from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.moi import CoilLookupResponse, CoilResponse
from app.services.coil_service import CoilService

router = APIRouter()
coil_service = CoilService()


@router.get("/coils", response_model=list[CoilResponse])
async def list_coils(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID = Query(...),
    run_id: UUID = Query(...),
    purpose: str | None = Query(default=None),
):
    if purpose == "drawing":
        return await coil_service.list_coils_for_drawing(session, run_id, plant_id)
    return await coil_service.list_coils_for_run(session, run_id, plant_id)


@router.get("/coils/lookup", response_model=list[CoilLookupResponse])
async def lookup_coil(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID = Query(...),
    coil_no: str = Query(..., min_length=1),
    limit: int = Query(default=20, le=50),
):
    return await coil_service.lookup_coil(session, plant_id, coil_no, limit=limit)
