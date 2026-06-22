from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import MaintenanceIssue, Plant, User
from app.db.types import categories_equal, pg_category_matches_division
from app.models.enums import MaintenanceIssueStatus, ObservationCategory
from app.schemas.moi import MaintenanceIssueClose, MaintenanceIssueCreate, MaintenanceIssueResponse, UserBrief
from app.services.access_scope import (
    apply_maintenance_issue_scope,
    assert_maintenance_issue_access,
    can_raise_maintenance_issue,
    is_maintenance,
    is_platform_admin,
)
from app.services.notification_service import notify_maintenance_division, notify_user_maintenance_event


def _to_response(issue: MaintenanceIssue) -> MaintenanceIssueResponse:
    data = MaintenanceIssueResponse.model_validate(issue)
    if issue.raiser:
        data.raised_by_user = UserBrief.model_validate(issue.raiser)
    if issue.assignee:
        data.assigned_to_user = UserBrief.model_validate(issue.assignee)
    if issue.closer:
        data.closed_by_user = UserBrief.model_validate(issue.closer)
    return data


class MaintenanceIssueService:
    async def list_categories(self) -> list[dict[str, str]]:
        labels = {
            ObservationCategory.QUALITY: "Quality",
            ObservationCategory.SAFETY: "Safety",
            ObservationCategory.ENERGY: "Energy",
            ObservationCategory.EQUIPMENT: "Equipment",
            ObservationCategory.PROCESS: "Process",
        }
        return [{"value": c.value, "label": labels[c]} for c in ObservationCategory]

    async def create_issue(
        self, session: AsyncSession, user: User, data: MaintenanceIssueCreate
    ) -> MaintenanceIssueResponse:
        if not can_raise_maintenance_issue(user):
            raise HTTPException(status_code=403, detail="Not permitted to raise maintenance issues")

        plant_id = data.plant_id or user.plant_id
        if not plant_id:
            raise HTTPException(status_code=400, detail="plant_id is required")

        plant = await session.get(Plant, plant_id)
        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")

        org_id = user.organisation_id or plant.organisation_id
        if not org_id:
            raise HTTPException(status_code=400, detail="organisation_id could not be resolved")

        issue = MaintenanceIssue(
            organisation_id=org_id,
            plant_id=plant_id,
            run_id=data.run_id,
            asset_id=data.asset_id,
            category=data.category,
            title=data.title.strip(),
            description=data.description.strip(),
            severity=data.severity,
            status=MaintenanceIssueStatus.OPEN,
            raised_by=user.id,
            raised_at=datetime.now(timezone.utc),
        )
        session.add(issue)
        await session.flush()
        await session.refresh(issue, ["raiser"])
        await notify_maintenance_division(session, issue, exclude_user_id=user.id)
        return _to_response(issue)

    async def list_issues(
        self,
        session: AsyncSession,
        user: User,
        *,
        category: ObservationCategory | None = None,
        status: MaintenanceIssueStatus | None = None,
        run_id: UUID | None = None,
    ) -> list[MaintenanceIssueResponse]:
        query = select(MaintenanceIssue).options(
            selectinload(MaintenanceIssue.raiser),
            selectinload(MaintenanceIssue.assignee),
            selectinload(MaintenanceIssue.closer),
        )
        if is_maintenance(user):
            query = query.where(pg_category_matches_division(MaintenanceIssue.category, user.maintenance_division))
            if user.organisation_id:
                query = query.where(MaintenanceIssue.organisation_id == user.organisation_id)
        else:
            query = apply_maintenance_issue_scope(query, user)

        if category:
            query = query.where(MaintenanceIssue.category == category)
        if status:
            query = query.where(MaintenanceIssue.status == status)
        if run_id:
            query = query.where(MaintenanceIssue.run_id == run_id)

        result = await session.execute(query.order_by(MaintenanceIssue.raised_at.desc()))
        return [_to_response(i) for i in result.scalars()]

    async def list_for_run(self, session: AsyncSession, user: User, run_id: UUID) -> list[MaintenanceIssueResponse]:
        return await self.list_issues(session, user, run_id=run_id)

    async def get_issue(self, session: AsyncSession, user: User, issue_id: UUID) -> MaintenanceIssueResponse:
        result = await session.execute(
            select(MaintenanceIssue)
            .where(MaintenanceIssue.id == issue_id)
            .options(
                selectinload(MaintenanceIssue.raiser),
                selectinload(MaintenanceIssue.assignee),
                selectinload(MaintenanceIssue.closer),
            )
        )
        issue = result.scalar_one_or_none()
        if not issue:
            raise HTTPException(status_code=404, detail="Maintenance issue not found")
        await assert_maintenance_issue_access(session, issue, user)
        return _to_response(issue)

    async def assign_to_self(self, session: AsyncSession, user: User, issue_id: UUID) -> MaintenanceIssueResponse:
        if not is_maintenance(user):
            raise HTTPException(status_code=403, detail="Only maintenance crew can assign issues")

        issue = await session.get(MaintenanceIssue, issue_id)
        if not issue:
            raise HTTPException(status_code=404, detail="Maintenance issue not found")
        if not categories_equal(issue.category, user.maintenance_division):
            raise HTTPException(status_code=403, detail="Issue is not in your category")
        if issue.status != MaintenanceIssueStatus.OPEN:
            raise HTTPException(status_code=400, detail="Only open issues can be assigned")

        now = datetime.now(timezone.utc)
        issue.status = MaintenanceIssueStatus.IN_PROGRESS
        issue.assigned_to = user.id
        issue.assigned_at = now
        await session.flush()
        await session.refresh(issue, ["raiser", "assignee", "closer"])
        return _to_response(issue)

    async def close_issue(
        self, session: AsyncSession, user: User, issue_id: UUID, data: MaintenanceIssueClose
    ) -> MaintenanceIssueResponse:
        if not is_maintenance(user):
            raise HTTPException(status_code=403, detail="Only maintenance crew can close issues")

        issue = await session.get(MaintenanceIssue, issue_id)
        if not issue:
            raise HTTPException(status_code=404, detail="Maintenance issue not found")
        if not categories_equal(issue.category, user.maintenance_division):
            raise HTTPException(status_code=403, detail="Issue is not in your category")
        if issue.status == MaintenanceIssueStatus.CLOSED:
            raise HTTPException(status_code=400, detail="Issue is already closed")
        if issue.status == MaintenanceIssueStatus.OPEN:
            raise HTTPException(status_code=400, detail="Assign the issue before closing")

        now = datetime.now(timezone.utc)
        issue.status = MaintenanceIssueStatus.CLOSED
        issue.closed_by = user.id
        issue.closed_at = now
        issue.resolution_notes = data.resolution_notes.strip()
        await session.flush()
        await session.refresh(issue, ["raiser", "assignee", "closer"])
        await notify_user_maintenance_event(session, issue.raised_by, issue, "maintenance_issue_closed")
        return _to_response(issue)

    async def open_count(self, session: AsyncSession, user: User) -> int:
        from sqlalchemy import func

        query = select(func.count()).select_from(MaintenanceIssue).where(
            MaintenanceIssue.status.in_([MaintenanceIssueStatus.OPEN, MaintenanceIssueStatus.IN_PROGRESS])
        )
        if is_maintenance(user) and user.maintenance_division:
            query = query.where(pg_category_matches_division(MaintenanceIssue.category, user.maintenance_division))
        else:
            query = apply_maintenance_issue_scope(query, user)
        result = await session.execute(query)
        return result.scalar() or 0
