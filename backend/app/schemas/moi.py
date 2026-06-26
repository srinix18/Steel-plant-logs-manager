from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import (
    AttendanceStatus,
    CoilStatus,
    CorrectiveActionPriority,
    CorrectiveActionStatus,
    DelayCodeCategory,
    DelayEventStatus,
    EmploymentStatus,
    EmploymentType,
    EventSeverity,
    EventSource,
    MaintenanceIssueStatus,
    ObservationCategory,
    ObservationSeverity,
    ProcessRunType,
    TemplateScopeType,
    TemplateVersionStatus,
    UserRole,
)


# Auth
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBrief(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole
    organisation_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    process_id: Optional[UUID] = None
    maintenance_division: Optional[ObservationCategory] = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class OrgUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: UserRole
    department_id: Optional[UUID] = None
    process_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    maintenance_division: Optional[ObservationCategory] = None
    employment_status: Optional[EmploymentStatus] = EmploymentStatus.ACTIVE


class OrgUserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    department_id: Optional[UUID] = None
    process_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6)
    maintenance_division: Optional[ObservationCategory] = None
    employment_status: Optional[EmploymentStatus] = None
    date_of_joining: Optional[date] = None


class MessageCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1)
    recipient_ids: list[UUID] = Field(default_factory=list)
    is_broadcast: bool = False


class MessageAttachmentResponse(BaseModel):
    id: UUID
    message_id: UUID
    file_name: str
    mime_type: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageSenderBrief(BaseModel):
    id: UUID
    full_name: str
    role: UserRole

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    sender_id: UUID
    subject: str
    body: str
    is_broadcast: bool
    created_at: datetime
    sender: Optional[MessageSenderBrief] = None
    attachments: list[MessageAttachmentResponse] = Field(default_factory=list)
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotificationResponse(BaseModel):
    id: UUID
    message_id: Optional[UUID] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    notification_type: str
    read_at: Optional[datetime] = None
    created_at: datetime
    message: Optional[MessageResponse] = None
    maintenance_issue: Optional["MaintenanceIssueResponse"] = None

    model_config = {"from_attributes": True}


class UserProfile(UserBrief):
    employee_uid: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[date] = None
    employment_status: Optional[EmploymentStatus] = EmploymentStatus.ACTIVE


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[date] = None


class LoginResponse(TokenResponse):
    user: UserBrief


class UserResponse(UserBrief):
    is_active: bool
    created_at: datetime
    updated_at: datetime


# Hierarchy
class OrganisationResponse(BaseModel):
    id: UUID
    name: str
    code: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class PlantResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    name: str
    code: str
    timezone: str
    location: Optional[str] = None
    model_config = {"from_attributes": True}


class DepartmentResponse(BaseModel):
    id: UUID
    plant_id: UUID
    organisation_id: UUID
    name: str
    code: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class ProcessResponse(BaseModel):
    id: UUID
    department_id: UUID
    code: str
    name: str
    description: Optional[str] = None
    default_template_id: Optional[UUID] = None
    model_config = {"from_attributes": True}


class AssetGroupResponse(BaseModel):
    id: UUID
    plant_id: UUID
    code: str
    name: str
    model_config = {"from_attributes": True}


class AssetResponse(BaseModel):
    id: UUID
    group_id: UUID
    plant_id: UUID
    asset_no: str
    name: str
    status: str
    life_counters: dict[str, Any] = Field(default_factory=dict)
    plc_tag_prefix: Optional[str] = None
    model_config = {"from_attributes": True}


class ProcessInstanceResponse(BaseModel):
    id: UUID
    process_id: UUID
    asset_id: UUID
    name: str
    status: str
    template_id: Optional[UUID] = None
    model_config = {"from_attributes": True}


# Templates
class TemplateFieldResponse(BaseModel):
    id: UUID
    section_id: UUID
    name: str
    label: str
    field_type: str
    required: bool
    sort_order: int
    config: dict[str, Any] = Field(default_factory=dict)
    formula: Optional[str] = None
    model_config = {"from_attributes": True}


