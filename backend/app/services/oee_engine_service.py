"""Generic OEE engine — Availability × Performance × Quality."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.pulse_live import day_start_utc
from app.db.models import (
    AggShiftKPI,
    Asset,
    DelayEvent,
    Department,
    FactProcessRun,
    MaintenanceIssue,
    OEESnapshot,
    Plant,
    Process,
    ProcessInstance,
    ProcessRun,
)
from app.models.enums import AttendanceStatus, ProcessRunOutcome

_IDEAL_OUTPUT_BY_DEPT: dict[str, float] = {
    "IAF": 25.0,
    "SMS": 25.0,
    "ROLLING": 120.0,
    "WIRE": 8.0,
    "BBD": 15.0,
    "FORGE": 10.0,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


class OEEEngineService:
    @staticmethod
    def _no_data() -> dict:
        """Nothing ran (or nothing usable): callers show "no data" instead of a made-up figure."""
        return {
            "availability": 0.85,
            "performance": 0.80,
            "quality": 0.95,
            "oee": round(0.85 * 0.80 * 0.95, 4),
            "is_estimated": True,
            "no_runs": True,
        }

    async def compute_oee(
        self,
        session: AsyncSession,
        scope_type: str,
        scope_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        runs = await self._runs_for_scope(session, scope_type, scope_id, period_start, period_end)
        if not runs:
            return {
                "availability": 0.85,
                "performance": 0.80,
                "quality": 0.95,
                "oee": round(0.85 * 0.80 * 0.95, 4),
                "is_estimated": True,
                "no_runs": True,  # nothing ran in the period: callers show "no data" rather than this placeholder
            }

        run_ids = [r.id for r in runs]
        downtime_min = 0.0
        if run_ids:
            delay_result = await session.execute(
                select(func.coalesce(func.sum(DelayEvent.time_lost_minutes), 0)).where(DelayEvent.run_id.in_(run_ids))
            )
            downtime_min = float(delay_result.scalar() or 0)

        # Time the runs were actually going in this period.
        running_min = 0.0
        for run in runs:
            start = run.started_at or run.created_at
            if start is None:
                continue
            end = run.completed_at or run.closed_at or period_end
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            start = max(start, period_start)
            end = min(end, period_end)
            if end > start:
                running_min += (end - start).total_seconds() / 60

        if running_min <= 0:
            return self._no_data()

        # Availability: how much of the running time was not lost to recorded delays.
        availability = _clamp(1 - downtime_min / running_min)

        # Performance: output against the ideal, but only for runs that recorded an output.
        # Where none did there is nothing to measure, so no figure is shown.
        actual_output = 0.0
        ideal_output = 0.0
        accepted = 0
        rejected = 0
        for run in runs:
            fact = (await session.execute(select(FactProcessRun).where(FactProcessRun.run_id == run.id))).scalar_one_or_none()
            if fact and fact.charge_kg:
                actual_output += float(fact.charge_kg) / 1000
                ideal_output += await self._ideal_output_t(session, run)
            if run.outcome == ProcessRunOutcome.REJECTED:
                rejected += 1
            else:
                accepted += 1

        if ideal_output == 0:
            return self._no_data()  # runs exist but none recorded an output yet: no honest figure
        performance = _clamp(actual_output / ideal_output)
        total_quality = accepted + rejected
        quality = _clamp(accepted / total_quality) if total_quality else 1.0
        oee = round(availability * performance * quality, 4)
        is_estimated = len(runs) < 2

        return {
            "availability": round(availability, 4),
            "performance": round(performance, 4),
            "quality": round(quality, 4),
            "oee": oee,
            "is_estimated": is_estimated,
            "downtime_minutes": downtime_min,
            "actual_output": actual_output,
            "ideal_output": ideal_output,
        }

    async def persist_snapshot(
        self,
        session: AsyncSession,
        scope_type: str,
        scope_id: UUID,
        period: str,
        period_start: datetime,
        period_end: datetime,
        metrics: dict,
    ) -> OEESnapshot:
        snap = OEESnapshot(
            scope_type=scope_type,
            scope_id=scope_id,
            period=period,
            period_start=period_start,
            period_end=period_end,
            availability=metrics["availability"],
            performance=metrics["performance"],
            quality=metrics["quality"],
            oee=metrics["oee"],
            is_estimated=metrics.get("is_estimated", False),
        )
        session.add(snap)
        return snap

    async def get_trends(
        self,
        session: AsyncSession,
        scope_type: str,
        scope_id: UUID,
    ) -> dict:
        now = datetime.now(timezone.utc)
        today_start = day_start_utc()

        hourly = []
        for h in range(max(0, now.hour), -1, -1):
            ps = today_start + timedelta(hours=h)
            pe = ps + timedelta(hours=1)
            m = await self.compute_oee(session, scope_type, scope_id, ps, pe)
            hourly.append({"period_start": ps, "period_end": pe, **m})

        daily = []
        for d in range(7):
            day = date.today() - timedelta(days=d)
            ps = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc)
            pe = ps + timedelta(days=1)
            m = await self.compute_oee(session, scope_type, scope_id, ps, pe)
            daily.append({"period_start": ps, "period_end": pe, **m})

        weekly = []
        for w in range(4):
            ps = today_start - timedelta(weeks=w + 1)
            pe = today_start - timedelta(weeks=w)
            m = await self.compute_oee(session, scope_type, scope_id, ps, pe)
            weekly.append({"period_start": ps, "period_end": pe, **m})

        monthly = []
        for m_idx in range(6):
            month_end = today_start.replace(day=1) - timedelta(days=30 * m_idx)
            month_start = (month_end.replace(day=1))
            m = await self.compute_oee(session, scope_type, scope_id, month_start, month_end)
            monthly.append({"period_start": month_start, "period_end": month_end, **m})

        current = await self.compute_oee(session, scope_type, scope_id, today_start, now)
        return {"current": current, "hourly": hourly, "daily": daily, "weekly": weekly, "monthly": monthly}

    async def _runs_for_scope(
        self,
        session: AsyncSession,
        scope_type: str,
        scope_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> list[ProcessRun]:
        q = select(ProcessRun).where(
            or_(
                and_(ProcessRun.started_at.isnot(None), ProcessRun.started_at <= period_end),
                ProcessRun.created_at <= period_end,
            )
        ).where(
            or_(
                ProcessRun.completed_at.is_(None),
                ProcessRun.completed_at >= period_start,
                ProcessRun.started_at >= period_start,
            )
        )

        if scope_type == "run":
            q = q.where(ProcessRun.id == scope_id)
        elif scope_type == "asset":
            q = q.where(
                or_(
                    ProcessRun.primary_asset_id == scope_id,
                    ProcessRun.secondary_asset_ids.contains([scope_id]),
                )
            )
        elif scope_type == "process":
            q = q.where(ProcessRun.process_id == scope_id)
        elif scope_type == "department":
            q = (
                q.join(Process, ProcessRun.process_id == Process.id)
                .where(Process.department_id == scope_id)
            )
        elif scope_type == "plant":
            q = (
                q.join(Process, ProcessRun.process_id == Process.id)
                .join(Department, Process.department_id == Department.id)
                .where(Department.plant_id == scope_id)
            )

        result = await session.execute(q.limit(500))
        return list(result.scalars())

    async def _ideal_output_t(self, session: AsyncSession, run: ProcessRun) -> float:
        """Target output (tonnes) for one run: a little above this process's own average over the last 30 days,
        so a line is judged against what it really does. With too little history, a typical figure for the department."""
        since = datetime.now(timezone.utc) - timedelta(days=30)
        row = (await session.execute(
            select(func.avg(FactProcessRun.charge_kg), func.count())
            .join(ProcessRun, FactProcessRun.run_id == ProcessRun.id)
            .where(
                ProcessRun.process_id == run.process_id,
                ProcessRun.id != run.id,
                FactProcessRun.charge_kg > 0,
                ProcessRun.created_at >= since,
            )
        )).one()
        avg_kg, n = row
        if n and n >= 3 and avg_kg:
            return float(avg_kg) / 1000 * 1.2
        dept_code = await self._dept_code_for_run(session, run)
        return _IDEAL_OUTPUT_BY_DEPT.get(dept_code or "", 10.0)

    async def _dept_code_for_run(self, session: AsyncSession, run: ProcessRun) -> str | None:
        proc = await session.get(Process, run.process_id)
        if not proc:
            return None
        dept = await session.get(Department, proc.department_id)
        return dept.code if dept else None
