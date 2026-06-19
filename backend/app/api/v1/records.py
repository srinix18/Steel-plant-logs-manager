from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from app.api.deps import CurrentUser, require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas import MessageResponse, RecordCreate, RecordResponse, RecordUpdate
from app.services import RecordService

router = APIRouter()
record_service = RecordService()

AdminOrDeptUser = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.DEPARTMENT))]


@router.get("", response_model=list[RecordResponse])
async def list_records(current_user: CurrentUser):
    return await record_service.list_records(current_user)


@router.get("/export", response_class=PlainTextResponse)
async def export_records(current_user: AdminOrDeptUser):
    csv_data = await record_service.export_records_csv(current_user)
    return PlainTextResponse(content=csv_data, media_type="text/csv")


@router.post("", response_model=RecordResponse, status_code=201)
async def create_record(data: RecordCreate, current_user: CurrentUser):
    return await record_service.create_record(data, current_user)


@router.get("/{record_id}", response_model=RecordResponse)
async def get_record(record_id: UUID, current_user: CurrentUser):
    return await record_service.get_record(record_id, current_user)


@router.put("/{record_id}", response_model=RecordResponse)
async def update_record(record_id: UUID, data: RecordUpdate, current_user: CurrentUser):
    return await record_service.update_record(record_id, data, current_user)


@router.delete("/{record_id}", response_model=MessageResponse)
async def delete_record(record_id: UUID, current_user: CurrentUser):
    await record_service.delete_record(record_id, current_user)
    return MessageResponse(message="Record deleted")
