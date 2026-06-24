from datetime import date
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.db.models import Shift
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
from app.services.workforce_service import WorkforceService
from sqlalchemy import select

router = APIRouter()
service = WorkforceService()


@router.get("/workforce/employees", response_model=list[UserProfile])
async def list_employees(
    session: DbSession,
    user: CurrentUser,
    department_id: UUID | None = None,
):
    return await service.list_employees(session, user, department_id)


@router.post("/workforce/employees", response_model=UserProfile)
async def create_employee(session: DbSession, user: CurrentUser, data: WorkforceEmployeeCreate):
    return await service.create_employee(session, user, data)


@router.patch("/workforce/employees/{user_id}", response_model=UserProfile)
async def update_employee(
    session: DbSession, user: CurrentUser, user_id: UUID, data: WorkforceEmployeeUpdate
):
    return await service.update_employee(session, user, user_id, data)


@router.get("/workforce/contractors", response_model=list[ContractorResponse])
async def list_contractors(
    session: DbSession,
    user: CurrentUser,
    department_id: UUID | None = None,
):
    return await service.list_contractors(session, user, department_id)


@router.post("/workforce/contractors", response_model=ContractorResponse)
async def create_contractor(session: DbSession, user: CurrentUser, data: ContractorCreate):
    return await service.create_contractor(session, user, data)


@router.patch("/workforce/contractors/{contractor_id}", response_model=ContractorResponse)
async def update_contractor(
    session: DbSession, user: CurrentUser, contractor_id: UUID, data: ContractorUpdate
):
    return await service.update_contractor(session, user, contractor_id, data)


@router.get("/workforce/contract-workers", response_model=list[ContractWorkerResponse])
async def list_contract_workers(
    session: DbSession, user: CurrentUser, department_id: UUID | None = None
):
    return await service.list_contract_workers(session, user, department_id)


@router.post("/workforce/contract-workers", response_model=ContractWorkerResponse)
async def create_contract_worker(session: DbSession, user: CurrentUser, data: ContractWorkerCreate):
    return await service.create_contract_worker(session, user, data)


@router.patch("/workforce/contract-workers/{worker_id}", response_model=ContractWorkerResponse)
async def update_contract_worker(
    session: DbSession, user: CurrentUser, worker_id: UUID, data: ContractWorkerUpdate
):
    return await service.update_contract_worker(session, user, worker_id, data)


@router.get("/workforce/shift-assignments", response_model=list[ShiftAssignmentResponse])
async def list_shift_assignments(
    session: DbSession,
    user: CurrentUser,
    department_id: UUID | None = None,
    shift_id: UUID | None = None,
):
    return await service.list_shift_assignments(session, user, department_id, shift_id)


@router.post("/workforce/shift-assignments", response_model=ShiftAssignmentResponse)
async def create_shift_assignment(session: DbSession, user: CurrentUser, data: ShiftAssignmentCreate):
    return await service.create_shift_assignment(session, user, data)


@router.patch("/workforce/shift-assignments/{assignment_id}", response_model=ShiftAssignmentResponse)
async def update_shift_assignment(
    session: DbSession, user: CurrentUser, assignment_id: UUID, data: ShiftAssignmentUpdate
):
    return await service.update_shift_assignment(session, user, assignment_id, data)


@router.get("/workforce/shifts")
async def list_workforce_shifts(
    session: DbSession, user: CurrentUser, plant_id: UUID | None = None
):
    query = select(Shift)
    if plant_id:
        query = query.where(Shift.plant_id == plant_id)
    result = await session.execute(query.order_by(Shift.code))
    return [
        {
            "id": s.id,
            "plant_id": s.plant_id,
            "code": s.code,
            "name": s.name,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
        }
        for s in result.scalars()
    ]


@router.get("/workforce/attendance", response_model=list[AttendanceRecordResponse])
async def list_attendance(
    session: DbSession,
    user: CurrentUser,
    attendance_date: date,
    department_id: UUID,
    shift_id: UUID,
):
    return await service.list_attendance(session, user, attendance_date, department_id, shift_id)


@router.post("/workforce/attendance/bulk", response_model=list[AttendanceRecordResponse])
async def save_attendance_bulk(session: DbSession, user: CurrentUser, data: AttendanceBulkSave):
    return await service.save_attendance_bulk(session, user, data)


@router.get("/workforce/contractor-attendance", response_model=list[ContractorAttendanceResponse])
async def list_contractor_attendance(
    session: DbSession,
    user: CurrentUser,
    attendance_date: date,
    department_id: UUID,
    shift_id: UUID,
):
    return await service.list_contractor_attendance(
        session, user, attendance_date, department_id, shift_id
    )


@router.post("/workforce/contractor-attendance", response_model=ContractorAttendanceResponse)
async def save_contractor_attendance(
    session: DbSession, user: CurrentUser, data: ContractorAttendanceCreate
):
    return await service.save_contractor_attendance(session, user, data)


@router.get("/workforce/handover-notes", response_model=list[ShiftHandoverResponse])
async def list_handover_notes(
    session: DbSession,
    user: CurrentUser,
    note_date: date | None = None,
    department_id: UUID | None = None,
    shift_id: UUID | None = None,
):
    return await service.list_handover_notes(session, user, note_date, department_id, shift_id)


@router.post("/workforce/handover-notes", response_model=ShiftHandoverResponse)
async def create_handover_note(session: DbSession, user: CurrentUser, data: ShiftHandoverCreate):
    return await service.create_handover_note(session, user, data)


@router.get("/workforce/handover-notes/previous", response_model=ShiftHandoverResponse | None)
async def get_previous_handover(
    session: DbSession,
    user: CurrentUser,
    department_id: UUID,
    shift_id: UUID,
    note_date: date = Query(default_factory=date.today),
):
    return await service.get_previous_handover(session, user, department_id, shift_id, note_date)


@router.get("/workforce/dashboard/departments", response_model=list[DepartmentAttendanceSummary])
async def department_dashboard(
    session: DbSession, user: CurrentUser, attendance_date: date = Query(default_factory=date.today)
):
    return await service.department_dashboard(session, user, attendance_date)


@router.get("/workforce/summary", response_model=WorkforceDailySummary)
async def workforce_summary(
    session: DbSession, user: CurrentUser, attendance_date: date = Query(default_factory=date.today)
):
    return await service.daily_summary(session, user, attendance_date)


@router.get("/workforce/me", response_model=WorkforceMeResponse)
async def workforce_me(session: DbSession, user: CurrentUser):
    return await service.get_me(session, user)
