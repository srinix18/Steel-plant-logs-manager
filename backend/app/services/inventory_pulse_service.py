"""Operational inventory pulse — raw materials tracking."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import InventorySnapshot, MaterialCatalog, RunFieldValue
from app.services.pulse_notification_service import PulseNotificationService

DEFAULT_MATERIALS = [
    ("304_SCRAP", "Stainless Scrap", "MT", 450, 25, "Yard A", "Local Supplier"),
    ("LIME", "Lime", "MT", 80, 8, "SMS Store", "Raj Lime Co"),
    ("DOLOMITE", "Dolomite", "MT", 120, 10, "SMS Store", "Mineral Traders"),
    ("FECR", "Ferro Chrome", "MT", 35, 5, "Alloy Store", "Ferro Alloys Ltd"),
    ("FENI", "Ferro Nickel", "MT", 18, 3, "Alloy Store", "Nickel Suppliers"),
    ("FEMO", "Ferro Moly", "MT", 8, 2, "Alloy Store", "Mo Alloys"),
    ("ELECTRODES", "Graphite Electrodes", "Nos", 45, 8, "IAF Bay", "Electrode Corp"),
    ("FLUX", "Flux", "MT", 25, 4, "SMS Store", "Flux India"),
    ("FUEL", "Furnace Fuel", "KL", 5000, 800, "Fuel Tank", "IOCL"),
]


class InventoryPulseService:
    def __init__(self) -> None:
        self._notify = PulseNotificationService()

    async def refresh_snapshots(self, session: AsyncSession, plant_id: UUID, organisation_id: UUID) -> int:
        count = 0
        for code, name, unit, qty, threshold, location, supplier in DEFAULT_MATERIALS:
            consumption = await self._avg_consumption(session, code)
            days_remaining = qty / consumption if consumption and consumption > 0 else None
            status = "normal"
            if threshold and qty <= threshold * 0.5:
                status = "critical"
            elif threshold and qty <= threshold:
                status = "warning"

            existing = await session.execute(
                select(InventorySnapshot).where(
                    InventorySnapshot.plant_id == plant_id,
                    InventorySnapshot.material_code == code,
                )
            )
            snap = existing.scalar_one_or_none()
            if snap:
                snap.quantity = qty
                snap.avg_daily_consumption = consumption
                snap.days_remaining = days_remaining
                snap.status = status
                snap.snapshot_at = datetime.now(timezone.utc)
            else:
                snap = InventorySnapshot(
                    plant_id=plant_id,
                    material_code=code,
                    material_name=name,
                    quantity=qty,
                    unit=unit,
                    location=location,
                    avg_daily_consumption=consumption,
                    days_remaining=days_remaining,
                    current_value=qty * 1000,
                    supplier=supplier,
                    low_stock_threshold=threshold,
                    status=status,
                )
                session.add(snap)
            count += 1

            if status == "critical":
                await self._notify.notify_plant_leaders(
                    session,
                    organisation_id,
                    notification_type="low_inventory",
                    title=f"Low stock: {name}",
                    body=f"Only {qty} {unit} remaining",
                    entity_type="inventory",
                )
        return count

    async def list_snapshots(self, session: AsyncSession, plant_id: UUID) -> list[InventorySnapshot]:
        result = await session.execute(
            select(InventorySnapshot)
            .where(InventorySnapshot.plant_id == plant_id)
            .order_by(InventorySnapshot.status.desc(), InventorySnapshot.material_name)
        )
        return list(result.scalars())

    async def adjust(
        self,
        session: AsyncSession,
        plant_id: UUID,
        material_code: str,
        quantity: float,
        quality_grade: str | None = None,
        location: str | None = None,
    ) -> InventorySnapshot:
        result = await session.execute(
            select(InventorySnapshot).where(
                InventorySnapshot.plant_id == plant_id,
                InventorySnapshot.material_code == material_code,
            )
        )
        snap = result.scalar_one_or_none()
        if not snap:
            cat = await session.execute(
                select(MaterialCatalog).where(MaterialCatalog.code == material_code).limit(1)
            )
            mat = cat.scalar_one_or_none()
            snap = InventorySnapshot(
                plant_id=plant_id,
                material_code=material_code,
                material_name=mat.name if mat else material_code,
                quantity=quantity,
                unit="MT",
            )
            session.add(snap)
        else:
            snap.quantity = quantity
        if quality_grade:
            snap.quality_grade = quality_grade
        if location:
            snap.location = location
        threshold = snap.low_stock_threshold or 0
        if threshold and quantity <= threshold * 0.5:
            snap.status = "critical"
        elif threshold and quantity <= threshold:
            snap.status = "warning"
        else:
            snap.status = "normal"
        snap.snapshot_at = datetime.now(timezone.utc)
        return snap

    async def _avg_consumption(self, session: AsyncSession, material_code: str) -> float | None:
        result = await session.execute(
            select(func.count()).select_from(RunFieldValue).where(
                RunFieldValue.field_key.ilike(f"%{material_code}%")
            )
        )
        count = int(result.scalar() or 0)
        if count == 0:
            return 2.0
        return max(1.0, count / 30)
