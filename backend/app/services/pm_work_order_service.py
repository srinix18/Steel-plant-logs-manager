from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    MaintenanceDowntimeRecord,
    MaintenanceProgram,
    MaintenanceTaskTemplate,
    MaintenanceWorkOrder,
    MaintenanceWorkOrderPart,
    MaintenanceWorkOrderTask,
    MaintenanceWorkOrderTransition,
    User,
)
from app.models.enums import MaintenanceTaskExecutionStatus, MaintenanceWorkOrderStatus
from app.schemas.maintenance_pm import (
    MaintenanceDowntimeCreate,
    MaintenanceDowntimeResponse,
    MaintenanceDowntimeUpdate,
    MaintenanceWorkOrderCreate,
    MaintenanceWorkOrderPartCreate,
    MaintenanceWorkOrderPartResponse,
    MaintenanceWorkOrderPartUpdate,
    MaintenanceWorkOrderResponse,
    MaintenanceWorkOrderTaskExecute,
    MaintenanceWorkOrderTaskResponse,
    MaintenanceWorkOrderTransitionCreate,
    MaintenanceWorkOrderTransitionResponse,
    MaintenanceWorkOrderUpdate,
)
from app.services.access_scope import assert_work_order_access, can_execute_work_orders, can_view_pm_dashboard

_VALID_TRANSITIONS: dict[str, set[str]] = {
    MaintenanceWorkOrderStatus.DRAFT.value: {
        MaintenanceWorkOrderStatus.ASSIGNED.value,
    },
    MaintenanceWorkOrderStatus.ASSIGNED.value: {
        MaintenanceWorkOrderStatus.ACCEPTED.value,
        MaintenanceWorkOrderStatus.DRAFT.value,
    },
    MaintenanceWorkOrderStatus.ACCEPTED.value: {
        MaintenanceWorkOrderStatus.IN_PROGRESS.value,
    },
    MaintenanceWorkOrderStatus.IN_PROGRESS.value: {
        MaintenanceWorkOrderStatus.WAITING_SHUTDOWN.value,
        MaintenanceWorkOrderStatus.WAITING_PARTS.value,
        MaintenanceWorkOrderStatus.COMPLETED.value,
    },
    MaintenanceWorkOrderStatus.WAITING_SHUTDOWN.value: {
        MaintenanceWorkOrderStatus.IN_PROGRESS.value,
        MaintenanceWorkOrderStatus.COMPLETED.value,
    },
    MaintenanceWorkOrderStatus.WAITING_PARTS.value: {
        MaintenanceWorkOrderStatus.IN_PROGRESS.value,
    },
    MaintenanceWorkOrderStatus.COMPLETED.value: {
        MaintenanceWorkOrderStatus.VERIFIED.value,
        MaintenanceWorkOrderStatus.IN_PROGRESS.value,
    },
    MaintenanceWorkOrderStatus.VERIFIED.value: {
        MaintenanceWorkOrderStatus.CLOSED.value,
    },
}


