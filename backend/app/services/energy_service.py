"""Energy consumption aggregation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, AssetLiveParameter, Department, EnergyReading, FactProcessRun, ProcessRun


class EnergyService:
    async def plant_dashboard(self, session: AsyncSession, plant_id: UUID) -> dict:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)

        async def _sum(since: datetime) -> float:
            r = await session.execute(
                select(func.coalesce(func.sum(EnergyReading.kwh), 0)).where(
                    EnergyReading.plant_id == plant_id, EnergyReading.reading_at >= since
                )
            )
            return float(r.scalar() or 0)

        today_kwh = await _sum(today_start)
        if not today_kwh:
            today_kwh = await self._fallback_power(session, plant_id)

        week_kwh = await _sum(week_start) or today_kwh * 7
        month_kwh = await _sum(month_start) or today_kwh * 30

        peak_val = (await session.execute(
            select(func.max(EnergyReading.peak_kw)).where(EnergyReading.plant_id == plant_id)
        )).scalar()
        avg_val = (await session.execute(
            select(func.avg(EnergyReading.peak_kw)).where(
                EnergyReading.plant_id == plant_id, EnergyReading.reading_at >= week_start
            )
        )).scalar()

        depts = await session.execute(select(Department).where(Department.plant_id == plant_id))
        dept_rows = []
        for dept in depts.scalars():
            dr = await session.execute(
                select(func.coalesce(func.sum(EnergyReading.kwh), 0)).where(
                    EnergyReading.department_id == dept.id, EnergyReading.reading_at >= today_start
                )
            )
            kwh = float(dr.scalar() or 0)
            dept_rows.append({"department_id": str(dept.id), "code": dept.code, "name": dept.name, "kwh": kwh})

        assets = await session.execute(select(Asset).where(Asset.plant_id == plant_id).limit(20))
        asset_rows = []
        for asset in assets.scalars():
            ar = await session.execute(
                select(func.coalesce(func.sum(EnergyReading.kwh), 0)).where(
                    EnergyReading.asset_id == asset.id, EnergyReading.reading_at >= today_start
                )
            )
            kwh = float(ar.scalar() or 0)
            if not kwh:
                pr = await session.execute(
                    select(AssetLiveParameter.value).where(
                        AssetLiveParameter.asset_id == asset.id, AssetLiveParameter.param_key == "power"
                    )
                )
                kwh = float(pr.scalar() or 0)
            asset_rows.append({"asset_id": str(asset.id), "name": asset.name, "kwh": kwh})

        hist = await session.execute(
            select(EnergyReading)
            .where(EnergyReading.plant_id == plant_id)
            .order_by(EnergyReading.reading_at.desc())
            .limit(30)
        )

        cost_per_kwh = 8.5
        return {
            "plant_id": plant_id,
            "today_kwh": today_kwh,
            "week_kwh": week_kwh,
            "month_kwh": month_kwh,
            "today_cost": round(today_kwh * cost_per_kwh, 2),
            "peak_load_kw": float(peak_val) if peak_val is not None else None,
            "avg_load_kw": float(avg_val) if avg_val is not None else None,
            "departments": dept_rows,
            "assets": asset_rows,
            "history": [
                {"reading_at": e.reading_at.isoformat(), "kwh": e.kwh, "cost": e.cost}
                for e in hist.scalars()
            ],
        }

    async def _fallback_power(self, session: AsyncSession, plant_id: UUID) -> float:
        r = await session.execute(
            select(func.coalesce(func.sum(FactProcessRun.energy_kwh), 0))
            .join(ProcessRun, FactProcessRun.run_id == ProcessRun.id)
            .where(FactProcessRun.plant_id == plant_id)
        )
        from_params = await session.execute(
            select(func.coalesce(func.sum(AssetLiveParameter.value), 0))
            .join(Asset, AssetLiveParameter.asset_id == Asset.id)
            .where(Asset.plant_id == plant_id, AssetLiveParameter.param_key == "power")
        )
        return float(r.scalar() or 0) + float(from_params.scalar() or 0)
