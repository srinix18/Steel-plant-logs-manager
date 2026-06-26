from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    MaintenanceDowntimeRecord,
    MaintenanceProgram,
    MaintenanceWorkOrder,
    User,
)
from app.models.enums import MaintenanceProgramStatus, MaintenanceWorkOrderStatus
from app.schemas.maintenance_pm import MaintenanceAnalyticsResponse
from app.services.access_scope import can_view_pm_dashboard

_CLOSED_STATES = {
    MaintenanceWorkOrderStatus.COMPLETED.value,
    MaintenanceWorkOrderStatus.VERIFIED.value,
    MaintenanceWorkOrderStatus.CLOSED.value,
}


class MaintenanceAnalyticsService:
    def _org_id(self, actor: User) -> UUID:
        if not actor.organisation_id:
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="User has no organisation")
        return actor.organisation_id

    async def get_analytics(
        self,
        session: AsyncSession,
        actor: User,
        *,
        plant_id: UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> MaintenanceAnalyticsResponse:
        if not can_view_pm_dashboard(actor):
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="Access denied")

        org_id = self._org_id(actor)
        now = datetime.now(timezone.utc)

        wo_query = select(MaintenanceWorkOrder).where(
            MaintenanceWorkOrder.organisation_id == org_id
        )
        if plant_id:
            wo_query = wo_query.where(MaintenanceWorkOrder.plant_id == plant_id)
        if from_date:
            wo_query = wo_query.where(
                MaintenanceWorkOrder.created_at >= datetime.combine(from_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            )
        if to_date:
            wo_query = wo_query.where(
                MaintenanceWorkOrder.created_at <= datetime.combine(to_date, datetime.max.time()).replace(tzinfo=timezone.utc)
            )

        result = await session.execute(wo_query)
        work_orders = list(result.scalars())

        open_wo = sum(
            1
            for wo in work_orders
            if wo.status not in _CLOSED_STATES
        )
        overdue = sum(
            1
            for wo in work_orders
            if wo.due_at and wo.due_at < now and wo.status not in _CLOSED_STATES
        )
        completed = sum(1 for wo in work_orders if wo.status in _CLOSED_STATES)

        repair_durations: list[float] = []
        for wo in work_orders:
            if wo.started_at and wo.completed_at:
                hours = (wo.completed_at - wo.started_at).total_seconds() / 3600.0
                repair_durations.append(hours)

        mttr = sum(repair_durations) / len(repair_durations) if repair_durations else None

        breakdown_count = sum(
            1 for wo in work_orders if wo.source_issue_id is not None
        )
        operating_hours = max(1.0, len(work_orders) * 24.0)
        mtbf = operating_hours / breakdown_count if breakdown_count > 0 else None

        prog_query = select(func.count()).select_from(MaintenanceProgram).where(
            MaintenanceProgram.organisation_id == org_id,
            MaintenanceProgram.status == MaintenanceProgramStatus.ACTIVE.value,
        )
        if plant_id:
            prog_query = prog_query.where(MaintenanceProgram.plant_id == plant_id)
        active_programs = int((await session.execute(prog_query)).scalar() or 0)

        pm_generated = sum(1 for wo in work_orders if wo.program_id is not None)
        pm_compliance = (
            (pm_generated / active_programs * 100.0) if active_programs > 0 else None
        )

        dt_query = (
            select(func.coalesce(func.sum(MaintenanceDowntimeRecord.duration_min), 0))
            .join(MaintenanceWorkOrder, MaintenanceDowntimeRecord.work_order_id == MaintenanceWorkOrder.id)
            .where(MaintenanceWorkOrder.organisation_id == org_id)
        )
        if plant_id:
            dt_query = dt_query.where(MaintenanceWorkOrder.plant_id == plant_id)
        total_downtime = float((await session.execute(dt_query)).scalar() or 0)

        return MaintenanceAnalyticsResponse(
            plant_id=plant_id,
            from_date=from_date,
            to_date=to_date,
            mtbf_hours=round(mtbf, 2) if mtbf is not None else None,
            mttr_hours=round(mttr, 2) if mttr is not None else None,
            pm_compliance_pct=round(pm_compliance, 1) if pm_compliance is not None else None,
            open_work_orders=open_wo,
            overdue_work_orders=overdue,
            completed_work_orders=completed,
            total_downtime_min=total_downtime,
            kpis={
                "active_programs": active_programs,
                "pm_work_orders": pm_generated,
                "breakdown_work_orders": breakdown_count,
                "avg_repair_hours": round(mttr, 2) if mttr is not None else None,
            },
        )
