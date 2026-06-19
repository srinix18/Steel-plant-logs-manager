from uuid import UUID

from fastapi import APIRouter

from app.api.deps import AdminUser
from app.schemas import MessageResponse, UserCreate, UserResponse, UserUpdate
from app.services import UserService

router = APIRouter()
user_service = UserService()


@router.get("", response_model=list[UserResponse])
async def list_users(_: AdminUser):
    return await user_service.list_users()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(data: UserCreate, _: AdminUser):
    return await user_service.create_user(data)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, _: AdminUser):
    return await user_service.get_user(user_id)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: UUID, data: UserUpdate, _: AdminUser):
    return await user_service.update_user(user_id, data)


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(user_id: UUID, _: AdminUser):
    await user_service.delete_user(user_id)
    return MessageResponse(message="User deleted")
