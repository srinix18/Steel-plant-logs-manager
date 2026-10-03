"""Brute-force protection for /auth/login.

Failed attempts are stored in Postgres so limits hold across workers/instances.
Writes use their own session: the login request's session is rolled back when
it raises 401, which would otherwise discard the recorded attempt.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import delete, func, select

from app.core.config import settings
from app.db.models import LoginAttempt
from app.db.session import async_session_factory


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host if request.client else None


def _window_start() -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)


def _too_many() -> HTTPException:
    minutes = settings.LOGIN_LOCKOUT_MINUTES
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many failed login attempts. Try again in {minutes} minutes.",
        headers={"Retry-After": str(minutes * 60)},
    )


async def assert_not_locked(email: str, ip: str | None) -> None:
    since = _window_start()
    async with async_session_factory() as session:
        by_email = await session.scalar(
            select(func.count()).select_from(LoginAttempt).where(
                LoginAttempt.email == email, LoginAttempt.created_at >= since
            )
        )
        if (by_email or 0) >= settings.LOGIN_MAX_FAILURES_PER_ACCOUNT:
            raise _too_many()
        if ip:
            by_ip = await session.scalar(
                select(func.count()).select_from(LoginAttempt).where(
                    LoginAttempt.ip_address == ip, LoginAttempt.created_at >= since
                )
            )
            if (by_ip or 0) >= settings.LOGIN_MAX_FAILURES_PER_IP:
                raise _too_many()


async def record_failure(email: str, ip: str | None) -> None:
    async with async_session_factory() as session:
        session.add(LoginAttempt(email=email, ip_address=ip))
        await session.execute(
            delete(LoginAttempt).where(LoginAttempt.created_at < datetime.now(timezone.utc) - timedelta(days=1))
        )
        await session.commit()


async def clear_failures(email: str) -> None:
    async with async_session_factory() as session:
        await session.execute(delete(LoginAttempt).where(LoginAttempt.email == email))
        await session.commit()
