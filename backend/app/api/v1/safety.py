from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, DbSession
from app.services.access_scope import (
    MAINTENANCE_ROLES,
    SUPERVISOR_TIER_ROLES,
    WORKER_ROLES,
    assert_plant_in_scope,
    user_has_role,
)
from app.schemas.pulse import (
    SafetyDashboardResponse,
    SafetyIncidentCreate,
    SafetyInspectionCreate,
)
from app.services.safety_service import SafetyService
from app.utils.chandan_org import get_chandan_plant

router = APIRouter()
safety_service = SafetyService()

# Anyone working on the floor may report an incident; only supervisors and above, or the
# maintenance crew, record inspections. HR and other roles have no safety write access.
INCIDENT_REPORTERS = SUPERVISOR_TIER_ROLES | MAINTENANCE_ROLES | WORKER_ROLES
INSPECTORS = SUPERVISOR_TIER_ROLES | MAINTENANCE_ROLES


@router.get("/safety/dashboard/{plant_id}", response_model=SafetyDashboardResponse)
async def safety_dashboard(plant_id: UUID, session: DbSession, user: CurrentUser):
    await assert_plant_in_scope(session, user, plant_id)
    data = await safety_service.dashboard(session, plant_id)
    return SafetyDashboardResponse(**data)


@router.get("/safety/inspections/{plant_id}")
async def list_inspections(plant_id: UUID, session: DbSession, user: CurrentUser):
    await assert_plant_in_scope(session, user, plant_id)
    rows = await safety_service.list_inspections(session, plant_id)
    return [
        {
            "id": str(r.id),
            "asset_id": str(r.asset_id) if r.asset_id else None,
            "inspection_type": r.inspection_type,
            "status": r.status,
            "findings": r.findings,
            "inspected_at": r.inspected_at.isoformat(),
            "next_due_at": r.next_due_at.isoformat() if r.next_due_at else None,
        }
        for r in rows
    ]


@router.post("/safety/inspections/{plant_id}", status_code=201)
async def create_inspection(
    plant_id: UUID, data: SafetyInspectionCreate, session: DbSession, user: CurrentUser
):
    await assert_plant_in_scope(session, user, plant_id)
    if not user_has_role(user, INSPECTORS):
        raise HTTPException(status_code=403, detail="Not permitted to record inspections")
    insp = await safety_service.create_inspection(
        session,
        plant_id,
        user,
        asset_id=data.asset_id,
        inspection_type=data.inspection_type,
        findings=data.findings,
        next_due_at=data.next_due_at,
    )
    await session.commit()
    return {"id": str(insp.id)}


@router.get("/safety/incidents/{plant_id}")
async def list_incidents(plant_id: UUID, session: DbSession, user: CurrentUser):
    await assert_plant_in_scope(session, user, plant_id)
    rows = await safety_service.list_incidents(session, plant_id)
    return [
        {
            "id": str(r.id),
            "title": r.title,
            "severity": r.severity,
            "status": r.status,
            "occurred_at": r.occurred_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/safety/incidents/{plant_id}", status_code=201)
async def create_incident(
    plant_id: UUID, data: SafetyIncidentCreate, session: DbSession, user: CurrentUser
):
    await assert_plant_in_scope(session, user, plant_id)
    if not user_has_role(user, INCIDENT_REPORTERS):
        raise HTTPException(status_code=403, detail="Not permitted to report incidents")
    inc = await safety_service.create_incident(
        session,
        plant_id,
        user,
        asset_id=data.asset_id,
        title=data.title,
        description=data.description,
        severity=data.severity,
        occurred_at=data.occurred_at,
    )
    await session.commit()
    return {"id": str(inc.id)}


@router.get("/safety/sops/{plant_id}")
async def list_sops(plant_id: UUID, session: DbSession, user: CurrentUser, asset_id: UUID | None = None):
    await assert_plant_in_scope(session, user, plant_id)
    rows = await safety_service.list_sops(session, plant_id, asset_id)
    return [{"id": str(s.id), "title": s.title, "category": s.category, "version": s.version} for s in rows]


@router.get("/safety/assets/search")
async def search_assets(
    session: DbSession,
    user: CurrentUser,
    q: str = "",
    plant_id: UUID | None = None,
    limit: int = 10,
):
    scoped_plant = plant_id or user.plant_id
    return await safety_service.search_assets(session, q, plant_id=scoped_plant, limit=limit)


@router.post("/safety/scan")
async def scan_qr(payload: dict, session: DbSession, user: CurrentUser):
    raw = payload.get("payload") or payload.get("qr_payload") or ""
    asset_id = await safety_service.resolve_qr(session, raw)
    if not asset_id:
        raise HTTPException(status_code=404, detail="Asset not found for QR payload")
    return {"asset_id": str(asset_id), "workspace_url": f"/assets/{asset_id}/workspace"}
