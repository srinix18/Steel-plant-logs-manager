"""Idempotent ALTER TABLE patches for existing PostgreSQL databases."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_USER_COLUMN_PATCHES = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_uid VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(128)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_joining DATE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_uid ON users (employee_uid) WHERE employee_uid IS NOT NULL",
)

_USERROLE_VALUES = ("ceo", "hod")

_MESSAGE_TABLE_PATCHES = (
    """
    CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY,
        organisation_id UUID NOT NULL REFERENCES organisations(id),
        sender_id UUID NOT NULL REFERENCES users(id),
        subject VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        is_broadcast BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS message_recipients (
        id UUID PRIMARY KEY,
        message_id UUID NOT NULL REFERENCES messages(id),
        recipient_id UUID NOT NULL REFERENCES users(id),
        read_at TIMESTAMPTZ,
        UNIQUE (message_id, recipient_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS message_attachments (
        id UUID PRIMARY KEY,
        message_id UUID NOT NULL REFERENCES messages(id),
        file_name VARCHAR(255) NOT NULL,
        storage_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes INTEGER NOT NULL,
        uploaded_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_notifications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        message_id UUID NOT NULL REFERENCES messages(id),
        notification_type VARCHAR(50) DEFAULT 'message',
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
)


async def apply_schema_patches(conn: AsyncConnection) -> None:
    for value in _USERROLE_VALUES:
        await conn.execute(text(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{value}'"))

    for stmt in _USER_COLUMN_PATCHES:
        await conn.execute(text(stmt))

    for stmt in _MESSAGE_TABLE_PATCHES:
        await conn.execute(text(stmt))
