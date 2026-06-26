"""Seed Phase 4 demo data — leave types and sample PM program."""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Asset,
    LeaveType,
    MaintenanceNotificationRule,
    MaintenanceProgram,
    MaintenanceProgramTrigger,
    MaintenanceTaskTemplate,
    SalaryStructure,
    User,
)
from app.models.enums import MaintenanceProgramStatus, MaintenanceTriggerType
from app.utils.chandan_org import get_chandan_department, get_chandan_organisation, get_chandan_plant


async def _seed_demo_salary_structures(session: AsyncSession, org_id) -> None:
    """Demo salary structures so payroll processing produces payslips."""
    demos = [
        ("melter@chandansteel.com", 25000, 8000, 2000, 1800, 500, 200),
        ("iaf.supervisor@chandansteel.com", 35000, 12000, 3000, 2500, 750, 300),
        ("worker.rolling@chandansteel.com", 22000, 7000, 1500, 1600, 400, 150),
        ("hod@chandansteel.com", 55000, 18000, 5000, 4000, 1200, 500),
        ("hr@chandansteel.com", 48000, 15000, 4000, 3500, 1000, 400),
        ("worker.bbd@chandansteel.com", 24000, 7500, 1800, 1700, 450, 175),
        ("supervisor.bbd@chandansteel.com", 32000, 10000, 2500, 2200, 650, 250),
        ("worker.forge@chandansteel.com", 23000, 7200, 1600, 1650, 420, 160),
    ]
    effective = date(2024, 1, 1)
    for email, basic, hra, allowances, pf, esi, other in demos:
        user_result = await session.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if not user:
            continue
        existing = await session.execute(
            select(SalaryStructure).where(SalaryStructure.user_id == user.id).limit(1)
        )
        if existing.scalar_one_or_none():
            continue
        session.add(
            SalaryStructure(
                user_id=user.id,
                basic=basic,
                hra=hra,
                allowances=allowances,
                pf=pf,
                esi=esi,
                other_deductions=other,
                effective_from=effective,
            )
        )


async def seed_phase4(session: AsyncSession) -> None:
    org = await get_chandan_organisation(session)
    if not org:
        return
    plant = await get_chandan_plant(session, org.id)
    if not plant:
        return

    leave_types = [
        ("CL", "Casual Leave"),
        ("SL", "Sick Leave"),
        ("EL", "Earned Leave"),
        ("LOP", "Loss of Pay"),
    ]
    for code, name in leave_types:
        existing = await session.execute(
            select(LeaveType).where(LeaveType.organisation_id == org.id, LeaveType.code == code)
        )
        if not existing.scalar_one_or_none():
            session.add(LeaveType(organisation_id=org.id, code=code, name=name, is_active=True))

    await _seed_demo_salary_structures(session, org.id)

    sms_dept = await get_chandan_department(session, plant.id, "SMS")
    asset_result = await session.execute(
        select(Asset).where(Asset.plant_id == plant.id).order_by(Asset.asset_no).limit(1)
    )
    asset = asset_result.scalar_one_or_none()

    prog_existing = await session.execute(
        select(MaintenanceProgram).where(
            MaintenanceProgram.organisation_id == org.id,
            MaintenanceProgram.name == "EAF Monthly Inspection",
        )
    )
    if prog_existing.scalar_one_or_none():
        await session.flush()
        return

    program = MaintenanceProgram(
        organisation_id=org.id,
        plant_id=plant.id,
        department_id=sms_dept.id if sms_dept else None,
        asset_id=asset.id if asset else None,
        name="EAF Monthly Inspection",
        description="Monthly preventive maintenance for EAF equipment",
        category="equipment",
        priority="high",
        responsible_team="SMS Maintenance",
        estimated_duration_min=240,
        status=MaintenanceProgramStatus.ACTIVE.value,
        is_active=True,
        auto_generate_work_orders=True,
    )
    session.add(program)
    await session.flush()

    now = datetime.now(timezone.utc)
    session.add(
        MaintenanceProgramTrigger(
            program_id=program.id,
            trigger_type=MaintenanceTriggerType.TIME.value,
            interval_days=30,
            next_due_at=now + timedelta(days=30),
            is_active=True,
        )
    )
    session.add(
        MaintenanceTaskTemplate(
            program_id=program.id,
            name="Visual inspection",
            description="Check electrodes, cooling panels, and hoses",
            estimated_duration_min=60,
            is_required=True,
            checklist=[
                {"key": "electrodes", "label": "Electrodes condition OK"},
                {"key": "cooling", "label": "Cooling system OK"},
            ],
            sort_order=1,
        )
    )
    session.add(
        MaintenanceTaskTemplate(
            program_id=program.id,
            name="Lubrication check",
            description="Verify lubrication points",
            estimated_duration_min=30,
            is_required=True,
            checklist=[{"key": "lube", "label": "All lube points serviced"}],
            sort_order=2,
        )
    )
    session.add(
        MaintenanceNotificationRule(
            program_id=program.id,
            offset_days=3,
            recipient_role="maintenance_manager",
            channel="in_app",
            is_active=True,
        )
    )
    await session.flush()