class TemplateSectionResponse(BaseModel):
    id: UUID
    version_id: UUID
    key: str
    title: str
    sort_order: int
    section_type: str
    config: dict[str, Any] = Field(default_factory=dict)
    fields: list[TemplateFieldResponse] = Field(default_factory=list)
    model_config = {"from_attributes": True}


class TemplateVersionResponse(BaseModel):
    id: UUID
    template_id: UUID
    rev_no: str
    status: TemplateVersionStatus
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    published_at: Optional[datetime] = None
    change_summary: Optional[str] = None
    is_immutable: bool
    model_config = {"from_attributes": True}


class TemplateResponse(BaseModel):
    id: UUID
    scope_type: TemplateScopeType
    scope_id: UUID
    doc_no: str
    name: str
    model_config = {"from_attributes": True}


class TemplateDetailResponse(TemplateResponse):
    versions: list[TemplateVersionResponse] = Field(default_factory=list)


class TemplateVersionDetailResponse(TemplateVersionResponse):
    sections: list[TemplateSectionResponse] = Field(default_factory=list)


class PublishVersionRequest(BaseModel):
    effective_from: date
    change_summary: Optional[str] = None


# Workflow
class WorkflowStateResponse(BaseModel):
    key: str
    label: str
    is_terminal: bool
    color: Optional[str] = None
    model_config = {"from_attributes": True}


class WorkflowTransitionDefResponse(BaseModel):
    from_state: str
    to_state: str
    label: str
    allowed_roles: list[str] = Field(default_factory=list)
    requires_approval: bool = False
    auto_trigger_event_type: Optional[str] = None
    model_config = {"from_attributes": True}


class WorkflowStatusResponse(BaseModel):
    current_state: str
    available_transitions: list[WorkflowTransitionDefResponse] = Field(default_factory=list)
    states: list[WorkflowStateResponse] = Field(default_factory=list)


class TransitionRequest(BaseModel):
    to_state: str
    notes: Optional[str] = None


class WorkflowTransitionLogResponse(BaseModel):
    id: UUID
    from_state: str
    to_state: str
    actor_id: UUID
    trigger: str
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# Process Runs
class ProcessRunCreate(BaseModel):
    run_type: ProcessRunType = ProcessRunType.HEAT
    shift_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    run_number: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunFieldValueInput(BaseModel):
    field_key: str
    value: Any
    field_id: Optional[UUID] = None


class RunSectionDataInput(BaseModel):
    section_key: str
    data: dict[str, Any]


class ProcessRunUpdate(BaseModel):
    field_values: Optional[list[RunFieldValueInput]] = None
    section_data: Optional[list[RunSectionDataInput]] = None
    metadata: Optional[dict[str, Any]] = None


class RunFieldValueResponse(BaseModel):
    field_key: str
    value: Any
    source: str
    model_config = {"from_attributes": True}


class RunSectionDataResponse(BaseModel):
    section_key: str
    data: dict[str, Any]
    model_config = {"from_attributes": True}


class ProcessRunResponse(BaseModel):
    id: UUID
    run_number: str
    run_type: ProcessRunType
    process_id: UUID
    process_instance_id: UUID
    template_version_id: UUID
    workflow_definition_id: UUID
    current_state: str
    shift_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    primary_asset_id: Optional[UUID] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_by: UUID
    outcome: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ProcessRunDetailResponse(ProcessRunResponse):
    field_values: list[RunFieldValueResponse] = Field(default_factory=list)
    section_data: list[RunSectionDataResponse] = Field(default_factory=list)
    workflow: Optional[WorkflowStatusResponse] = None


