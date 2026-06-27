"""Phase 5 seed — QR codes, live parameters, energy readings, inventory, safety demo data."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Asset,
    AssetLiveParameter,
    EnergyReading,
    OperationalEvent,
    QRAsset,
    SafetyIncident,
    SafetyInspection,
    SopDocument,
    User,
)
from app.models.enums import EventSeverity, EventSource
from app.services.inventory_pulse_service import InventoryPulseService
from app.utils.chandan_org import get_chandan_organisation, get_chandan_plant


IAF_PARAMS = [
    ("power", "Power", "kW", 1250.0),
    ("temperature", "Temperature", "°C", 1580.0),
    ("voltage", "Voltage", "V", 850.0),
    ("current", "Current", "A", 42000.0),
    ("heat_number", "Heat Number", None, None),
    ("electrode_consumption", "Electrode Consumption", "kg", 45.0),
]

ROLLING_PARAMS = [
    ("speed", "Speed", "m/min", 12.5),
    ("load", "Load", "ton", 850.0),
    ("temperature", "Temperature", "°C", 1050.0),
    ("power", "Power", "kW", 3200.0),
    ("production", "Production", "ton/h", 8.2),
]

WIRE_PARAMS = [
    ("speed", "Drawing Speed", "m/min", 180.0),
    ("lubrication", "Lubrication", "L/min", 12.0),
    ("output", "Output", "kg/h", 450.0),
    ("motor_load", "Motor Load", "%", 78.0),
    ("temperature", "Temperature", "°C", 65.0),
    ("power", "Power", "kW", 180.0),
]


async def seed_phase5(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return
    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    assets = list((await session.execute(select(Asset).where(Asset.plant_id == plant.id))).scalars())
    for asset in assets:
        existing_qr = await session.execute(select(QRAsset).where(QRAsset.asset_id == asset.id))
        if not existing_qr.scalar_one_or_none():
            session.add(
                QRAsset(
                    asset_id=asset.id,
                    qr_payload=f"asset:{asset.id}",
                )
            )

    async def _seed_params(asset: Asset, params: list) -> None:
        for key, label, unit, val in params:
            ex = await session.execute(
                select(AssetLiveParameter).where(
                    AssetLiveParameter.asset_id == asset.id,
                    AssetLiveParameter.param_key == key,
                )
            )
            if ex.scalar_one_or_none():
                continue
            session.add(
                AssetLiveParameter(
                    asset_id=asset.id,
                    param_key=key,
                    label=label,
                    value=val if unit and val is not None else None,
                    value_text="H-2026-042" if key == "heat_number" else None,
                    unit=unit,
                    source="manual",
                )
            )

    for asset in assets:
        name_u = asset.name.upper()
        asset_no_u = asset.asset_no.upper()
        if "IAF" in name_u or "FURNACE" in name_u or "EAF" in name_u or "EAF" in asset_no_u:
            await _seed_params(asset, IAF_PARAMS)
        elif "ROLL" in name_u or "MILL" in name_u:
            await _seed_params(asset, ROLLING_PARAMS)
        elif "WIRE" in name_u or "DRAW" in name_u:
            await _seed_params(asset, WIRE_PARAMS)

    now = datetime.now(timezone.utc)
    energy_exists = await session.execute(
        select(EnergyReading).where(EnergyReading.plant_id == plant.id).limit(1)
    )
    if not energy_exists.scalar_one_or_none():
        for days_ago in range(7):
            ts = now - timedelta(days=days_ago)
            session.add(
                EnergyReading(
                    plant_id=plant.id,
                    reading_at=ts,
                    kwh=45000 + days_ago * 1000,
                    peak_kw=5200,
                    cost=(45000 + days_ago * 1000) * 8.5,
                    source="manual",
                )
            )
        for asset in assets[:5]:
            if asset.department_id:
                session.add(
                    EnergyReading(
                        plant_id=plant.id,
                        department_id=asset.department_id,
                        asset_id=asset.id,
                        reading_at=now,
                        kwh=1200 + hash(str(asset.id)) % 500,
                        peak_kw=800,
                        source="manual",
                    )
                )

    await InventoryPulseService().refresh_snapshots(session, plant.id, org.id)

    ceo = (await session.execute(select(User).where(User.email == "ceo@chandansteel.com"))).scalar_one_or_none()
    if ceo:
        insp_exists = await session.execute(
            select(SafetyInspection).where(SafetyInspection.plant_id == plant.id).limit(1)
        )
        if not insp_exists.scalar_one_or_none() and assets:
            session.add(
                SafetyInspection(
                    plant_id=plant.id,
                    asset_id=assets[0].id,
                    inspector_id=ceo.id,
                    inspection_type="routine",
                    findings="All safety guards in place. PPE compliance verified.",
                    inspected_at=now - timedelta(days=14),
                    next_due_at=now + timedelta(days=76),
                )
            )
            session.add(
                SafetyIncident(
                    plant_id=plant.id,
                    asset_id=assets[0].id if assets else None,
                    reported_by=ceo.id,
                    title="Minor spill near furnace bay",
                    description="Hydraulic oil spill contained and cleaned. No injuries.",
                    severity="low",
                    status="closed",
                    occurred_at=now - timedelta(days=30),
                )
            )

    sop_exists = await session.execute(select(SopDocument).where(SopDocument.plant_id == plant.id).limit(1))
    if not sop_exists.scalar_one_or_none():
        session.add(
            SopDocument(
                plant_id=plant.id,
                title="Induction Furnace Safe Operating Procedure",
                category="sop",
                version="2.1",
            )
        )
        session.add(
            SopDocument(
                plant_id=plant.id,
                title="Emergency Shutdown Procedure",
                category="emergency",
                version="1.0",
            )
        )

    events_exist = await session.execute(
        select(OperationalEvent).where(OperationalEvent.plant_id == plant.id).limit(1)
    )
    if not events_exist.scalar_one_or_none():
        demo_events = [
            ("heat_started", "Heat Started", EventSeverity.INFO),
            ("aod_completed", "AOD Completed", EventSeverity.INFO),
            ("rolling_delay", "Rolling Delay", EventSeverity.WARNING),
            ("maintenance_started", "Maintenance Started", EventSeverity.INFO),
            ("safety_alert", "Safety Alert Cleared", EventSeverity.INFO),
            ("work_order_closed", "Work Order Closed", EventSeverity.INFO),
            ("employee_checkin", "Employee Checked In", EventSeverity.INFO),
        ]
        for i, (etype, label, sev) in enumerate(demo_events):
            session.add(
                OperationalEvent(
                    plant_id=plant.id,
                    asset_id=assets[i % len(assets)].id if assets else None,
                    event_type=etype,
                    severity=sev,
                    occurred_at=now - timedelta(minutes=i * 15),
                    source=EventSource.SYSTEM,
                    payload={"label": label},
                )
            )

    from app.services.pulse_aggregator_service import PulseAggregatorService

    await PulseAggregatorService().refresh_all(session, plant.id)
