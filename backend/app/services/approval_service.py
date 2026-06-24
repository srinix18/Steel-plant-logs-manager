from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ApprovalRecord, User
from app.schemas.foundation import ApprovalRecordResponse, ApprovalTransition


class ApprovalService:
    async def list_records(
        self, session: AsyncSession, entity_type: str, entity_id: UUID
    ) -> list[ApprovalRecordResponse]:
        result = await session.execute(
            select(ApprovalRecord, User.full_name)
            .join(User, ApprovalRecord.user_id == User.id)
            .where(
                ApprovalRecord.entity_type == entity_type,
                ApprovalRecord.entity_id == entity_id,
            )
            .order_by(ApprovalRecord.created_at)
        )
        rows = []
        for rec, user_name in result.all():
            item = ApprovalRecordResponse.model_validate(rec)
            item.user_name = user_name
            rows.append(item)
        return rows

    async def transition(
        self,
        session: AsyncSession,
        user: User,
        entity_type: str,
        entity_id: UUID,
        data: ApprovalTransition,
    ) -> ApprovalRecordResponse:
        rec = ApprovalRecord(
            entity_type=entity_type,
            entity_id=entity_id,
            action=data.action.value,
            user_id=user.id,
            comments=data.comments,
        )
        session.add(rec)
        await session.flush()
        item = ApprovalRecordResponse.model_validate(rec)
        item.user_name = user.full_name
        return item

    async def current_state(
        self, session: AsyncSession, entity_type: str, entity_id: UUID
    ) -> str | None:
        result = await session.execute(
            select(ApprovalRecord.action)
            .where(
                ApprovalRecord.entity_type == entity_type,
                ApprovalRecord.entity_id == entity_id,
            )
            .order_by(ApprovalRecord.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
