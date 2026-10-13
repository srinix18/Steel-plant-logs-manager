"""Live figures for the pulse screens, plus a refresh that follows real changes.

The pulse tables are snapshots taken every 5 minutes. Counts people act on right away (attendance, open
issues, pending work orders) are read live here instead, and any write that can move the heavier figures
(OEE, production, cost) schedules a snapshot refresh a few seconds later, so the dashboards follow the data.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AttendanceRecord,
    Asset,
    Department,
    MaintenanceIssue,
    MaintenanceWorkOrder,
    FactProcessRun,
    Process,
    ProcessRun,
    User,
)
from app.models.enums import AttendanceStatus, MaintenanceWorkOrderStatus

log = logging.getLogger("pulse_live")

IST = timezone(timedelta(hours=5, minutes=30))
CLOSED_WORK_ORDER = {
    MaintenanceWorkOrderStatus.COMPLETED.value,
    MaintenanceWorkOrderStatus.VERIFIED.value,
    MaintenanceWorkOrderStatus.CLOSED.value,
}


def plant_today() -> date:
    """The plant's calendar day (IST), which is what attendance dates are entered in."""
    return datetime.now(IST).date()


def day_start_utc() -> datetime:
    """Midnight IST today, as a UTC instant: the start of 'today' for production, cost and OEE."""
    midnight = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.astimezone(timezone.utc)


async def attendance_summary(session: AsyncSession, department_ids: list[UUID]) -> dict:
    """Today's attendance for some departments. Half-days count as half a person; everyone marked is in the base."""
    if not department_ids:
        return {"present": 0, "half_day": 0, "absent": 0, "leave": 0, "marked": 0, "pct": None}
    rows = await session.execute(
        select(AttendanceRecord.status, func.count())
        .where(AttendanceRecord.attendance_date == plant_today(), AttendanceRecord.department_id.in_(department_ids))
        .group_by(AttendanceRecord.status)
    )
    counts = {str(getattr(s, "value", s)).lower(): n for s, n in rows}
    present = counts.get(AttendanceStatus.PRESENT.value, 0)
    half = counts.get(AttendanceStatus.HALF_DAY.value, 0)
    absent = counts.get(AttendanceStatus.ABSENT.value, 0)
    leave = counts.get(AttendanceStatus.LEAVE.value, 0)
    marked = present + half + absent + leave
    pct = round((present + 0.5 * half) / marked * 100, 1) if marked else None
    return {"present": present, "half_day": half, "absent": absent, "leave": leave, "marked": marked, "pct": pct}


async def plant_department_ids(session: AsyncSession, plant_id: UUID) -> list[UUID]:
    return list((await session.execute(select(Department.id).where(Department.plant_id == plant_id))).scalars())


async def open_issue_count(session: AsyncSession, plant_id: UUID, department_id: UUID | None = None) -> int:
    """Open maintenance issues. For one department: the department of the run it was raised on, else of whoever raised it."""
    query = (
        select(func.count())
        .select_from(MaintenanceIssue)
        .join(User, User.id == MaintenanceIssue.raised_by)
        .outerjoin(ProcessRun, ProcessRun.id == MaintenanceIssue.run_id)
        .outerjoin(Process, Process.id == ProcessRun.process_id)
        .where(MaintenanceIssue.plant_id == plant_id, MaintenanceIssue.status == "open")
    )
    if department_id is not None:
        query = query.where(func.coalesce(Process.department_id, User.department_id) == department_id)
    return int((await session.execute(query)).scalar() or 0)


async def pending_work_orders(session: AsyncSession, plant_id: UUID, department_id: UUID | None = None) -> int:
    query = (
        select(func.count())
        .select_from(MaintenanceWorkOrder)
        .outerjoin(Asset, MaintenanceWorkOrder.asset_id == Asset.id)
        .where(MaintenanceWorkOrder.plant_id == plant_id, MaintenanceWorkOrder.status.notin_(list(CLOSED_WORK_ORDER)))
    )
    if department_id is not None:
        query = query.where(func.coalesce(MaintenanceWorkOrder.department_id, Asset.department_id) == department_id)
    return int((await session.execute(query)).scalar() or 0)


async def run_energy_kwh(session: AsyncSession, plant_id: UUID, since: datetime, department_id: UUID | None = None) -> float:
    """Energy recorded on the log sheets (for example IAF energy units) for runs finished since a time."""
    query = (
        select(func.coalesce(func.sum(FactProcessRun.energy_kwh), 0))
        .join(ProcessRun, FactProcessRun.run_id == ProcessRun.id)
        .where(FactProcessRun.plant_id == plant_id, ProcessRun.completed_at >= since)
    )
    if department_id is not None:
        query = query.join(Process, ProcessRun.process_id == Process.id).where(Process.department_id == department_id)
    return float((await session.execute(query)).scalar() or 0)


# --------------------------------------------------------------- refresh after writes
_pending = False
suspended = False  # set while the demo seed runs, which makes thousands of writes


def schedule_refresh(delay: float = 3.0) -> None:
    """Refresh the pulse snapshots shortly after a change. Many writes in a burst share one refresh."""
    global _pending
    if _pending or suspended:
        return
    _pending = True

    async def _run() -> None:
        global _pending
        try:
            await asyncio.sleep(delay)
            from app.db.session import async_session_factory
            from app.services.pulse_aggregator_service import PulseAggregatorService

            async with async_session_factory() as session:
                await PulseAggregatorService().refresh_all(session)
                await session.commit()
        except Exception:  # a failed refresh is retried by the 5-minute loop
            log.exception("pulse refresh after write failed")
        finally:
            _pending = False

    asyncio.get_running_loop().create_task(_run())
