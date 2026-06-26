from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.api.deps import CurrentUser, DbSession
from app.schemas.workforce_ops import (
    EmployeeSkillAssign,
    EmployeeSkillResponse,
    LeaveRequestCreate,
    LeaveRequestDecision,
    LeaveRequestResponse,
    LeaveTypeCreate,
    LeaveTypeResponse,
    LeaveTypeUpdate,
    PayrollLineItemResponse,
    PayrollRunCreate,
    PayrollRunResponse,
    SalaryStructureCreate,
    SalaryStructureResponse,
    SalaryStructureUpdate,
    ShiftRosterCreate,
    ShiftRosterResponse,
    ShiftRosterUpdate,
    SkillCreate,
    SkillResponse,
    SkillUpdate,
    TrainingRecordCreate,
    TrainingRecordResponse,
    TrainingRecordUpdate,
)
from app.services.leave_service import LeaveService
from app.services.payroll_service import PayrollService
from app.services.workforce_ops_service import WorkforceOpsService

router = APIRouter()
leave_service = LeaveService()
ops_service = WorkforceOpsService()
payroll_service = PayrollService()


# --- Leave types ---


@router.get("/workforce/leave/types", response_model=list[LeaveTypeResponse])
async def list_leave_types(session: DbSession, user: CurrentUser):
    return await leave_service.list_leave_types(session, user)


@router.post("/workforce/leave/types", response_model=LeaveTypeResponse, status_code=201)
async def create_leave_type(session: DbSession, user: CurrentUser, data: LeaveTypeCreate):
    result = await leave_service.create_leave_type(session, user, data)
    await session.commit()
    return result


@router.patch("/workforce/leave/types/{type_id}", response_model=LeaveTypeResponse)
async def update_leave_type(
    session: DbSession, user: CurrentUser, type_id: UUID, data: LeaveTypeUpdate
):
    result = await leave_service.update_leave_type(session, user, type_id, data)
    await session.commit()
    return result


# --- Leave requests ---


@router.get("/workforce/leave/requests", response_model=list[LeaveRequestResponse])
async def list_leave_requests(
    session: DbSession,
    user: CurrentUser,
    user_id: UUID | None = None,
    status: str | None = None,
):
    return await leave_service.list_requests(session, user, user_id=user_id, status=status)


@router.post("/workforce/leave/requests", response_model=LeaveRequestResponse, status_code=201)
async def create_leave_request(session: DbSession, user: CurrentUser, data: LeaveRequestCreate):
    result = await leave_service.create_request(session, user, data)
    await session.commit()
    return result


@router.post("/workforce/leave/requests/{request_id}/approve", response_model=LeaveRequestResponse)
async def approve_leave_request(
    session: DbSession, user: CurrentUser, request_id: UUID, data: LeaveRequestDecision
):
    result = await leave_service.approve_request(session, user, request_id, data)
    await session.commit()
    return result


@router.post("/workforce/leave/requests/{request_id}/reject", response_model=LeaveRequestResponse)
async def reject_leave_request(
    session: DbSession, user: CurrentUser, request_id: UUID, data: LeaveRequestDecision
):
    result = await leave_service.reject_request(session, user, request_id, data)
    await session.commit()
    return result


@router.get("/workforce/leave/requests/mine", response_model=list[LeaveRequestResponse])
async def my_leave_requests(session: DbSession, user: CurrentUser):
    return await leave_service.list_requests(session, user, user_id=user.id)


# --- Roster ---


@router.get("/workforce/ops/rosters", response_model=list[ShiftRosterResponse])
async def list_rosters(session: DbSession, user: CurrentUser, department_id: UUID | None = None):
    return await ops_service.list_rosters(session, user, department_id)


@router.post("/workforce/ops/rosters", response_model=ShiftRosterResponse, status_code=201)
async def create_roster(session: DbSession, user: CurrentUser, data: ShiftRosterCreate):
    result = await ops_service.create_roster(session, user, data)
    await session.commit()
    return result


@router.patch("/workforce/ops/rosters/{roster_id}", response_model=ShiftRosterResponse)
async def update_roster(
    session: DbSession, user: CurrentUser, roster_id: UUID, data: ShiftRosterUpdate
):
    result = await ops_service.update_roster(session, user, roster_id, data)
    await session.commit()
    return result


@router.post("/workforce/ops/rosters/{roster_id}/publish", response_model=ShiftRosterResponse)
async def publish_roster(session: DbSession, user: CurrentUser, roster_id: UUID):
    result = await ops_service.publish_roster(session, user, roster_id)
    await session.commit()
    return result


# --- Skills ---


@router.get("/workforce/ops/skills", response_model=list[SkillResponse])
async def list_skills(session: DbSession, user: CurrentUser, department_id: UUID | None = None):
    return await ops_service.list_skills(session, user, department_id)


@router.post("/workforce/ops/skills", response_model=SkillResponse, status_code=201)
async def create_skill(session: DbSession, user: CurrentUser, data: SkillCreate):
    result = await ops_service.create_skill(session, user, data)
    await session.commit()
    return result


