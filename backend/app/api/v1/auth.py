from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.moi import LoginRequest, LoginResponse, UserBrief, UserResponse
from app.services.platform_services import AuthService

router = APIRouter()
auth_service = AuthService()


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, session: DbSession):
    return await auth_service.login(session, data)


@router.get("/me", response_model=UserBrief)
async def me(user: CurrentUser):
    return UserBrief.model_validate(user)
