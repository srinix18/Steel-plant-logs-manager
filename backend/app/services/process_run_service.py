from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Department,
    FactProcessRun,
    MLFeatureSnapshot,
    Plant,
    Process,
    ProcessInstance,
    ProcessRun,
    RunFieldValue,
    RunSectionData,
    TemplateField,
    TemplateSection,
    TemplateVersion,
    WorkflowDefinition,
    WorkflowState,
)
from app.db.models import User
from app.models.enums import TemplateVersionStatus, UserRole, ValueSource
from app.schemas.moi import (
    ProcessRunCreate,
    ProcessRunDetailResponse,
    ProcessRunResponse,
    ProcessRunUpdate,
    RunFieldValueResponse,
    RunSectionDataResponse,
)
from app.services.run_defaults_service import seed_default_field_values
from app.services.workflow_service import WorkflowService
from app.services.access_scope import (
    apply_run_query_scope,
    assert_can_create_run,
    assert_run_access,
    is_platform_admin,
    is_supervisor_only,
    is_worker,
    needs_run_join_for_scope,
)
from app.utils.formulas import apply_calculated_fields, collect_calculated_fields


def _optional_float(value: object) -> float | None:
    """Parse analytics numerics; blank / invalid field values become None."""
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _to_run_response(run: ProcessRun) -> ProcessRunResponse:
    return ProcessRunResponse(
        id=run.id,
        run_number=run.run_number,
        run_type=run.run_type,
        process_id=run.process_id,
        process_instance_id=run.process_instance_id,
        template_version_id=run.template_version_id,
        workflow_definition_id=run.workflow_definition_id,
        current_state=run.current_state,
        shift_id=run.shift_id,
        grade_id=run.grade_id,
        primary_asset_id=run.primary_asset_id,
        started_at=run.started_at,
        completed_at=run.completed_at,
        closed_at=run.closed_at,
        created_by=run.created_by,
        outcome=run.outcome.value if run.outcome else None,
        metadata=run.metadata_ or {},
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


class ProcessRunService:
    def __init__(self):
        self.workflow = WorkflowService()

    def _runs_query_with_joins(self):
        return (
            select(ProcessRun)
            .join(ProcessInstance, ProcessRun.process_instance_id == ProcessInstance.id)
            .join(Process, ProcessInstance.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .join(Plant, Department.plant_id == Plant.id)
        )

    async def _assert_run_access(
        self, session: AsyncSession, run: ProcessRun, user: User, *, write: bool = False
    ) -> None:
        await assert_run_access(session, run, user, write=write)

    async def _assert_run_editable(self, session: AsyncSession, run: ProcessRun) -> None:
        state = (
            await session.execute(
                select(WorkflowState).where(
                    WorkflowState.definition_id == run.workflow_definition_id,
                    WorkflowState.key == run.current_state,
                )
            )
        ).scalar_one_or_none()
        # Approved = signed off; only remarks may be added from here on.
        if run.current_state == "approved" or (state and state.is_terminal):
            raise HTTPException(status_code=409, detail=f"Run is {run.current_state} and can no longer be edited")

    async def _load_template_field_meta(
        self, session: AsyncSession, version_id: UUID
    ) -> tuple[list[tuple[str, str]], dict[str, str]]:
        result = await session.execute(
            select(TemplateSection)
            .where(TemplateSection.version_id == version_id)
            .options(selectinload(TemplateSection.fields))
        )
        sections = result.scalars().all()
        calculated = collect_calculated_fields(sections)
        field_types: dict[str, str] = {}
        for section in sections:
            for field in section.fields:
                field_types[field.name] = field.field_type.value if hasattr(field.field_type, "value") else str(field.field_type)
        return calculated, field_types

    async def _sync_calculated_fields(self, session: AsyncSession, run: ProcessRun) -> None:
        calculated, field_types = await self._load_template_field_meta(session, run.template_version_id)
        if not calculated:
            return
        result = await session.execute(select(RunFieldValue).where(RunFieldValue.run_id == run.id))
        field_map: dict = {}
        for fv in result.scalars():
            field_map[fv.field_key] = fv.value
        updates = apply_calculated_fields(field_map, field_types, calculated)
        for key, value in updates.items():
            existing = await session.execute(
                select(RunFieldValue).where(RunFieldValue.run_id == run.id, RunFieldValue.field_key == key)
            )
            fv = existing.scalar_one_or_none()
            if fv:
                fv.value = value
                fv.source = ValueSource.SYSTEM
            else:
                session.add(
                    RunFieldValue(
                        run_id=run.id,
                        field_key=key,
                        value=value,
                        source=ValueSource.SYSTEM,
                    )
                )

    async def _resolve_template_version(
        self, session: AsyncSession, instance: ProcessInstance
    ) -> tuple[TemplateVersion, WorkflowDefinition]:
        template_id = instance.template_id
        if not template_id:
            process = await session.get(Process, instance.process_id)
            if process and process.default_template_id:
                template_id = process.default_template_id
        if not template_id:
            raise HTTPException(status_code=400, detail="No template configured for this process instance")

        today = date.today()
        result = await session.execute(
            select(TemplateVersion)
            .where(
                TemplateVersion.template_id == template_id,
                TemplateVersion.status == TemplateVersionStatus.PUBLISHED,
                TemplateVersion.effective_from <= today,
            )
            .where((TemplateVersion.effective_to.is_(None)) | (TemplateVersion.effective_to > today))
            .order_by(TemplateVersion.effective_from.desc())
            .options(selectinload(TemplateVersion.workflow_definition))
        )
        version = result.scalars().first()
        if not version or not version.workflow_definition:
            raise HTTPException(status_code=400, detail="No published template version with workflow")
        return version, version.workflow_definition

    async def create_run(
        self,
        session: AsyncSession,
        instance_id: UUID,
        user: User,
        data: ProcessRunCreate,
    ) -> ProcessRunDetailResponse:
        # Row lock serialises concurrent creates on this instance so run numbers stay unique.
        instance = await session.get(ProcessInstance, instance_id, with_for_update=True)
        if not instance:
            raise HTTPException(status_code=404, detail="Process instance not found")

        await assert_can_create_run(session, instance, user)

        version, workflow = await self._resolve_template_version(session, instance)

        count_result = await session.execute(
            select(func.count()).select_from(ProcessRun).where(ProcessRun.process_instance_id == instance_id)
        )
        count = count_result.scalar() or 0
        run_number = data.run_number or f"H-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{count + 1:04d}"

        run = ProcessRun(
            run_number=run_number,
            run_type=data.run_type,
            process_id=instance.process_id,
            process_instance_id=instance_id,
            template_version_id=version.id,
            workflow_definition_id=workflow.id,
            current_state=workflow.initial_state,
            shift_id=data.shift_id,
            grade_id=data.grade_id,
            primary_asset_id=instance.asset_id,
            created_by=user.id,
            metadata_=data.metadata,
        )
        session.add(run)
        await session.flush()
        await seed_default_field_values(session, run, user)
        await session.flush()
        return await self.get_run(session, run.id, user)

    async def get_run(self, session: AsyncSession, run_id: UUID, user: User) -> ProcessRunDetailResponse:
        result = await session.execute(
            select(ProcessRun)
            .where(ProcessRun.id == run_id)
            .options(
                selectinload(ProcessRun.field_values),
                selectinload(ProcessRun.section_data),
            )
        )
        run = result.scalar_one_or_none()
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")

        await self._assert_run_access(session, run, user)

        workflow_status = await self.workflow.get_status(session, run, user)
        return ProcessRunDetailResponse(
            **_to_run_response(run).model_dump(),
            field_values=[
                RunFieldValueResponse(
                    field_key=fv.field_key,
                    value=fv.value,
                    source=fv.source.value,
                )
                for fv in run.field_values
            ],
            section_data=[RunSectionDataResponse.model_validate(sd) for sd in run.section_data],
            workflow=workflow_status,
        )

    async def list_runs(
        self,
        session: AsyncSession,
        user: User | None = None,
        *,
        instance_id: UUID | None = None,
        plant_id: UUID | None = None,
        organisation_id: UUID | None = None,
        department_id: UUID | None = None,
        process_id: UUID | None = None,
        process_code: str | None = None,
    state: str | None = None,
    active_only: bool = False,
    created_by: UUID | None = None,
) -> list[ProcessRunResponse]:
        needs_join = (
            plant_id
            or organisation_id
            or department_id
            or process_id
            or process_code
            or (user and needs_run_join_for_scope(user))
        )
        if needs_join:
            query = self._runs_query_with_joins()
        else:
            query = select(ProcessRun)

        if user:
            query = apply_run_query_scope(query, user)
            if is_worker(user) and not created_by:
                query = query.where(ProcessRun.created_by == user.id)

        if plant_id:
            query = query.where(Department.plant_id == plant_id)
        if organisation_id:
            query = query.where(Plant.organisation_id == organisation_id)
        if department_id:
            query = query.where(Department.id == department_id)
        if process_id:
            query = query.where(Process.id == process_id)
        if process_code:
            query = query.where(Process.code == process_code)
        if instance_id:
            query = query.where(ProcessRun.process_instance_id == instance_id)
        if state:
            query = query.where(ProcessRun.current_state == state)
        if active_only:
            query = query.where(ProcessRun.current_state.notin_(["closed", "approved", "aborted"]))
        if created_by:
            query = query.where(ProcessRun.created_by == created_by)

        result = await session.execute(query.order_by(ProcessRun.created_at.desc()))
        runs = result.scalars().unique().all()
        return [_to_run_response(r) for r in runs]

    async def update_run(
        self, session: AsyncSession, run_id: UUID, user: User, data: ProcessRunUpdate
    ) -> ProcessRunDetailResponse:
        run = await session.get(ProcessRun, run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Process run not found")

        await self._assert_run_access(session, run, user, write=True)
        await self._assert_run_editable(session, run)

        if data.metadata is not None:
            run.metadata_ = data.metadata

        if data.field_values:
            for item in data.field_values:
                existing = await session.execute(
                    select(RunFieldValue).where(
                        RunFieldValue.run_id == run_id,
                        RunFieldValue.field_key == item.field_key,
                    )
                )
                fv = existing.scalar_one_or_none()
                if fv:
                    fv.value = item.value
                    if item.field_id:
                        fv.field_id = item.field_id
                else:
                    session.add(
                        RunFieldValue(
                            run_id=run_id,
                            field_id=item.field_id,
                            field_key=item.field_key,
                            value=item.value,
                            source=ValueSource.MANUAL,
                        )
                    )

        if data.section_data:
            from app.db.models import Department, Process
            from app.services.coil_service import CoilService
            from app.services.delay_event_service import DelayEventService

            delay_service = DelayEventService()
            coil_service = CoilService()
            for item in data.section_data:
                existing = await session.execute(
                    select(RunSectionData).where(
                        RunSectionData.run_id == run_id,
                        RunSectionData.section_key == item.section_key,
                    )
                )
                sd = existing.scalar_one_or_none()
                if sd:
                    sd.data = item.data
                else:
                    session.add(
                        RunSectionData(run_id=run_id, section_key=item.section_key, data=item.data)
                    )
                process = await session.get(Process, run.process_id)
                plant_id = None
                dept_id = None
                if process:
                    dept = await session.get(Department, process.department_id)
                    if dept:
                        plant_id = dept.plant_id
                        dept_id = dept.id
                if item.section_key == "delay_register" and plant_id:
                    await delay_service.sync_delay_register(
                        session, user, run_id, plant_id, item.data
                    )
                if item.section_key == "input_coils" and plant_id and dept_id:
                    await coil_service.upsert_coils_from_input_register(
                        session, run_id, plant_id, dept_id, user.id, item.data
                    )
                if item.section_key == "furnace_output" and plant_id:
                    await coil_service.sync_furnace_output(session, plant_id, item.data)
                if item.section_key == "input_material" and plant_id:
                    await coil_service.sync_drawing_input(session, plant_id, item.data)
                if item.section_key == "output_material" and plant_id and dept_id:
                    await coil_service.sync_drawing_output(
                        session, run_id, plant_id, dept_id, user.id, item.data
                    )

        if data.field_values or data.section_data:
            await self._sync_calculated_fields(session, run)

        await session.flush()
        return await self.get_run(session, run_id, user)

    async def compute_analytics_facts(self, session: AsyncSession, run_id: UUID) -> None:
        run = await session.get(ProcessRun, run_id)
        if not run:
            return

        field_map = {}
        result = await session.execute(select(RunFieldValue).where(RunFieldValue.run_id == run_id))
        for fv in result.scalars():
            field_map[fv.field_key] = fv.value

        section_map = {}
        result = await session.execute(select(RunSectionData).where(RunSectionData.run_id == run_id))
        for sd in result.scalars():
            section_map[sd.section_key] = sd.data

        duration_min = None
        if run.started_at and run.completed_at:
            duration_min = (run.completed_at - run.started_at).total_seconds() / 60

        energy = field_map.get("power_total")
        charge_kg = None
        if "charge_mix" in section_map:
            charge_data = section_map["charge_mix"]
            if isinstance(charge_data, list):
                charge_kg = sum(row.get("quantity_kg", 0) or 0 for row in charge_data)
            elif isinstance(charge_data, dict) and isinstance(charge_data.get("rows"), list):
                charge_kg = sum(row.get("quantity_kg", 0) or 0 for row in charge_data["rows"])
        alloy_kg = None
        if "ferro_alloys" in section_map:
            alloy_data = section_map["ferro_alloys"]
            if isinstance(alloy_data, list):
                alloy_kg = sum(row.get("quantity_kg", 0) or 0 for row in alloy_data)
            elif isinstance(alloy_data, dict) and isinstance(alloy_data.get("rows"), list):
                alloy_kg = sum(row.get("quantity_kg", 0) or 0 for row in alloy_data["rows"])

        instance = await session.get(ProcessInstance, run.process_instance_id)
        from app.db.models import Department

        process = await session.get(Process, run.process_id)
        plant_id = None
        if process:
            dept = await session.get(Department, process.department_id)
            plant_id = dept.plant_id if dept else None

        existing = await session.execute(select(FactProcessRun).where(FactProcessRun.run_id == run_id))
        fact = existing.scalar_one_or_none()
        if not fact:
            fact = FactProcessRun(run_id=run_id, plant_id=plant_id, process_instance_id=run.process_instance_id, run_type=run.run_type.value)
            session.add(fact)

        fact.duration_min = duration_min
        fact.energy_kwh = _optional_float(energy)
        fact.charge_kg = charge_kg
        fact.alloy_kg = alloy_kg
        fact.outcome = run.outcome.value if run.outcome else None

        snapshot = await session.execute(select(MLFeatureSnapshot).where(MLFeatureSnapshot.run_id == run_id))
        ml = snapshot.scalar_one_or_none()
        if not ml:
            ml = MLFeatureSnapshot(run_id=run_id)
            session.add(ml)
        ml.feature_vector = {
            "duration_min": duration_min,
            "energy_kwh": fact.energy_kwh,
            "charge_kg": charge_kg,
            "alloy_kg": alloy_kg,
            "run_type": run.run_type.value,
            "grade_id": str(run.grade_id) if run.grade_id else None,
        }
        await session.flush()
