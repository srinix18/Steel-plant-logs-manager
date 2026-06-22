from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MaintenanceIssue, User, UserNotification
from app.db.types import category_value
from app.models.enums import UserRole


async def notify_maintenance_division(
    session: AsyncSession,
    issue: MaintenanceIssue,
    *,
    exclude_user_id: UUID | None = None,
) -> int:
    query = select(User).where(
        User.role == UserRole.MAINTENANCE,
        User.maintenance_division == category_value(issue.category),
        User.organisation_id == issue.organisation_id,
        User.is_active.is_(True),
    )
    if exclude_user_id:
        query = query.where(User.id != exclude_user_id)

    result = await session.execute(query)
    recipients = list(result.scalars())
    for user in recipients:
        session.add(
            UserNotification(
                user_id=user.id,
                message_id=None,
                entity_type="maintenance_issue",
                entity_id=issue.id,
                notification_type="maintenance_issue",
            )
        )
    await session.flush()
    return len(recipients)


async def notify_user_maintenance_event(
    session: AsyncSession,
    user_id: UUID,
    issue: MaintenanceIssue,
    notification_type: str,
) -> None:
    session.add(
        UserNotification(
            user_id=user_id,
            message_id=None,
            entity_type="maintenance_issue",
            entity_id=issue.id,
            notification_type=notification_type,
        )
    )
    await session.flush()
