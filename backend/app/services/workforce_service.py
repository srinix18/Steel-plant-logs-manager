"""Workforce management — employees, contractors, attendance, handover."""

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash
from app.db.models import (
    AttendanceRecord,
    Contractor,
    ContractorAttendance,
    ContractWorker,
    Department,
    Shift,
    ShiftAssignment,
    ShiftHandoverNote,
    User,
)
from app.models.enums import AttendanceStatus, EmploymentStatus, UserRole
from app.schemas.moi import (
    AttendanceBulkSave,
    AttendanceRecordResponse,
    ContractorAttendanceCreate,
    ContractorAttendanceResponse,
    ContractorCreate,
    ContractorResponse,
    ContractorUpdate,
    ContractWorkerCreate,
    ContractWorkerResponse,
    ContractWorkerUpdate,
    DepartmentAttendanceSummary,
    ShiftAssignmentCreate,
    ShiftAssignmentResponse,
    ShiftAssignmentUpdate,
    ShiftHandoverCreate,
    ShiftHandoverResponse,
    UserProfile,
    WorkforceDailySummary,
    WorkforceEmployeeCreate,
    WorkforceEmployeeUpdate,
    WorkforceMeResponse,
)
from app.services.access_scope import (
    CEO_ASSIGNABLE_ROLES,
    WORKFORCE_EMPLOYEE_ROLES,
    apply_workforce_department_scope,
    assert_manage_contractors,
    assert_manage_shift_assignments,
    assert_mark_attendance,
    assert_workforce_manage,
    assert_write_handover,
    can_manage_workforce,
    can_view_handover,
    is_ceo_tier,
    is_hr,
    is_hod_tier,
    is_platform_admin,
    is_supervisor_tier,
    is_worker,
    validate_user_scope,
)
from app.services.platform_services import OrgUserService

_SHIFT_ORDER = ("A", "B", "C")
_PRESENT_WEIGHT = {
    AttendanceStatus.PRESENT: 1.0,
    AttendanceStatus.HALF_DAY: 0.5,
    AttendanceStatus.ABSENT: 0.0,
    AttendanceStatus.LEAVE: 0.0,
}


def _attendance_weight(status: str | AttendanceStatus) -> float:
    if isinstance(status, str):
        try:
            status = AttendanceStatus(status)
        except ValueError:
            return 0.0
    return _PRESENT_WEIGHT.get(status, 0.0)


def resolve_previous_shift(shift_code: str, note_date: date) -> tuple[date, str]:
    code = shift_code.upper()
    if code == "A":
        return note_date - timedelta(days=1), "C"
    if code == "B":
        return note_date, "A"
    if code == "C":
        return note_date, "B"
    return note_date, "A"


