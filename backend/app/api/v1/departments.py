from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import AdminUser
from app.schemas import DepartmentCreate, DepartmentResponse, DepartmentUpdate, MessageResponse
from app.services import DepartmentService

router = APIRouter()
department_service = DepartmentService()


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(
    _: AdminUser,
    organisation_id: Optional[UUID] = Query(default=None),
):
    return await department_service.list_departments(organisation_id)


@router.post("", response_model=DepartmentResponse, status_code=201)
async def create_department(data: DepartmentCreate, _: AdminUser):
    return await department_service.create_department(data)


@router.get("/{dept_id}", response_model=DepartmentResponse)
async def get_department(dept_id: UUID, _: AdminUser):
    return await department_service.get_department(dept_id)


@router.put("/{dept_id}", response_model=DepartmentResponse)
async def update_department(dept_id: UUID, data: DepartmentUpdate, _: AdminUser):
    return await department_service.update_department(dept_id, data)


@router.delete("/{dept_id}", response_model=MessageResponse)
async def delete_department(dept_id: UUID, _: AdminUser):
    await department_service.delete_department(dept_id)
    return MessageResponse(message="Department deleted")
