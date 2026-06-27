"""Pulse notification helpers for Phase 5 alert types."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User, UserNotification
from app.models.enums import UserRole
from app.services.access_scope import CEO_TIER_ROLES, HOD_TIER_ROLES

PULSE_ALERT_TYPES = frozenset({
    "high_energy",
    "high_temperature",
    "low_inventory",
    "maintenance_due",
    "maintenance_overdue",
    "low_oee",
    "attendance_issue",
    "production_delay",
    "safety_alert",
    "health_critical",
})


class PulseNotificationService:
    async def notify_plant_leaders(
        self,
        session: AsyncSession,
        organisation_id: UUID,
        *,
        notification_type: str,
        title: str,
        body: str,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        department_id: UUID | None = None,
    ) -> int:
        if notification_type not in PULSE_ALERT_TYPES:
            return 0

        leader_roles = list(CEO_TIER_ROLES | HOD_TIER_ROLES)
        q = select(User).where(User.organisation_id == organisation_id, User.is_active.is_(True))
        if department_id:
            q = q.where(
                (User.role.in_(leader_roles)) | (User.department_id == department_id)
            )
        else:
            q = q.where(User.role.in_(leader_roles))

        result = await session.execute(q)
        users = list(result.scalars())
        sent = 0
        for user in users:
            if department_id and user.department_id and user.department_id != department_id:
                if user.role not in CEO_TIER_ROLES:
                    continue
            session.add(
                UserNotification(
                    user_id=user.id,
                    notification_type=notification_type,
                    title=title,
                    body=body,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    created_at=datetime.now(timezone.utc),
                )
            )
            sent += 1
        return sent
