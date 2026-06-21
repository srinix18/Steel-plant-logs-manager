"""Idempotent ALTER TABLE patches for existing PostgreSQL databases."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_USER_COLUMN_PATCHES = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_uid VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(128)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_joining DATE",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_uid ON users (employee_uid) WHERE employee_uid IS NOT NULL",
)


async def apply_schema_patches(conn: AsyncConnection) -> None:
    for stmt in _USER_COLUMN_PATCHES:
        await conn.execute(text(stmt))