@router.patch("/workforce/ops/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(session: DbSession, user: CurrentUser, skill_id: UUID, data: SkillUpdate):
    result = await ops_service.update_skill(session, user, skill_id, data)
    await session.commit()
    return result


@router.get("/workforce/ops/employee-skills", response_model=list[EmployeeSkillResponse])
async def list_all_employee_skills(session: DbSession, user: CurrentUser):
    return await ops_service.list_all_employee_skills(session, user)


@router.get("/workforce/ops/summary")
async def workforce_ops_summary(session: DbSession, user: CurrentUser):
    return await ops_service.get_ops_summary(session, user)


@router.get("/workforce/ops/employees/{user_id}/skills", response_model=list[EmployeeSkillResponse])
async def list_employee_skills(session: DbSession, user: CurrentUser, user_id: UUID):
    return await ops_service.list_employee_skills(session, user, user_id)


@router.post("/workforce/ops/employees/{user_id}/skills", response_model=EmployeeSkillResponse, status_code=201)
async def assign_employee_skill(
    session: DbSession, user: CurrentUser, user_id: UUID, data: EmployeeSkillAssign
):
    result = await ops_service.assign_skill(session, user, user_id, data)
    await session.commit()
    return result


@router.delete("/workforce/ops/employees/{user_id}/skills/{skill_id}", status_code=204)
async def remove_employee_skill(
    session: DbSession, user: CurrentUser, user_id: UUID, skill_id: UUID
):
    await ops_service.remove_skill(session, user, user_id, skill_id)
    await session.commit()


# --- Training ---


@router.get("/workforce/ops/training", response_model=list[TrainingRecordResponse])
async def list_training_records(session: DbSession, user: CurrentUser, user_id: UUID | None = None):
    return await ops_service.list_training_records(session, user, user_id)


@router.post("/workforce/ops/training", response_model=TrainingRecordResponse, status_code=201)
async def create_training_record(session: DbSession, user: CurrentUser, data: TrainingRecordCreate):
    result = await ops_service.create_training_record(session, user, data)
    await session.commit()
    return result


@router.patch("/workforce/ops/training/{record_id}", response_model=TrainingRecordResponse)
async def update_training_record(
    session: DbSession, user: CurrentUser, record_id: UUID, data: TrainingRecordUpdate
):
    result = await ops_service.update_training_record(session, user, record_id, data)
    await session.commit()
    return result


# --- Payroll ---


@router.get("/workforce/payroll/salary-structures", response_model=list[SalaryStructureResponse])
async def list_salary_structures(session: DbSession, user: CurrentUser, user_id: UUID | None = None):
    return await payroll_service.list_salary_structures(session, user, user_id)


@router.post("/workforce/payroll/salary-structures", response_model=SalaryStructureResponse, status_code=201)
async def create_salary_structure(session: DbSession, user: CurrentUser, data: SalaryStructureCreate):
    result = await payroll_service.create_salary_structure(session, user, data)
    await session.commit()
    return result


@router.patch(
    "/workforce/payroll/salary-structures/{struct_id}", response_model=SalaryStructureResponse
)
async def update_salary_structure(
    session: DbSession, user: CurrentUser, struct_id: UUID, data: SalaryStructureUpdate
):
    result = await payroll_service.update_salary_structure(session, user, struct_id, data)
    await session.commit()
    return result


@router.get("/workforce/payroll/runs", response_model=list[PayrollRunResponse])
async def list_payroll_runs(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    return await payroll_service.list_payroll_runs(session, user, plant_id)


@router.post("/workforce/payroll/runs", response_model=PayrollRunResponse, status_code=201)
async def create_payroll_run(session: DbSession, user: CurrentUser, data: PayrollRunCreate):
    result = await payroll_service.create_payroll_run(session, user, data)
    await session.commit()
    return result


@router.post("/workforce/payroll/runs/{run_id}/process", response_model=PayrollRunResponse)
async def process_payroll_run(session: DbSession, user: CurrentUser, run_id: UUID):
    result = await payroll_service.process_payroll_run(session, user, run_id)
    await session.commit()
    return result


@router.get("/workforce/payroll/runs/{run_id}/line-items", response_model=list[PayrollLineItemResponse])
async def list_payroll_line_items(session: DbSession, user: CurrentUser, run_id: UUID):
    return await payroll_service.list_line_items(session, user, run_id)


@router.get("/workforce/payroll/payslips/mine", response_model=list[PayrollLineItemResponse])
async def my_payslips(session: DbSession, user: CurrentUser):
    return await payroll_service.list_my_payslips(session, user)


@router.get("/workforce/payroll/payslips/{line_item_id}")
async def get_payslip(session: DbSession, user: CurrentUser, line_item_id: UUID):
    payslip = await payroll_service.get_payslip_html(session, user, line_item_id)
    return HTMLResponse(content=payslip.html)
