"""Seed CEO, HoD, and process-scoped supervisors for Chandan Steel."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.db.models import Process, User
from app.models.enums import ObservationCategory, UserRole
from app.utils.chandan_org import get_chandan_department, get_chandan_organisation, get_chandan_plant


async def seed_org_role_users(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return

    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    hr_dept = await get_chandan_department(session, plant.id, "QUAL")

    hr_seed = {
        "email": "hr@chandansteel.com",
        "password": "hr123",
        "full_name": "HR Workforce Manager",
        "role": UserRole.HR,
        "designation": "HR Manager",
        "employee_uid": "CHANDAN-HR-0001",
    }
    with session.no_autoflush:
        existing_hr = await session.execute(select(User).where(User.email == hr_seed["email"]))
        if not existing_hr.scalar_one_or_none():
            session.add(
                User(
                    email=hr_seed["email"],
                    hashed_password=get_password_hash(hr_seed["password"]),
                    full_name=hr_seed["full_name"],
                    role=hr_seed["role"],
                    organisation_id=org.id,
                    plant_id=plant.id,
                    department_id=hr_dept.id if hr_dept else None,
                    designation=hr_seed["designation"],
                    employee_uid=hr_seed["employee_uid"],
                    is_active=True,
                )
            )

    dept = await get_chandan_department(session, plant.id, "SMS")
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
            "employee_uid": "CHANDAN-HOD-0001",
            "process_id": None,
        },
        {
            "email": "iaf.supervisor@chandansteel.com",
            "password": "iaf123",
            "full_name": "IAF Shift Incharge",
            "role": UserRole.SUPERVISOR,
            "designation": "IAF Supervisor",
            "employee_uid": "CHANDAN-IAF-SUP-0001",
            "process_code": "IAF",
        },
        {
            "email": "aod.supervisor@chandansteel.com",
            "password": "aod123",
            "full_name": "AOD Shift Incharge",
            "role": UserRole.SUPERVISOR,
            "designation": "AOD Supervisor",
            "employee_uid": "CHANDAN-AOD-SUP-0001",
            "process_code": "AOD",
        },
        {
            "email": "ccm.supervisor@chandansteel.com",
            "password": "ccm123",
            "full_name": "CCM Shift Incharge",
            "role": UserRole.SUPERVISOR,
            "designation": "CCM Supervisor",
            "employee_uid": "CHANDAN-CCM-SUP-0001",
            "process_code": "CCM",
        },
    ]

    for spec in seeds:
        with session.no_autoflush:
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

    rolling_dept = await get_chandan_department(session, plant.id, "ROLLING")
    if rolling_dept:
        rmill_proc = await session.execute(
            select(Process).where(Process.department_id == rolling_dept.id, Process.code == "RMILL")
        )
        rmill = rmill_proc.scalar_one_or_none()
        rolling_seeds = [
            {
                "email": "hod.rolling@chandansteel.com",
                "password": "hod123",
                "full_name": "Rolling Mill HoD",
                "role": UserRole.HOD,
                "designation": "HOD (Rolling Mill)",
                "employee_uid": "CHANDAN-HOD-RM-0001",
            },
            {
                "email": "supervisor.rolling@chandansteel.com",
                "password": "rolling123",
                "full_name": "Rolling Mill Shift Incharge",
                "role": UserRole.SUPERVISOR,
                "designation": "Rolling Mill Supervisor",
                "employee_uid": "CHANDAN-RM-SUP-0001",
                "process_id": rmill.id if rmill else None,
            },
            {
                "email": "worker.rolling@chandansteel.com",
                "password": "rolling123",
                "full_name": "Rolling Mill Operator",
                "role": UserRole.WORKER,
                "designation": "Mill Operator",
                "employee_uid": "CHANDAN-RM-WKR-0001",
            },
        ]
        for spec in rolling_seeds:
            with session.no_autoflush:
                existing = await session.execute(select(User).where(User.email == spec["email"]))
                if existing.scalar_one_or_none():
                    continue
                session.add(
                    User(
                        email=spec["email"],
                        hashed_password=get_password_hash(spec["password"]),
                        full_name=spec["full_name"],
                        role=spec["role"],
                        organisation_id=org.id,
                        plant_id=plant.id,
                        department_id=rolling_dept.id,
                        process_id=spec.get("process_id"),
                        designation=spec["designation"],
                        employee_uid=spec["employee_uid"],
                        is_active=True,
                    )
                )

    wire_dept = await get_chandan_department(session, plant.id, "WIRE")
    if wire_dept:
        wire_seeds = [
            {
                "email": "hod.wire@chandansteel.com",
                "password": "hod123",
                "full_name": "Wire Division HoD",
                "role": UserRole.HOD,
                "designation": "HOD (Wire Division)",
                "employee_uid": "CHANDAN-HOD-WIRE-0001",
            },
            {
                "email": "supervisor.wire@chandansteel.com",
                "password": "wire123",
                "full_name": "Wire Division Shift Incharge",
                "role": UserRole.SUPERVISOR,
                "designation": "Wire Division Supervisor",
                "employee_uid": "CHANDAN-WIRE-SUP-0001",
            },
            {
                "email": "worker.wire@chandansteel.com",
                "password": "wire123",
                "full_name": "Wire Division Operator",
                "role": UserRole.WORKER,
                "designation": "Wire Division Operator",
                "employee_uid": "CHANDAN-WIRE-WKR-0001",
            },
        ]
        for spec in wire_seeds:
            with session.no_autoflush:
                existing = await session.execute(select(User).where(User.email == spec["email"]))
                user = existing.scalar_one_or_none()
                if user:
                    user.designation = spec["designation"]
                    user.full_name = spec["full_name"]
                    user.process_id = None
                    continue
                session.add(
                    User(
                        email=spec["email"],
                        hashed_password=get_password_hash(spec["password"]),
                        full_name=spec["full_name"],
                        role=spec["role"],
                        organisation_id=org.id,
                        plant_id=plant.id,
                        department_id=wire_dept.id,
                        process_id=spec.get("process_id"),
                        designation=spec["designation"],
                        employee_uid=spec["employee_uid"],
                        is_active=True,
                    )
                )

    bbd_dept = await get_chandan_department(session, plant.id, "BBD")
    if bbd_dept:
        bbd_seeds = [
            {
                "email": "hod.bbd@chandansteel.com",
                "password": "hod123",
                "full_name": "Bright Bar Division HoD",
                "role": UserRole.HOD,
                "designation": "HOD (Bright Bar Division)",
                "employee_uid": "CHANDAN-HOD-BBD-0001",
            },
            {
                "email": "supervisor.bbd@chandansteel.com",
                "password": "bbd123",
                "full_name": "Bright Bar Shift Incharge",
                "role": UserRole.SUPERVISOR,
                "designation": "Bright Bar Supervisor",
                "employee_uid": "CHANDAN-BBD-SUP-0001",
            },
            {
                "email": "worker.bbd@chandansteel.com",
                "password": "bbd123",
                "full_name": "Bright Bar Production Clerk",
                "role": UserRole.WORKER,
                "designation": "Bright Bar Operator",
                "employee_uid": "CHANDAN-BBD-WKR-0001",
            },
        ]
        for spec in bbd_seeds:
            with session.no_autoflush:
                existing = await session.execute(select(User).where(User.email == spec["email"]))
                user = existing.scalar_one_or_none()
                if user:
                    user.designation = spec["designation"]
                    user.full_name = spec["full_name"]
                    user.process_id = None
                    continue
                session.add(
                    User(
                        email=spec["email"],
                        hashed_password=get_password_hash(spec["password"]),
                        full_name=spec["full_name"],
                        role=spec["role"],
                        organisation_id=org.id,
                        plant_id=plant.id,
                        department_id=bbd_dept.id,
                        process_id=spec.get("process_id"),
                        designation=spec["designation"],
                        employee_uid=spec["employee_uid"],
                        is_active=True,
                    )
                )

    forge_dept = await get_chandan_department(session, plant.id, "FORGE")
    if forge_dept:
        grind_proc = await session.execute(
            select(Process).where(Process.department_id == forge_dept.id, Process.code == "GRIND")
        )
        grind = grind_proc.scalar_one_or_none()
        forge_seeds = [
            {
                "email": "hod.forge@chandansteel.com",
                "password": "hod123",
                "full_name": "Forge Shop HoD",
                "role": UserRole.HOD,
                "designation": "HOD (Forge Shop)",
                "employee_uid": "CHANDAN-HOD-FORGE-0001",
            },
            {
                "email": "supervisor.forge@chandansteel.com",
                "password": "forge123",
                "full_name": "Forge Shop Shift Incharge",
                "role": UserRole.SUPERVISOR,
                "designation": "Forge Shop Supervisor",
                "employee_uid": "CHANDAN-FORGE-SUP-0001",
                "process_id": grind.id if grind else None,
            },
            {
                "email": "worker.forge@chandansteel.com",
                "password": "forge123",
                "full_name": "Grinding Operator",
                "role": UserRole.WORKER,
                "designation": "Grinding Operator",
                "employee_uid": "CHANDAN-FORGE-WKR-0001",
            },
        ]
        for spec in forge_seeds:
            with session.no_autoflush:
                existing = await session.execute(select(User).where(User.email == spec["email"]))
                if existing.scalar_one_or_none():
                    continue
                session.add(
                    User(
                        email=spec["email"],
                        hashed_password=get_password_hash(spec["password"]),
                        full_name=spec["full_name"],
                        role=spec["role"],
                        organisation_id=org.id,
                        plant_id=plant.id,
                        department_id=forge_dept.id,
                        process_id=spec.get("process_id"),
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

    maint_seeds = [
        ("maint.quality@chandansteel.com", "Quality Maintenance", ObservationCategory.QUALITY, "SMS-SMS-M001"),
        ("maint.safety@chandansteel.com", "Safety Maintenance", ObservationCategory.SAFETY, "SMS-SMS-M002"),
        ("maint.energy@chandansteel.com", "Energy Maintenance", ObservationCategory.ENERGY, "SMS-SMS-M003"),
        ("maint.equipment@chandansteel.com", "Equipment Maintenance", ObservationCategory.EQUIPMENT, "SMS-SMS-M004"),
        ("maint.process@chandansteel.com", "Process Maintenance", ObservationCategory.PROCESS, "SMS-SMS-M005"),
    ]
    for email, name, division, uid in maint_seeds:
        with session.no_autoflush:
            existing = await session.execute(select(User).where(User.email == email))
            if existing.scalar_one_or_none():
                continue
            session.add(
                User(
                    email=email,
                    hashed_password=get_password_hash("maint123"),
                    full_name=name,
                    role=UserRole.MAINTENANCE,
                    organisation_id=org.id,
                    plant_id=plant.id,
                    department_id=dept.id,
                    maintenance_division=division,
                    designation=f"{division.value.title()} Crew",
                    employee_uid=uid,
                    is_active=True,
                )
            )

    await session.flush()
