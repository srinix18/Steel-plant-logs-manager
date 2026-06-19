from uuid import UUID

from fastapi import APIRouter

from app.api.deps import AdminUser
from app.schemas import MessageResponse, OrganisationCreate, OrganisationResponse, OrganisationUpdate
from app.services import OrganisationService

router = APIRouter()
organisation_service = OrganisationService()


@router.get("", response_model=list[OrganisationResponse])
async def list_organisations(_: AdminUser):
    return await organisation_service.list_organisations()


@router.post("", response_model=OrganisationResponse, status_code=201)
async def create_organisation(data: OrganisationCreate, _: AdminUser):
    return await organisation_service.create_organisation(data)


@router.get("/{org_id}", response_model=OrganisationResponse)
async def get_organisation(org_id: UUID, _: AdminUser):
    return await organisation_service.get_organisation(org_id)


@router.put("/{org_id}", response_model=OrganisationResponse)
async def update_organisation(org_id: UUID, data: OrganisationUpdate, _: AdminUser):
    return await organisation_service.update_organisation(org_id, data)


@router.delete("/{org_id}", response_model=MessageResponse)
async def delete_organisation(org_id: UUID, _: AdminUser):
    await organisation_service.delete_organisation(org_id)
    return MessageResponse(message="Organisation deleted")