# Events
class OperationalEventCreate(BaseModel):
    plant_id: UUID
    asset_id: Optional[UUID] = None
    run_id: Optional[UUID] = None
    event_type: str
    severity: EventSeverity = EventSeverity.INFO
    occurred_at: datetime
    source: EventSource = EventSource.MANUAL
    correlation_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class OperationalEventResponse(BaseModel):
    id: UUID
    plant_id: UUID
    asset_id: Optional[UUID] = None
    run_id: Optional[UUID] = None
    event_type: str
    severity: EventSeverity
    occurred_at: datetime
    source: EventSource
    payload: dict[str, Any] = Field(default_factory=dict)
    processed: bool
    model_config = {"from_attributes": True}


class TelemetryBindingResponse(BaseModel):
    id: UUID
    asset_id: UUID
    field_key: str
    tag_name: str
    event_type: Optional[str] = None
    model_config = {"from_attributes": True}


# Observations & Corrective Actions
class ObservationCreate(BaseModel):
    plant_id: UUID
    run_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    category: ObservationCategory
    description: str
    severity: ObservationSeverity


class ObservationResponse(BaseModel):
    id: UUID
    plant_id: UUID
    run_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    category: ObservationCategory
    description: str
    severity: ObservationSeverity
    observed_by: UUID
    observed_at: datetime
    status: str
    model_config = {"from_attributes": True}


class MaintenanceIssueCreate(BaseModel):
    plant_id: Optional[UUID] = None
    run_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    category: ObservationCategory
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    severity: ObservationSeverity


class MaintenanceIssueClose(BaseModel):
    resolution_notes: str = Field(min_length=1)


class MaintenanceIssueResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    plant_id: UUID
    run_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    category: ObservationCategory
    title: str
    description: str
    severity: ObservationSeverity
    status: MaintenanceIssueStatus
    raised_by: UUID
    raised_at: datetime
    assigned_to: Optional[UUID] = None
    assigned_at: Optional[datetime] = None
    closed_by: Optional[UUID] = None
    closed_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    raised_by_user: Optional[UserBrief] = None
    assigned_to_user: Optional[UserBrief] = None
    closed_by_user: Optional[UserBrief] = None

    model_config = {"from_attributes": True}


class CorrectiveActionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: UUID
    due_date: Optional[date] = None
    priority: CorrectiveActionPriority = CorrectiveActionPriority.MEDIUM


class CorrectiveActionUpdate(BaseModel):
    status: Optional[CorrectiveActionStatus] = None
    assigned_to: Optional[UUID] = None
    due_date: Optional[date] = None
    closure_notes: Optional[str] = None


class CorrectiveActionResponse(BaseModel):
    id: UUID
    observation_id: UUID
    title: str
    description: Optional[str] = None
    assigned_to: UUID
    due_date: Optional[date] = None
    priority: CorrectiveActionPriority
    status: CorrectiveActionStatus
    closure_notes: Optional[str] = None
    closed_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# Run remarks
class RunRemarkAttachmentResponse(BaseModel):
    id: UUID
    remark_id: UUID
    file_name: str
    mime_type: str
    size_bytes: int
    created_at: datetime
    model_config = {"from_attributes": True}


class RunRemarkAuthorBrief(BaseModel):
    id: UUID
    full_name: str
    employee_uid: Optional[str] = None
    model_config = {"from_attributes": True}


class RunRemarkResponse(BaseModel):
    id: UUID
    run_id: UUID
    author_id: UUID
    body: str
    role: str
    parent_id: Optional[UUID] = None
    created_at: datetime
    author: Optional[RunRemarkAuthorBrief] = None
    attachments: list[RunRemarkAttachmentResponse] = Field(default_factory=list)
    model_config = {"from_attributes": True}


class RunRemarkCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


# Analytics
class KPIDefinitionResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    formula: str
    model_config = {"from_attributes": True}


class ShiftKPIResponse(BaseModel):
    shift_id: UUID
    shift_date: date
    runs_completed: int
    avg_tap_to_tap_min: Optional[float] = None
    total_energy_kwh: Optional[float] = None
    oos_rate: Optional[float] = None
    model_config = {"from_attributes": True}


