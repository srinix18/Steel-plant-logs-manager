"""Plant / department / asset pulse aggregation."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Asset,
    AssetLiveParameter,
    AssetPulse,
    AttendanceRecord,
    CostCalculation,
    Department,
    DepartmentPulse,
    EnergyReading,
    FactProcessRun,
    MaintenanceIssue,
    MaintenanceWorkOrder,
    OperationalEvent,
    Plant,
    Process,
    ProcessRun,
    PulseSnapshot,
    Shift,
    User,
)
from app.models.enums import AttendanceStatus, EventSeverity, EventSource, MaintenanceWorkOrderStatus
from app.services.asset_health_engine_service import AssetHealthEngineService
from app.services.oee_engine_service import OEEEngineService
from app.services.pulse_notification_service import PulseNotificationService

_CLOSED_WO = {
    MaintenanceWorkOrderStatus.COMPLETED.value,
    MaintenanceWorkOrderStatus.VERIFIED.value,
    MaintenanceWorkOrderStatus.CLOSED.value,
}


def _status_color(score: float | None, alerts: int, oee: float | None) -> str:
    if alerts > 2 or (score is not None and score < 60) or (oee is not None and oee < 0.5):
        return "critical"
    if alerts > 0 or (score is not None and score < 85) or (oee is not None and oee < 0.75):
        return "warning"
    return "normal"


class PulseAggregatorService:
    def __init__(self) -> None:
        self._oee = OEEEngineService()
        self._health = AssetHealthEngineService()
        self._notify = PulseNotificationService()

    async def refresh_all(self, session: AsyncSession, plant_id: UUID | None = None) -> dict:
        plants_q = select(Plant)
        if plant_id:
            plants_q = plants_q.where(Plant.id == plant_id)
        plants = list((await session.execute(plants_q)).scalars())
        stats = {"plants": 0, "departments": 0, "assets": 0, "events": 0}
        for plant in plants:
            await self._refresh_plant(session, plant)
            stats["plants"] += 1
            depts = await session.execute(select(Department).where(Department.plant_id == plant.id))
            for dept in depts.scalars():
                await self._refresh_department(session, dept)
                stats["departments"] += 1
            assets = await session.execute(select(Asset).where(Asset.plant_id == plant.id))
            for asset in assets.scalars():
                await self._refresh_asset(session, asset)
                await self._health.persist_health(session, asset.id)
                stats["assets"] += 1
            ev = await self._emit_status_events(session, plant)
            stats["events"] += ev
        return stats

    async def _refresh_plant(self, session: AsyncSession, plant: Plant) -> PulseSnapshot:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        oee_m = await self._oee.compute_oee(session, "plant", plant.id, today_start, now)
        await self._oee.persist_snapshot(session, "plant", plant.id, "day", today_start, now, oee_m)

        prod_result = await session.execute(
            select(func.coalesce(func.sum(FactProcessRun.charge_kg), 0))
            .join(ProcessRun, FactProcessRun.run_id == ProcessRun.id)
            .where(FactProcessRun.plant_id == plant.id, FactProcessRun.computed_at >= today_start)
        )
        today_production = float(prod_result.scalar() or 0) / 1000

        cost_result = await session.execute(
            select(func.coalesce(func.sum(CostCalculation.total_cost), 0))
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .join(Department, Process.department_id == Department.id)
            .where(Department.plant_id == plant.id, CostCalculation.calculated_at >= today_start)
        )
        today_cost = float(cost_result.scalar() or 0)

        energy_result = await session.execute(
            select(func.coalesce(func.sum(EnergyReading.kwh), 0)).where(
                EnergyReading.plant_id == plant.id, EnergyReading.reading_at >= today_start
            )
        )
        power_kwh = float(energy_result.scalar() or 0)
        if not power_kwh:
            param_result = await session.execute(
                select(func.coalesce(func.sum(AssetLiveParameter.value), 0))
                .join(Asset, AssetLiveParameter.asset_id == Asset.id)
                .where(Asset.plant_id == plant.id, AssetLiveParameter.param_key == "power")
            )
            power_kwh = float(param_result.scalar() or 0)

        pending_maint = await session.execute(
            select(func.count())
            .select_from(MaintenanceWorkOrder)
            .where(
                MaintenanceWorkOrder.plant_id == plant.id,
                MaintenanceWorkOrder.status.notin_(list(_CLOSED_WO)),
            )
        )
        pending_count = int(pending_maint.scalar() or 0)

        alerts = await session.execute(
            select(func.count())
            .select_from(MaintenanceIssue)
            .where(MaintenanceIssue.plant_id == plant.id, MaintenanceIssue.status == "open")
        )
        alert_count = int(alerts.scalar() or 0)

        shift_code = await self._current_shift_code(session, plant.id)
        attendance_pct = await self._plant_attendance_pct(session, plant.id)

        dept_pulses = await session.execute(
            select(DepartmentPulse)
            .join(Department, DepartmentPulse.department_id == Department.id)
            .where(Department.plant_id == plant.id)
            .order_by(DepartmentPulse.snapshot_at.desc())
        )
        latest_depts: dict[UUID, DepartmentPulse] = {}
        for dp in dept_pulses.scalars():
            if dp.department_id not in latest_depts:
                latest_depts[dp.department_id] = dp

        worst = "normal"
        for dp in latest_depts.values():
            if dp.status == "critical":
                worst = "critical"
                break
            if dp.status == "warning":
                worst = "warning"

        snap = PulseSnapshot(
            plant_id=plant.id,
            snapshot_at=now,
            plant_status=worst,
            overall_oee=oee_m["oee"],
            today_production=today_production,
            today_cost=today_cost,
            power_consumption_kwh=power_kwh,
            downtime_minutes=oee_m.get("downtime_minutes", 0),
            active_alerts=alert_count,
            pending_maintenance=pending_count,
            current_shift_code=shift_code,
            attendance_pct=attendance_pct,
            metrics={"oee_detail": oee_m},
        )
        session.add(snap)

        if oee_m["oee"] < 0.6 and plant.organisation_id:
            await self._notify.notify_plant_leaders(
                session,
                plant.organisation_id,
                notification_type="low_oee",
                title="Plant OEE below target",
                body=f"Overall OEE is {oee_m['oee']*100:.1f}%",
                entity_type="plant",
                entity_id=plant.id,
            )
        if attendance_pct is not None and attendance_pct < 70 and plant.organisation_id:
            await self._notify.notify_plant_leaders(
                session,
                plant.organisation_id,
                notification_type="attendance_issue",
                title="Attendance below minimum",
                body=f"Plant attendance is {attendance_pct:.0f}%",
                entity_type="plant",
                entity_id=plant.id,
            )

        return snap

    async def _refresh_department(self, session: AsyncSession, dept: Department) -> DepartmentPulse:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        oee_m = await self._oee.compute_oee(session, "department", dept.id, today_start, now)

        active_run = await session.execute(
            select(ProcessRun)
            .join(Process, ProcessRun.process_id == Process.id)
            .where(Process.department_id == dept.id, ProcessRun.completed_at.is_(None))
            .order_by(ProcessRun.started_at.desc().nullslast())
            .limit(1)
        )
        run = active_run.scalar_one_or_none()

        prod = await session.execute(
            select(func.coalesce(func.sum(FactProcessRun.charge_kg), 0))
            .join(ProcessRun, FactProcessRun.run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .where(Process.department_id == dept.id, FactProcessRun.computed_at >= today_start)
        )
        production = float(prod.scalar() or 0) / 1000

        issues = await session.execute(
            select(func.count())
            .select_from(MaintenanceIssue)
            .join(ProcessRun, MaintenanceIssue.run_id == ProcessRun.id, isouter=True)
            .where(
                MaintenanceIssue.status == "open",
                MaintenanceIssue.plant_id == dept.plant_id,
            )
        )
        open_issues = int(issues.scalar() or 0)

        maint_alerts = await session.execute(
            select(func.count())
            .select_from(MaintenanceWorkOrder)
            .join(Asset, MaintenanceWorkOrder.asset_id == Asset.id)
            .where(Asset.department_id == dept.id, MaintenanceWorkOrder.status.notin_(list(_CLOSED_WO)))
        )
        maint_count = int(maint_alerts.scalar() or 0)

        assets = await session.execute(select(Asset).where(Asset.department_id == dept.id).limit(5))
        health_scores = []
        for a in assets.scalars():
            h = await self._health.compute_health(session, a.id)
            health_scores.append(h["score"])
        avg_health = sum(health_scores) / len(health_scores) if health_scores else 90.0

        shift_code = await self._current_shift_code(session, dept.plant_id)
        power = await session.execute(
            select(func.coalesce(func.sum(EnergyReading.kwh), 0)).where(
                EnergyReading.department_id == dept.id, EnergyReading.reading_at >= today_start
            )
        )
        power_kwh = float(power.scalar() or 0)

        status = _status_color(avg_health, open_issues, oee_m["oee"])
        dept_metrics = self._dept_specific_metrics(dept.code, run)

        pulse = DepartmentPulse(
            department_id=dept.id,
            snapshot_at=now,
            status=status,
            current_shift_code=shift_code,
            current_run_id=run.id if run else None,
            current_run_label=run.run_number if run else None,
            production=production,
            oee=oee_m["oee"],
            downtime_minutes=oee_m.get("downtime_minutes", 0),
            power_kwh=power_kwh,
            open_issues=open_issues,
            maintenance_alerts=maint_count,
            health_score=avg_health,
            metrics=dept_metrics,
        )
        session.add(pulse)
        return pulse

    async def _refresh_asset(self, session: AsyncSession, asset: Asset) -> AssetPulse:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        oee_m = await self._oee.compute_oee(session, "asset", asset.id, today_start, now)
        health = await self._health.compute_health(session, asset.id)

        run_result = await session.execute(
            select(ProcessRun)
            .where(ProcessRun.primary_asset_id == asset.id, ProcessRun.completed_at.is_(None))
            .order_by(ProcessRun.started_at.desc().nullslast())
            .limit(1)
        )
        run = run_result.scalar_one_or_none()

        operator = None
        if run:
            user = await session.get(User, run.created_by)
            operator = user.full_name if user else None

        power_result = await session.execute(
            select(AssetLiveParameter.value).where(
                AssetLiveParameter.asset_id == asset.id, AssetLiveParameter.param_key == "power"
            )
        )
        power = power_result.scalar_one_or_none()

        status = _status_color(health["score"], 0, oee_m["oee"])
        pulse = AssetPulse(
            asset_id=asset.id,
            snapshot_at=now,
            status=status,
            health_score=health["score"],
            current_run_id=run.id if run else None,
            current_operator=operator,
            oee=oee_m["oee"],
            power_kwh=float(power) if power else None,
            metrics={"health_category": health["category"], "oee_detail": oee_m},
        )
        session.add(pulse)

        if health["category"] == "critical" and asset.plant_id:
            plant = await session.get(Plant, asset.plant_id)
            if plant and plant.organisation_id:
                await self._notify.notify_plant_leaders(
                    session,
                    plant.organisation_id,
                    notification_type="health_critical",
                    title=f"Asset health critical: {asset.name}",
                    body=f"Health score {health['score']}%",
                    entity_type="asset",
                    entity_id=asset.id,
                    department_id=asset.department_id,
                )
        return pulse

    async def _emit_status_events(self, session: AsyncSession, plant: Plant) -> int:
        count = 0
        recent = await session.execute(
            select(OperationalEvent)
            .where(OperationalEvent.plant_id == plant.id)
            .order_by(OperationalEvent.occurred_at.desc())
            .limit(1)
        )
        last = recent.scalar_one_or_none()
        if last and (datetime.now(timezone.utc) - last.occurred_at).total_seconds() < 300:
            return 0

        snap = await session.execute(
            select(PulseSnapshot)
            .where(PulseSnapshot.plant_id == plant.id)
            .order_by(PulseSnapshot.snapshot_at.desc())
            .limit(1)
        )
        ps = snap.scalar_one_or_none()
        if ps and ps.plant_status == "critical":
            session.add(
                OperationalEvent(
                    plant_id=plant.id,
                    event_type="plant_status_critical",
                    severity=EventSeverity.CRITICAL,
                    occurred_at=datetime.now(timezone.utc),
                    source=EventSource.MANUAL,
                    payload={"status": ps.plant_status, "oee": ps.overall_oee},
                )
            )
            count += 1
        return count

    async def _current_shift_code(self, session: AsyncSession, plant_id: UUID) -> str | None:
        shifts = await session.execute(select(Shift).where(Shift.plant_id == plant_id))
        now_t = datetime.now().time()
        for shift in shifts.scalars():
            if shift.start_time <= now_t <= shift.end_time or (
                shift.start_time > shift.end_time and (now_t >= shift.start_time or now_t <= shift.end_time)
            ):
                return shift.code
        first = await session.execute(select(Shift).where(Shift.plant_id == plant_id).limit(1))
        s = first.scalar_one_or_none()
        return s.code if s else None

    async def _plant_attendance_pct(self, session: AsyncSession, plant_id: UUID) -> float | None:
        today = date.today()
        depts = await session.execute(select(Department.id).where(Department.plant_id == plant_id))
        dept_ids = [d for d in depts.scalars()]
        if not dept_ids:
            return None
        total = await session.execute(
            select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.attendance_date == today,
                AttendanceRecord.department_id.in_(dept_ids),
            )
        )
        present = await session.execute(
            select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.attendance_date == today,
                AttendanceRecord.department_id.in_(dept_ids),
                AttendanceRecord.status == AttendanceStatus.PRESENT,
            )
        )
        t = int(total.scalar() or 0)
        p = int(present.scalar() or 0)
        if t == 0:
            return None
        return round(p / t * 100, 1)

    def _dept_specific_metrics(self, code: str, run: ProcessRun | None) -> dict:
        base: dict = {}
        if not run:
            return base
        code_u = (code or "").upper()
        if code_u in ("IAF", "SMS"):
            base["current_heat"] = run.run_number
        elif code_u == "ROLLING":
            base["current_mill"] = run.run_number
        elif code_u == "WIRE":
            base["current_machine"] = run.run_number
        elif code_u == "BBD":
            base["current_line"] = run.run_number
        elif code_u == "FORGE":
            base["current_machine"] = run.run_number
        return base
