"""Central role tier helpers and data-access scoping for process runs."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Department, Plant, Process, ProcessRun, User
from app.models.enums import UserRole

PLATFORM_ADMIN_ROLES = {UserRole.SUPER_ADMIN, UserRole.ADMIN}
CEO_ROLES = {UserRole.CEO, UserRole.ORG_ADMIN}
HOD_ROLES = {UserRole.HOD, UserRole.PLANT_ADMIN}
SUPERVISOR_ONLY_ROLES = {UserRole.SUPERVISOR, UserRole.DEPARTMENT}
WORKER_ROLES = {UserRole.WORKER, UserRole.MEMBER}

CEO_TIER_ROLES = PLATFORM_ADMIN_ROLES | CEO_ROLES
HOD_TIER_ROLES = CEO_TIER_ROLES | HOD_ROLES
SUPERVISOR_TIER_ROLES = HOD_TIER_ROLES | SUPERVISOR_ONLY_ROLES


def role_key(role: UserRole) -> str:
    if role == UserRole.ADMIN:
        return UserRole.SUPER_ADMIN.value
    if role == UserRole.ORG_ADMIN:
        return UserRole.CEO.value
    if role == UserRole.PLANT_ADMIN:
        return UserRole.HOD.value
    if role == UserRole.DEPARTMENT:
        return UserRole.SUPERVISOR.value
    if role == UserRole.MEMBER:
        return UserRole.WORKER.value
    return role.value


def is_platform_admin(user: User) -> bool:
    return user.role in PLATFORM_ADMIN_ROLES


def is_ceo_tier(user: User) -> bool:
    return user.role in CEO_TIER_ROLES


def is_hod_tier(user: User) -> bool:
    return user.role in HOD_TIER_ROLES


def is_supervisor_tier(user: User) -> bool:
    return user.role in SUPERVISOR_TIER_ROLES


def is_supervisor_only(user: User) -> bool:
    return user.role in SUPERVISOR_ONLY_ROLES


def is_worker(user: User) -> bool:
    return user.role in WORKER_ROLES


def user_has_role(user: User, allowed: set[UserRole]) -> bool:
    if user.role in allowed:
        return True
    if user.role == UserRole.ADMIN and UserRole.SUPER_ADMIN in allowed:
        return True
    if user.role == UserRole.ORG_ADMIN and UserRole.CEO in allowed:
        return True
    if user.role == UserRole.PLANT_ADMIN and UserRole.HOD in allowed:
        return True
    if user.role == UserRole.DEPARTMENT and UserRole.SUPERVISOR in allowed:
        return True
    if user.role == UserRole.MEMBER and UserRole.WORKER in allowed:
        return True
    return False


def needs_run_join_for_scope(user: User | None) -> bool:
    if not user or is_platform_admin(user):
        return False
    if is_ceo_tier(user) and not is_platform_admin(user):
        return True
    if is_hod_tier(user) and not is_ceo_tier(user):
        return True
    if is_supervisor_only(user):
        return True
    return False


def apply_run_query_scope(query: Select, user: User) -> Select:
    if is_platform_admin(user):
        return query
    if is_ceo_tier(user) and user.organisation_id:
        return query.where(Plant.organisation_id == user.organisation_id)
    if is_hod_tier(user) and not is_ceo_tier(user) and user.department_id:
        return query.where(Department.id == user.department_id)
    if is_supervisor_only(user):
        if user.department_id:
            query = query.where(Department.id == user.department_id)
        elif user.plant_id:
            query = query.where(Department.plant_id == user.plant_id)
        if user.process_id:
            query = query.where(ProcessRun.process_id == user.process_id)
        return query
    return query


async def assert_run_access(session: AsyncSession, run: ProcessRun, user: User) -> None:
    if is_platform_admin(user) or is_ceo_tier(user):
        if is_ceo_tier(user) and not is_platform_admin(user) and user.organisation_id:
            process = await session.get(Process, run.process_id)
            if not process:
                raise HTTPException(status_code=404, detail="Process run not found")
            dept = await session.get(Department, process.department_id)
            if not dept:
                raise HTTPException(status_code=403, detail="Access denied")
            plant = await session.get(Plant, dept.plant_id)
            if not plant or plant.organisation_id != user.organisation_id:
                raise HTTPException(status_code=403, detail="Access denied")
        return

    if is_hod_tier(user) and not is_ceo_tier(user):
        process = await session.get(Process, run.process_id)
        if not process:
            raise HTTPException(status_code=404, detail="Process run not found")
        dept = await session.get(Department, process.department_id)
        if not dept or (user.department_id and dept.id != user.department_id):
            raise HTTPException(status_code=403, detail="Access denied")
        return

    if is_supervisor_only(user):
        process = await session.get(Process, run.process_id)
        if not process:
            raise HTTPException(status_code=404, detail="Process run not found")
        dept = await session.get(Department, process.department_id)
        if not dept:
            raise HTTPException(status_code=403, detail="Access denied")
        if user.department_id and dept.id != user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user.plant_id and not user.department_id and dept.plant_id != user.plant_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user.process_id and run.process_id != user.process_id:
            raise HTTPException(status_code=403, detail="Access denied")
        return

    if is_worker(user):
        if run.created_by != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        return


async def list_eligible_recipients(session: AsyncSession, sender: User) -> list[User]:
    if not sender.organisation_id:
        return []

    result = await session.execute(
        select(User).where(
            User.organisation_id == sender.organisation_id,
            User.is_active.is_(True),
            User.id != sender.id,
        )
    )
    candidates = list(result.scalars())
    return [u for u in candidates if can_message(sender, u)]


def can_message(sender: User, recipient: User) -> bool:
    if not sender.organisation_id or sender.organisation_id != recipient.organisation_id:
        return False
    if sender.id == recipient.id:
        return False

    sender_role = sender.role
    recipient_role = recipient.role

    if sender_role in PLATFORM_ADMIN_ROLES or sender_role in CEO_ROLES:
        return True

    if sender_role in HOD_ROLES:
        if recipient_role in CEO_ROLES or recipient_role in PLATFORM_ADMIN_ROLES:
            return True
        if recipient_role in HOD_ROLES:
            return True
        if sender.department_id and recipient.department_id == sender.department_id:
            return recipient_role in SUPERVISOR_ONLY_ROLES | WORKER_ROLES
        return False

    if sender_role in SUPERVISOR_ONLY_ROLES:
        if not sender.department_id or recipient.department_id != sender.department_id:
            return False
        if recipient_role in HOD_ROLES:
            return True
        if recipient_role in SUPERVISOR_ONLY_ROLES:
            return True
        if recipient_role in WORKER_ROLES:
            return True
        return False

    if sender_role in WORKER_ROLES:
        if not sender.department_id or recipient.department_id != sender.department_id:
            return False
        if recipient_role in HOD_ROLES:
            return True
        if recipient_role in SUPERVISOR_ONLY_ROLES:
            return True
        if recipient_role in WORKER_ROLES:
            return True
        return False

    return False


CEO_ASSIGNABLE_ROLES = {UserRole.HOD, UserRole.SUPERVISOR, UserRole.WORKER}


def validate_user_scope(role: UserRole, organisation_id: UUID | None, department_id: UUID | None, process_id: UUID | None) -> None:
    if role == UserRole.CEO and not organisation_id:
        raise HTTPException(status_code=400, detail="CEO requires organisation_id")
    if role == UserRole.HOD:
        if not organisation_id or not department_id:
            raise HTTPException(status_code=400, detail="HoD requires organisation_id and department_id")
    if role == UserRole.SUPERVISOR:
        if not organisation_id or not department_id or not process_id:
            raise HTTPException(status_code=400, detail="Supervisor requires organisation_id, department_id, and process_id")
    if role == UserRole.WORKER:
        if not organisation_id or not department_id:
            raise HTTPException(status_code=400, detail="Worker requires organisation_id and department_id")
