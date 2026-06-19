from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, SupervisorUser
from app.schemas.moi import (
    CorrectiveActionCreate,
    CorrectiveActionResponse,
    CorrectiveActionUpdate,
    ObservationCreate,
    ObservationResponse,
    OperationalEventCreate,
    OperationalEventResponse,
    TelemetryBindingResponse,
)
from app.services.operations_service import EventService, ObservationService

router = APIRouter()
event_service = EventService()
observation_service = ObservationService()


@router.post("/integrations/events", response_model=list[OperationalEventResponse])
async def ingest_events(events: list[OperationalEventCreate], session: DbSession, user: CurrentUser):
    return await event_service.ingest_events(session, events, user)


@router.post("/integrations/lims/results", response_model=list[OperationalEventResponse])
async def lims_webhook(events: list[OperationalEventCreate], session: DbSession, user: CurrentUser):
    for e in events:
        e.source = __import__("app.models.enums", fromlist=["EventSource"]).EventSource.LIMS
    return await event_service.ingest_events(session, events, user)


@router.get("/integrations/bindings", response_model=list[TelemetryBindingResponse])
async def list_bindings(session: DbSession, _: CurrentUser, asset_id: UUID | None = None):
    return await event_service.list_bindings(session, asset_id)


@router.get("/process-runs/{run_id}/events", response_model=list[OperationalEventResponse])
async def run_events(run_id: UUID, session: DbSession, _: CurrentUser):
    return await event_service.list_run_events(session, run_id)


@router.post("/observations", response_model=ObservationResponse, status_code=201)
async def create_observation(data: ObservationCreate, session: DbSession, user: CurrentUser):
    return await observation_service.create(session, user, data)


@router.get("/observations", response_model=list[ObservationResponse])
async def list_observations(
    session: DbSession, _: SupervisorUser, plant_id: UUID | None = None, status: str | None = None
):
    return await observation_service.list_observations(session, plant_id, status)


@router.post("/observations/{observation_id}/corrective-actions", response_model=CorrectiveActionResponse, status_code=201)
async def create_corrective_action(
    observation_id: UUID, data: CorrectiveActionCreate, session: DbSession, user: SupervisorUser
):
    return await observation_service.create_corrective_action(session, user, observation_id, data)


@router.patch("/corrective-actions/{action_id}", response_model=CorrectiveActionResponse)
async def update_corrective_action(
    action_id: UUID, data: CorrectiveActionUpdate, session: DbSession, user: CurrentUser
):
    return await observation_service.update_corrective_action(session, user, action_id, data)


@router.get("/dashboards/actions/open", response_model=list[CorrectiveActionResponse])
async def open_actions(session: DbSession, _: SupervisorUser, plant_id: UUID | None = None):
    return await observation_service.list_open_actions(session, plant_id)
