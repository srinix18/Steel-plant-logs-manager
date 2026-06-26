"""Idempotent ALTER TABLE patches for existing PostgreSQL databases."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_SAVEPOINT_COUNTER = 0


async def _safe_execute(conn: AsyncConnection, sql: str) -> None:
    """Run one patch; on failure roll back to savepoint so the outer txn stays usable."""
    global _SAVEPOINT_COUNTER
    _SAVEPOINT_COUNTER += 1
    sp = f"schema_patch_{_SAVEPOINT_COUNTER}"
    await conn.execute(text(f"SAVEPOINT {sp}"))
    try:
        await conn.execute(text(sql))
    except Exception:
        await conn.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))
    finally:
        await conn.execute(text(f"RELEASE SAVEPOINT {sp}"))

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

_USERROLE_VALUES = ("ceo", "hr", "hod", "maintenance")

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

_PROCESSRUNTYPE_VALUES = (
    "heat",
    "shift",
    "daily",
    "ladle_metallurgy",
    "cast",
    "inspection",
    "maintenance",
    "quality_check",
)

_PROCESSRUNTYPE_LEGACY_TO_VALUE = (
    ("HEAT", "heat"),
    ("SHIFT", "shift"),
    ("DAILY", "daily"),
    ("LADLE_METALLURGY", "ladle_metallurgy"),
    ("CAST", "cast"),
    ("INSPECTION", "inspection"),
    ("MAINTENANCE", "maintenance"),
    ("QUALITY_CHECK", "quality_check"),
)

_PROCESSRUNOUTCOME_VALUES = ("accepted", "rejected", "rework", "aborted")

_PROCESSRUNOUTCOME_LEGACY_TO_VALUE = (
    ("ACCEPTED", "accepted"),
    ("REJECTED", "rejected"),
    ("REWORK", "rework"),
    ("ABORTED", "aborted"),
)

_WORKFORCE_PATCHES = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status VARCHAR(32) DEFAULT 'active'",
    "UPDATE users SET employment_status = 'active' WHERE employment_status IS NULL",
    """
    CREATE TABLE IF NOT EXISTS contractors (
        id UUID PRIMARY KEY,
        organisation_id UUID NOT NULL REFERENCES organisations(id),
        code VARCHAR(32) NOT NULL,
        name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(200),
        phone VARCHAR(32),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (organisation_id, code)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS contract_workers (
        id UUID PRIMARY KEY,
        contractor_id UUID NOT NULL REFERENCES contractors(id),
        full_name VARCHAR(200) NOT NULL,
        department_id UUID NOT NULL REFERENCES departments(id),
        phone VARCHAR(32),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS shift_assignments (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        department_id UUID NOT NULL REFERENCES departments(id),
        shift_id UUID NOT NULL REFERENCES shifts(id),
        effective_date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, department_id, shift_id, effective_date)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS attendance_records (
        id UUID PRIMARY KEY,
        attendance_date DATE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id),
        department_id UUID NOT NULL REFERENCES departments(id),
        shift_id UUID NOT NULL REFERENCES shifts(id),
        status VARCHAR(32) NOT NULL,
        remarks TEXT,
        marked_by_id UUID NOT NULL REFERENCES users(id),
        marked_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (attendance_date, user_id, department_id, shift_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS contractor_attendance (
        id UUID PRIMARY KEY,
        attendance_date DATE NOT NULL,
        contractor_id UUID NOT NULL REFERENCES contractors(id),
        department_id UUID NOT NULL REFERENCES departments(id),
        shift_id UUID NOT NULL REFERENCES shifts(id),
        workers_present INTEGER DEFAULT 0,
        workers_absent INTEGER DEFAULT 0,
        remarks TEXT,
        marked_by_id UUID NOT NULL REFERENCES users(id),
        marked_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (attendance_date, contractor_id, department_id, shift_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS shift_handover_notes (
        id UUID PRIMARY KEY,
        note_date DATE NOT NULL,
        department_id UUID NOT NULL REFERENCES departments(id),
        shift_id UUID NOT NULL REFERENCES shifts(id),
        author_id UUID NOT NULL REFERENCES users(id),
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_handover_dept_shift_date ON shift_handover_notes (department_id, shift_id, note_date)",
)

_FOUNDATION_PATCHES = (
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id)",
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS installation_date DATE",
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS remarks TEXT",
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS expected_life JSONB DEFAULT '{}'",
    "ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_inspection_at TIMESTAMPTZ",
    "ALTER TABLE observations ADD COLUMN IF NOT EXISTS title VARCHAR(300)",
    "ALTER TABLE observations ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id)",
    "ALTER TABLE observations ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id)",
    "ALTER TABLE observations ADD COLUMN IF NOT EXISTS maintenance_issue_id UUID REFERENCES maintenance_issues(id)",
    "ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id)",
    "ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS target_value DOUBLE PRECISION",
    "ALTER TABLE kpi_definitions ADD COLUMN IF NOT EXISTS frequency VARCHAR(32)",
    """
    CREATE TABLE IF NOT EXISTS product_catalog (
        id UUID PRIMARY KEY,
        organisation_id UUID NOT NULL REFERENCES organisations(id),
        code VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        department_id UUID REFERENCES departments(id),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (organisation_id, code)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS department_documents (
        id UUID PRIMARY KEY,
        plant_id UUID NOT NULL REFERENCES plants(id),
        department_id UUID NOT NULL REFERENCES departments(id),
        category VARCHAR(50) NOT NULL,
        title VARCHAR(300) NOT NULL,
        version VARCHAR(32) DEFAULT '1.0',
        file_name VARCHAR(255) NOT NULL,
        storage_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes INTEGER NOT NULL,
        uploaded_by UUID NOT NULL REFERENCES users(id),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS approval_records (
        id UUID PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(32) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id),
        comments TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS asset_responsibilities (
        id UUID PRIMARY KEY,
        asset_id UUID NOT NULL REFERENCES assets(id),
        user_id UUID NOT NULL REFERENCES users(id),
        role_label VARCHAR(100) DEFAULT 'owner',
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (asset_id, user_id, role_label)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_approval_entity ON approval_records (entity_type, entity_id)",
    "CREATE INDEX IF NOT EXISTS ix_dept_docs_dept ON department_documents (department_id)",
)

_CORRECTIVEACTIONSTATUS_VALUES = ("assigned", "completed")

_FINANCE_PATCHES = (
    """
    CREATE TABLE IF NOT EXISTS raw_material_cost_rates (
        id UUID PRIMARY KEY,
        organisation_id UUID NOT NULL REFERENCES organisations(id),
        material_id UUID NOT NULL REFERENCES material_catalog(id),
        unit VARCHAR(32) DEFAULT 'kg',
        rate DOUBLE PRECISION NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS power_cost_rates (
        id UUID PRIMARY KEY,
        plant_id UUID NOT NULL REFERENCES plants(id),
        cost_per_unit DOUBLE PRECISION NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS fuel_cost_rates (
        id UUID PRIMARY KEY,
        plant_id UUID NOT NULL REFERENCES plants(id),
        fuel_name VARCHAR(100) NOT NULL,
        unit VARCHAR(32) DEFAULT 'litre',
        rate DOUBLE PRECISION NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS labour_cost_rates (
        id UUID PRIMARY KEY,
        plant_id UUID NOT NULL REFERENCES plants(id),
        department_id UUID REFERENCES departments(id),
        role_label VARCHAR(100) NOT NULL,
        cost_per_hour DOUBLE PRECISION NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS maintenance_cost_rates (
        id UUID PRIMARY KEY,
        plant_id UUID NOT NULL REFERENCES plants(id),
        category VARCHAR(32) NOT NULL,
        default_cost DOUBLE PRECISION NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS cost_mapping_rules (
        id UUID PRIMARY KEY,
        template_version_id UUID NOT NULL REFERENCES template_versions(id),
        source_type VARCHAR(32) NOT NULL,
        source_key VARCHAR(100) NOT NULL,
        child_key VARCHAR(100),
        material_field_key VARCHAR(100),
        cost_category VARCHAR(32) NOT NULL,
        item_label_override VARCHAR(200),
        unit_override VARCHAR(32),
        labour_role_label VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS cost_calculations (
        id UUID PRIMARY KEY,
        process_run_id UUID NOT NULL REFERENCES process_runs(id),
        calculated_at TIMESTAMPTZ DEFAULT NOW(),
        total_cost DOUBLE PRECISION DEFAULT 0,
        version INTEGER NOT NULL,
        status VARCHAR(32) NOT NULL,
        warnings JSONB DEFAULT '[]',
        context JSONB DEFAULT '{}',
        UNIQUE (process_run_id, version)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS cost_line_items (
        id UUID PRIMARY KEY,
        cost_calculation_id UUID NOT NULL REFERENCES cost_calculations(id),
        cost_category VARCHAR(32) NOT NULL,
        item_name VARCHAR(200) NOT NULL,
        quantity DOUBLE PRECISION DEFAULT 0,
        unit VARCHAR(32) DEFAULT '',
        rate DOUBLE PRECISION DEFAULT 0,
        amount DOUBLE PRECISION DEFAULT 0,
        source_mapping_id UUID REFERENCES cost_mapping_rules(id),
        source_ref JSONB DEFAULT '{}'
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_cost_calc_run ON cost_calculations (process_run_id)",
    "CREATE INDEX IF NOT EXISTS ix_cost_mapping_version ON cost_mapping_rules (template_version_id)",
)


async def apply_schema_patches(conn: AsyncConnection) -> None:
    for value in _USERROLE_VALUES:
        await _safe_execute(conn, f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{value}'")

    for value in _PROCESSRUNTYPE_VALUES:
        await _safe_execute(conn, f"ALTER TYPE processruntype ADD VALUE IF NOT EXISTS '{value}'")

    for value in _PROCESSRUNOUTCOME_VALUES:
        await _safe_execute(conn, f"ALTER TYPE processrunoutcome ADD VALUE IF NOT EXISTS '{value}'")

    for legacy, normalized in _PROCESSRUNTYPE_LEGACY_TO_VALUE:
        await _safe_execute(
            conn,
            f"UPDATE process_runs SET run_type = '{normalized}' "
            f"WHERE run_type::text = '{legacy}'",
        )

    for legacy, normalized in _PROCESSRUNOUTCOME_LEGACY_TO_VALUE:
        await _safe_execute(
            conn,
            f"UPDATE process_runs SET outcome = '{normalized}' "
            f"WHERE outcome IS NOT NULL AND outcome::text = '{legacy}'",
        )

    for stmt in _USER_COLUMN_PATCHES:
        await _safe_execute(conn, stmt)

    for stmt in _MESSAGE_TABLE_PATCHES:
        await _safe_execute(conn, stmt)

    for stmt in _MAINTENANCE_PATCHES:
        await _safe_execute(conn, stmt)

    for stmt in _DELAY_PATCHES:
        await _safe_execute(conn, stmt)

    for stmt in _COIL_PATCHES:
        await _safe_execute(conn, stmt)

    for stmt in _COIL_COLUMN_PATCHES:
        await _safe_execute(conn, stmt)

    for stmt in _CUSTOMER_PATCHES:
        await _safe_execute(conn, stmt)

    for stmt in _WORKFORCE_PATCHES:
        await _safe_execute(conn, stmt)

    for value in _CORRECTIVEACTIONSTATUS_VALUES:
        await _safe_execute(
            conn, f"ALTER TYPE correctiveactionstatus ADD VALUE IF NOT EXISTS '{value}'"
        )

    for stmt in _FOUNDATION_PATCHES:
        await _safe_execute(conn, stmt)

    for stmt in _FINANCE_PATCHES:
        await _safe_execute(conn, stmt)
