from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    AggShiftKPI,
    CorrectiveAction,
    FactProcessRun,
    KPIDefinition,
    Observation,
    OperationalEvent,
    ProcessInstance,
    ProcessRun,
    TelemetryBinding,
)
from app.db.models import User
from app.models.enums import CorrectiveActionStatus, EventSource
from app.schemas.moi import (
    CorrectiveActionCreate,
    CorrectiveActionResponse,
    CorrectiveActionUpdate,
    ObservationCreate,
    ObservationResponse,
    OperationalEventCreate,
    OperationalEventResponse,
    TelemetryBindingResponse,
)
from app.services.process_run_service import ProcessRunService
from app.services.workflow_service import WorkflowService


class EventService:
    def __init__(self):
        self.workflow = WorkflowService()
        self.runs = ProcessRunService()

    async def ingest_events(
        self, session: AsyncSession, events: list[OperationalEventCreate], user: User | None = None
    ) -> list[OperationalEventResponse]:
        created = []
        for data in events:
            event = OperationalEvent(
                plant_id=data.plant_id,
                asset_id=data.asset_id,
                run_id=data.run_id,
                event_type=data.event_type,
                severity=data.severity,
                occurred_at=data.occurred_at,
                source=data.source,
                correlation_id=data.correlation_id,
                payload=data.payload,
            )
            session.add(event)
            await session.flush()

            if not event.run_id and event.asset_id:
                run = await self._match_active_run(session, event.asset_id)
                if run:
                    event.run_id = run.id

            if event.run_id:
                run = await session.get(ProcessRun, event.run_id)
                if run:
                    await self.workflow.try_auto_transition(session, run, event.event_type, user)
                    await self._apply_telemetry_binding(session, event, run)

            event.processed = True
            created.append(OperationalEventResponse.model_validate(event))
        return created

    async def _match_active_run(self, session: AsyncSession, asset_id: UUID) -> ProcessRun | None:
        result = await session.execute(
            select(ProcessRun)
            .join(ProcessInstance, ProcessRun.process_instance_id == ProcessInstance.id)
            .where(
                ProcessInstance.asset_id == asset_id,
                ProcessRun.current_state.notin_(["closed", "approved", "aborted"]),
            )
            .order_by(ProcessRun.created_at.desc())
        )
        return result.scalars().first()

    async def _apply_telemetry_binding(
        self, session: AsyncSession, event: OperationalEvent, run: ProcessRun
    ) -> None:
        if not event.asset_id:
            return
        result = await session.execute(
            select(TelemetryBinding).where(
                TelemetryBinding.asset_id == event.asset_id,
                TelemetryBinding.event_type == event.event_type,
            )
        )
        binding = result.scalar_one_or_none()
        if not binding:
            return
        from app.db.models import RunFieldValue
        from app.models.enums import ValueSource

        existing = await session.execute(
            select(RunFieldValue).where(
                RunFieldValue.run_id == run.id,
                RunFieldValue.field_key == binding.field_key,
            )
        )
        fv = existing.scalar_one_or_none()
        value = event.payload.get("value", event.payload)
        if fv:
            fv.value = value
            fv.source = ValueSource.TELEMETRY
        else:
            session.add(
                RunFieldValue(
                    run_id=run.id,
                    field_key=binding.field_key,
                    value=value,
                    source=ValueSource.TELEMETRY,
                )
            )

    async def list_run_events(self, session: AsyncSession, run_id: UUID) -> list[OperationalEventResponse]:
        result = await session.execute(
            select(OperationalEvent)
            .where(OperationalEvent.run_id == run_id)
            .order_by(OperationalEvent.occurred_at)
        )
        return [OperationalEventResponse.model_validate(e) for e in result.scalars()]

    async def list_bindings(self, session: AsyncSession, asset_id: UUID | None = None) -> list[TelemetryBindingResponse]:
        query = select(TelemetryBinding)
        if asset_id:
            query = query.where(TelemetryBinding.asset_id == asset_id)
        result = await session.execute(query)
        return [TelemetryBindingResponse.model_validate(b) for b in result.scalars()]


