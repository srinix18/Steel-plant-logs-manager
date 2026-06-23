from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CeoUser, CurrentUser, DbSession
from app.schemas.moi import (
    DelayCodeCreate,
    DelayCodeResponse,
    DelayCodeUpdate,
    DelayEventResponse,
    DelayEventUpdate,
    HeatLookupResponse,
)
from app.services.delay_event_service import DelayEventService

router = APIRouter()
delay_service = DelayEventService()


@router.get("/delay-codes", response_model=list[DelayCodeResponse])
async def list_delay_codes(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID = Query(...),
    active_only: bool = Query(default=True),
):
    return await delay_service.list_delay_codes(session, plant_id, active_only=active_only)


@router.post("/delay-codes", response_model=DelayCodeResponse, status_code=201)
async def create_delay_code(data: DelayCodeCreate, session: DbSession, user: CeoUser):
    return await delay_service.create_delay_code(session, user, data)


@router.patch("/delay-codes/{code_id}", response_model=DelayCodeResponse)
async def update_delay_code(
    code_id: UUID, data: DelayCodeUpdate, session: DbSession, user: CeoUser
):
    return await delay_service.update_delay_code(session, user, code_id, data)


@router.get("/delay-events", response_model=list[DelayEventResponse])
async def list_delay_events(
    session: DbSession,
    user: CurrentUser,
    run_id: UUID | None = None,
    plant_id: UUID | None = None,
    status: str | None = None,
):
    return await delay_service.list_delay_events(session, run_id=run_id, plant_id=plant_id, status=status)


@router.patch("/delay-events/{event_id}", response_model=DelayEventResponse)
async def update_delay_event(
    event_id: UUID, data: DelayEventUpdate, session: DbSession, user: CurrentUser
):
    return await delay_service.update_delay_event(session, user, event_id, data)


@router.get("/process-runs/heat-lookup", response_model=list[HeatLookupResponse])
async def heat_lookup(
    session: DbSession,
    user: CurrentUser,
    heat_no: str = Query(..., min_length=1),
    limit: int = Query(default=20, le=50),
):
    return await delay_service.heat_lookup(session, heat_no, limit=limit)