class WorkforceService:
    def __init__(self) -> None:
        self._org_users = OrgUserService()

    def _org_id(self, actor: User) -> UUID:
        if not actor.organisation_id:
            raise HTTPException(status_code=400, detail="User has no organisation")
        return actor.organisation_id

    async def list_employees(
        self, session: AsyncSession, actor: User, department_id: UUID | None = None
    ) -> list[UserProfile]:
        org_id = self._org_id(actor)
        if department_id:
            assert_workforce_manage(actor, department_id)
        elif not is_supervisor_tier(actor):
            assert_workforce_manage(actor)

        query = select(User).where(
            User.organisation_id == org_id,
            User.role.in_(list(WORKFORCE_EMPLOYEE_ROLES)),
        )
        if department_id:
            query = query.where(User.department_id == department_id)
        else:
            query = apply_workforce_department_scope(query, actor, User.department_id)
        query = query.order_by(User.full_name)
        result = await session.execute(query)
        return [UserProfile.model_validate(u) for u in result.scalars()]

    async def create_employee(
        self, session: AsyncSession, actor: User, data: WorkforceEmployeeCreate
    ) -> UserProfile:
        dept_id = data.department_id
        if dept_id:
            assert_workforce_manage(actor, dept_id)
        else:
            assert_workforce_manage(actor)
        org_id = self._org_id(actor)
        if not is_platform_admin(actor) and data.role not in CEO_ASSIGNABLE_ROLES:
            raise HTTPException(status_code=403, detail="Cannot assign this role")

        profile = await self._org_users.create_org_user(session, actor, org_id, data)
        user = await session.get(User, profile.id)
        if user:
            user.employment_status = data.employment_status.value
            if data.date_of_joining:
                user.date_of_joining = data.date_of_joining
            await session.flush()
            return UserProfile.model_validate(user)
        return profile

    async def update_employee(
        self, session: AsyncSession, actor: User, user_id: UUID, data: WorkforceEmployeeUpdate
    ) -> UserProfile:
        user = await session.get(User, user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Employee not found")
        assert_workforce_manage(actor, user.department_id)

        profile = await self._org_users.update_org_user(
            session, actor, user.organisation_id, user_id, data
        )
        user = await session.get(User, user_id)
        if user:
            if data.employment_status is not None:
                user.employment_status = data.employment_status.value
            if data.date_of_joining is not None:
                user.date_of_joining = data.date_of_joining
            await session.flush()
            return UserProfile.model_validate(user)
        return profile

    async def _contractor_ids_for_department(
        self, session: AsyncSession, department_id: UUID
    ) -> set[UUID]:
        worker_ids = await session.execute(
            select(ContractWorker.contractor_id).where(
                ContractWorker.department_id == department_id,
                ContractWorker.is_active.is_(True),
            )
        )
        att_ids = await session.execute(
            select(ContractorAttendance.contractor_id).where(
                ContractorAttendance.department_id == department_id,
            )
        )
        return set(worker_ids.scalars()) | set(att_ids.scalars())

    async def _assert_contractor_for_department(
        self, session: AsyncSession, contractor_id: UUID, department_id: UUID
    ) -> None:
        eligible = await self._contractor_ids_for_department(session, department_id)
        if contractor_id not in eligible:
            raise HTTPException(
                status_code=400,
                detail="Contractor is not linked to this department (add contract workers first)",
            )

    async def list_contractors(
        self, session: AsyncSession, actor: User, department_id: UUID | None = None
    ) -> list[ContractorResponse]:
        org_id = self._org_id(actor)
        if department_id:
            assert_mark_attendance(actor, department_id)
        else:
            assert_manage_contractors(actor)

        query = select(Contractor).where(Contractor.organisation_id == org_id)
        if department_id:
            eligible = await self._contractor_ids_for_department(session, department_id)
            if not eligible:
                return []
            query = query.where(Contractor.id.in_(eligible))
        query = query.order_by(Contractor.name)
        result = await session.execute(query)
        return [ContractorResponse.model_validate(c) for c in result.scalars()]

    async def create_contractor(
        self, session: AsyncSession, actor: User, data: ContractorCreate
    ) -> ContractorResponse:
        org_id = self._org_id(actor)
        assert_manage_contractors(actor)
        existing = await session.execute(
            select(Contractor).where(Contractor.organisation_id == org_id, Contractor.code == data.code)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Contractor code already exists")
        contractor = Contractor(organisation_id=org_id, **data.model_dump())
        session.add(contractor)
        await session.flush()
        return ContractorResponse.model_validate(contractor)

    async def update_contractor(
        self, session: AsyncSession, actor: User, contractor_id: UUID, data: ContractorUpdate
    ) -> ContractorResponse:
        assert_manage_contractors(actor)
        contractor = await session.get(Contractor, contractor_id)
        if not contractor or contractor.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Contractor not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(contractor, field, value)
        await session.flush()
        return ContractorResponse.model_validate(contractor)

    async def list_contract_workers(
        self, session: AsyncSession, actor: User, department_id: UUID | None = None
    ) -> list[ContractWorkerResponse]:
        org_id = self._org_id(actor)
        assert_manage_contractors(actor)
        query = (
            select(ContractWorker)
            .join(Contractor)
            .options(selectinload(ContractWorker.contractor), selectinload(ContractWorker.department))
            .where(Contractor.organisation_id == org_id)
        )
        if department_id:
            query = query.where(ContractWorker.department_id == department_id)
        result = await session.execute(query.order_by(ContractWorker.full_name))
        out: list[ContractWorkerResponse] = []
        for w in result.scalars():
            resp = ContractWorkerResponse.model_validate(w)
            resp.contractor_name = w.contractor.name if w.contractor else None
            resp.department_code = w.department.code if w.department else None
            out.append(resp)
        return out

    async def create_contract_worker(
        self, session: AsyncSession, actor: User, data: ContractWorkerCreate
    ) -> ContractWorkerResponse:
        assert_manage_contractors(actor)
        contractor = await session.get(Contractor, data.contractor_id)
        if not contractor or contractor.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Contractor not found")
        worker = ContractWorker(**data.model_dump())
        session.add(worker)
        await session.flush()
        await session.refresh(worker, ["contractor", "department"])
        resp = ContractWorkerResponse.model_validate(worker)
        resp.contractor_name = worker.contractor.name if worker.contractor else None
        resp.department_code = worker.department.code if worker.department else None
        return resp

    async def update_contract_worker(
        self, session: AsyncSession, actor: User, worker_id: UUID, data: ContractWorkerUpdate
    ) -> ContractWorkerResponse:
        assert_manage_contractors(actor)
        worker = await session.get(ContractWorker, worker_id)
        if not worker:
            raise HTTPException(status_code=404, detail="Contract worker not found")
        await session.refresh(worker, ["contractor", "department"])
        contractor = worker.contractor
        if not contractor or contractor.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Contract worker not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(worker, field, value)
        await session.flush()
        await session.refresh(worker, ["contractor", "department"])
        resp = ContractWorkerResponse.model_validate(worker)
        resp.contractor_name = contractor.name
        resp.department_code = worker.department.code if worker.department else None
        return resp

    async def list_shift_assignments(
        self,
        session: AsyncSession,
        actor: User,
        department_id: UUID | None = None,
        shift_id: UUID | None = None,
    ) -> list[ShiftAssignmentResponse]:
        query = (
            select(ShiftAssignment)
            .options(
                selectinload(ShiftAssignment.user),
                selectinload(ShiftAssignment.department),
                selectinload(ShiftAssignment.shift),
            )
            .join(User, ShiftAssignment.user_id == User.id)
            .where(User.organisation_id == self._org_id(actor))
        )
        if department_id:
            assert_manage_shift_assignments(actor, department_id)
            query = query.where(ShiftAssignment.department_id == department_id)
        else:
            if not is_hr(actor) and not is_platform_admin(actor):
                raise HTTPException(status_code=403, detail="Shift assignment management access denied")
        if shift_id:
            query = query.where(ShiftAssignment.shift_id == shift_id)
        result = await session.execute(query.order_by(ShiftAssignment.effective_date.desc()))
        return [self._shift_assignment_response(a) for a in result.scalars()]

    def _shift_assignment_response(self, a: ShiftAssignment) -> ShiftAssignmentResponse:
        resp = ShiftAssignmentResponse.model_validate(a)
        if a.user:
            resp.user_name = a.user.full_name
            resp.employee_uid = a.user.employee_uid
        if a.department:
            resp.department_code = a.department.code
        if a.shift:
            resp.shift_code = a.shift.code
        return resp

    async def create_shift_assignment(
        self, session: AsyncSession, actor: User, data: ShiftAssignmentCreate
    ) -> ShiftAssignmentResponse:
        assert_manage_shift_assignments(actor, data.department_id)
        user = await session.get(User, data.user_id)
        if not user or user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Employee not found")
        assignment = ShiftAssignment(**data.model_dump())
        session.add(assignment)
        await session.flush()
        await session.refresh(assignment, ["user", "department", "shift"])
        return self._shift_assignment_response(assignment)

    async def update_shift_assignment(
        self, session: AsyncSession, actor: User, assignment_id: UUID, data: ShiftAssignmentUpdate
    ) -> ShiftAssignmentResponse:
        assignment = await session.get(ShiftAssignment, assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Shift assignment not found")
        await session.refresh(assignment, ["user", "department", "shift"])
        if not assignment.user or assignment.user.organisation_id != self._org_id(actor):
            raise HTTPException(status_code=404, detail="Shift assignment not found")
        dept_id = data.department_id or assignment.department_id
        assert_manage_shift_assignments(actor, dept_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(assignment, field, value)
        await session.flush()
        await session.refresh(assignment, ["user", "department", "shift"])
        return self._shift_assignment_response(assignment)

    async def _assigned_users(
        self, session: AsyncSession, department_id: UUID, shift_id: UUID, on_date: date
    ) -> list[User]:
        subq = (
            select(
                ShiftAssignment.user_id,
                func.max(ShiftAssignment.effective_date).label("max_date"),
            )
            .where(
                ShiftAssignment.department_id == department_id,
                ShiftAssignment.shift_id == shift_id,
                ShiftAssignment.effective_date <= on_date,
            )
            .group_by(ShiftAssignment.user_id)
            .subquery()
        )
        result = await session.execute(
            select(User)
            .join(ShiftAssignment, ShiftAssignment.user_id == User.id)
            .join(
                subq,
                (ShiftAssignment.user_id == subq.c.user_id)
                & (ShiftAssignment.effective_date == subq.c.max_date),
            )
            .where(
                ShiftAssignment.department_id == department_id,
                ShiftAssignment.shift_id == shift_id,
                User.is_active.is_(True),
            )
            .order_by(User.full_name)
        )
        return list(result.scalars().unique())

    async def list_attendance(
        self,
        session: AsyncSession,
        actor: User,
        attendance_date: date,
        department_id: UUID,
        shift_id: UUID,
    ) -> list[AttendanceRecordResponse]:
        assert_mark_attendance(actor, department_id)
        result = await session.execute(
            select(AttendanceRecord)
            .options(selectinload(AttendanceRecord.user))
            .where(
                AttendanceRecord.attendance_date == attendance_date,
                AttendanceRecord.department_id == department_id,
                AttendanceRecord.shift_id == shift_id,
            )
            .order_by(AttendanceRecord.user_id)
        )
        records = list(result.scalars())
        if records:
            return [self._attendance_response(r) for r in records]

        users = await self._assigned_users(session, department_id, shift_id, attendance_date)
        return [
            AttendanceRecordResponse(
                id=None,
                attendance_date=attendance_date,
                user_id=u.id,
                department_id=department_id,
                shift_id=shift_id,
                status=AttendanceStatus.PRESENT,
                remarks=None,
                marked_by_id=actor.id,
                marked_at=datetime.now(timezone.utc),
                user_name=u.full_name,
            )
            for u in users
        ]

    def _attendance_response(self, r: AttendanceRecord) -> AttendanceRecordResponse:
        resp = AttendanceRecordResponse.model_validate(r)
        if r.user:
            resp.user_name = r.user.full_name
        return resp

    async def save_attendance_bulk(
        self, session: AsyncSession, actor: User, data: AttendanceBulkSave
    ) -> list[AttendanceRecordResponse]:
        assert_mark_attendance(actor, data.department_id)
        now = datetime.now(timezone.utc)
        out: list[AttendanceRecordResponse] = []
        for entry in data.entries:
            existing = await session.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.attendance_date == data.attendance_date,
                    AttendanceRecord.user_id == entry.user_id,
                    AttendanceRecord.department_id == data.department_id,
                    AttendanceRecord.shift_id == data.shift_id,
                )
            )
            record = existing.scalar_one_or_none()
            if record:
                record.status = entry.status.value
                record.remarks = entry.remarks
                record.marked_by_id = actor.id
                record.marked_at = now
            else:
                record = AttendanceRecord(
                    attendance_date=data.attendance_date,
                    user_id=entry.user_id,
                    department_id=data.department_id,
                    shift_id=data.shift_id,
                    status=entry.status.value,
                    remarks=entry.remarks,
                    marked_by_id=actor.id,
                    marked_at=now,
                )
                session.add(record)
            await session.flush()
            await session.refresh(record, ["user"])
            out.append(self._attendance_response(record))
        return out

    async def list_contractor_attendance(
        self,
        session: AsyncSession,
        actor: User,
        attendance_date: date,
        department_id: UUID,
        shift_id: UUID,
    ) -> list[ContractorAttendanceResponse]:
        assert_mark_attendance(actor, department_id)
        result = await session.execute(
            select(ContractorAttendance)
            .options(selectinload(ContractorAttendance.contractor))
            .where(
                ContractorAttendance.attendance_date == attendance_date,
                ContractorAttendance.department_id == department_id,
                ContractorAttendance.shift_id == shift_id,
            )
        )
        out: list[ContractorAttendanceResponse] = []
        for r in result.scalars():
            resp = ContractorAttendanceResponse.model_validate(r)
            if r.contractor:
                resp.contractor_name = r.contractor.name
            out.append(resp)
        return out

    async def save_contractor_attendance(
        self, session: AsyncSession, actor: User, data: ContractorAttendanceCreate
    ) -> ContractorAttendanceResponse:
        assert_mark_attendance(actor, data.department_id)
        await self._assert_contractor_for_department(session, data.contractor_id, data.department_id)
        existing = await session.execute(
            select(ContractorAttendance).where(
                ContractorAttendance.attendance_date == data.attendance_date,
                ContractorAttendance.contractor_id == data.contractor_id,
                ContractorAttendance.department_id == data.department_id,
                ContractorAttendance.shift_id == data.shift_id,
            )
        )
        record = existing.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        payload = data.model_dump()
        if record:
            for k, v in payload.items():
                setattr(record, k, v)
            record.marked_by_id = actor.id
            record.marked_at = now
        else:
            record = ContractorAttendance(
                **payload,
                marked_by_id=actor.id,
                marked_at=now,
            )
            session.add(record)
        await session.flush()
        await session.refresh(record, ["contractor"])
        resp = ContractorAttendanceResponse.model_validate(record)
        if record.contractor:
            resp.contractor_name = record.contractor.name
        return resp

    async def list_handover_notes(
        self,
        session: AsyncSession,
        actor: User,
        note_date: date | None = None,
        department_id: UUID | None = None,
        shift_id: UUID | None = None,
    ) -> list[ShiftHandoverResponse]:
        if not is_supervisor_tier(actor) and not is_hr(actor) and not is_worker(actor):
            raise HTTPException(status_code=403, detail="Access denied")

        query = (
            select(ShiftHandoverNote)
            .options(
                selectinload(ShiftHandoverNote.author),
                selectinload(ShiftHandoverNote.department),
                selectinload(ShiftHandoverNote.shift),
            )
            .join(Department, ShiftHandoverNote.department_id == Department.id)
            .where(Department.organisation_id == self._org_id(actor))
        )
        if note_date:
            query = query.where(ShiftHandoverNote.note_date == note_date)
        if department_id:
            if not can_view_handover(actor, department_id):
                raise HTTPException(status_code=403, detail="Access denied")
            query = query.where(ShiftHandoverNote.department_id == department_id)
        else:
            query = apply_workforce_department_scope(query, actor, ShiftHandoverNote.department_id)
        if shift_id:
            query = query.where(ShiftHandoverNote.shift_id == shift_id)
        result = await session.execute(query.order_by(ShiftHandoverNote.created_at.desc()))
        return [self._handover_response(n) for n in result.scalars()]

    def _handover_response(self, n: ShiftHandoverNote) -> ShiftHandoverResponse:
        resp = ShiftHandoverResponse.model_validate(n)
        if n.author:
            resp.author_name = n.author.full_name
        if n.department:
            resp.department_code = n.department.code
        if n.shift:
            resp.shift_code = n.shift.code
        return resp

    async def create_handover_note(
        self, session: AsyncSession, actor: User, data: ShiftHandoverCreate
    ) -> ShiftHandoverResponse:
        assert_write_handover(actor, data.department_id)
        note = ShiftHandoverNote(
            note_date=data.note_date,
            department_id=data.department_id,
            shift_id=data.shift_id,
            author_id=actor.id,
            note=data.note.strip(),
        )
        session.add(note)
        await session.flush()
        await session.refresh(note, ["author", "department", "shift"])
        return self._handover_response(note)

    async def get_previous_handover(
        self,
        session: AsyncSession,
        actor: User,
        department_id: UUID,
        shift_id: UUID,
        note_date: date,
    ) -> ShiftHandoverResponse | None:
        shift = await session.get(Shift, shift_id)
        if not shift:
            return None
        if not can_view_handover(actor, department_id):
            raise HTTPException(status_code=403, detail="Access denied")

        prev_date, prev_code = resolve_previous_shift(shift.code, note_date)
        prev_shift = await session.execute(
            select(Shift).where(Shift.plant_id == shift.plant_id, Shift.code == prev_code)
        )
        prev_shift_row = prev_shift.scalar_one_or_none()
        if not prev_shift_row:
            return None

        result = await session.execute(
            select(ShiftHandoverNote)
            .options(
                selectinload(ShiftHandoverNote.author),
                selectinload(ShiftHandoverNote.department),
                selectinload(ShiftHandoverNote.shift),
            )
            .where(
                ShiftHandoverNote.department_id == department_id,
                ShiftHandoverNote.shift_id == prev_shift_row.id,
                ShiftHandoverNote.note_date == prev_date,
            )
            .order_by(ShiftHandoverNote.created_at.desc())
            .limit(1)
        )
        note = result.scalar_one_or_none()
        return self._handover_response(note) if note else None

    async def _expected_for_department(
        self, session: AsyncSession, department_id: UUID, on_date: date
    ) -> int:
        subq = (
            select(
                ShiftAssignment.user_id,
                func.max(ShiftAssignment.effective_date).label("max_date"),
            )
            .where(
                ShiftAssignment.department_id == department_id,
                ShiftAssignment.effective_date <= on_date,
            )
            .group_by(ShiftAssignment.user_id)
            .subquery()
        )
        result = await session.execute(
            select(func.count(func.distinct(ShiftAssignment.user_id))).select_from(ShiftAssignment).join(
                subq,
                (ShiftAssignment.user_id == subq.c.user_id)
                & (ShiftAssignment.effective_date == subq.c.max_date),
            ).where(ShiftAssignment.department_id == department_id)
        )
        assigned = int(result.scalar() or 0)
        if assigned > 0:
            return assigned

        roster_roles = list(WORKFORCE_EMPLOYEE_ROLES - {UserRole.HR, UserRole.MAINTENANCE, UserRole.CEO})
        fallback = await session.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.department_id == department_id,
                User.is_active.is_(True),
                User.role.in_(roster_roles),
            )
        )
        return int(fallback.scalar() or 0)

    async def _present_for_department(
        self, session: AsyncSession, department_id: UUID, on_date: date
    ) -> float:
        result = await session.execute(
            select(AttendanceRecord.status).where(
                AttendanceRecord.department_id == department_id,
                AttendanceRecord.attendance_date == on_date,
            )
        )
        return sum(_attendance_weight(s) for s in result.scalars())

    async def _contract_attendance_for_department(
        self, session: AsyncSession, department_id: UUID, on_date: date
    ) -> tuple[int, int]:
        result = await session.execute(
            select(ContractorAttendance).where(
                ContractorAttendance.department_id == department_id,
                ContractorAttendance.attendance_date == on_date,
            )
        )
        rows = list(result.scalars())
        return sum(r.workers_present for r in rows), sum(r.workers_absent for r in rows)

    async def department_dashboard(
        self, session: AsyncSession, actor: User, on_date: date
    ) -> list[DepartmentAttendanceSummary]:
        if not is_supervisor_tier(actor) and not is_hr(actor) and not is_worker(actor):
            raise HTTPException(status_code=403, detail="Access denied")

        dept_query = select(Department).where(Department.organisation_id == self._org_id(actor))
        dept_query = apply_workforce_department_scope(dept_query, actor, Department.id)
        depts = list((await session.execute(dept_query.order_by(Department.code))).scalars())

        summaries: list[DepartmentAttendanceSummary] = []
        for dept in depts:
            expected = await self._expected_for_department(session, dept.id, on_date)
            present = await self._present_for_department(session, dept.id, on_date)
            contract_present, contract_absent = await self._contract_attendance_for_department(
                session, dept.id, on_date
            )
            understaffed = max(0, int(round(expected - present)))
            summaries.append(
                DepartmentAttendanceSummary(
                    department_id=dept.id,
                    department_code=dept.code,
                    department_name=dept.name,
                    expected=expected,
                    present=round(present, 1),
                    understaffed_by=understaffed if expected > present else 0,
                    contract_workers_present=contract_present,
                    contract_workers_absent=contract_absent,
                )
            )
        return summaries

    async def daily_summary(
        self, session: AsyncSession, actor: User, on_date: date
    ) -> WorkforceDailySummary:
        departments = await self.department_dashboard(session, actor, on_date)
        employees_expected = sum(d.expected for d in departments)
        employees_present = int(sum(d.present for d in departments))
        employees_absent = max(0, employees_expected - employees_present)

        contract_present = sum(d.contract_workers_present for d in departments)
        contract_absent = sum(d.contract_workers_absent for d in departments)

        understaffed = [
            f"{d.department_name} (-{d.understaffed_by})"
            for d in departments
            if d.understaffed_by > 0
        ]

        notes_query = select(ShiftHandoverNote).join(
            Department, ShiftHandoverNote.department_id == Department.id
        ).where(
            ShiftHandoverNote.note_date == on_date,
            Department.organisation_id == self._org_id(actor),
        )
        notes_query = apply_workforce_department_scope(notes_query, actor, ShiftHandoverNote.department_id)
        notes_submitted = len(list((await session.execute(notes_query)).scalars()))

        dept_with_assignments = sum(1 for d in departments if d.expected > 0)
        pending_notes = max(0, dept_with_assignments - notes_submitted)

        return WorkforceDailySummary(
            attendance_date=on_date,
            employees_present=employees_present,
            employees_absent=employees_absent,
            employees_expected=employees_expected,
            contract_workers_present=contract_present,
            contract_workers_absent=contract_absent,
            departments_understaffed=understaffed,
            shift_notes_submitted=notes_submitted,
            pending_shift_notes=pending_notes,
            departments=departments,
        )

    async def get_me(self, session: AsyncSession, actor: User) -> WorkforceMeResponse:
        if not is_worker(actor):
            raise HTTPException(status_code=403, detail="Worker access only")

        today = date.today()
        assignment_resp: ShiftAssignmentResponse | None = None
        if actor.department_id:
            subq = (
                select(func.max(ShiftAssignment.effective_date))
                .where(
                    ShiftAssignment.user_id == actor.id,
                    ShiftAssignment.department_id == actor.department_id,
                    ShiftAssignment.effective_date <= today,
                )
                .scalar_subquery()
            )
            result = await session.execute(
                select(ShiftAssignment)
                .options(
                    selectinload(ShiftAssignment.user),
                    selectinload(ShiftAssignment.department),
                    selectinload(ShiftAssignment.shift),
                )
                .where(
                    ShiftAssignment.user_id == actor.id,
                    ShiftAssignment.department_id == actor.department_id,
                    ShiftAssignment.effective_date == subq,
                )
                .limit(1)
            )
            assignment = result.scalar_one_or_none()
            if assignment:
                assignment_resp = self._shift_assignment_response(assignment)

        att_result = await session.execute(
            select(AttendanceRecord)
            .options(selectinload(AttendanceRecord.user))
            .where(AttendanceRecord.user_id == actor.id)
            .order_by(AttendanceRecord.attendance_date.desc())
            .limit(30)
        )
        recent = [self._attendance_response(r) for r in att_result.scalars()]
        return WorkforceMeResponse(shift_assignment=assignment_resp, recent_attendance=recent)
