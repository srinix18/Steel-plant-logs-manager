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


async def notify_pm_event(
    session: AsyncSession,
    *,
    program_id: UUID,
    program_name: str,
    recipient_role: str,
    organisation_id: UUID,
    plant_id: UUID,
    channel: str = "in_app",
    trigger_type: str | None = None,
) -> int:
    from app.models.enums import UserRole

    try:
        role_enum = UserRole(recipient_role.lower())
    except ValueError:
        role_enum = None

    query = select(User).where(
        User.organisation_id == organisation_id,
        User.is_active.is_(True),
    )
    if role_enum is not None:
        query = query.where(User.role == role_enum)

    result = await session.execute(query)
    recipients = list(result.scalars())
    for user in recipients:
        session.add(
            UserNotification(
                user_id=user.id,
                message_id=None,
                entity_type="maintenance_program",
                entity_id=program_id,
                notification_type="pm_trigger",
            )
        )
    await session.flush()
    return len(recipients)


async def notify_training_expiry(
    session: AsyncSession,
    user_id: UUID,
    training_record_id: UUID,
    training_name: str,
) -> None:
    session.add(
        UserNotification(
            user_id=user_id,
            message_id=None,
            entity_type="training_record",
            entity_id=training_record_id,
            notification_type="training_expiry",
        )
    )
    await session.flush()
