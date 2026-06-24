import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.models import Message, MessageAttachment, MessageRecipient, MaintenanceIssue, User, UserNotification
from app.models.enums import UserRole
from app.schemas.moi import MessageAttachmentResponse, MessageCreate, MessageResponse, NotificationResponse
from app.services.access_scope import (
    CEO_ROLES,
    can_message,
    is_ceo_tier,
    is_hr,
    is_platform_admin,
    list_eligible_recipients,
)

ALLOWED_MIME = {"image/jpeg", "image/png", "application/pdf"}
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024


class MessageService:
    def _to_message_response(
        self, message: Message, read_at: datetime | None = None
    ) -> MessageResponse:
        return MessageResponse(
            id=message.id,
            organisation_id=message.organisation_id,
            sender_id=message.sender_id,
            subject=message.subject,
            body=message.body,
            is_broadcast=message.is_broadcast,
            created_at=message.created_at,
            sender=message.sender,
            attachments=[MessageAttachmentResponse.model_validate(a) for a in message.attachments],
            read_at=read_at,
        )

    async def suggest_recipients(self, session: AsyncSession, sender: User) -> list[User]:
        return await list_eligible_recipients(session, sender)

    async def send_message(
        self, session: AsyncSession, sender: User, data: MessageCreate
    ) -> MessageResponse:
        if not sender.organisation_id:
            raise HTTPException(status_code=400, detail="Sender must belong to an organisation")

        if data.is_broadcast:
            if not is_ceo_tier(sender) and not is_hr(sender):
                raise HTTPException(status_code=403, detail="Only CEO or HR can broadcast to entire organisation")
            result = await session.execute(
                select(User).where(
                    User.organisation_id == sender.organisation_id,
                    User.is_active.is_(True),
                    User.id != sender.id,
                )
            )
            recipients = list(result.scalars())
        else:
            if not data.recipient_ids:
                raise HTTPException(status_code=400, detail="At least one recipient is required")
            result = await session.execute(
                select(User).where(User.id.in_(data.recipient_ids), User.is_active.is_(True))
            )
            recipients = list(result.scalars())
            if len(recipients) != len(set(data.recipient_ids)):
                raise HTTPException(status_code=400, detail="One or more recipients not found")

        for recipient in recipients:
            if not can_message(sender, recipient):
                raise HTTPException(
                    status_code=403,
                    detail=f"Not permitted to message {recipient.full_name}",
                )

        message = Message(
            organisation_id=sender.organisation_id,
            sender_id=sender.id,
            subject=data.subject.strip(),
            body=data.body.strip(),
            is_broadcast=data.is_broadcast,
        )
        session.add(message)
        await session.flush()

        for recipient in recipients:
            session.add(MessageRecipient(message_id=message.id, recipient_id=recipient.id))
            session.add(
                UserNotification(
                    user_id=recipient.id,
                    message_id=message.id,
                    notification_type="message",
                )
            )
        await session.flush()

        await session.refresh(message, ["sender", "attachments"])
        return self._to_message_response(message)

    async def list_inbox(
        self, session: AsyncSession, user: User, limit: int = 50, offset: int = 0
    ) -> list[MessageResponse]:
        result = await session.execute(
            select(Message, MessageRecipient.read_at)
            .join(MessageRecipient, MessageRecipient.message_id == Message.id)
            .where(MessageRecipient.recipient_id == user.id)
            .options(
                selectinload(Message.sender),
                selectinload(Message.attachments),
            )
            .order_by(Message.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return [self._to_message_response(msg, read_at) for msg, read_at in result.all()]

    async def list_sent(
        self, session: AsyncSession, user: User, limit: int = 50, offset: int = 0
    ) -> list[MessageResponse]:
        result = await session.execute(
            select(Message)
            .where(Message.sender_id == user.id)
            .options(
                selectinload(Message.sender),
                selectinload(Message.attachments),
            )
            .order_by(Message.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return [self._to_message_response(m) for m in result.scalars()]

    async def get_message(
        self, session: AsyncSession, user: User, message_id: UUID
    ) -> MessageResponse:
        result = await session.execute(
            select(Message)
            .where(Message.id == message_id)
            .options(
                selectinload(Message.sender),
                selectinload(Message.attachments),
            )
        )
        message = result.scalar_one_or_none()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        is_sender = message.sender_id == user.id
        recipient_row = await session.execute(
            select(MessageRecipient).where(
                MessageRecipient.message_id == message_id,
                MessageRecipient.recipient_id == user.id,
            )
        )
        recipient = recipient_row.scalar_one_or_none()
        if not is_sender and not recipient and not is_platform_admin(user):
            raise HTTPException(status_code=403, detail="Access denied")

        read_at = recipient.read_at if recipient else None
        if recipient and not recipient.read_at:
            now = datetime.now(timezone.utc)
            recipient.read_at = now
            notif = await session.execute(
                select(UserNotification).where(
                    UserNotification.message_id == message_id,
                    UserNotification.user_id == user.id,
                )
            )
            notification = notif.scalar_one_or_none()
            if notification:
                notification.read_at = now
            await session.flush()
            read_at = now

        return self._to_message_response(message, read_at)

    async def list_notifications(
        self, session: AsyncSession, user: User, unread_only: bool = False, limit: int = 50
    ) -> list[NotificationResponse]:
        query = (
            select(UserNotification)
            .where(UserNotification.user_id == user.id)
            .options(
                selectinload(UserNotification.message).selectinload(Message.sender),
                selectinload(UserNotification.message).selectinload(Message.attachments),
            )
            .order_by(UserNotification.created_at.desc())
            .limit(limit)
        )
        if unread_only:
            query = query.where(UserNotification.read_at.is_(None))
        result = await session.execute(query)
        items: list[NotificationResponse] = []
        for n in result.scalars():
            msg_resp = None
            maint_resp = None
            if n.message:
                msg_resp = self._to_message_response(n.message, n.read_at)
            if n.entity_type == "maintenance_issue" and n.entity_id:
                from app.services.maintenance_issue_service import MaintenanceIssueService

                try:
                    maint_resp = await MaintenanceIssueService().get_issue(session, user, n.entity_id)
                except HTTPException:
                    maint_resp = None
            items.append(
                NotificationResponse(
                    id=n.id,
                    message_id=n.message_id,
                    entity_type=n.entity_type,
                    entity_id=n.entity_id,
                    notification_type=n.notification_type,
                    read_at=n.read_at,
                    created_at=n.created_at,
                    message=msg_resp,
                    maintenance_issue=maint_resp,
                )
            )
        return items

    async def mark_notification_read(
        self, session: AsyncSession, user: User, notification_id: UUID
    ) -> NotificationResponse:
        result = await session.execute(
            select(UserNotification)
            .where(UserNotification.id == notification_id, UserNotification.user_id == user.id)
            .options(
                selectinload(UserNotification.message).selectinload(Message.sender),
                selectinload(UserNotification.message).selectinload(Message.attachments),
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        now = datetime.now(timezone.utc)
        if not notification.read_at:
            notification.read_at = now
            recipient = await session.execute(
                select(MessageRecipient).where(
                    MessageRecipient.message_id == notification.message_id,
                    MessageRecipient.recipient_id == user.id,
                )
            )
            mr = recipient.scalar_one_or_none()
            if mr and not mr.read_at:
                mr.read_at = now
            await session.flush()

        msg_resp = None
        maint_resp = None
        if notification.message:
            msg_resp = self._to_message_response(notification.message, notification.read_at)
        if notification.entity_type == "maintenance_issue" and notification.entity_id:
            from app.services.maintenance_issue_service import MaintenanceIssueService

            try:
                maint_resp = await MaintenanceIssueService().get_issue(session, user, notification.entity_id)
            except HTTPException:
                maint_resp = None
        return NotificationResponse(
            id=notification.id,
            message_id=notification.message_id,
            entity_type=notification.entity_type,
            entity_id=notification.entity_id,
            notification_type=notification.notification_type,
            read_at=notification.read_at,
            created_at=notification.created_at,
            message=msg_resp,
            maintenance_issue=maint_resp,
        )

    async def unread_count(self, session: AsyncSession, user: User) -> int:
        result = await session.execute(
            select(func.count())
            .select_from(UserNotification)
            .where(UserNotification.user_id == user.id, UserNotification.read_at.is_(None))
        )
        return result.scalar() or 0

    async def add_attachment(
        self, session: AsyncSession, user: User, message_id: UUID, file: UploadFile
    ) -> MessageAttachmentResponse:
        message = await session.get(Message, message_id)
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        if message.sender_id != user.id:
            raise HTTPException(status_code=403, detail="Only the sender can add attachments")

        content_type = file.content_type or ""
        if content_type not in ALLOWED_MIME:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, and PDF files are allowed")

        data = await file.read()
        if len(data) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(status_code=400, detail="File exceeds 5 MB limit")

        upload_root = Path(settings.UPLOAD_DIR)
        upload_root.mkdir(parents=True, exist_ok=True)
        safe_name = re.sub(r"[^\w.\-]", "_", file.filename or "file")
        storage_name = f"{uuid.uuid4().hex}_{safe_name}"
        storage_path = upload_root / storage_name
        storage_path.write_bytes(data)

        attachment = MessageAttachment(
            message_id=message_id,
            file_name=file.filename or safe_name,
            storage_path=str(storage_path),
            mime_type=content_type,
            size_bytes=len(data),
            uploaded_by=user.id,
        )
        session.add(attachment)
        await session.flush()
        return MessageAttachmentResponse.model_validate(attachment)

    async def get_attachment(
        self, session: AsyncSession, user: User, attachment_id: UUID
    ) -> tuple[Path, str, str]:
        result = await session.execute(
            select(MessageAttachment)
            .where(MessageAttachment.id == attachment_id)
            .options(selectinload(MessageAttachment.message))
        )
        attachment = result.scalar_one_or_none()
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")

        message = attachment.message
        is_sender = message.sender_id == user.id
        recipient = await session.execute(
            select(MessageRecipient).where(
                MessageRecipient.message_id == message.id,
                MessageRecipient.recipient_id == user.id,
            )
        )
        if not is_sender and not recipient.scalar_one_or_none() and not is_platform_admin(user):
            raise HTTPException(status_code=403, detail="Access denied")

        path = Path(attachment.storage_path)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="File missing on server")
        return path, attachment.mime_type, attachment.file_name
