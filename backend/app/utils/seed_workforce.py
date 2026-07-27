"""Additive seed for workforce management demo data."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Contractor,
    ContractWorker,
    Shift,
    ShiftAssignment,
    ShiftHandoverNote,
    User,
)
from app.utils.chandan_org import get_chandan_department, get_chandan_organisation, get_chandan_plant


async def _shift_by_code(session: AsyncSession, plant_id, code: str) -> Shift | None:
    result = await session.execute(
        select(Shift).where(Shift.plant_id == plant_id, Shift.code == code)
    )
    return result.scalar_one_or_none()


async def seed_workforce_demo(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return
    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    shift_a = await _shift_by_code(session, plant.id, "A")
    shift_b = await _shift_by_code(session, plant.id, "B")
    shift_c = await _shift_by_code(session, plant.id, "C")
    if not shift_a or not shift_b or not shift_c:
        return

    contractors_data = [
        ("ABC", "ABC Labour Services", "Ramesh Kumar", "9876500001"),
        ("XYZ", "XYZ Contractors", "Suresh Patel", "9876500002"),
    ]
    contractors: dict[str, Contractor] = {}
    for code, name, contact, phone in contractors_data:
        existing = await session.execute(
            select(Contractor).where(Contractor.organisation_id == org.id, Contractor.code == code)
        )
        contractor = existing.scalar_one_or_none()
        if not contractor:
            contractor = Contractor(
                organisation_id=org.id,
                code=code,
                name=name,
                contact_person=contact,
                phone=phone,
                is_active=True,
            )
            session.add(contractor)
            await session.flush()
        contractors[code] = contractor

    sms_dept = await get_chandan_department(session, plant.id, "SMS")
    rolling_dept = await get_chandan_department(session, plant.id, "ROLLING")
    wire_dept = await get_chandan_department(session, plant.id, "WIRE")
    bbd_dept = await get_chandan_department(session, plant.id, "BBD")
    forge_dept = await get_chandan_department(session, plant.id, "FORGE")

    if sms_dept and contractors.get("ABC"):
        for name in ("Rajesh Singh", "Kumar Das"):
            exists = await session.execute(
                select(ContractWorker).where(
                    ContractWorker.contractor_id == contractors["ABC"].id,
                    ContractWorker.full_name == name,
                )
            )
            if not exists.scalar_one_or_none():
                session.add(
                    ContractWorker(
                        contractor_id=contractors["ABC"].id,
                        full_name=name,
                        department_id=sms_dept.id,
                        is_active=True,
                    )
                )

    effective = date.today() - timedelta(days=30)
    assignment_specs: list[tuple[str, str, str]] = [
        ("melter@chandansteel.com", "SMS", "A"),
        ("iaf.supervisor@chandansteel.com", "SMS", "A"),
        ("worker.rolling@chandansteel.com", "ROLLING", "B"),
        ("supervisor.rolling@chandansteel.com", "ROLLING", "B"),
        ("worker.wire@chandansteel.com", "WIRE", "C"),
        ("supervisor.wire@chandansteel.com", "WIRE", "C"),
        ("worker.bbd@chandansteel.com", "BBD", "A"),
        ("supervisor.bbd@chandansteel.com", "BBD", "A"),
        ("worker.forge@chandansteel.com", "FORGE", "B"),
        ("supervisor.forge@chandansteel.com", "FORGE", "B"),
    ]
    dept_map = {
        "SMS": sms_dept,
        "ROLLING": rolling_dept,
        "WIRE": wire_dept,
        "BBD": bbd_dept,
        "FORGE": forge_dept,
    }
    shift_map = {"A": shift_a, "B": shift_b, "C": shift_c}

    for email, dept_code, shift_code in assignment_specs:
        dept = dept_map.get(dept_code)
        shift = shift_map.get(shift_code)
        if not dept or not shift:
            continue
        user_result = await session.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if not user:
            continue
        exists = await session.execute(
            select(ShiftAssignment).where(
                ShiftAssignment.user_id == user.id,
                ShiftAssignment.department_id == dept.id,
                ShiftAssignment.shift_id == shift.id,
                ShiftAssignment.effective_date == effective,
            )
        )
        if not exists.scalars().first():
            session.add(
                ShiftAssignment(
                    user_id=user.id,
                    department_id=dept.id,
                    shift_id=shift.id,
                    effective_date=effective,
                )
            )

    if sms_dept and shift_a:
        author = await session.execute(select(User).where(User.email == "iaf.supervisor@chandansteel.com"))
        author_user = author.scalar_one_or_none()
        if author_user:
            note_date = date.today() - timedelta(days=1)
            exists = await session.execute(
                select(ShiftHandoverNote).where(
                    ShiftHandoverNote.department_id == sms_dept.id,
                    ShiftHandoverNote.shift_id == shift_a.id,
                    ShiftHandoverNote.note_date == note_date,
                )
            )
            if not exists.scalars().first():
                session.add(
                    ShiftHandoverNote(
                        note_date=note_date,
                        department_id=sms_dept.id,
                        shift_id=shift_a.id,
                        author_id=author_user.id,
                        note=(
                            "Furnace #2 showing voltage fluctuation. Maintenance informed. "
                            "Inspection pending before next heat."
                        ),
                    )
                )

    await session.flush()
