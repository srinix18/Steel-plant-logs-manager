"""Energy consumption, built from what the log sheets record (finished runs with a power reading)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asset, Department, FactProcessRun, PowerCostRate, Process, ProcessRun
from app.services.pulse_live import IST, day_start_utc


class EnergyService:
    async def _rows(self, session: AsyncSession, plant_id: UUID, since: datetime) -> list[dict]:
        """Finished runs that recorded energy since a time."""
        result = await session.execute(
            select(
                ProcessRun.completed_at, ProcessRun.started_at, ProcessRun.primary_asset_id,
                Process.department_id, FactProcessRun.energy_kwh,
            )
            .join(ProcessRun, FactProcessRun.run_id == ProcessRun.id)
            .join(Process, ProcessRun.process_id == Process.id)
            .where(FactProcessRun.plant_id == plant_id, FactProcessRun.energy_kwh > 0, ProcessRun.completed_at >= since)
        )
        return [
            {"at": at, "started": st, "asset_id": asset, "department_id": dept, "kwh": float(kwh)}
            for at, st, asset, dept, kwh in result
        ]

    async def _rate(self, session: AsyncSession, plant_id: UUID) -> float:
        row = (await session.execute(
            select(PowerCostRate).where(PowerCostRate.plant_id == plant_id).order_by(PowerCostRate.effective_from.desc()).limit(1)
        )).scalar_one_or_none()
        return float(row.cost_per_unit) if row else 0.0

    async def plant_dashboard(self, session: AsyncSession, plant_id: UUID) -> dict:
        today_start = day_start_utc()
        month = await self._rows(session, plant_id, today_start - timedelta(days=30))
        rate = await self._rate(session, plant_id)

        def total(rows: list[dict], since: datetime) -> float:
            return round(sum(r["kwh"] for r in rows if r["at"] >= since), 1)

        today_kwh = total(month, today_start)
        week_start = today_start - timedelta(days=7)

        # Average load of a run = its energy over the hours it ran; the peak is the busiest run this week.
        loads = []
        for r in month:
            if r["at"] >= week_start and r["started"] and r["at"] > r["started"]:
                hours = (r["at"] - r["started"]).total_seconds() / 3600
                if hours > 0:
                    loads.append(r["kwh"] / hours)

        depts = (await session.execute(select(Department).where(Department.plant_id == plant_id))).scalars().all()
        dept_rows = [
            {
                "department_id": str(d.id), "code": d.code, "name": d.name,
                "kwh": round(sum(r["kwh"] for r in month if r["department_id"] == d.id and r["at"] >= today_start), 1),
                "week_kwh": round(sum(r["kwh"] for r in month if r["department_id"] == d.id and r["at"] >= week_start), 1),
            }
            for d in depts
        ]
        assets = (await session.execute(select(Asset).where(Asset.plant_id == plant_id).limit(60))).scalars().all()
        asset_rows = [
            {
                "asset_id": str(a.id), "name": a.name,
                "kwh": round(sum(r["kwh"] for r in month if r["asset_id"] == a.id and r["at"] >= today_start), 1),
                "week_kwh": round(sum(r["kwh"] for r in month if r["asset_id"] == a.id and r["at"] >= week_start), 1),
            }
            for a in assets
        ]
        asset_rows.sort(key=lambda x: -x["week_kwh"])

        by_day: dict[date, float] = defaultdict(float)
        for r in month:
            by_day[r["at"].astimezone(IST).date()] += r["kwh"]
        history = [
            {"reading_at": datetime.combine(day, datetime.min.time(), tzinfo=IST).isoformat(), "kwh": round(kwh, 1), "cost": round(kwh * rate, 2)}
            for day, kwh in sorted(by_day.items(), reverse=True)[:30]
        ]

        return {
            "plant_id": plant_id,
            "today_kwh": today_kwh,
            "week_kwh": total(month, week_start),
            "month_kwh": total(month, today_start - timedelta(days=30)),
            "today_cost": round(today_kwh * rate, 2),
            "peak_load_kw": round(max(loads), 1) if loads else None,
            "avg_load_kw": round(sum(loads) / len(loads), 1) if loads else None,
            "departments": dept_rows,
            "assets": asset_rows,
            "history": history,
        }
