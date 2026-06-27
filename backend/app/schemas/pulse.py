from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class OEEMetrics(BaseModel):
    availability: float = 0
    performance: float = 0
    quality: float = 0
    oee: float = 0
    is_estimated: bool = False


class OEETrendPoint(BaseModel):
    period_start: datetime
    period_end: datetime
    availability: float
    performance: float
    quality: float
    oee: float


class OEEResponse(BaseModel):
    scope_type: str
    scope_id: UUID
    current: OEEMetrics
    hourly: list[OEETrendPoint] = Field(default_factory=list)
    daily: list[OEETrendPoint] = Field(default_factory=list)
    weekly: list[OEETrendPoint] = Field(default_factory=list)
    monthly: list[OEETrendPoint] = Field(default_factory=list)


class DepartmentPulseCard(BaseModel):
    department_id: UUID
    department_code: str
    department_name: str
    status: str
    current_shift_code: Optional[str] = None
    current_run_label: Optional[str] = None
    production: Optional[float] = None
    oee: Optional[float] = None
    downtime_minutes: Optional[float] = None
    power_kwh: Optional[float] = None
    open_issues: int = 0
    maintenance_alerts: int = 0
    health_score: Optional[float] = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class PlantPulseResponse(BaseModel):
    plant_id: UUID
    plant_name: str
    snapshot_at: datetime
    plant_status: str
    overall_oee: Optional[float] = None
    today_production: Optional[float] = None
    today_cost: Optional[float] = None
    power_consumption_kwh: Optional[float] = None
    downtime_minutes: Optional[float] = None
    active_alerts: int = 0
    pending_maintenance: int = 0
    current_shift_code: Optional[str] = None
    attendance_pct: Optional[float] = None
    oee: OEEMetrics = Field(default_factory=OEEMetrics)
    departments: list[DepartmentPulseCard] = Field(default_factory=list)


class PulseEventItem(BaseModel):
    id: UUID
    event_type: str
    severity: str
    occurred_at: datetime
    asset_id: Optional[UUID] = None
    run_id: Optional[UUID] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class PulseAlertItem(BaseModel):
    id: str
    alert_type: str
    severity: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    occurred_at: datetime


class DepartmentPulseResponse(BaseModel):
    department_id: UUID
    department_code: str
    department_name: str
    snapshot_at: datetime
    status: str
    current_shift_code: Optional[str] = None
    current_run_id: Optional[UUID] = None
    current_run_label: Optional[str] = None
    production: Optional[float] = None
    oee: Optional[float] = None
    downtime_minutes: Optional[float] = None
    power_kwh: Optional[float] = None
    open_issues: int = 0
    maintenance_alerts: int = 0
    health_score: Optional[float] = None
    attendance_pct: Optional[float] = None
    production_target: Optional[float] = None
    actual_production: Optional[float] = None
    shift_completion_pct: Optional[float] = None
    department_cost: Optional[float] = None
    oee_detail: OEEMetrics = Field(default_factory=OEEMetrics)
    metrics: dict[str, Any] = Field(default_factory=dict)
    active_runs: list[dict[str, Any]] = Field(default_factory=list)


class AssetPulseResponse(BaseModel):
    asset_id: UUID
    asset_name: str
    asset_no: str
    department_name: Optional[str] = None
    status: str
    health_score: Optional[float] = None
    health_category: Optional[str] = None
    current_operator: Optional[str] = None
    current_run_id: Optional[UUID] = None
    current_run_label: Optional[str] = None
    current_shift_code: Optional[str] = None
    oee: OEEMetrics = Field(default_factory=OEEMetrics)
    live_parameters: list[dict[str, Any]] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)


class LiveParameterItem(BaseModel):
    param_key: str
    label: Optional[str] = None
    value: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    source: str = "manual"


class AssetWorkspaceResponse(BaseModel):
    asset_id: UUID
    asset_no: str
    asset_name: str
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    status: str
    health_score: Optional[float] = None
    health_category: Optional[str] = None
    current_operator: Optional[str] = None
    current_run_id: Optional[UUID] = None
    current_run_label: Optional[str] = None
    current_shift_code: Optional[str] = None
    location: Optional[str] = None
    installation_date: Optional[str] = None
    remaining_useful_life_pct: Optional[float] = None
    qr_payload: Optional[str] = None
    live_parameters: list[LiveParameterItem] = Field(default_factory=list)
    open_alerts: list[PulseAlertItem] = Field(default_factory=list)
    oee: OEEMetrics = Field(default_factory=OEEMetrics)
    energy_kwh_today: Optional[float] = None
    maintenance: dict[str, Any] = Field(default_factory=dict)
    inspections: list[dict[str, Any]] = Field(default_factory=list)
    sops: list[dict[str, Any]] = Field(default_factory=list)
    incidents: list[dict[str, Any]] = Field(default_factory=list)
    emergency_contacts: list[dict[str, str]] = Field(default_factory=list)


class QRAssetResponse(BaseModel):
    asset_id: UUID
    qr_payload: str
    workspace_url: str


class EnergyDashboardResponse(BaseModel):
    plant_id: UUID
    today_kwh: float = 0
    week_kwh: float = 0
    month_kwh: float = 0
    today_cost: float = 0
    peak_load_kw: Optional[float] = None
    avg_load_kw: Optional[float] = None
    departments: list[dict[str, Any]] = Field(default_factory=list)
    assets: list[dict[str, Any]] = Field(default_factory=list)
    history: list[dict[str, Any]] = Field(default_factory=list)


class InventoryItemResponse(BaseModel):
    material_code: str
    material_name: str
    quantity: float
    unit: str
    quality_grade: Optional[str] = None
    location: Optional[str] = None
    avg_daily_consumption: Optional[float] = None
    days_remaining: Optional[float] = None
    current_value: Optional[float] = None
    supplier: Optional[str] = None
    low_stock_threshold: Optional[float] = None
    status: str
    last_updated: datetime


class MaintenanceIntelligenceResponse(BaseModel):
    assets_running: int = 0
    under_pm: int = 0
    breakdown: int = 0
    waiting_parts: int = 0
    waiting_shutdown: int = 0
    completed_today: int = 0
    upcoming_pm: int = 0
    pm_compliance_pct: Optional[float] = None
    mtbf_hours: Optional[float] = None
    mttr_hours: Optional[float] = None
    maintenance_cost: Optional[float] = None
    downtime_hours: Optional[float] = None


class SafetyDashboardResponse(BaseModel):
    assets_under_maintenance: int = 0
    unsafe_assets: int = 0
    expired_certifications: int = 0
    inspection_due: int = 0
    recent_incidents: list[dict[str, Any]] = Field(default_factory=list)
    safety_alerts: list[PulseAlertItem] = Field(default_factory=list)
    emergency_contacts: list[dict[str, str]] = Field(default_factory=list)


class SafetyInspectionCreate(BaseModel):
    asset_id: Optional[UUID] = None
    inspection_type: str
    findings: Optional[str] = None
    next_due_at: Optional[datetime] = None


class SafetyIncidentCreate(BaseModel):
    asset_id: Optional[UUID] = None
    title: str
    description: str
    severity: str = "medium"
    occurred_at: datetime


class InventoryAdjustRequest(BaseModel):
    material_code: str
    quantity: float
    quality_grade: Optional[str] = None
    location: Optional[str] = None
