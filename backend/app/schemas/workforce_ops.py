from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import EmploymentType, LeaveRequestStatus, PayrollRunStatus, RosterPeriodType


class LeaveTypeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=100)
    is_active: bool = True


class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class LeaveTypeResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    code: str
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeaveRequestCreate(BaseModel):
    leave_type_id: UUID
    from_date: date
    to_date: date
    remarks: Optional[str] = None


class LeaveRequestDecision(BaseModel):
    remarks: Optional[str] = None


class LeaveRequestResponse(BaseModel):
    id: UUID
    user_id: UUID
    leave_type_id: UUID
    from_date: date
    to_date: date
    status: str
    remarks: Optional[str] = None
    approver_id: Optional[UUID] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None
    leave_type_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ShiftRosterEntryCreate(BaseModel):
    user_id: UUID
    shift_id: UUID
    roster_date: date


class ShiftRosterCreate(BaseModel):
    department_id: UUID
    period_start: date
    period_end: date
    period_type: RosterPeriodType = RosterPeriodType.WEEKLY
    entries: list[ShiftRosterEntryCreate] = Field(default_factory=list)


class ShiftRosterUpdate(BaseModel):
    status: Optional[str] = None
    period_end: Optional[date] = None
    period_start: Optional[date] = None
    entries: Optional[list[ShiftRosterEntryCreate]] = None


class ShiftRosterEntryResponse(BaseModel):
    id: UUID
    roster_id: UUID
    user_id: UUID
    shift_id: UUID
    roster_date: date
    user_name: Optional[str] = None
    shift_code: Optional[str] = None

    model_config = {"from_attributes": True}


class ShiftRosterResponse(BaseModel):
    id: UUID
    department_id: UUID
    period_start: date
    period_end: date
    period_type: str
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    entries: list[ShiftRosterEntryResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class SkillCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    department_id: Optional[UUID] = None


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[UUID] = None


class SkillResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    code: str
    name: str
    department_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployeeSkillAssign(BaseModel):
    skill_id: UUID
    proficiency_level: str = "basic"


class EmployeeSkillResponse(BaseModel):
    id: UUID
    user_id: UUID
    skill_id: UUID
    proficiency_level: str
    skill_name: Optional[str] = None
    skill_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrainingRecordCreate(BaseModel):
    user_id: UUID
    name: str = Field(min_length=1, max_length=200)
    certification: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    document_id: Optional[UUID] = None


class TrainingRecordUpdate(BaseModel):
    name: Optional[str] = None
    certification: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    status: Optional[str] = None
    document_id: Optional[UUID] = None


class TrainingRecordResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    certification: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    status: str
    document_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None

    model_config = {"from_attributes": True}


class SalaryStructureCreate(BaseModel):
    user_id: UUID
    basic: float = 0
    hra: float = 0
    allowances: float = 0
    pf: float = 0
    esi: float = 0
    other_deductions: float = 0
    effective_from: date
    effective_to: Optional[date] = None


class SalaryStructureUpdate(BaseModel):
    basic: Optional[float] = None
    hra: Optional[float] = None
    allowances: Optional[float] = None
    pf: Optional[float] = None
    esi: Optional[float] = None
    other_deductions: Optional[float] = None
    effective_to: Optional[date] = None


class SalaryStructureResponse(BaseModel):
    id: UUID
    user_id: UUID
    basic: float
    hra: float
    allowances: float
    pf: float
    esi: float
    other_deductions: float
    effective_from: date
    effective_to: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None

    model_config = {"from_attributes": True}


class PayrollRunCreate(BaseModel):
    plant_id: UUID
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)


class PayrollRunResponse(BaseModel):
    id: UUID
    plant_id: UUID
    month: int
    year: int
    status: str
    processed_by: Optional[UUID] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PayrollLineItemResponse(BaseModel):
    id: UUID
    payroll_run_id: UUID
    user_id: UUID
    payable_days: float
    gross_salary: float
    deductions: float
    net_salary: float
    payslip_data: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None

    model_config = {"from_attributes": True}


class PayslipResponse(BaseModel):
    line_item_id: UUID
    html: str