class AssetHealthResponse(BaseModel):
    asset_id: UUID
    asset_name: str
    utilization_pct: Optional[float] = None
    event_count: int = 0
    open_actions: int = 0


class DashboardMetrics(BaseModel):
    total_organisations: int = 0
    total_plants: int = 0
    active_runs: int = 0
    open_observations: int = 0
    open_corrective_actions: int = 0


class MessageResponse(BaseModel):
    message: str


# Rolling Mill — delay codes and events
class DelayCodeResponse(BaseModel):
    id: UUID
    plant_id: UUID
    code: str
    description: str
    category: DelayCodeCategory
    is_active: bool
    model_config = {"from_attributes": True}


class DelayCodeCreate(BaseModel):
    plant_id: UUID
    code: str = Field(min_length=1, max_length=10)
    description: str = Field(min_length=1, max_length=300)
    category: DelayCodeCategory
    is_active: bool = True


class DelayCodeUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=300)
    category: Optional[DelayCodeCategory] = None
    is_active: Optional[bool] = None


class DelayEventResponse(BaseModel):
    id: UUID
    run_id: UUID
    plant_id: UUID
    row_key: str
    delay_code_id: Optional[UUID] = None
    time_from: Optional[str] = None
    time_to: Optional[str] = None
    time_lost_minutes: Optional[int] = None
    reason: Optional[str] = None
    action_taken: Optional[str] = None
    assigned_to: Optional[UUID] = None
    status: DelayEventStatus
    observation_id: Optional[UUID] = None
    closed_at: Optional[datetime] = None
    closed_by: Optional[UUID] = None
    delay_code: Optional[DelayCodeResponse] = None
    model_config = {"from_attributes": True}


class DelayEventUpdate(BaseModel):
    assigned_to: Optional[UUID] = None
    action_taken: Optional[str] = None
    status: Optional[DelayEventStatus] = None


class HeatLookupResponse(BaseModel):
    run_id: UUID
    run_number: str
    heat_no: str
    grade_id: Optional[UUID] = None
    process_code: Optional[str] = None


# Wire Division — coils
class CoilResponse(BaseModel):
    id: UUID
    plant_id: UUID
    department_id: UUID
    coil_no: str
    work_order_no: Optional[str] = None
    grade_id: Optional[UUID] = None
    heat_run_id: Optional[UUID] = None
    heat_no: Optional[str] = None
    size_mm: Optional[float] = None
    weight_kg: Optional[float] = None
    status: CoilStatus
    parent_coil_id: Optional[UUID] = None
    source_run_id: Optional[UUID] = None
    registered_by: UUID
    model_config = {"from_attributes": True}


class CoilLookupResponse(BaseModel):
    id: UUID
    coil_no: str
    status: CoilStatus
    work_order_no: Optional[str] = None
    grade_id: Optional[UUID] = None
    heat_no: Optional[str] = None
    size_mm: Optional[float] = None
    weight_kg: Optional[float] = None
    parent_coil_id: Optional[UUID] = None


# Bright Bar — customers
class CustomerResponse(BaseModel):
    id: UUID
    plant_id: UUID
    name: str
    code: Optional[str] = None
    is_active: bool = True
    model_config = {"from_attributes": True}


# Workforce Management
class WorkforceEmployeeCreate(OrgUserCreate):
    employment_status: EmploymentStatus = EmploymentStatus.ACTIVE
    date_of_joining: Optional[date] = None
    employment_type: Optional[EmploymentType] = None
    manager_id: Optional[UUID] = None


class WorkforceEmployeeUpdate(OrgUserUpdate):
    employment_status: Optional[EmploymentStatus] = None
    date_of_joining: Optional[date] = None
    employment_type: Optional[EmploymentType] = None
    manager_id: Optional[UUID] = None


class ContractorCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=200)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True


class ContractorUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class ContractorResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    code: str
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


