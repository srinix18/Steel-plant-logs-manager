from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.pulse import (
    AssetPulseResponse,
    AssetWorkspaceResponse,
    DepartmentPulseResponse,
    MaintenanceIntelligenceResponse,
    OEEResponse,
    PlantPulseResponse,
    PulseAlertItem,
    PulseEventItem,
    QRAssetResponse,
)
from app.services.pulse_aggregator_service import PulseAggregatorService
from app.services.pulse_service import PulseService

router = APIRouter()
pulse_service = PulseService()
aggregator = PulseAggregatorService()


@router.get("/pulse/plant/{plant_id}", response_model=PlantPulseResponse)
async def plant_pulse(plant_id: UUID, session: DbSession, user: CurrentUser):
    return await pulse_service.get_plant_pulse(session, user, plant_id)


@router.get("/pulse/department/{department_id}", response_model=DepartmentPulseResponse)
async def department_pulse(department_id: UUID, session: DbSession, user: CurrentUser):
    return await pulse_service.get_department_pulse(session, user, department_id)


@router.get("/pulse/asset/{asset_id}", response_model=AssetPulseResponse)
async def asset_pulse(asset_id: UUID, session: DbSession, user: CurrentUser):
    return await pulse_service.get_asset_pulse(session, user, asset_id)


@router.get("/pulse/feed", response_model=list[PulseEventItem])
async def pulse_feed(session: DbSession, user: CurrentUser, plant_id: UUID, limit: int = 30):
    return await pulse_service.get_feed(session, user, plant_id, limit)


@router.get("/pulse/alerts", response_model=list[PulseAlertItem])
async def pulse_alerts(session: DbSession, user: CurrentUser, plant_id: UUID):
    return await pulse_service.get_alerts(session, user, plant_id)


@router.post("/pulse/refresh")
async def pulse_refresh(
    session: DbSession, user: CurrentUser, plant_id: UUID | None = Query(None)
):
    from app.services.access_scope import is_ceo_tier

    if not is_ceo_tier(user):
        raise HTTPException(status_code=403, detail="Only plant leadership can refresh pulse data")
    stats = await aggregator.refresh_all(session, plant_id)
    await session.commit()
    return {"status": "ok", **stats}


@router.get("/oee/{scope_type}/{scope_id}", response_model=OEEResponse)
async def oee_metrics(scope_type: str, scope_id: UUID, session: DbSession, user: CurrentUser):
    return await pulse_service.get_oee(session, user, scope_type, scope_id)


@router.get("/assets/{asset_id}/workspace", response_model=AssetWorkspaceResponse)
async def asset_workspace(asset_id: UUID, session: DbSession, user: CurrentUser):
    return await pulse_service.get_asset_workspace(session, user, asset_id)


@router.get("/assets/{asset_id}/qr", response_model=QRAssetResponse)
async def asset_qr(asset_id: UUID, session: DbSession, user: CurrentUser):
    return await pulse_service.get_qr(session, user, asset_id)


@router.get("/maintenance/intelligence", response_model=MaintenanceIntelligenceResponse)
async def maintenance_intelligence(session: DbSession, user: CurrentUser, plant_id: UUID):
    data = await pulse_service.get_maintenance_intelligence(session, user, plant_id)
    return MaintenanceIntelligenceResponse(**data)
