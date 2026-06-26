from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import (
    DowntimeType,
    MaintenanceProgramStatus,
    MaintenanceTaskExecutionStatus,
    MaintenanceTriggerType,
    MaintenanceWorkOrderStatus,
)


class MaintenanceProgramCreate(BaseModel):
    plant_id: UUID
    department_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    asset_group_id: Optional[UUID] = None
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    category: str = Field(min_length=1, max_length=32)
    priority: str = "medium"
    responsible_team: Optional[str] = None
    estimated_duration_min: Optional[int] = None
    status: MaintenanceProgramStatus = MaintenanceProgramStatus.DRAFT
    is_active: bool = True
    auto_generate_work_orders: bool = True


class MaintenanceProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    responsible_team: Optional[str] = None
    estimated_duration_min: Optional[int] = None
    status: Optional[MaintenanceProgramStatus] = None
    is_active: Optional[bool] = None
    auto_generate_work_orders: Optional[bool] = None
    department_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    asset_group_id: Optional[UUID] = None


class MaintenanceProgramResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    plant_id: UUID
    department_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    asset_group_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    category: str
    priority: str
    responsible_team: Optional[str] = None
    estimated_duration_min: Optional[int] = None
    status: str
    is_active: bool
    auto_generate_work_orders: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceTriggerCreate(BaseModel):
    trigger_type: MaintenanceTriggerType
    threshold_value: Optional[float] = None
    interval_days: Optional[int] = None
    is_active: bool = True


class MaintenanceTriggerUpdate(BaseModel):
    trigger_type: Optional[MaintenanceTriggerType] = None
    threshold_value: Optional[float] = None
    interval_days: Optional[int] = None
    is_active: Optional[bool] = None


class MaintenanceTriggerResponse(BaseModel):
    id: UUID
    program_id: UUID
    trigger_type: str
    threshold_value: Optional[float] = None
    interval_days: Optional[int] = None
    last_fired_at: Optional[datetime] = None
    next_due_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceTaskTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    estimated_duration_min: Optional[int] = None
    is_required: bool = True
    checklist: list[Any] = Field(default_factory=list)
    photo_required: bool = False
    remarks_required: bool = False
    sort_order: int = 0


class MaintenanceTaskTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    estimated_duration_min: Optional[int] = None
    is_required: Optional[bool] = None
    checklist: Optional[list[Any]] = None
    photo_required: Optional[bool] = None
    remarks_required: Optional[bool] = None
    sort_order: Optional[int] = None


class MaintenanceTaskTemplateResponse(BaseModel):
    id: UUID
    program_id: UUID
    name: str
    description: Optional[str] = None
    estimated_duration_min: Optional[int] = None
    is_required: bool
    checklist: list[Any]
    photo_required: bool
    remarks_required: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceNotificationRuleCreate(BaseModel):
    offset_days: int = 0
    recipient_role: str = Field(min_length=1, max_length=32)
    channel: str = "in_app"
    is_active: bool = True


class MaintenanceNotificationRuleUpdate(BaseModel):
    offset_days: Optional[int] = None
    recipient_role: Optional[str] = None
    channel: Optional[str] = None
    is_active: Optional[bool] = None


class MaintenanceNotificationRuleResponse(BaseModel):
    id: UUID
    program_id: UUID
    offset_days: int
    recipient_role: str
    channel: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceWorkOrderCreate(BaseModel):
    plant_id: UUID
    program_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    source_issue_id: Optional[UUID] = None
    title: str = Field(min_length=1, max_length=300)
    assigned_team: Optional[str] = None
    assigned_to: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    estimated_duration_min: Optional[int] = None


class MaintenanceWorkOrderUpdate(BaseModel):
    title: Optional[str] = None
    assigned_team: Optional[str] = None
    assigned_to: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    estimated_duration_min: Optional[int] = None


class MaintenanceWorkOrderTransitionCreate(BaseModel):
    to_state: MaintenanceWorkOrderStatus
    notes: Optional[str] = None


class MaintenanceWorkOrderTransitionResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    from_state: Optional[str] = None
    to_state: str
    actor_id: UUID
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceWorkOrderTaskResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    template_id: Optional[UUID] = None
    name: str
    status: str
    checklist_responses: dict[str, Any]
    photos: list[Any]
    remarks: Optional[str] = None
    time_spent_min: Optional[int] = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceWorkOrderTaskExecute(BaseModel):
    status: MaintenanceTaskExecutionStatus
    checklist_responses: Optional[dict[str, Any]] = None
    photos: Optional[list[Any]] = None
    remarks: Optional[str] = None
    time_spent_min: Optional[int] = None


class MaintenanceWorkOrderPartCreate(BaseModel):
    part_name: str = Field(min_length=1, max_length=200)
    material_id: Optional[UUID] = None
    quantity: float = 1
    unit_cost: float = 0


class MaintenanceWorkOrderPartUpdate(BaseModel):
    part_name: Optional[str] = None
    material_id: Optional[UUID] = None
    quantity: Optional[float] = None
    unit_cost: Optional[float] = None


class MaintenanceWorkOrderPartResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    part_name: str
    material_id: Optional[UUID] = None
    quantity: float
    unit_cost: float
    total_cost: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceDowntimeCreate(BaseModel):
    asset_id: UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    reason: Optional[str] = None
    downtime_type: DowntimeType = DowntimeType.PLANNED


class MaintenanceDowntimeUpdate(BaseModel):
    ended_at: Optional[datetime] = None
    reason: Optional[str] = None
    downtime_type: Optional[DowntimeType] = None


class MaintenanceDowntimeResponse(BaseModel):
    id: UUID
    work_order_id: UUID
    asset_id: UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_min: Optional[float] = None
    reason: Optional[str] = None
    downtime_type: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceWorkOrderResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    plant_id: UUID
    program_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    source_issue_id: Optional[UUID] = None
    wo_number: str
    title: str
    status: str
    assigned_team: Optional[str] = None
    assigned_to: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    estimated_duration_min: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    tasks: list[MaintenanceWorkOrderTaskResponse] = Field(default_factory=list)
    parts: list[MaintenanceWorkOrderPartResponse] = Field(default_factory=list)
    transitions: list[MaintenanceWorkOrderTransitionResponse] = Field(default_factory=list)
    downtime_records: list[MaintenanceDowntimeResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class MaintenanceAnalyticsResponse(BaseModel):
    plant_id: Optional[UUID] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    mtbf_hours: Optional[float] = None
    mttr_hours: Optional[float] = None
    pm_compliance_pct: Optional[float] = None
    open_work_orders: int = 0
    overdue_work_orders: int = 0
    completed_work_orders: int = 0
    total_downtime_min: float = 0
    kpis: dict[str, Any] = Field(default_factory=dict)


class PmEvaluateResponse(BaseModel):
    triggers_evaluated: int = 0
    notifications_sent: int = 0
    work_orders_generated: int = 0
