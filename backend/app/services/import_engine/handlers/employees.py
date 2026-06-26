from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Department, User
from app.models.enums import EmploymentStatus, EmploymentType, UserRole
from app.schemas.moi import WorkforceEmployeeCreate
from app.services.import_engine.registry import register_module
from app.services.workforce_service import WorkforceService

COLUMNS = [
    "employee_uid",
    "email",
    "password",
    "full_name",
    "role",
    "department_id",
    "designation",
    "phone",
    "employment_type",
    "employment_status",
    "date_of_joining",
]

REQUIRED = ["email", "password", "full_name", "role"]


async def _resolve_department(
    session: AsyncSession, org_id: UUID, dept_raw: Any
) -> tuple[Department | None, list[str]]:
    """Resolve department_id column as UUID or department code (e.g. SMS)."""
    errors: list[str] = []
    if not dept_raw:
        errors.append("Missing required field: department_id (UUID or department code)")
        return None, errors
    raw = str(dept_raw).strip()
    try:
        dept_id = UUID(raw)
        dept = await session.get(Department, dept_id)
        if not dept:
            errors.append("Department not found")
        return dept, errors
    except ValueError:
        result = await session.execute(
            select(Department).where(
                Department.organisation_id == org_id,
                Department.code == raw.upper(),
            )
        )
        dept = result.scalar_one_or_none()
        if not dept:
            errors.append(f"Department not found for code: {raw}")
        return dept, errors


def _parse_date(val: Any) -> date | None:
    if val is None or val == "":
        return None
    if isinstance(val, date):
        return val
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_role(val: Any) -> UserRole | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    for role in UserRole:
        if role.value == s or role.name.lower() == s:
            return role
    return None


def _parse_employment_status(val: Any) -> EmploymentStatus:
    if val is None or val == "":
        return EmploymentStatus.ACTIVE
    s = str(val).strip().lower()
    for status in EmploymentStatus:
        if status.value == s:
            return status
    return EmploymentStatus.ACTIVE


def _parse_employment_type(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    for et in EmploymentType:
        if et.value == s:
            return et.value
        return s if s else None


_workforce = WorkforceService()


async def validate_row(
    session: AsyncSession,
    actor: User,
    row: dict[str, Any],
    *,
    org_id: UUID,
) -> list[str]:
    errors: list[str] = []
    for col in REQUIRED:
        if not row.get(col):
            errors.append(f"Missing required field: {col}")

    role = _parse_role(row.get("role"))
    if row.get("role") and not role:
        errors.append(f"Invalid role: {row.get('role')}")

    _dept, dept_errors = await _resolve_department(session, org_id, row.get("department_id"))
    errors.extend(dept_errors)

    email = str(row.get("email", "")).strip().lower()
    if email:
        existing = await session.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            errors.append("Email already registered")

    uid = row.get("employee_uid")
    if uid:
        uid_str = str(uid).strip()
        existing_uid = await session.execute(select(User).where(User.employee_uid == uid_str))
        if existing_uid.scalar_one_or_none():
            errors.append("employee_uid already exists")

    if row.get("date_of_joining") and _parse_date(row.get("date_of_joining")) is None:
        errors.append("Invalid date_of_joining format (use YYYY-MM-DD)")

    return errors


async def import_row(
    session: AsyncSession,
    actor: User,
    row: dict[str, Any],
    *,
    org_id: UUID,
) -> dict[str, Any]:
    role = _parse_role(row["role"])
    if not role:
        raise ValueError("Invalid role")

    dept, dept_errors = await _resolve_department(session, org_id, row.get("department_id"))
    if dept_errors or not dept:
        raise ValueError(dept_errors[0] if dept_errors else "Department not found")
    dept_id = dept.id

    et = _parse_employment_type(row.get("employment_type"))
    emp_type = None
    if et:
        try:
            emp_type = EmploymentType(et)
        except ValueError:
            emp_type = None

    data = WorkforceEmployeeCreate(
        email=str(row["email"]).strip().lower(),
        password=str(row["password"]),
        full_name=str(row["full_name"]).strip(),
        role=role,
        department_id=dept_id,
        plant_id=dept.plant_id,
        designation=str(row["designation"]).strip() if row.get("designation") else None,
        phone=str(row["phone"]).strip() if row.get("phone") else None,
        employment_status=_parse_employment_status(row.get("employment_status")),
        date_of_joining=_parse_date(row.get("date_of_joining")),
        employment_type=emp_type,
    )
    profile = await _workforce.create_employee(session, actor, data)
    user = await session.get(User, profile.id)
    if user:
        if row.get("employee_uid"):
            user.employee_uid = str(row["employee_uid"]).strip()
        if emp_type:
            user.employment_type = emp_type.value
        await session.flush()
    return {"entity_id": profile.id, "action": "created"}


def register() -> None:
    register_module(
        "employees",
        columns=COLUMNS,
        required=REQUIRED,
        validate_row=validate_row,
        import_row=import_row,
    )


register()
