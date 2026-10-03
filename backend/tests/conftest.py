"""Integration test harness.

Boots the real FastAPI app (full lifespan: schema + seed) against a dedicated
Postgres database (default ``moi_test`` on the dev server). The schema is wiped
at the start of every session so each run starts from a fresh seed.

Override with ``TEST_DATABASE_URL``.
"""

import asyncio
import os

import pytest

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/moi_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")


def _reset_schema() -> None:
    import asyncpg

    async def _run() -> None:
        dsn = TEST_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncpg.connect(dsn)
        try:
            await conn.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
        finally:
            await conn.close()

    asyncio.run(_run())


_reset_schema()

import httpx  # noqa: E402

from app.main import app  # noqa: E402
from tests.helpers import ACCOUNTS, Api  # noqa: E402


@pytest.fixture(scope="session")
async def client():
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1", timeout=60) as c:
            yield c


@pytest.fixture(scope="session")
async def tokens(client):
    out: dict[str, dict] = {}
    for key, (email, password) in ACCOUNTS.items():
        r = await client.post("/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
        body = r.json()
        out[key] = {"token": body["access_token"], "user": body["user"]}
    return out


@pytest.fixture(scope="session")
async def api(client, tokens):
    return Api(client, tokens)