class PmWorkOrderService:
    def _org_id(self, actor: User) -> UUID:
        if not actor.organisation_id:
            raise HTTPException(status_code=400, detail="User has no organisation")
        return actor.organisation_id

    async def _next_wo_number(self, session: AsyncSession, plant_id: UUID) -> str:
        year = datetime.now(timezone.utc).year
        prefix = f"PM-{year}-"
        result = await session.execute(
            select(func.count())
            .select_from(MaintenanceWorkOrder)
            .where(
                MaintenanceWorkOrder.plant_id == plant_id,
                MaintenanceWorkOrder.wo_number.like(f"{prefix}%"),
            )
        )
        seq = int(result.scalar() or 0) + 1
        return f"{prefix}{seq:05d}"

    @staticmethod
    def _wo_load_options():
        return (
            selectinload(MaintenanceWorkOrder.tasks),
            selectinload(MaintenanceWorkOrder.parts),
            selectinload(MaintenanceWorkOrder.transitions),
            selectinload(MaintenanceWorkOrder.downtime_records),
        )

    def _wo_response(self, wo: MaintenanceWorkOrder) -> MaintenanceWorkOrderResponse:
        return MaintenanceWorkOrderResponse(
            id=wo.id,
            organisation_id=wo.organisation_id,
            plant_id=wo.plant_id,
            program_id=wo.program_id,
            asset_id=wo.asset_id,
            department_id=wo.department_id,
            source_issue_id=wo.source_issue_id,
            wo_number=wo.wo_number,
            title=wo.title,
            status=wo.status,
            assigned_team=wo.assigned_team,
            assigned_to=wo.assigned_to,
            scheduled_at=wo.scheduled_at,
            due_at=wo.due_at,
            started_at=wo.started_at,
            completed_at=wo.completed_at,
            verified_at=wo.verified_at,
            closed_at=wo.closed_at,
            estimated_duration_min=wo.estimated_duration_min,
            created_at=wo.created_at,
            updated_at=wo.updated_at,
            tasks=[MaintenanceWorkOrderTaskResponse.model_validate(t) for t in wo.tasks],
            parts=[MaintenanceWorkOrderPartResponse.model_validate(p) for p in wo.parts],
            transitions=[
                MaintenanceWorkOrderTransitionResponse.model_validate(tr) for tr in wo.transitions
            ],
            downtime_records=[
                MaintenanceDowntimeResponse.model_validate(d) for d in wo.downtime_records
            ],
        )

    async def _load_wo(
        self, session: AsyncSession, actor: User, wo_id: UUID
    ) -> MaintenanceWorkOrder:
        result = await session.execute(
            select(MaintenanceWorkOrder)
            .where(MaintenanceWorkOrder.id == wo_id)
            .options(*self._wo_load_options())
        )
        wo = result.scalar_one_or_none()
        if not wo or wo.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Work order not found")
        return wo

    async def list_work_orders(
        self,
        session: AsyncSession,
        actor: User,
        *,
        plant_id: UUID | None = None,
        status: str | None = None,
        asset_id: UUID | None = None,
    ) -> list[MaintenanceWorkOrderResponse]:
        if not can_view_pm_dashboard(actor):
            raise HTTPException(status_code=403, detail="Access denied")
        query = select(MaintenanceWorkOrder).where(
            MaintenanceWorkOrder.organisation_id == self._org_id(actor)
        )
        if plant_id:
            query = query.where(MaintenanceWorkOrder.plant_id == plant_id)
        if status:
            query = query.where(MaintenanceWorkOrder.status == status)
        if asset_id:
            query = query.where(MaintenanceWorkOrder.asset_id == asset_id)
        result = await session.execute(
            query.options(*self._wo_load_options()).order_by(MaintenanceWorkOrder.created_at.desc())
        )
        return [self._wo_response(wo) for wo in result.scalars()]

    async def get_work_order(
        self, session: AsyncSession, actor: User, wo_id: UUID
    ) -> MaintenanceWorkOrderResponse:
        wo = await self._load_wo(session, actor, wo_id)
        return self._wo_response(wo)

    async def create_work_order(
        self, session: AsyncSession, actor: User, data: MaintenanceWorkOrderCreate
    ) -> MaintenanceWorkOrderResponse:
        assert_work_order_access(actor)
        wo_number = await self._next_wo_number(session, data.plant_id)
        wo = MaintenanceWorkOrder(
            organisation_id=self._org_id(actor),
            wo_number=wo_number,
            status=MaintenanceWorkOrderStatus.DRAFT.value,
            **data.model_dump(),
        )
        session.add(wo)
        await session.flush()
        await self._record_transition(
            session, wo, None, MaintenanceWorkOrderStatus.DRAFT.value, actor.id, "Created"
        )
        return self._wo_response(await self._load_wo(session, actor, wo.id))

    async def update_work_order(
        self, session: AsyncSession, actor: User, wo_id: UUID, data: MaintenanceWorkOrderUpdate
    ) -> MaintenanceWorkOrderResponse:
        assert_work_order_access(actor)
        wo = await self._load_wo(session, actor, wo_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(wo, field, value)
        await session.flush()
        return self._wo_response(await self._load_wo(session, actor, wo_id))

    async def generate_from_program(
        self, session: AsyncSession, actor: User, program_id: UUID
    ) -> MaintenanceWorkOrderResponse:
        assert_work_order_access(actor)
        program = await session.execute(
            select(MaintenanceProgram)
            .where(MaintenanceProgram.id == program_id)
            .options(selectinload(MaintenanceProgram.task_templates))
        )
        prog = program.scalar_one_or_none()
        if not prog or prog.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Program not found")

        wo_number = await self._next_wo_number(session, prog.plant_id)
        wo = MaintenanceWorkOrder(
            organisation_id=prog.organisation_id,
            plant_id=prog.plant_id,
            program_id=prog.id,
            asset_id=prog.asset_id,
            department_id=prog.department_id,
            wo_number=wo_number,
            title=f"PM: {prog.name}",
            status=MaintenanceWorkOrderStatus.DRAFT.value,
            assigned_team=prog.responsible_team,
            estimated_duration_min=prog.estimated_duration_min,
        )
        session.add(wo)
        await session.flush()

        for tmpl in sorted(prog.task_templates, key=lambda t: t.sort_order):
            session.add(
                MaintenanceWorkOrderTask(
                    work_order_id=wo.id,
                    template_id=tmpl.id,
                    name=tmpl.name,
                    status=MaintenanceTaskExecutionStatus.PENDING.value,
                    sort_order=tmpl.sort_order,
                )
            )

        await self._record_transition(
            session, wo, None, MaintenanceWorkOrderStatus.DRAFT.value, actor.id, "Generated from program"
        )
        await session.flush()
        return self._wo_response(await self._load_wo(session, actor, wo.id))

    async def _record_transition(
        self,
        session: AsyncSession,
        wo: MaintenanceWorkOrder,
        from_state: str | None,
        to_state: str,
        actor_id: UUID,
        notes: str | None = None,
    ) -> MaintenanceWorkOrderTransition:
        tr = MaintenanceWorkOrderTransition(
            work_order_id=wo.id,
            from_state=from_state,
            to_state=to_state,
            actor_id=actor_id,
            notes=notes,
        )
        session.add(tr)
        wo.status = to_state
        now = datetime.now(timezone.utc)
        if to_state == MaintenanceWorkOrderStatus.IN_PROGRESS.value and not wo.started_at:
            wo.started_at = now
        elif to_state == MaintenanceWorkOrderStatus.COMPLETED.value:
            wo.completed_at = now
        elif to_state == MaintenanceWorkOrderStatus.VERIFIED.value:
            wo.verified_at = now
        elif to_state == MaintenanceWorkOrderStatus.CLOSED.value:
            wo.closed_at = now
        return tr

    async def transition(
        self,
        session: AsyncSession,
        actor: User,
        wo_id: UUID,
        data: MaintenanceWorkOrderTransitionCreate,
    ) -> MaintenanceWorkOrderResponse:
        assert_work_order_access(actor)
        wo = await self._load_wo(session, actor, wo_id)
        to_state = data.to_state.value
        allowed = _VALID_TRANSITIONS.get(wo.status, set())
        if to_state not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from {wo.status} to {to_state}",
            )
        await self._record_transition(session, wo, wo.status, to_state, actor.id, data.notes)
        await session.flush()
        return self._wo_response(await self._load_wo(session, actor, wo_id))

    async def execute_task(
        self,
        session: AsyncSession,
        actor: User,
        wo_id: UUID,
        task_id: UUID,
        data: MaintenanceWorkOrderTaskExecute,
    ) -> MaintenanceWorkOrderTaskResponse:
        if not can_execute_work_orders(actor):
            raise HTTPException(status_code=403, detail="Not permitted")
        wo = await self._load_wo(session, actor, wo_id)
        task = next((t for t in wo.tasks if t.id == task_id), None)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        task.status = data.status.value
        if data.checklist_responses is not None:
            task.checklist_responses = data.checklist_responses
        if data.photos is not None:
            task.photos = data.photos
        if data.remarks is not None:
            task.remarks = data.remarks
        if data.time_spent_min is not None:
            task.time_spent_min = data.time_spent_min
        await session.flush()
        return MaintenanceWorkOrderTaskResponse.model_validate(task)

    async def add_part(
        self, session: AsyncSession, actor: User, wo_id: UUID, data: MaintenanceWorkOrderPartCreate
    ) -> MaintenanceWorkOrderPartResponse:
        assert_work_order_access(actor)
        await self._load_wo(session, actor, wo_id)
        total = data.quantity * data.unit_cost
        part = MaintenanceWorkOrderPart(
            work_order_id=wo_id,
            part_name=data.part_name,
            material_id=data.material_id,
            quantity=data.quantity,
            unit_cost=data.unit_cost,
            total_cost=total,
        )
        session.add(part)
        await session.flush()
        return MaintenanceWorkOrderPartResponse.model_validate(part)

    async def update_part(
        self,
        session: AsyncSession,
        actor: User,
        wo_id: UUID,
        part_id: UUID,
        data: MaintenanceWorkOrderPartUpdate,
    ) -> MaintenanceWorkOrderPartResponse:
        assert_work_order_access(actor)
        await self._load_wo(session, actor, wo_id)
        part = await session.get(MaintenanceWorkOrderPart, part_id)
        if not part or part.work_order_id != wo_id:
            raise HTTPException(status_code=404, detail="Part not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(part, field, value)
        part.total_cost = part.quantity * part.unit_cost
        await session.flush()
        return MaintenanceWorkOrderPartResponse.model_validate(part)

    async def remove_part(
        self, session: AsyncSession, actor: User, wo_id: UUID, part_id: UUID
    ) -> None:
        assert_work_order_access(actor)
        part = await session.get(MaintenanceWorkOrderPart, part_id)
        if not part or part.work_order_id != wo_id:
            raise HTTPException(status_code=404, detail="Part not found")
        await session.delete(part)

    async def add_downtime(
        self, session: AsyncSession, actor: User, wo_id: UUID, data: MaintenanceDowntimeCreate
    ) -> MaintenanceDowntimeResponse:
        assert_work_order_access(actor)
        await self._load_wo(session, actor, wo_id)
        duration = None
        if data.ended_at:
            duration = (data.ended_at - data.started_at).total_seconds() / 60.0
        record = MaintenanceDowntimeRecord(
            work_order_id=wo_id,
            asset_id=data.asset_id,
            started_at=data.started_at,
            ended_at=data.ended_at,
            duration_min=duration,
            reason=data.reason,
            downtime_type=data.downtime_type.value,
        )
        session.add(record)
        await session.flush()
        return MaintenanceDowntimeResponse.model_validate(record)

    async def update_downtime(
        self,
        session: AsyncSession,
        actor: User,
        wo_id: UUID,
        downtime_id: UUID,
        data: MaintenanceDowntimeUpdate,
    ) -> MaintenanceDowntimeResponse:
        assert_work_order_access(actor)
        record = await session.get(MaintenanceDowntimeRecord, downtime_id)
        if not record or record.work_order_id != wo_id:
            raise HTTPException(status_code=404, detail="Downtime record not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "downtime_type" and value is not None:
                value = value.value
            setattr(record, field, value)
        if record.ended_at:
            record.duration_min = (record.ended_at - record.started_at).total_seconds() / 60.0
        await session.flush()
        return MaintenanceDowntimeResponse.model_validate(record)
