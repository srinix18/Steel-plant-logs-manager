from datetime import date, datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Department,
    Plant,
    ProcessRun,
    RunFieldValue,
    Shift,
    TemplateSection,
    User,
)
from app.models.enums import ValueSource


async def _plant_today(session: AsyncSession, run: ProcessRun) -> date:
    from app.db.models import Process

    process = await session.get(Process, run.process_id)
    if not process:
        return datetime.now(timezone.utc).date()
    dept = await session.get(Department, process.department_id)
    if not dept:
        return datetime.now(timezone.utc).date()
    plant = await session.get(Plant, dept.plant_id)
    tz_name = plant.timezone if plant and plant.timezone else "UTC"
    try:
        return datetime.now(ZoneInfo(tz_name)).date()
    except Exception:
        return datetime.now(timezone.utc).date()


async def _last_tapping_time(session: AsyncSession, instance_id: UUID, exclude_run_id: UUID) -> str | None:
    result = await session.execute(
        select(ProcessRun)
        .where(
            ProcessRun.process_instance_id == instance_id,
            ProcessRun.id != exclude_run_id,
            ProcessRun.current_state.in_(["completed", "approved", "closed"]),
        )
        .order_by(ProcessRun.completed_at.desc().nullslast(), ProcessRun.created_at.desc())
        .limit(1)
    )
    prev_run = result.scalar_one_or_none()
    if not prev_run:
        return None
    fv_result = await session.execute(
        select(RunFieldValue).where(
            RunFieldValue.run_id == prev_run.id,
            RunFieldValue.field_key == "tapping_time",
        )
    )
    fv = fv_result.scalar_one_or_none()
    if not fv or not fv.value:
        return None
    return str(fv.value)


async def _section_field_names(session: AsyncSession, version_id: UUID) -> dict[str, set[str]]:
    result = await session.execute(
        select(TemplateSection)
        .where(TemplateSection.version_id == version_id)
        .options(selectinload(TemplateSection.fields))
    )
    mapping: dict[str, set[str]] = {}
    for section in result.scalars():
        mapping[section.key] = {f.name for f in section.fields}
    return mapping


async def seed_default_field_values(session: AsyncSession, run: ProcessRun, user: User) -> None:
    section_fields = await _section_field_names(session, run.template_version_id)
    today = await _plant_today(session, run)
    today_str = today.isoformat()

    shift_code: str | None = None
    if run.shift_id:
        shift = await session.get(Shift, run.shift_id)
        if shift:
            shift_code = shift.code

    grade_str = str(run.grade_id) if run.grade_id else None
    melter_str = str(user.id)
    heat_no = run.run_number.split("-")[-1] if "-" in run.run_number else run.run_number

    defaults: dict[str, str] = {}
    heat_fields = section_fields.get("heat_info", set())
    if "date" in heat_fields:
        defaults["date"] = today_str
    if "heat_no" in heat_fields:
        defaults["heat_no"] = heat_no
    if "grade" in heat_fields and grade_str:
        defaults["grade"] = grade_str
    if "shift" in heat_fields and shift_code:
        defaults["shift"] = shift_code
    if "melter" in heat_fields:
        defaults["melter"] = melter_str

    shift_header = section_fields.get("shift_header", set())
    if "date" in shift_header:
        defaults["date"] = today_str
    if "shift" in shift_header:
        defaults["shift"] = shift_code or ""

    timing_fields = section_fields.get("timing_equipment", set())
    if "previous_heat_tapping_time" in timing_fields:
        prev = await _last_tapping_time(session, run.process_instance_id, run.id)
        if prev:
            defaults["previous_heat_tapping_time"] = prev

    for key, value in defaults.items():
        if not value:
            continue
        session.add(
            RunFieldValue(
                run_id=run.id,
                field_key=key,
                value=value,
                source=ValueSource.SYSTEM,
            )
        )