class ContractWorkerCreate(BaseModel):
    contractor_id: UUID
    full_name: str = Field(min_length=1, max_length=200)
    department_id: UUID
    phone: Optional[str] = None
    is_active: bool = True


class ContractWorkerUpdate(BaseModel):
    full_name: Optional[str] = None
    department_id: Optional[UUID] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class ContractWorkerResponse(BaseModel):
    id: UUID
    contractor_id: UUID
    full_name: str
    department_id: UUID
    phone: Optional[str] = None
    is_active: bool
    contractor_name: Optional[str] = None
    department_code: Optional[str] = None
    model_config = {"from_attributes": True}


class ShiftAssignmentCreate(BaseModel):
    user_id: UUID
    department_id: UUID
    shift_id: UUID
    effective_date: date


class ShiftAssignmentUpdate(BaseModel):
    department_id: Optional[UUID] = None
    shift_id: Optional[UUID] = None
    effective_date: Optional[date] = None


class ShiftAssignmentResponse(BaseModel):
    id: UUID
    user_id: UUID
    department_id: UUID
    shift_id: UUID
    effective_date: date
    user_name: Optional[str] = None
    employee_uid: Optional[str] = None
    department_code: Optional[str] = None
    shift_code: Optional[str] = None
    model_config = {"from_attributes": True}


class AttendanceEntryItem(BaseModel):
    user_id: UUID
    status: AttendanceStatus = AttendanceStatus.PRESENT
    remarks: Optional[str] = None


class AttendanceBulkSave(BaseModel):
    attendance_date: date
    department_id: UUID
    shift_id: UUID
    entries: list[AttendanceEntryItem]


class AttendanceRecordResponse(BaseModel):
    id: Optional[UUID] = None
    attendance_date: date
    user_id: UUID
    department_id: UUID
    shift_id: UUID
    status: AttendanceStatus
    remarks: Optional[str] = None
    marked_by_id: UUID
    marked_at: datetime
    user_name: Optional[str] = None
    model_config = {"from_attributes": True}


class ContractorAttendanceCreate(BaseModel):
    attendance_date: date
    contractor_id: UUID
    department_id: UUID
    shift_id: UUID
    workers_present: int = Field(ge=0)
    workers_absent: int = Field(ge=0)
    remarks: Optional[str] = None


class ContractorAttendanceResponse(BaseModel):
    id: UUID
    attendance_date: date
    contractor_id: UUID
    department_id: UUID
    shift_id: UUID
    workers_present: int
    workers_absent: int
    remarks: Optional[str] = None
    marked_by_id: UUID
    marked_at: datetime
    contractor_name: Optional[str] = None
    model_config = {"from_attributes": True}


class ShiftHandoverCreate(BaseModel):
    note_date: date
    department_id: UUID
    shift_id: UUID
    note: str = Field(min_length=1)


class ShiftHandoverResponse(BaseModel):
    id: UUID
    note_date: date
    department_id: UUID
    shift_id: UUID
    author_id: UUID
    note: str
    created_at: datetime
    author_name: Optional[str] = None
    department_code: Optional[str] = None
    shift_code: Optional[str] = None
    model_config = {"from_attributes": True}


class DepartmentAttendanceSummary(BaseModel):
    department_id: UUID
    department_code: str
    department_name: str
    expected: int
    present: float
    understaffed_by: int
    contract_workers_present: int = 0
    contract_workers_absent: int = 0


class WorkforceDailySummary(BaseModel):
    attendance_date: date
    employees_present: int
    employees_absent: int
    employees_expected: int
    contract_workers_present: int
    contract_workers_absent: int
    departments_understaffed: list[str]
    shift_notes_submitted: int
    pending_shift_notes: int
    departments: list[DepartmentAttendanceSummary]


class WorkforceMeResponse(BaseModel):
    shift_assignment: Optional[ShiftAssignmentResponse] = None
    recent_attendance: list[AttendanceRecordResponse] = Field(default_factory=list)