class ObservationService:
    async def create(
        self, session: AsyncSession, user: User, data: ObservationCreate
    ) -> ObservationResponse:
        obs = Observation(
            plant_id=data.plant_id,
            run_id=data.run_id,
            asset_id=data.asset_id,
            category=data.category,
            description=data.description,
            severity=data.severity,
            observed_by=user.id,
            observed_at=datetime.now(timezone.utc),
        )
        session.add(obs)
        await session.flush()
        return ObservationResponse.model_validate(obs)

    async def list_observations(
        self, session: AsyncSession, plant_id: UUID | None = None, status: str | None = None
    ) -> list[ObservationResponse]:
        query = select(Observation)
        if plant_id:
            query = query.where(Observation.plant_id == plant_id)
        if status:
            query = query.where(Observation.status == status)
        result = await session.execute(query.order_by(Observation.observed_at.desc()))
        return [ObservationResponse.model_validate(o) for o in result.scalars()]

    async def create_corrective_action(
        self, session: AsyncSession, user: User, observation_id: UUID, data: CorrectiveActionCreate
    ) -> CorrectiveActionResponse:
        obs = await session.get(Observation, observation_id)
        if not obs:
            raise HTTPException(status_code=404, detail="Observation not found")
        ca = CorrectiveAction(
            observation_id=observation_id,
            title=data.title,
            description=data.description,
            assigned_to=data.assigned_to,
            assigned_by=user.id,
            due_date=data.due_date,
            priority=data.priority,
        )
        session.add(ca)
        obs.status = "triaged"
        await session.flush()
        return CorrectiveActionResponse.model_validate(ca)

    async def update_corrective_action(
        self, session: AsyncSession, user: User, action_id: UUID, data: CorrectiveActionUpdate
    ) -> CorrectiveActionResponse:
        ca = await session.get(CorrectiveAction, action_id)
        if not ca:
            raise HTTPException(status_code=404, detail="Corrective action not found")
        if data.status:
            ca.status = data.status
            if data.status == CorrectiveActionStatus.CLOSED:
                if not data.closure_notes and not ca.closure_notes:
                    raise HTTPException(status_code=400, detail="Closure notes required")
                ca.closure_notes = data.closure_notes or ca.closure_notes
                ca.closed_at = datetime.now(timezone.utc)
                ca.closed_by = user.id
        if data.assigned_to:
            ca.assigned_to = data.assigned_to
        if data.due_date:
            ca.due_date = data.due_date
        await session.flush()
        return CorrectiveActionResponse.model_validate(ca)

    async def list_open_actions(self, session: AsyncSession, plant_id: UUID | None = None) -> list[CorrectiveActionResponse]:
        query = select(CorrectiveAction).where(
            CorrectiveAction.status.in_([CorrectiveActionStatus.OPEN, CorrectiveActionStatus.IN_PROGRESS])
        )
        if plant_id:
            query = query.join(Observation).where(Observation.plant_id == plant_id)
        result = await session.execute(query.order_by(CorrectiveAction.due_date))
        return [CorrectiveActionResponse.model_validate(a) for a in result.scalars()]


class AnalyticsService:
    async def refresh_shift_kpis(self, session: AsyncSession, plant_id: UUID, shift_id: UUID, shift_date) -> None:
        result = await session.execute(
            select(FactProcessRun).where(
                FactProcessRun.plant_id == plant_id,
                FactProcessRun.shift_code.isnot(None),
            )
        )
        facts = result.scalars().all()
        runs_completed = len(facts)
        tap_times = [f.tap_to_tap_min for f in facts if f.tap_to_tap_min]
        energy = [f.energy_kwh for f in facts if f.energy_kwh]

        existing = await session.execute(
            select(AggShiftKPI).where(
                AggShiftKPI.plant_id == plant_id,
                AggShiftKPI.shift_id == shift_id,
                AggShiftKPI.shift_date == shift_date,
            )
        )
        agg = existing.scalar_one_or_none()
        if not agg:
            agg = AggShiftKPI(plant_id=plant_id, shift_id=shift_id, shift_date=shift_date)
            session.add(agg)
        agg.runs_completed = runs_completed
        agg.avg_tap_to_tap_min = sum(tap_times) / len(tap_times) if tap_times else None
        agg.total_energy_kwh = sum(energy) if energy else None
        await session.flush()

    async def list_kpi_definitions(self, session: AsyncSession) -> list:
        from app.schemas.moi import KPIDefinitionResponse

        result = await session.execute(select(KPIDefinition))
        return [KPIDefinitionResponse.model_validate(k) for k in result.scalars()]

    async def dashboard_metrics(self, session: AsyncSession) -> dict:
        from app.db.models import Organisation, Plant

        orgs = await session.execute(select(func.count()).select_from(Organisation))
        plants = await session.execute(select(func.count()).select_from(Plant))
        active = await session.execute(
            select(func.count())
            .select_from(ProcessRun)
            .where(ProcessRun.current_state.notin_(["closed", "approved", "aborted"]))
        )
        open_obs = await session.execute(
            select(func.count()).select_from(Observation).where(Observation.status == "open")
        )
        open_ca = await session.execute(
            select(func.count())
            .select_from(CorrectiveAction)
            .where(CorrectiveAction.status.in_([CorrectiveActionStatus.OPEN, CorrectiveActionStatus.IN_PROGRESS]))
        )
        return {
            "total_organisations": orgs.scalar() or 0,
            "total_plants": plants.scalar() or 0,
            "active_runs": active.scalar() or 0,
            "open_observations": open_obs.scalar() or 0,
            "open_corrective_actions": open_ca.scalar() or 0,
        }
