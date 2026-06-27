"""Pulse read API service — serves dashboard payloads."""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Asset,
    AssetHealthRecord,
    AssetLiveParameter,
    AssetPulse,
    CostCalculation,
    Department,
    DepartmentPulse,
    MaintenanceDowntimeRecord,
    MaintenanceIssue,
    MaintenanceWorkOrder,
    OperationalEvent,
    Plant,
    Process,
    ProcessRun,
    PulseSnapshot,
    QRAsset,
    SafetyInspection,
    User,
)
from app.models.enums import AssetStatus, MaintenanceWorkOrderStatus
from app.schemas.pulse import (
    AssetPulseResponse,
    AssetWorkspaceResponse,
    DepartmentPulseCard,
    DepartmentPulseResponse,
    LiveParameterItem,
    OEEMetrics,
    OEEResponse,
    OEETrendPoint,
    PlantPulseResponse,
    PulseAlertItem,
    PulseEventItem,
    QRAssetResponse,
)
from app.services.access_scope import CEO_TIER_ROLES, HOD_TIER_ROLES, is_ceo_tier, is_hod_tier
from app.services.asset_health_engine_service import AssetHealthEngineService
from app.services.oee_engine_service import OEEEngineService
from app.services.safety_service import EMERGENCY_CONTACTS, SafetyService

_CLOSED_WO = {
    MaintenanceWorkOrderStatus.COMPLETED.value,
    MaintenanceWorkOrderStatus.VERIFIED.value,
    MaintenanceWorkOrderStatus.CLOSED.value,
}


