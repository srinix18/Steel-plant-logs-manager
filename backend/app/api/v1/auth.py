from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas import LoginRequest, LoginResponse, UserBrief
from app.services import AuthService

router = APIRouter()
auth_service = AuthService()


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest):
    return await auth_service.login(data)


@router.get("/me", response_model=UserBrief)
async def me(current_user: CurrentUser):
    return UserBrief(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        department_id=current_user.department_id,
    )
