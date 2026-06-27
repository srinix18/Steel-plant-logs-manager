"""Asset health scoring engine."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, AssetHealthRecord, MaintenanceIssue, MaintenanceWorkOrder, ProcessRun
from app.models.enums import MaintenanceWorkOrderStatus
from app.services.oee_engine_service import OEEEngineService

_CLOSED_WO = {
    MaintenanceWorkOrderStatus.COMPLETED.value,
    MaintenanceWorkOrderStatus.VERIFIED.value,
    MaintenanceWorkOrderStatus.CLOSED.value,
}


def _category(score: float) -> str:
    if score >= 85:
        return "healthy"
    if score >= 60:
        return "warning"
    return "critical"


class AssetHealthEngineService:
    def __init__(self) -> None:
        self._oee = OEEEngineService()

    async def compute_health(self, session: AsyncSession, asset_id: UUID) -> dict:
        asset = await session.get(Asset, asset_id)
        if not asset:
            return {"score": 0, "category": "critical", "factors": {}}

        score = 100.0
        factors: dict[str, float | int | str] = {}

        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)

        overdue = await session.execute(
            select(func.count())
            .select_from(MaintenanceWorkOrder)
            .where(
                MaintenanceWorkOrder.asset_id == asset_id,
                MaintenanceWorkOrder.due_at.isnot(None),
                MaintenanceWorkOrder.due_at < now,
                MaintenanceWorkOrder.status.notin_(list(_CLOSED_WO)),
            )
        )
        overdue_count = int(overdue.scalar() or 0)
        if overdue_count:
            penalty = min(30, overdue_count * 10)
            score -= penalty
            factors["maintenance_overdue"] = overdue_count

        open_wo = await session.execute(
            select(func.count())
            .select_from(MaintenanceWorkOrder)
            .where(
                MaintenanceWorkOrder.asset_id == asset_id,
                MaintenanceWorkOrder.status.notin_(list(_CLOSED_WO)),
            )
        )
        open_count = int(open_wo.scalar() or 0)
        if open_count > 2:
            score -= min(15, (open_count - 2) * 3)
            factors["open_work_orders"] = open_count

        breakdowns = await session.execute(
            select(func.count())
            .select_from(MaintenanceIssue)
            .where(
                MaintenanceIssue.asset_id == asset_id,
                MaintenanceIssue.status == "open",
                MaintenanceIssue.raised_at >= week_ago,
            )
        )
        bd = int(breakdowns.scalar() or 0)
        if bd:
            score -= min(20, bd * 5)
            factors["recent_breakdowns"] = bd

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        oee_m = await self._oee.compute_oee(session, "asset", asset_id, today_start, now)
        oee_val = oee_m["oee"]
        if oee_val < 0.6:
            score -= 20
        elif oee_val < 0.75:
            score -= 10
        factors["oee"] = round(oee_val, 3)

        if asset.installation_date:
            age_years = (date.today() - asset.installation_date).days / 365.25
            if age_years > 15:
                score -= 10
            elif age_years > 10:
                score -= 5
            factors["age_years"] = round(age_years, 1)

        heat_count = (asset.life_counters or {}).get("heat_count") or (asset.life_counters or {}).get("heats") or 0
        expected = (asset.expected_life or {}).get("heats") or (asset.expected_life or {}).get("heat_count")
        if expected and heat_count:
            usage_pct = float(heat_count) / float(expected)
            if usage_pct > 0.9:
                score -= 15
            elif usage_pct > 0.75:
                score -= 8
            factors["usage_pct"] = round(usage_pct * 100, 1)

        score = max(0, min(100, round(score, 1)))
        category = _category(score)
        return {"score": score, "category": category, "factors": factors}

    async def persist_health(self, session: AsyncSession, asset_id: UUID) -> AssetHealthRecord:
        data = await self.compute_health(session, asset_id)
        record = AssetHealthRecord(
            asset_id=asset_id,
            score=data["score"],
            category=data["category"],
            factors=data["factors"],
        )
        session.add(record)
        return record

    async def get_latest(self, session: AsyncSession, asset_id: UUID) -> AssetHealthRecord | None:
        result = await session.execute(
            select(AssetHealthRecord)
            .where(AssetHealthRecord.asset_id == asset_id)
            .order_by(AssetHealthRecord.computed_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