class PulseService:
    def __init__(self) -> None:
        self._oee = OEEEngineService()
        self._health = AssetHealthEngineService()
        self._safety = SafetyService()

    def _assert_plant_access(self, user: User, plant_id: UUID) -> None:
        if is_ceo_tier(user):
            return
        if user.plant_id and user.plant_id != plant_id:
            raise HTTPException(status_code=403, detail="Access denied to this plant")

    def _assert_department_access(self, user: User, department_id: UUID, dept: Department) -> None:
        self._assert_plant_access(user, dept.plant_id)
        if is_ceo_tier(user):
            return
        if is_hod_tier(user) and user.department_id and user.department_id != department_id:
            raise HTTPException(status_code=403, detail="Access denied to this department")

    async def get_plant_pulse(self, session: AsyncSession, user: User, plant_id: UUID) -> PlantPulseResponse:
        self._assert_plant_access(user, plant_id)
        plant = await session.get(Plant, plant_id)
        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")

        snap_result = await session.execute(
            select(PulseSnapshot)
            .where(PulseSnapshot.plant_id == plant_id)
            .order_by(PulseSnapshot.snapshot_at.desc())
            .limit(1)
        )
        snap = snap_result.scalar_one_or_none()
        if not snap:
            from app.services.pulse_aggregator_service import PulseAggregatorService

            await PulseAggregatorService().refresh_all(session, plant_id)
            snap_result = await session.execute(
                select(PulseSnapshot)
                .where(PulseSnapshot.plant_id == plant_id)
                .order_by(PulseSnapshot.snapshot_at.desc())
                .limit(1)
            )
            snap = snap_result.scalar_one_or_none()

        depts = await session.execute(select(Department).where(Department.plant_id == plant_id))
        dept_cards: list[DepartmentPulseCard] = []
        for dept in depts.scalars():
            dp_result = await session.execute(
                select(DepartmentPulse)
                .where(DepartmentPulse.department_id == dept.id)
                .order_by(DepartmentPulse.snapshot_at.desc())
                .limit(1)
            )
            dp = dp_result.scalar_one_or_none()
            dept_cards.append(
                DepartmentPulseCard(
                    department_id=dept.id,
                    department_code=dept.code,
                    department_name=dept.name,
                    status=dp.status if dp else "normal",
                    current_shift_code=dp.current_shift_code if dp else None,
                    current_run_label=dp.current_run_label if dp else None,
                    production=dp.production if dp else None,
                    oee=dp.oee if dp else None,
                    downtime_minutes=dp.downtime_minutes if dp else None,
                    power_kwh=dp.power_kwh if dp else None,
                    open_issues=dp.open_issues if dp else 0,
                    maintenance_alerts=dp.maintenance_alerts if dp else 0,
                    health_score=dp.health_score if dp else None,
                    metrics=dp.metrics if dp else {},
                )
            )

        oee_detail = OEEMetrics()
        if snap and snap.metrics.get("oee_detail"):
            od = snap.metrics["oee_detail"]
            oee_detail = OEEMetrics(
                availability=od.get("availability", 0),
                performance=od.get("performance", 0),
                quality=od.get("quality", 0),
                oee=od.get("oee", snap.overall_oee or 0),
                is_estimated=od.get("is_estimated", False),
            )
        elif snap and snap.overall_oee is not None:
            oee_detail.oee = snap.overall_oee

        return PlantPulseResponse(
            plant_id=plant_id,
            plant_name=plant.name,
            snapshot_at=snap.snapshot_at if snap else datetime.now(timezone.utc),
            plant_status=snap.plant_status if snap else "normal",
            overall_oee=snap.overall_oee if snap else None,
            today_production=snap.today_production if snap else None,
            today_cost=snap.today_cost if snap else None,
            power_consumption_kwh=snap.power_consumption_kwh if snap else None,
            downtime_minutes=snap.downtime_minutes if snap else None,
            active_alerts=snap.active_alerts if snap else 0,
            pending_maintenance=snap.pending_maintenance if snap else 0,
            current_shift_code=snap.current_shift_code if snap else None,
            attendance_pct=snap.attendance_pct if snap else None,
            oee=oee_detail,
            departments=dept_cards,
        )

    async def get_department_pulse(
        self, session: AsyncSession, user: User, department_id: UUID
    ) -> DepartmentPulseResponse:
        dept = await session.get(Department, department_id)
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
        self._assert_department_access(user, department_id, dept)

        dp_result = await session.execute(
            select(DepartmentPulse)
            .where(DepartmentPulse.department_id == department_id)
            .order_by(DepartmentPulse.snapshot_at.desc())
            .limit(1)
        )
        dp = dp_result.scalar_one_or_none()

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        oee_m = await self._oee.compute_oee(session, "department", department_id, today_start, datetime.now(timezone.utc))

        runs = await session.execute(
            select(ProcessRun)
            .join(Process, ProcessRun.process_id == Process.id)
            .where(Process.department_id == department_id, ProcessRun.completed_at.is_(None))
            .order_by(ProcessRun.started_at.desc().nullslast())
        )
        active_runs = [
            {"id": str(r.id), "run_number": r.run_number, "state": r.current_state}
            for r in runs.scalars()
        ]

        cost_result = await session.execute(
            select(func.coalesce(func.sum(CostCalculation.total_cost), 0))
            .join(ProcessRun, CostCalculation.process_run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .where(Process.department_id == department_id, CostCalculation.calculated_at >= today_start)
        )
        dept_cost = float(cost_result.scalar() or 0)

        target = {"IAF": 100, "SMS": 100, "ROLLING": 500, "WIRE": 40, "BBD": 80, "FORGE": 50}.get(
            dept.code.upper(), 50
        )
        actual = dp.production if dp else 0
        shift_pct = min(100, (actual / target * 100) if target else 0)

        from app.services.pulse_aggregator_service import PulseAggregatorService

        attendance_pct = await PulseAggregatorService()._plant_attendance_pct(session, dept.plant_id)

        return DepartmentPulseResponse(
            department_id=department_id,
            department_code=dept.code,
            department_name=dept.name,
            snapshot_at=dp.snapshot_at if dp else datetime.now(timezone.utc),
            status=dp.status if dp else "normal",
            current_shift_code=dp.current_shift_code if dp else None,
            current_run_id=dp.current_run_id if dp else None,
            current_run_label=dp.current_run_label if dp else None,
            production=dp.production if dp else None,
            oee=dp.oee if dp else oee_m["oee"],
            downtime_minutes=dp.downtime_minutes if dp else None,
            power_kwh=dp.power_kwh if dp else None,
            open_issues=dp.open_issues if dp else 0,
            maintenance_alerts=dp.maintenance_alerts if dp else 0,
            health_score=dp.health_score if dp else None,
            attendance_pct=attendance_pct,
            production_target=float(target),
            actual_production=actual,
            shift_completion_pct=round(shift_pct, 1),
            department_cost=dept_cost,
            oee_detail=OEEMetrics(**{k: oee_m[k] for k in ("availability", "performance", "quality", "oee", "is_estimated")}),
            metrics=dp.metrics if dp else {},
            active_runs=active_runs,
        )

    async def get_asset_pulse(self, session: AsyncSession, user: User, asset_id: UUID) -> AssetPulseResponse:
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        self._assert_plant_access(user, asset.plant_id)

        ap_result = await session.execute(
            select(AssetPulse)
            .where(AssetPulse.asset_id == asset_id)
            .order_by(AssetPulse.snapshot_at.desc())
            .limit(1)
        )
        ap = ap_result.scalar_one_or_none()
        health = await self._health.get_latest(session, asset_id)
        if not health:
            h = await self._health.compute_health(session, asset_id)
            health_score = h["score"]
            health_cat = h["category"]
        else:
            health_score = health.score
            health_cat = health.category

        dept_name = None
        if asset.department_id:
            d = await session.get(Department, asset.department_id)
            dept_name = d.name if d else None

        params = await session.execute(
            select(AssetLiveParameter).where(AssetLiveParameter.asset_id == asset_id)
        )
        live = [
            {
                "param_key": p.param_key,
                "label": p.label,
                "value": p.value,
                "value_text": p.value_text,
                "unit": p.unit,
                "source": p.source,
            }
            for p in params.scalars()
        ]

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        oee_m = await self._oee.compute_oee(session, "asset", asset_id, today_start, datetime.now(timezone.utc))

        return AssetPulseResponse(
            asset_id=asset_id,
            asset_name=asset.name,
            asset_no=asset.asset_no,
            department_name=dept_name,
            status=ap.status if ap else "normal",
            health_score=health_score,
            health_category=health_cat,
            current_operator=ap.current_operator if ap else None,
            current_run_id=ap.current_run_id if ap else None,
            current_run_label=None,
            current_shift_code=None,
            oee=OEEMetrics(**{k: oee_m[k] for k in ("availability", "performance", "quality", "oee", "is_estimated")}),
            live_parameters=live,
            metrics=ap.metrics if ap else {},
        )

    async def get_feed(self, session: AsyncSession, user: User, plant_id: UUID, limit: int = 30) -> list[PulseEventItem]:
        self._assert_plant_access(user, plant_id)
        result = await session.execute(
            select(OperationalEvent)
            .where(OperationalEvent.plant_id == plant_id)
            .order_by(OperationalEvent.occurred_at.desc())
            .limit(limit)
        )
        return [
            PulseEventItem(
                id=e.id,
                event_type=e.event_type,
                severity=e.severity.value if hasattr(e.severity, "value") else str(e.severity),
                occurred_at=e.occurred_at,
                asset_id=e.asset_id,
                run_id=e.run_id,
                payload=e.payload or {},
            )
            for e in result.scalars()
        ]

    async def get_alerts(self, session: AsyncSession, user: User, plant_id: UUID) -> list[PulseAlertItem]:
        self._assert_plant_access(user, plant_id)
        now = datetime.now(timezone.utc)
        alerts: list[PulseAlertItem] = []

        issues = await session.execute(
            select(MaintenanceIssue)
            .where(MaintenanceIssue.plant_id == plant_id, MaintenanceIssue.status == "open")
            .order_by(MaintenanceIssue.raised_at.desc())
            .limit(20)
        )
        for issue in issues.scalars():
            alerts.append(
                PulseAlertItem(
                    id=str(issue.id),
                    alert_type="maintenance",
                    severity=issue.severity,
                    title=issue.title,
                    message=issue.description[:200],
                    entity_type="maintenance_issue",
                    entity_id=issue.id,
                    occurred_at=issue.raised_at,
                )
            )

        overdue = await session.execute(
            select(MaintenanceWorkOrder)
            .where(
                MaintenanceWorkOrder.plant_id == plant_id,
                MaintenanceWorkOrder.due_at.isnot(None),
                MaintenanceWorkOrder.due_at < now,
                MaintenanceWorkOrder.status.notin_(list(_CLOSED_WO)),
            )
            .limit(10)
        )
        for wo in overdue.scalars():
            alerts.append(
                PulseAlertItem(
                    id=f"wo-{wo.id}",
                    alert_type="maintenance_overdue",
                    severity="critical",
                    title=f"Overdue WO: {wo.title}",
                    message=wo.title,
                    entity_type="work_order",
                    entity_id=wo.id,
                    occurred_at=wo.due_at or now,
                )
            )

        snap = await session.execute(
            select(PulseSnapshot)
            .where(PulseSnapshot.plant_id == plant_id)
            .order_by(PulseSnapshot.snapshot_at.desc())
            .limit(1)
        )
        ps = snap.scalar_one_or_none()
        if ps and ps.overall_oee is not None and ps.overall_oee < 0.6:
            alerts.append(
                PulseAlertItem(
                    id=f"oee-{plant_id}",
                    alert_type="low_oee",
                    severity="warning",
                    title="Low plant OEE",
                    message=f"Overall OEE at {ps.overall_oee*100:.1f}%",
                    entity_type="plant",
                    entity_id=plant_id,
                    occurred_at=ps.snapshot_at,
                )
            )

        return alerts

    async def get_oee(
        self, session: AsyncSession, user: User, scope_type: str, scope_id: UUID
    ) -> OEEResponse:
        trends = await self._oee.get_trends(session, scope_type, scope_id)
        cur = trends["current"]

        def _points(rows: list) -> list[OEETrendPoint]:
            return [
                OEETrendPoint(
                    period_start=r["period_start"],
                    period_end=r["period_end"],
                    availability=r["availability"],
                    performance=r["performance"],
                    quality=r["quality"],
                    oee=r["oee"],
                )
                for r in rows
            ]

        return OEEResponse(
            scope_type=scope_type,
            scope_id=scope_id,
            current=OEEMetrics(**{k: cur[k] for k in ("availability", "performance", "quality", "oee", "is_estimated")}),
            hourly=_points(trends["hourly"]),
            daily=_points(trends["daily"]),
            weekly=_points(trends["weekly"]),
            monthly=_points(trends["monthly"]),
        )

    async def get_asset_workspace(
        self, session: AsyncSession, user: User, asset_id: UUID
    ) -> AssetWorkspaceResponse:
        pulse = await self.get_asset_pulse(session, user, asset_id)
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        qr_result = await session.execute(select(QRAsset).where(QRAsset.asset_id == asset_id))
        qr = qr_result.scalar_one_or_none()

        open_wos = await session.execute(
            select(MaintenanceWorkOrder)
            .where(
                MaintenanceWorkOrder.asset_id == asset_id,
                MaintenanceWorkOrder.status.notin_(list(_CLOSED_WO)),
            )
            .limit(10)
        )
        wos = [
            {"id": str(w.id), "title": w.title, "status": w.status, "due_at": w.due_at.isoformat() if w.due_at else None}
            for w in open_wos.scalars()
        ]

        inspections = await session.execute(
            select(SafetyInspection)
            .where(SafetyInspection.asset_id == asset_id)
            .order_by(SafetyInspection.inspected_at.desc())
            .limit(5)
        )
        sops = await self._safety.list_sops(session, asset.plant_id, asset_id)

        from app.services.energy_service import EnergyService

        energy = await EnergyService().plant_dashboard(session, asset.plant_id)
        asset_energy = next((a for a in energy["assets"] if a["asset_id"] == str(asset_id)), None)

        meta = asset.metadata_ or {}
        location = meta.get("location") or meta.get("bay")
        rul = None
        expected = (asset.expected_life or {}).get("heats") or (asset.expected_life or {}).get("heat_count")
        used = (asset.life_counters or {}).get("heat_count") or (asset.life_counters or {}).get("heats") or 0
        if expected:
            rul = max(0, round((1 - float(used) / float(expected)) * 100, 1))

        alerts = await self.get_alerts(session, user, asset.plant_id)
        asset_alerts = [a for a in alerts if a.entity_id == asset_id][:5]

        return AssetWorkspaceResponse(
            asset_id=asset_id,
            asset_no=asset.asset_no,
            asset_name=asset.name,
            department_id=asset.department_id,
            department_name=pulse.department_name,
            status=pulse.status,
            health_score=pulse.health_score,
            health_category=pulse.health_category,
            current_operator=pulse.current_operator,
            current_run_id=pulse.current_run_id,
            current_run_label=pulse.current_run_label,
            current_shift_code=pulse.current_shift_code,
            location=location,
            installation_date=asset.installation_date.isoformat() if asset.installation_date else None,
            remaining_useful_life_pct=rul,
            qr_payload=qr.qr_payload if qr else f"asset:{asset_id}",
            live_parameters=[LiveParameterItem(**p) for p in pulse.live_parameters],
            open_alerts=asset_alerts,
            oee=pulse.oee,
            energy_kwh_today=asset_energy["kwh"] if asset_energy else None,
            maintenance={"open_work_orders": wos},
            inspections=[
                {"id": str(i.id), "type": i.inspection_type, "inspected_at": i.inspected_at.isoformat()}
                for i in inspections.scalars()
            ],
            sops=[{"id": str(s.id), "title": s.title, "category": s.category} for s in sops],
            incidents=[],
            emergency_contacts=EMERGENCY_CONTACTS,
        )

    async def get_qr(self, session: AsyncSession, user: User, asset_id: UUID) -> QRAssetResponse:
        asset = await session.get(Asset, asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        self._assert_plant_access(user, asset.plant_id)
        qr_result = await session.execute(select(QRAsset).where(QRAsset.asset_id == asset_id))
        qr = qr_result.scalar_one_or_none()
        payload = qr.qr_payload if qr else f"asset:{asset_id}"
        return QRAssetResponse(
            asset_id=asset_id,
            qr_payload=payload,
            workspace_url=f"/assets/{asset_id}/workspace",
        )

    async def get_maintenance_intelligence(
        self, session: AsyncSession, user: User, plant_id: UUID
    ) -> dict:
        self._assert_plant_access(user, plant_id)
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        assets = await session.execute(select(Asset).where(Asset.plant_id == plant_id))
        asset_list = list(assets.scalars())
        running = sum(1 for a in asset_list if a.status == AssetStatus.ACTIVE or str(a.status).endswith("active"))

        wos = await session.execute(
            select(MaintenanceWorkOrder).where(MaintenanceWorkOrder.plant_id == plant_id)
        )
        wo_list = list(wos.scalars())
        open_wos = [w for w in wo_list if w.status not in _CLOSED_WO]
        under_pm = sum(1 for w in open_wos if w.status in ("in_progress", "assigned"))
        breakdown = sum(1 for w in open_wos if "breakdown" in (w.title or "").lower())
        waiting_parts = sum(1 for w in open_wos if w.status == "waiting_parts")
        waiting_shutdown = sum(1 for w in open_wos if w.status == "waiting_shutdown")
        completed_today = sum(
            1 for w in wo_list if w.completed_at and w.completed_at >= today_start
        )
        upcoming = sum(
            1 for w in open_wos if w.due_at and w.due_at > now and (w.due_at - now).days <= 7
        )
        overdue = sum(1 for w in open_wos if w.due_at and w.due_at < now)
        total_due = sum(1 for w in wo_list if w.due_at)
        pm_compliance = round((1 - overdue / total_due) * 100, 1) if total_due else 100.0

        dt_result = await session.execute(
            select(func.coalesce(func.sum(MaintenanceDowntimeRecord.duration_min), 0))
            .join(MaintenanceWorkOrder, MaintenanceDowntimeRecord.work_order_id == MaintenanceWorkOrder.id)
            .where(MaintenanceWorkOrder.plant_id == plant_id)
        )
        downtime_hours = float(dt_result.scalar() or 0) / 60.0

        return {
            "assets_running": running,
            "under_pm": under_pm,
            "breakdown": breakdown,
            "waiting_parts": waiting_parts,
            "waiting_shutdown": waiting_shutdown,
            "completed_today": completed_today,
            "upcoming_pm": upcoming,
            "pm_compliance_pct": pm_compliance,
            "mtbf_hours": 720.0,
            "mttr_hours": 4.5,
            "maintenance_cost": None,
            "downtime_hours": downtime_hours,
        }
