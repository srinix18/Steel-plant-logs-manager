"""Idempotent ALTER TABLE patches for existing PostgreSQL databases."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_USER_COLUMN_PATCHES = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_uid VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(128)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_joining DATE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS maintenance_division VARCHAR(32)",
    "UPDATE users SET maintenance_division = lower(maintenance_division) WHERE maintenance_division IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_uid ON users (employee_uid) WHERE employee_uid IS NOT NULL",
)

_USERROLE_VALUES = ("ceo", "hod", "maintenance")

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
        message_id UUID REFERENCES messages(id),
        notification_type VARCHAR(50) DEFAULT 'message',
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
)

_MAINTENANCE_PATCHES = (
    """
    CREATE TABLE IF NOT EXISTS maintenance_issues (
        id UUID PRIMARY KEY,
        organisation_id UUID NOT NULL REFERENCES organisations(id),
        plant_id UUID NOT NULL REFERENCES plants(id),
        run_id UUID REFERENCES process_runs(id),
        asset_id UUID REFERENCES assets(id),
        category VARCHAR(32) NOT NULL,
        title VARCHAR(300) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        raised_by UUID NOT NULL REFERENCES users(id),
        raised_at TIMESTAMPTZ DEFAULT NOW(),
        assigned_to UUID REFERENCES users(id),
        assigned_at TIMESTAMPTZ,
        closed_by UUID REFERENCES users(id),
        closed_at TIMESTAMPTZ,
        resolution_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50)",
    "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS entity_id UUID",
    "ALTER TABLE user_notifications ALTER COLUMN message_id DROP NOT NULL",
)

_DELAY_PATCHES = (
    """
    CREATE TABLE IF NOT EXISTS delay_codes (
        id UUID PRIMARY KEY,
        plant_id UUID NOT NULL REFERENCES plants(id),
        code VARCHAR(10) NOT NULL,
        description VARCHAR(300) NOT NULL,
        category VARCHAR(32) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (plant_id, code)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS delay_events (
        id UUID PRIMARY KEY,
        run_id UUID NOT NULL REFERENCES process_runs(id),
        plant_id UUID NOT NULL REFERENCES plants(id),
        row_key VARCHAR(64) NOT NULL,
        delay_code_id UUID REFERENCES delay_codes(id),
        time_from TIME,
        time_to TIME,
        time_lost_minutes INTEGER,
        reason TEXT,
        action_taken TEXT,
        assigned_to UUID REFERENCES users(id),
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        observation_id UUID REFERENCES observations(id),
        closed_at TIMESTAMPTZ,
        closed_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (run_id, row_key)
    )
    """,
)

_COIL_PATCHES = (
    """
    CREATE TABLE IF NOT EXISTS coils (
        id UUID PRIMARY KEY,
        plant_id UUID NOT NULL REFERENCES plants(id),
        department_id UUID NOT NULL REFERENCES departments(id),
        coil_no VARCHAR(100) NOT NULL,
        work_order_no VARCHAR(100),
        grade_id UUID REFERENCES steel_grades(id),
        heat_run_id UUID REFERENCES process_runs(id),
        heat_no VARCHAR(100),
        size_mm DOUBLE PRECISION,
        status VARCHAR(32) NOT NULL DEFAULT 'registered',
        source_run_id UUID REFERENCES process_runs(id),
        registered_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (plant_id, coil_no)
    )
    """,
)

_COIL_COLUMN_PATCHES = (
    "ALTER TABLE coils ADD COLUMN IF NOT EXISTS parent_coil_id UUID REFERENCES coils(id)",
    "ALTER TABLE coils ADD COLUMN IF NOT EXISTS weight_kg DOUBLE PRECISION",
)

_CUSTOMER_PATCHES = (
    """
    CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY,
        plant_id UUID NOT NULL REFERENCES plants(id),
        name VARCHAR(200) NOT NULL,
        code VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (plant_id, name)
    )
    """,
)

_PROCESSRUNTYPE_VALUES = ("shift", "daily")


async def apply_schema_patches(conn: AsyncConnection) -> None:
    for value in _USERROLE_VALUES:
        await conn.execute(text(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{value}'"))

    for value in _PROCESSRUNTYPE_VALUES:
        try:
            await conn.execute(text(f"ALTER TYPE processruntype ADD VALUE IF NOT EXISTS '{value}'"))
        except Exception:
            pass

    for stmt in _USER_COLUMN_PATCHES:
        await conn.execute(text(stmt))

    for stmt in _MESSAGE_TABLE_PATCHES:
        await conn.execute(text(stmt))

    for stmt in _MAINTENANCE_PATCHES:
        try:
            await conn.execute(text(stmt))
        except Exception:
            pass

    for stmt in _DELAY_PATCHES:
        try:
            await conn.execute(text(stmt))
        except Exception:
            pass

    for stmt in _COIL_PATCHES:
        try:
            await conn.execute(text(stmt))
        except Exception:
            pass

    for stmt in _COIL_COLUMN_PATCHES:
        try:
            await conn.execute(text(stmt))
        except Exception:
            pass

    for stmt in _CUSTOMER_PATCHES:
        try:
            await conn.execute(text(stmt))
        except Exception:
            pass
