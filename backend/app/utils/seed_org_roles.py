"""Seed CEO, HoD, and process-scoped supervisors for Chandan Steel."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.db.models import Department, Organisation, Plant, Process, User
from app.models.enums import UserRole


async def seed_org_role_users(session: AsyncSession) -> None:
    org_result = await session.execute(select(Organisation).where(Organisation.code == "CHANDAN"))
    org = org_result.scalar_one_or_none()
    if not org:
        return

    plant_result = await session.execute(select(Plant).where(Plant.organisation_id == org.id, Plant.code == "SMS"))
    plant = plant_result.scalar_one_or_none()
    if not plant:
        return

    dept_result = await session.execute(
        select(Department).where(Department.plant_id == plant.id, Department.code == "SMS")
    )
    dept = dept_result.scalar_one_or_none()
    if not dept:
        return

    processes: dict[str, Process] = {}
    for code in ("IAF", "AOD", "CCM"):
        proc_result = await session.execute(
            select(Process).where(Process.department_id == dept.id, Process.code == code)
        )
        proc = proc_result.scalar_one_or_none()
        if proc:
            processes[code] = proc

    seeds = [
        {
            "email": "ceo@chandansteel.com",
            "password": "ceo123",
            "full_name": "Chandan CEO",
            "role": UserRole.CEO,
            "designation": "Chief Executive Officer",
            "employee_uid": "CHANDAN-CEO-0001",
            "process_id": None,
        },
        {
            "email": "hod@chandansteel.com",
            "password": "hod123",
            "full_name": "SMS Head of Department",
            "role": UserRole.HOD,
            "designation": "HOD (Production)",
            "employee_uid": "SMS-SMS-0001",
            "process_id": None,
        },
        {
            "email": "iaf.supervisor@chandansteel.com",
            "password": "iaf123",
            "full_name": "IAF Shift Incharge",
            "role": UserRole.SUPERVISOR,
            "designation": "IAF Supervisor",
            "employee_uid": "SMS-SMS-0002",
            "process_code": "IAF",
        },
        {
            "email": "aod.supervisor@chandansteel.com",
            "password": "aod123",
            "full_name": "AOD Shift Incharge",
            "role": UserRole.SUPERVISOR,
            "designation": "AOD Supervisor",
            "employee_uid": "SMS-SMS-0003",
            "process_code": "AOD",
        },
        {
            "email": "ccm.supervisor@chandansteel.com",
            "password": "ccm123",
            "full_name": "CCM Shift Incharge",
            "role": UserRole.SUPERVISOR,
            "designation": "CCM Supervisor",
            "employee_uid": "SMS-SMS-0004",
            "process_code": "CCM",
        },
    ]

    for spec in seeds:
        existing = await session.execute(select(User).where(User.email == spec["email"]))
        if existing.scalar_one_or_none():
            continue

        process_id = None
        if spec.get("process_code"):
            proc = processes.get(spec["process_code"])
            if not proc:
                continue
            process_id = proc.id

        session.add(
            User(
                email=spec["email"],
                hashed_password=get_password_hash(spec["password"]),
                full_name=spec["full_name"],
                role=spec["role"],
                organisation_id=org.id,
                plant_id=plant.id,
                department_id=dept.id,
                process_id=process_id,
                designation=spec["designation"],
                employee_uid=spec["employee_uid"],
                is_active=True,
            )
        )

    # Migrate legacy supervisor to IAF scope
    legacy = await session.execute(select(User).where(User.email == "supervisor@chandansteel.com"))
    legacy_user = legacy.scalar_one_or_none()
    iaf = processes.get("IAF")
    if legacy_user and iaf:
        legacy_user.process_id = iaf.id
        legacy_user.designation = legacy_user.designation or "IAF Supervisor"

    await session.flush()
