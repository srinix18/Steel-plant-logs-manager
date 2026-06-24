from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import (
    ApprovalAction,
    AssetEventType,
    AssetStatus,
    CorrectiveActionPriority,
    CorrectiveActionStatus,
    DelayCodeCategory,
    DocumentCategory,
    KpiFrequency,
    MaterialType,
    ObservationCategory,
    ObservationSeverity,
)


# --- Assets ---


class AssetGroupCreate(BaseModel):
    plant_id: UUID
    code: str
    name: str


class AssetGroupResponse(BaseModel):
    id: UUID
    plant_id: UUID
    code: str
    name: str
    model_config = {"from_attributes": True}


class AssetAdminCreate(BaseModel):
    plant_id: UUID
    group_id: UUID
    asset_no: str
    name: str
    department_id: Optional[UUID] = None
    status: AssetStatus = AssetStatus.ACTIVE
    installation_date: Optional[date] = None
    remarks: Optional[str] = None
    life_counters: dict[str, Any] = Field(default_factory=dict)
    expected_life: dict[str, Any] = Field(default_factory=dict)
    last_inspection_at: Optional[datetime] = None
    plc_tag_prefix: Optional[str] = None


class AssetAdminUpdate(BaseModel):
    name: Optional[str] = None
    group_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    status: Optional[AssetStatus] = None
    installation_date: Optional[date] = None
    remarks: Optional[str] = None
    life_counters: Optional[dict[str, Any]] = None
    expected_life: Optional[dict[str, Any]] = None
    last_inspection_at: Optional[datetime] = None
    plc_tag_prefix: Optional[str] = None


class AssetAdminResponse(BaseModel):
    id: UUID
    group_id: UUID
    plant_id: UUID
    department_id: Optional[UUID] = None
    asset_no: str
    name: str
    status: str
    life_counters: dict[str, Any] = Field(default_factory=dict)
    expected_life: dict[str, Any] = Field(default_factory=dict)
    remaining_life: Optional[dict[str, Any]] = None
    installation_date: Optional[date] = None
    remarks: Optional[str] = None
    last_inspection_at: Optional[datetime] = None
    plc_tag_prefix: Optional[str] = None
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    model_config = {"from_attributes": True}


class AssetEventCreate(BaseModel):
    event_type: AssetEventType
    occurred_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)


class AssetEventResponse(BaseModel):
    id: UUID
    plant_id: UUID
    asset_id: Optional[UUID] = None
    event_type: str
    source: str
    occurred_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)
    model_config = {"from_attributes": True}


class AssetResponsibilityCreate(BaseModel):
    user_id: UUID
    role_label: str = "owner"
    is_primary: bool = False


class AssetResponsibilityResponse(BaseModel):
    id: UUID
    asset_id: UUID
    user_id: UUID
    role_label: str
    is_primary: bool
    user_name: Optional[str] = None
    model_config = {"from_attributes": True}


# --- Masters ---


class SteelGradeCreate(BaseModel):
    organisation_id: UUID
    code: str
    description: Optional[str] = None


class SteelGradeUpdate(BaseModel):
    description: Optional[str] = None


class SteelGradeAdminResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    code: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class MaterialCreate(BaseModel):
    organisation_id: UUID
    type: MaterialType
    code: str
    name: str


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[MaterialType] = None


class MaterialAdminResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    type: str
    code: str
    name: str
    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    organisation_id: UUID
    code: str
    name: str
    department_id: Optional[UUID] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class ProductResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    code: str
    name: str
    department_id: Optional[UUID] = None
    is_active: bool
    model_config = {"from_attributes": True}


class CustomerCreate(BaseModel):
    plant_id: UUID
    name: str
    code: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerAdminResponse(BaseModel):
    id: UUID
    plant_id: UUID
    name: str
    code: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


class DelayCodeCreate(BaseModel):
    plant_id: UUID
    code: str
    description: str
    category: DelayCodeCategory


class DelayCodeUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[DelayCodeCategory] = None
    is_active: Optional[bool] = None


class DelayCodeAdminResponse(BaseModel):
    id: UUID
    plant_id: UUID
    code: str
    description: str
    category: str
    is_active: bool
    model_config = {"from_attributes": True}


class ContractorReadResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    code: str
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


# --- Observations ---


class FoundationObservationCreate(BaseModel):
    plant_id: UUID
    title: str
    description: str
    department_id: Optional[UUID] = None
    process_id: Optional[UUID] = None
    category: ObservationCategory
    severity: ObservationSeverity
    run_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    maintenance_issue_id: Optional[UUID] = None


class FoundationObservationUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[ObservationSeverity] = None
    status: Optional[str] = None
    maintenance_issue_id: Optional[UUID] = None


class FoundationObservationResponse(BaseModel):
    id: UUID
    plant_id: UUID
    title: Optional[str] = None
    description: str
    department_id: Optional[UUID] = None
    process_id: Optional[UUID] = None
    category: str
    severity: str
    status: str
    observed_by: UUID
    observed_at: datetime
    run_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    maintenance_issue_id: Optional[UUID] = None
    model_config = {"from_attributes": True}


class FoundationCorrectiveActionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: UUID
    due_date: Optional[date] = None
    priority: CorrectiveActionPriority = CorrectiveActionPriority.MEDIUM


class FoundationCorrectiveActionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[UUID] = None
    due_date: Optional[date] = None
    priority: Optional[CorrectiveActionPriority] = None
    status: Optional[CorrectiveActionStatus] = None
    closure_notes: Optional[str] = None


class FoundationCorrectiveActionResponse(BaseModel):
    id: UUID
    observation_id: UUID
    title: str
    description: Optional[str] = None
    assigned_to: UUID
    assigned_by: UUID
    due_date: Optional[date] = None
    priority: str
    status: str
    closure_notes: Optional[str] = None
    closed_at: Optional[datetime] = None
    observation_title: Optional[str] = None
    model_config = {"from_attributes": True}


# --- Documents ---


class DocumentUploadMeta(BaseModel):
    plant_id: UUID
    department_id: UUID
    category: DocumentCategory
    title: str
    version: str = "1.0"


class DocumentResponse(BaseModel):
    id: UUID
    plant_id: UUID
    department_id: UUID
    category: str
    title: str
    version: str
    file_name: str
    mime_type: str
    size_bytes: int
    uploaded_by: UUID
    is_active: bool
    created_at: datetime
    uploader_name: Optional[str] = None
    model_config = {"from_attributes": True}


# --- Approvals ---


class ApprovalTransition(BaseModel):
    action: ApprovalAction
    comments: Optional[str] = None


class ApprovalRecordResponse(BaseModel):
    id: UUID
    entity_type: str
    entity_id: UUID
    action: str
    user_id: UUID
    comments: Optional[str] = None
    created_at: datetime
    user_name: Optional[str] = None
    model_config = {"from_attributes": True}


# --- KPI ---


class KpiDefinitionCreate(BaseModel):
    code: str
    name: str
    formula: str
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    target_value: Optional[float] = None
    frequency: Optional[KpiFrequency] = None
    dimensions: list[str] = Field(default_factory=list)
    refresh_interval_minutes: int = 60


class KpiDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    formula: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    target_value: Optional[float] = None
    frequency: Optional[KpiFrequency] = None
    dimensions: Optional[list[str]] = None
    refresh_interval_minutes: Optional[int] = None


class KpiDefinitionAdminResponse(BaseModel):
    id: UUID
    code: str
    name: str
    formula: str
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    target_value: Optional[float] = None
    frequency: Optional[str] = None
    dimensions: list[str] = Field(default_factory=list)
    refresh_interval_minutes: int
    model_config = {"from_attributes": True}
