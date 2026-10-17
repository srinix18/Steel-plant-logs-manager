"""Operational inventory: stock follows the ledger, so it changes with receipts, counts and what runs consume.

Balance = opening + receipts + counts - consumption. Consumption is recorded by the cost engine from the same
log-sheet rules that price a run, so a heat that uses 3 t of scrap takes 3 t off the stock and adds its cost.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import InventoryMovement, InventorySnapshot, MaterialCatalog, Plant
from app.services.pulse_notification_service import PulseNotificationService

# Fuels and gases tracked next to the catalogue materials: code -> (name, unit, opening, low threshold, location, supplier)
FUEL_ITEMS: dict[str, tuple[str, str, float, float, str, str]] = {
    "FURNACE_OIL": ("Furnace Oil", "litre", 30000, 6000, "Fuel Tank", "IOCL"),
    "ARGON": ("Argon", "Nm3", 20000, 4000, "Gas Yard", "Linde"),
    "OXYGEN": ("Oxygen", "Nm3", 40000, 8000, "Gas Yard", "Linde"),
    "NITROGEN": ("Nitrogen", "Nm3", 25000, 5000, "Gas Yard", "Linde"),
}

# Opening stock (MT) and low-stock level for catalogue materials; others default to 50 / 10 MT.
MATERIAL_STOCK: dict[str, tuple[float, float, str, str]] = {
    "304_SCRAP": (120, 25, "Yard A", "Local Supplier"),
    "316_SCRAP": (60, 12, "Yard A", "Local Supplier"),
    "410_SCRAP": (40, 8, "Yard B", "Local Supplier"),
    "2205_SCRAP": (30, 6, "Yard B", "Local Supplier"),
    "CRCA": (25, 5, "Yard B", "Steel Traders"),
    "HC_FE_CR": (20, 4, "Alloy Store", "Ferro Alloys Ltd"),
    "HC_FESI": (15, 3, "Alloy Store", "Ferro Alloys Ltd"),
    "FE_NI": (6, 2, "Alloy Store", "Nickel Suppliers"),
    "FE_CR": (18, 4, "Alloy Store", "Ferro Alloys Ltd"),
    "FE_MN": (12, 3, "Alloy Store", "Ferro Alloys Ltd"),
    "FE_SI": (14, 3, "Alloy Store", "Ferro Alloys Ltd"),
    "FE_MO": (1.5, 0.5, "Alloy Store", "Mo Alloys"),
    "P_NI": (3, 1, "Alloy Store", "Nickel Suppliers"),
    "TI": (1, 0.4, "Alloy Store", "Metal Traders"),
    "LIME": (60, 10, "SMS Store", "Raj Lime Co"),
    "DOLOMITE": (80, 12, "SMS Store", "Mineral Traders"),
    "CPC": (5, 1.5, "CCM Store", "Powder India"),
    "OTHER": (10, 2, "SMS Store", "Local Supplier"),
}

# Log-sheet quantities are in kg for materials; stock for materials is kept in MT.
KG_PER_MT = 1000.0


def fuel_code(name: str) -> str:
    return name.strip().upper().replace(" ", "_")


class InventoryPulseService:
    def __init__(self) -> None:
        self._notify = PulseNotificationService()

    # ------------------------------------------------------------------ items
    async def ensure_items(self, session: AsyncSession, plant_id: UUID) -> None:
        """Make sure every material and fuel has a stock record with an opening balance."""
        plant = await session.get(Plant, plant_id)
        if not plant:
            return
        opened_at = datetime.now(timezone.utc) - timedelta(days=45)
        wanted: list[tuple[str, str, str, float, float, str, str]] = []
        catalogue = (await session.execute(select(MaterialCatalog).where(MaterialCatalog.organisation_id == plant.organisation_id))).scalars()
        for mat in catalogue:
            opening, threshold, location, supplier = MATERIAL_STOCK.get(mat.code, (50, 10, "Store", "Local Supplier"))
            wanted.append((mat.code, mat.name, "MT", opening, threshold, location, supplier))
        for code, (name, unit, opening, threshold, location, supplier) in FUEL_ITEMS.items():
            wanted.append((code, name, unit, opening, threshold, location, supplier))
        opened = {c for (c,) in await session.execute(
            select(InventoryMovement.material_code).where(InventoryMovement.plant_id == plant_id, InventoryMovement.movement_type == "opening"))}
        snaps = {r.material_code: r for r in (await session.execute(select(InventorySnapshot).where(InventorySnapshot.plant_id == plant_id))).scalars()}
        for code, name, unit, opening, threshold, location, supplier in wanted:
            snap = snaps.get(code)
            if snap is None:
                session.add(InventorySnapshot(
                    plant_id=plant_id, material_code=code, material_name=name, quantity=opening, unit=unit,
                    location=location, supplier=supplier, low_stock_threshold=threshold, status="normal",
                ))
            if code not in opened:
                # Also covers rows left by the old hard-coded stock list, which had no ledger behind them.
                session.add(InventoryMovement(plant_id=plant_id, material_code=code, movement_type="opening", quantity=opening,
                                              note="Opening balance", moved_at=opened_at))
                if snap is not None:
                    snap.unit, snap.low_stock_threshold, snap.location, snap.supplier = unit, threshold, location, supplier
        # Old placeholder rows (hard-coded quantities that no log sheet could change) are removed.
        allowed = {w[0] for w in wanted}
        for snap in (await session.execute(select(InventorySnapshot).where(InventorySnapshot.plant_id == plant_id))).scalars():
            if snap.material_code not in allowed:
                has_history = (await session.execute(
                    select(func.count()).select_from(InventoryMovement).where(
                        InventoryMovement.plant_id == plant_id, InventoryMovement.material_code == snap.material_code)
                )).scalar()
                if not has_history:
                    await session.delete(snap)
        await session.flush()

    # ------------------------------------------------------------- movements
    async def record_consumption(
        self, session: AsyncSession, plant_id: UUID, run_id: UUID, moved_at: datetime, used: dict[str, float]
    ) -> None:
        """Replace what one run consumed (so recalculating a run never counts it twice). ``used`` is in item units."""
        await session.execute(delete(InventoryMovement).where(
            InventoryMovement.run_id == run_id, InventoryMovement.movement_type == "consumption"))
        for code, qty in used.items():
            if qty:
                session.add(InventoryMovement(plant_id=plant_id, material_code=code, movement_type="consumption",
                                              quantity=-abs(qty), run_id=run_id, note="Used on log sheet", moved_at=moved_at))
        await session.flush()

    async def _balances(self, session: AsyncSession, plant_id: UUID) -> dict[str, float]:
        rows = await session.execute(
            select(InventoryMovement.material_code, func.coalesce(func.sum(InventoryMovement.quantity), 0))
            .where(InventoryMovement.plant_id == plant_id).group_by(InventoryMovement.material_code)
        )
        return {code: float(total) for code, total in rows}

    async def _daily_use(self, session: AsyncSession, plant_id: UUID) -> dict[str, float]:
        """Average consumption per day over the last 30 days (or since the first use, if shorter)."""
        since = datetime.now(timezone.utc) - timedelta(days=30)
        rows = await session.execute(
            select(InventoryMovement.material_code, func.coalesce(func.sum(-InventoryMovement.quantity), 0), func.min(InventoryMovement.moved_at))
            .where(InventoryMovement.plant_id == plant_id, InventoryMovement.movement_type == "consumption",
                   InventoryMovement.moved_at >= since)
            .group_by(InventoryMovement.material_code)
        )
        out: dict[str, float] = {}
        now = datetime.now(timezone.utc)
        for code, total, first in rows:
            days = max(1.0, (now - first).total_seconds() / 86400) if first else 1.0
            out[code] = float(total) / days
        return out

    # ---------------------------------------------------------------- reads
    async def list_snapshots(self, session: AsyncSession, plant_id: UUID) -> list[InventorySnapshot]:
        await self.ensure_items(session, plant_id)
        await self.refresh_snapshots(session, plant_id)
        result = await session.execute(
            select(InventorySnapshot).where(InventorySnapshot.plant_id == plant_id)
            .order_by(InventorySnapshot.status.desc(), InventorySnapshot.material_name)
        )
        return list(result.scalars())

    async def refresh_snapshots(self, session: AsyncSession, plant_id: UUID, organisation_id: UUID | None = None) -> int:
        """Bring every stock record in line with the ledger: quantity, usage, days left, status."""
        balances = await self._balances(session, plant_id)
        use = await self._daily_use(session, plant_id)
        count = 0
        for snap in (await session.execute(select(InventorySnapshot).where(InventorySnapshot.plant_id == plant_id))).scalars():
            qty = round(balances.get(snap.material_code, snap.quantity), 3)
            daily = use.get(snap.material_code)
            days = round(qty / daily, 1) if daily and daily > 0 else None
            threshold = snap.low_stock_threshold or 0
            status = "normal"
            if qty <= 0 or (threshold and qty <= threshold * 0.5) or (days is not None and days < 3):
                status = "critical"
            elif (threshold and qty <= threshold) or (days is not None and days < 7):
                status = "warning"
            was = snap.status
            snap.quantity, snap.avg_daily_consumption, snap.days_remaining, snap.status = qty, daily, days, status
            snap.snapshot_at = datetime.now(timezone.utc)
            if status == "critical" and was != "critical" and organisation_id:
                await self._notify.notify_plant_leaders(
                    session, organisation_id, notification_type="low_inventory",
                    title=f"Low stock: {snap.material_name}", body=f"Only {qty:g} {snap.unit} left",
                    entity_type="inventory",
                )
            count += 1
        await session.flush()
        return count

    # --------------------------------------------------------------- writes
    async def adjust(
        self, session: AsyncSession, plant_id: UUID, material_code: str, quantity: float,
        quality_grade: str | None = None, location: str | None = None, user_id: UUID | None = None,
    ) -> InventorySnapshot:
        """A stock count: set the quantity to what was counted. Recorded as an adjustment for the difference."""
        await self.ensure_items(session, plant_id)
        snap = (await session.execute(select(InventorySnapshot).where(
            InventorySnapshot.plant_id == plant_id, InventorySnapshot.material_code == material_code))).scalar_one_or_none()
        if snap is None:
            snap = InventorySnapshot(plant_id=plant_id, material_code=material_code, material_name=material_code, quantity=0, unit="MT")
            session.add(snap)
            await session.flush()
        current = (await self._balances(session, plant_id)).get(material_code, 0.0)
        if quantity != current:
            session.add(InventoryMovement(plant_id=plant_id, material_code=material_code, movement_type="adjustment",
                                          quantity=quantity - current, note="Stock count", created_by=user_id))
        if quality_grade:
            snap.quality_grade = quality_grade
        if location:
            snap.location = location
        await session.flush()
        await self.refresh_snapshots(session, plant_id)
        return snap

    async def receive(
        self, session: AsyncSession, plant_id: UUID, material_code: str, quantity: float,
        supplier: str | None = None, note: str | None = None, user_id: UUID | None = None,
    ) -> InventorySnapshot:
        """Goods received: adds to stock."""
        await self.ensure_items(session, plant_id)
        snap = (await session.execute(select(InventorySnapshot).where(
            InventorySnapshot.plant_id == plant_id, InventorySnapshot.material_code == material_code))).scalar_one_or_none()
        if snap is None:
            raise ValueError("Unknown material")
        session.add(InventoryMovement(plant_id=plant_id, material_code=material_code, movement_type="receipt",
                                      quantity=abs(quantity), note=note or (f"Received from {supplier}" if supplier else "Received"), created_by=user_id))
        if supplier:
            snap.supplier = supplier
        await session.flush()
        await self.refresh_snapshots(session, plant_id)
        return snap
