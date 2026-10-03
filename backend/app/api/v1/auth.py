from uuid import UUID

from fastapi import APIRouter, Request

from app.api.deps import CurrentUser, DbSession
from app.schemas.moi import LoginRequest, LoginResponse, UserBrief, UserProfile, UserProfileUpdate, UserResponse
from app.services.login_throttle import client_ip
from app.services.platform_services import AuthService

router = APIRouter()
auth_service = AuthService()


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, request: Request, session: DbSession):
    return await auth_service.login(session, data, ip=client_ip(request))


@router.get("/me", response_model=UserProfile)
async def me(user: CurrentUser):
    return UserProfile.model_validate(user)


@router.patch("/me", response_model=UserProfile)
async def update_me(data: UserProfileUpdate, session: DbSession, user: CurrentUser):
    return await auth_service.update_profile(session, user, data)
