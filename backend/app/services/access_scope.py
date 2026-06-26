"""Central role tier helpers and data-access scoping for process runs."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import Select, and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.db.models import Department, DepartmentDocument, MaintenanceIssue, Observation, Plant, Process, ProcessInstance, ProcessRun, User
from app.db.types import categories_equal, pg_category_matches_division
from app.models.enums import ObservationCategory, UserRole

PLATFORM_ADMIN_ROLES = {UserRole.SUPER_ADMIN, UserRole.ADMIN}
CEO_ROLES = {UserRole.CEO, UserRole.ORG_ADMIN}
HOD_ROLES = {UserRole.HOD, UserRole.PLANT_ADMIN}
SUPERVISOR_ONLY_ROLES = {UserRole.SUPERVISOR, UserRole.DEPARTMENT}
WORKER_ROLES = {UserRole.WORKER, UserRole.MEMBER}
MAINTENANCE_ROLES = {UserRole.MAINTENANCE}
HR_ROLES = {UserRole.HR}

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


def is_maintenance(user: User) -> bool:
    return user.role in MAINTENANCE_ROLES


def is_hr(user: User) -> bool:
    return user.role in HR_ROLES


def can_raise_maintenance_issue(user: User) -> bool:
    return is_platform_admin(user) or is_supervisor_only(user) or is_worker(user)


def _scope_maintenance_to_department(query: Select, department_id: UUID) -> Select:
    raiser = aliased(User)
    return (
        query.outerjoin(ProcessRun, MaintenanceIssue.run_id == ProcessRun.id)
        .outerjoin(Process, ProcessRun.process_id == Process.id)
        .outerjoin(raiser, MaintenanceIssue.raised_by == raiser.id)
        .where(
            or_(
                Process.department_id == department_id,
                and_(MaintenanceIssue.run_id.is_(None), raiser.department_id == department_id),
            )
        )
    )


async def _issue_in_department(session: AsyncSession, issue: MaintenanceIssue, department_id: UUID) -> bool:
    if issue.run_id:
        run = await session.get(ProcessRun, issue.run_id)
        if run:
            process = await session.get(Process, run.process_id)
            if process:
                return process.department_id == department_id
    raiser = await session.get(User, issue.raised_by)
    return raiser is not None and raiser.department_id == department_id


def apply_maintenance_issue_scope(query: Select, user: User) -> Select:
    if is_platform_admin(user):
        return query
    if is_maintenance(user) and user.maintenance_division:
        query = query.where(pg_category_matches_division(MaintenanceIssue.category, user.maintenance_division))
        if user.organisation_id:
            query = query.where(MaintenanceIssue.organisation_id == user.organisation_id)
        if user.department_id:
            query = _scope_maintenance_to_department(query, user.department_id)
        return query
    if is_ceo_tier(user) and user.organisation_id:
        return query.where(MaintenanceIssue.organisation_id == user.organisation_id)
    if user.department_id:
        if is_hod_tier(user) and not is_ceo_tier(user):
            return _scope_maintenance_to_department(query, user.department_id)
        if is_supervisor_only(user) or is_worker(user):
            return _scope_maintenance_to_department(query, user.department_id)
    if user.plant_id:
        return query.where(MaintenanceIssue.plant_id == user.plant_id)
    return query


async def assert_maintenance_issue_access(session: AsyncSession, issue: MaintenanceIssue, user: User) -> None:
    if is_platform_admin(user):
        return
    if is_maintenance(user):
        if not categories_equal(issue.category, user.maintenance_division):
            raise HTTPException(status_code=403, detail="Access denied")
        if user.organisation_id and issue.organisation_id != user.organisation_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user.department_id and not await _issue_in_department(session, issue, user.department_id):
            raise HTTPException(status_code=403, detail="Access denied")
        return
    if is_ceo_tier(user):
        if user.organisation_id and issue.organisation_id != user.organisation_id:
            raise HTTPException(status_code=403, detail="Access denied")
        return
    if user.department_id:
        if is_hod_tier(user) and not is_ceo_tier(user):
            if not await _issue_in_department(session, issue, user.department_id):
                raise HTTPException(status_code=403, detail="Access denied")
            return
        if is_supervisor_only(user) or is_worker(user):
            if not await _issue_in_department(session, issue, user.department_id):
                raise HTTPException(status_code=403, detail="Access denied")
            return
    if user.plant_id and issue.plant_id != user.plant_id:
        raise HTTPException(status_code=403, detail="Access denied")


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


async def assert_can_access_process(session: AsyncSession, user: User, process: Process) -> None:
    if is_platform_admin(user):
        return
    if is_ceo_tier(user):
        if user.organisation_id:
            dept = await session.get(Department, process.department_id)
            if not dept:
                raise HTTPException(status_code=403, detail="Access denied")
            plant = await session.get(Plant, dept.plant_id)
            if not plant or plant.organisation_id != user.organisation_id:
                raise HTTPException(status_code=403, detail="Access denied")
        return
    if is_hr(user) or is_maintenance(user):
        raise HTTPException(status_code=403, detail="Not permitted for this process")
    if is_hod_tier(user) and not is_ceo_tier(user):
        if not user.department_id or user.department_id != process.department_id:
            raise HTTPException(status_code=403, detail="Cannot access processes outside your department")
        return
    if is_supervisor_only(user):
        if user.department_id and user.department_id != process.department_id:
            raise HTTPException(status_code=403, detail="Cannot access processes outside your department")
        if user.plant_id and not user.department_id:
            dept = await session.get(Department, process.department_id)
            if not dept or dept.plant_id != user.plant_id:
                raise HTTPException(status_code=403, detail="Cannot access processes outside your plant")
        if user.process_id and user.process_id != process.id:
            raise HTTPException(status_code=403, detail="Cannot access processes outside your assigned process")
        return
    if is_worker(user):
        if not user.department_id or user.department_id != process.department_id:
            raise HTTPException(status_code=403, detail="Cannot access processes outside your department")
        return
    raise HTTPException(status_code=403, detail="Access denied")


async def assert_can_create_run(session: AsyncSession, instance: ProcessInstance, user: User) -> None:
    process = await session.get(Process, instance.process_id)
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")
    await assert_can_access_process(session, user, process)


def apply_process_list_scope(query: Select, user: User) -> Select:
    if is_platform_admin(user):
        return query
    if is_ceo_tier(user) and user.organisation_id:
        return query.join(Department, Process.department_id == Department.id).join(
            Plant, Department.plant_id == Plant.id
        ).where(Plant.organisation_id == user.organisation_id)
    if is_hod_tier(user) and not is_ceo_tier(user) and user.department_id:
        return query.where(Process.department_id == user.department_id)
    if is_supervisor_only(user):
        if user.department_id:
            query = query.where(Process.department_id == user.department_id)
        elif user.plant_id:
            query = query.join(Department, Process.department_id == Department.id).where(
                Department.plant_id == user.plant_id
            )
        if user.process_id:
            query = query.where(Process.id == user.process_id)
        return query
    if is_worker(user) and user.department_id:
        return query.where(Process.department_id == user.department_id)
    if is_hr(user) or is_maintenance(user):
        return query.where(Process.id.is_(None))
    return query.where(Process.id.is_(None))


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

    if is_hr(sender) or is_hr(recipient):
        return True

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


CEO_ASSIGNABLE_ROLES = {UserRole.HR, UserRole.HOD, UserRole.SUPERVISOR, UserRole.WORKER, UserRole.MAINTENANCE}

WORKFORCE_EMPLOYEE_ROLES = CEO_ASSIGNABLE_ROLES | {UserRole.HOD, UserRole.PLANT_ADMIN}


def can_manage_workforce(actor: User, department_id: UUID | None = None) -> bool:
    if is_platform_admin(actor) or is_hr(actor):
        return True
    if is_hod_tier(actor) and not is_ceo_tier(actor):
        return department_id is None or actor.department_id == department_id
    return False


def can_manage_shift_assignments(actor: User, department_id: UUID) -> bool:
    return is_platform_admin(actor) or is_hr(actor)


def can_manage_contractors(actor: User) -> bool:
    return is_platform_admin(actor) or is_hr(actor)


def assert_manage_contractors(actor: User) -> None:
    if not can_manage_contractors(actor):
        raise HTTPException(status_code=403, detail="Contractor management access denied")


def can_mark_attendance(actor: User, department_id: UUID) -> bool:
    return is_platform_admin(actor) or is_hr(actor)


def can_write_handover(actor: User, department_id: UUID) -> bool:
    if is_platform_admin(actor) or is_ceo_tier(actor) or is_hr(actor):
        return True
    if is_supervisor_only(actor):
        return actor.department_id == department_id
    return False


def can_view_handover(actor: User, department_id: UUID) -> bool:
    if can_write_handover(actor, department_id):
        return True
    if is_hod_tier(actor) and not is_ceo_tier(actor):
        return actor.department_id == department_id
    if is_worker(actor):
        return actor.department_id == department_id
    return False


def can_mark_workforce_ops(actor: User, department_id: UUID) -> bool:
    return can_write_handover(actor, department_id)


def assert_workforce_manage(actor: User, department_id: UUID | None = None) -> None:
    if not can_manage_workforce(actor, department_id):
        raise HTTPException(status_code=403, detail="Workforce management access denied")


def assert_manage_shift_assignments(actor: User, department_id: UUID) -> None:
    if not can_manage_shift_assignments(actor, department_id):
        raise HTTPException(status_code=403, detail="Shift assignment management access denied")


def assert_mark_attendance(actor: User, department_id: UUID) -> None:
    if not can_mark_attendance(actor, department_id):
        raise HTTPException(status_code=403, detail="Attendance entry access denied")


def assert_write_handover(actor: User, department_id: UUID) -> None:
    if not can_write_handover(actor, department_id):
        raise HTTPException(status_code=403, detail="Cannot write handover notes for this department")


def assert_view_handover(actor: User, department_id: UUID) -> None:
    if not can_view_handover(actor, department_id):
        raise HTTPException(status_code=403, detail="Access denied")


def assert_workforce_ops(actor: User, department_id: UUID) -> None:
    assert_write_handover(actor, department_id)


def apply_workforce_department_scope(query: Select, user: User, department_col) -> Select:
    if is_platform_admin(user) or is_hr(user):
        return query
    if user.department_id:
        return query.where(department_col == user.department_id)
    return query.where(False)


def apply_department_list_scope(query: Select, user: User) -> Select:
    if is_platform_admin(user) or is_ceo_tier(user) or is_hr(user):
        return query
    if user.department_id:
        return query.where(Department.id == user.department_id)
    return query.where(Department.id.is_(None))


def can_manage_masters(user: User) -> bool:
    return is_platform_admin(user) or is_ceo_tier(user)


def can_manage_assets(user: User) -> bool:
    return is_platform_admin(user) or is_hod_tier(user)


def can_view_foundation(user: User) -> bool:
    return is_supervisor_tier(user) or is_maintenance(user)


def assert_can_manage_masters(user: User) -> None:
    if not can_manage_masters(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions to manage master data")


def assert_can_manage_assets(user: User) -> None:
    if not can_manage_assets(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions to manage assets")


def can_view_documents(user: User) -> bool:
    return (
        is_platform_admin(user)
        or is_ceo_tier(user)
        or is_hr(user)
        or is_hod_tier(user)
        or is_supervisor_only(user)
        or is_worker(user)
        or is_maintenance(user)
    )


def assert_can_view_foundation(user: User) -> None:
    if not can_view_foundation(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def assert_can_view_documents(user: User) -> None:
    if not can_view_documents(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def apply_observation_department_scope(query: Select, user: User) -> Select:
    if is_platform_admin(user) or is_ceo_tier(user):
        return query
    if user.department_id:
        return query.where(
            or_(
                Observation.department_id == user.department_id,
                Observation.department_id.is_(None),
            )
        )
    return query


def apply_document_department_scope(query: Select, user: User) -> Select:
    if is_platform_admin(user) or is_ceo_tier(user) or is_hr(user):
        return query
    if user.department_id:
        return query.where(DepartmentDocument.department_id == user.department_id)
    return query.where(False)


def validate_user_scope(
    role: UserRole,
    organisation_id: UUID | None,
    department_id: UUID | None,
    process_id: UUID | None,
    plant_id: UUID | None = None,
    maintenance_division: ObservationCategory | None = None,
) -> None:
    if role == UserRole.CEO and not organisation_id:
        raise HTTPException(status_code=400, detail="CEO requires organisation_id")
    if role == UserRole.HR and not organisation_id:
        raise HTTPException(status_code=400, detail="HR requires organisation_id")
    if role == UserRole.HOD:
        if not organisation_id or not department_id:
            raise HTTPException(status_code=400, detail="HoD requires organisation_id and department_id")
    if role == UserRole.SUPERVISOR:
        if not organisation_id or not department_id or not process_id:
            raise HTTPException(status_code=400, detail="Supervisor requires organisation_id, department_id, and process_id")
    if role == UserRole.WORKER:
        if not organisation_id or not department_id:
            raise HTTPException(status_code=400, detail="Worker requires organisation_id and department_id")
    if role == UserRole.MAINTENANCE:
        if not organisation_id or not plant_id or not department_id or not maintenance_division:
            raise HTTPException(
                status_code=400,
                detail="Maintenance requires organisation_id, plant_id, department_id, and maintenance_division",
            )


FINANCE_VIEW_ROLES = CEO_TIER_ROLES | HOD_ROLES | SUPERVISOR_ONLY_ROLES
FINANCE_MASTERS_WRITE_ROLES = CEO_TIER_ROLES | {UserRole.PLANT_ADMIN}
FINANCE_MAPPING_WRITE_ROLES = CEO_TIER_ROLES | {UserRole.PLANT_ADMIN, UserRole.HOD}


def can_view_finance(user: User) -> bool:
    return user.role in FINANCE_VIEW_ROLES


def can_write_finance_masters(user: User) -> bool:
    return user.role in FINANCE_MASTERS_WRITE_ROLES


def can_write_finance_mappings(user: User) -> bool:
    return user.role in FINANCE_MAPPING_WRITE_ROLES


def assert_finance_access(user: User) -> None:
    if not can_view_finance(user):
        raise HTTPException(status_code=403, detail="Finance access not permitted")


def assert_finance_masters_write(user: User) -> None:
    if not can_write_finance_masters(user):
        raise HTTPException(status_code=403, detail="Not permitted to manage cost masters")


def assert_finance_mapping_write(user: User) -> None:
    if not can_write_finance_mappings(user):
        raise HTTPException(status_code=403, detail="Not permitted to manage cost mappings")


def apply_finance_run_scope(query: Select, user: User) -> Select:
    """Scope cost/run queries for finance dashboards."""
    if is_platform_admin(user):
        return query
    if is_ceo_tier(user) and user.organisation_id:
        return query.where(Plant.organisation_id == user.organisation_id)
    if user.role == UserRole.PLANT_ADMIN and user.plant_id:
        return query.where(Department.plant_id == user.plant_id)
    if user.role == UserRole.HOD and user.department_id:
        return query.where(Department.id == user.department_id)
    if is_supervisor_only(user):
        if user.department_id:
            query = query.where(Department.id == user.department_id)
        elif user.plant_id:
            query = query.where(Department.plant_id == user.plant_id)
        return query
    raise HTTPException(status_code=403, detail="Finance access not permitted")
