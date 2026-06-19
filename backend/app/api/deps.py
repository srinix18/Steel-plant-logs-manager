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

security = HTTPBearer()

ADMIN_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.PLANT_ADMIN,
    UserRole.ADMIN,
}

SUPERVISOR_ROLES = ADMIN_ROLES | {UserRole.SUPERVISOR, UserRole.DEPARTMENT}


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
    async def checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        effective = current_user.role
        if effective == UserRole.ADMIN and UserRole.SUPER_ADMIN in roles:
            return current_user
        if effective == UserRole.DEPARTMENT and UserRole.SUPERVISOR in roles:
            return current_user
        if effective == UserRole.MEMBER and UserRole.WORKER in roles:
            return current_user
        if effective not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return checker


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PLANT_ADMIN, UserRole.ADMIN))]
SupervisorUser = Annotated[User, Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.PLANT_ADMIN, UserRole.SUPERVISOR, UserRole.ADMIN, UserRole.DEPARTMENT))]
DbSession = Annotated[AsyncSession, Depends(get_db)]
