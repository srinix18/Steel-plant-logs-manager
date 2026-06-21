from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import (
    CorrectiveActionPriority,
    CorrectiveActionStatus,
    EventSeverity,
    EventSource,
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

    model_config = {"from_attributes": True}


class UserProfile(UserBrief):
    employee_uid: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    date_of_joining: Optional[date] = None


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
