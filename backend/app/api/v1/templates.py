from uuid import UUID

from fastapi import APIRouter

from app.api.deps import AdminUser, CurrentUser
from app.schemas import (
    MessageResponse,
    TemplateCreate,
    TemplateDetailResponse,
    TemplateFieldCreate,
    TemplateFieldResponse,
    TemplateFieldUpdate,
    TemplateResponse,
    TemplateUpdate,
)
from app.services import TemplateService

router = APIRouter()
template_service = TemplateService()


@router.get("", response_model=list[TemplateResponse])
async def list_templates(current_user: CurrentUser):
    return await template_service.list_templates(current_user)


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(data: TemplateCreate, _: AdminUser):
    return await template_service.create_template(data)


@router.get("/{template_id}", response_model=TemplateDetailResponse)
async def get_template(template_id: UUID, current_user: CurrentUser):
    return await template_service.get_template(template_id, current_user)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: UUID, data: TemplateUpdate, _: AdminUser):
    return await template_service.update_template(template_id, data)


@router.delete("/{template_id}", response_model=MessageResponse)
async def delete_template(template_id: UUID, _: AdminUser):
    await template_service.delete_template(template_id)
    return MessageResponse(message="Template deleted")


@router.get("/{template_id}/fields", response_model=list[TemplateFieldResponse])
async def list_fields(template_id: UUID, current_user: CurrentUser):
    detail = await template_service.get_template(template_id, current_user)
    return detail.fields


@router.post("/{template_id}/fields", response_model=TemplateFieldResponse, status_code=201)
async def add_field(template_id: UUID, data: TemplateFieldCreate, _: AdminUser):
    return await template_service.add_field(template_id, data)


@router.put("/{template_id}/fields/{field_id}", response_model=TemplateFieldResponse)
async def update_field(template_id: UUID, field_id: UUID, data: TemplateFieldUpdate, _: AdminUser):
    return await template_service.update_field(template_id, field_id, data)


@router.delete("/{template_id}/fields/{field_id}", response_model=MessageResponse)
async def delete_field(template_id: UUID, field_id: UUID, _: AdminUser):
    await template_service.delete_field(template_id, field_id)
    return MessageResponse(message="Field deleted")
