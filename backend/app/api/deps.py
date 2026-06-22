from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db
from app.models.enums import UserRole
from app.services.access_scope import (
    CEO_ROLES,
    CEO_TIER_ROLES,
    HOD_ROLES,
    HOD_TIER_ROLES,
    PLATFORM_ADMIN_ROLES,
    SUPERVISOR_ONLY_ROLES,
    SUPERVISOR_TIER_ROLES,
    WORKER_ROLES,
    user_has_role,
)

security = HTTPBearer()

ADMIN_ROLES = PLATFORM_ADMIN_ROLES | CEO_ROLES | {UserRole.PLANT_ADMIN, UserRole.ORG_ADMIN}
SUPERVISOR_ROLES = SUPERVISOR_TIER_ROLES


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    result = await session.execute(select(User).where(User.id == UUID(payload["sub"])))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_roles(*roles: UserRole):
    allowed = set(roles)

    async def checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if not user_has_role(current_user, allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return checker


CurrentUser = Annotated[User, Depends(get_current_user)]
PlatformAdminUser = Annotated[
    User,
    Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)),
]
CeoUser = Annotated[
    User,
    Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
            UserRole.CEO,
            UserRole.ORG_ADMIN,
        )
    ),
]
AdminUser = PlatformAdminUser
SupervisorUser = Annotated[
    User,
    Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
            UserRole.CEO,
            UserRole.ORG_ADMIN,
            UserRole.HOD,
            UserRole.PLANT_ADMIN,
            UserRole.SUPERVISOR,
            UserRole.DEPARTMENT,
        )
    ),
]
MaintenanceUser = Annotated[User, Depends(require_roles(UserRole.MAINTENANCE))]
DbSession = Annotated[AsyncSession, Depends(get_db)]
