from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession, MaintenanceUser
from app.models.enums import MaintenanceIssueStatus, ObservationCategory
from app.schemas.moi import (
    MaintenanceIssueClose,
    MaintenanceIssueCreate,
    MaintenanceIssueResponse,
)
from app.services.maintenance_issue_service import MaintenanceIssueService

router = APIRouter()
service = MaintenanceIssueService()


@router.get("/maintenance/categories")
async def list_categories(_: CurrentUser):
    return await service.list_categories()


@router.post("/maintenance/issues", response_model=MaintenanceIssueResponse, status_code=201)
async def create_issue(data: MaintenanceIssueCreate, session: DbSession, user: CurrentUser):
    return await service.create_issue(session, user, data)


@router.get("/maintenance/issues", response_model=list[MaintenanceIssueResponse])
async def list_issues(
    session: DbSession,
    user: CurrentUser,
    category: ObservationCategory | None = None,
    status: MaintenanceIssueStatus | None = None,
    run_id: UUID | None = None,
):
    return await service.list_issues(session, user, category=category, status=status, run_id=run_id)


@router.get("/maintenance/issues/mine", response_model=list[MaintenanceIssueResponse])
async def my_issues(
    session: DbSession,
    user: MaintenanceUser,
    status: MaintenanceIssueStatus | None = None,
):
    return await service.list_issues(session, user, status=status)


@router.get("/maintenance/issues/open-count")
async def open_issue_count(session: DbSession, user: CurrentUser):
    count = await service.open_count(session, user)
    return {"count": count}


@router.get("/maintenance/issues/{issue_id}", response_model=MaintenanceIssueResponse)
async def get_issue(issue_id: UUID, session: DbSession, user: CurrentUser):
    return await service.get_issue(session, user, issue_id)


@router.post("/maintenance/issues/{issue_id}/assign", response_model=MaintenanceIssueResponse)
async def assign_issue(issue_id: UUID, session: DbSession, user: MaintenanceUser):
    return await service.assign_to_self(session, user, issue_id)


@router.post("/maintenance/issues/{issue_id}/close", response_model=MaintenanceIssueResponse)
async def close_issue(
    issue_id: UUID, data: MaintenanceIssueClose, session: DbSession, user: MaintenanceUser
):
    return await service.close_issue(session, user, issue_id, data)


@router.get("/process-runs/{run_id}/maintenance-issues", response_model=list[MaintenanceIssueResponse])
async def run_maintenance_issues(run_id: UUID, session: DbSession, user: CurrentUser):
    return await service.list_for_run(session, user, run_id)
