from uuid import UUID

from fastapi import APIRouter, File, UploadFile
from app.services.storage import file_response

from app.api.deps import CurrentUser, DbSession
from app.schemas.moi import MessageAttachmentResponse, MessageCreate, MessageResponse, NotificationResponse, UserProfile
from app.services.message_service import MessageService

router = APIRouter()
message_service = MessageService()


@router.get("/messages/recipients/suggest", response_model=list[UserProfile])
async def suggest_recipients(session: DbSession, user: CurrentUser):
    recipients = await message_service.suggest_recipients(session, user)
    return [UserProfile.model_validate(u) for u in recipients]


@router.post("/messages", response_model=MessageResponse, status_code=201)
async def send_message(data: MessageCreate, session: DbSession, user: CurrentUser):
    return await message_service.send_message(session, user, data)


@router.get("/messages/inbox", response_model=list[MessageResponse])
async def inbox(session: DbSession, user: CurrentUser, limit: int = 50, offset: int = 0):
    return await message_service.list_inbox(session, user, limit, offset)


@router.get("/messages/sent", response_model=list[MessageResponse])
async def sent(session: DbSession, user: CurrentUser, limit: int = 50, offset: int = 0):
    return await message_service.list_sent(session, user, limit, offset)


@router.get("/messages/{message_id}", response_model=MessageResponse)
async def get_message(message_id: UUID, session: DbSession, user: CurrentUser):
    return await message_service.get_message(session, user, message_id)


@router.post("/messages/{message_id}/attachments", response_model=MessageAttachmentResponse, status_code=201)
async def upload_attachment(
    message_id: UUID, session: DbSession, user: CurrentUser, file: UploadFile = File(...)
):
    return await message_service.add_attachment(session, user, message_id, file)


@router.get("/messages/attachments/{attachment_id}")
async def download_attachment(attachment_id: UUID, session: DbSession, user: CurrentUser):
    data, mime_type, file_name = await message_service.get_attachment(session, user, attachment_id)
    return file_response(data, mime_type, file_name)


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    session: DbSession, user: CurrentUser, unread_only: bool = False, limit: int = 50
):
    return await message_service.list_notifications(session, user, unread_only, limit)


@router.get("/notifications/unread-count")
async def unread_count(session: DbSession, user: CurrentUser):
    count = await message_service.unread_count(session, user)
    return {"count": count}


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(notification_id: UUID, session: DbSession, user: CurrentUser):
    return await message_service.mark_notification_read(session, user, notification_id)
