from uuid import UUID

from fastapi import APIRouter

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.schemas.moi import PublishVersionRequest, TemplateDetailResponse, TemplateVersionDetailResponse
from app.services.platform_services import TemplateService

router = APIRouter()
template_service = TemplateService()


@router.get("/versions/{version_id}", response_model=TemplateVersionDetailResponse)
async def get_version(version_id: UUID, session: DbSession, _: CurrentUser):
    return await template_service.get_version_detail(session, version_id)


@router.post("/versions/{version_id}/publish")
async def publish_version(
    version_id: UUID, data: PublishVersionRequest, session: DbSession, user: AdminUser
):
    return await template_service.publish_version(session, version_id, user, data)


@router.get("", response_model=list[TemplateDetailResponse])
@router.get("/", response_model=list[TemplateDetailResponse])
async def list_templates(session: DbSession, _: AdminUser):
    return await template_service.list_templates(session)


@router.get("/{template_id}", response_model=TemplateDetailResponse)
async def get_template(template_id: UUID, session: DbSession, _: CurrentUser):
    return await template_service.get_template(session, template_id)
