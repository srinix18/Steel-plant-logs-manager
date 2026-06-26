from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import CostCalculationStatus, CostCategory, CostMappingSourceType


# --- Cost Masters ---


class RawMaterialCostRateCreate(BaseModel):
    organisation_id: UUID
    material_id: UUID
    unit: str = "kg"
    rate: float
    effective_from: date
    effective_to: Optional[date] = None
    is_active: bool = True


class RawMaterialCostRateUpdate(BaseModel):
    unit: Optional[str] = None
    rate: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_active: Optional[bool] = None


class RawMaterialCostRateResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    material_id: UUID
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    unit: str
    rate: float
    effective_from: date
    effective_to: Optional[date] = None
    is_active: bool

    model_config = {"from_attributes": True}


class PowerCostRateCreate(BaseModel):
    plant_id: UUID
    cost_per_unit: float
    effective_from: date
    effective_to: Optional[date] = None


class PowerCostRateUpdate(BaseModel):
    cost_per_unit: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


class PowerCostRateResponse(BaseModel):
    id: UUID
    plant_id: UUID
    cost_per_unit: float
    effective_from: date
    effective_to: Optional[date] = None

    model_config = {"from_attributes": True}


class FuelCostRateCreate(BaseModel):
    plant_id: UUID
    fuel_name: str
    unit: str = "litre"
    rate: float
    effective_from: date
    effective_to: Optional[date] = None
    is_active: bool = True


class FuelCostRateUpdate(BaseModel):
    fuel_name: Optional[str] = None
    unit: Optional[str] = None
    rate: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_active: Optional[bool] = None


class FuelCostRateResponse(BaseModel):
    id: UUID
    plant_id: UUID
    fuel_name: str
    unit: str
    rate: float
    effective_from: date
    effective_to: Optional[date] = None
    is_active: bool

    model_config = {"from_attributes": True}


class LabourCostRateCreate(BaseModel):
    plant_id: UUID
    department_id: Optional[UUID] = None
    role_label: str
    cost_per_hour: float
    is_active: bool = True


class LabourCostRateUpdate(BaseModel):
    department_id: Optional[UUID] = None
    role_label: Optional[str] = None
    cost_per_hour: Optional[float] = None
    is_active: Optional[bool] = None


class LabourCostRateResponse(BaseModel):
    id: UUID
    plant_id: UUID
    department_id: Optional[UUID] = None
    role_label: str
    cost_per_hour: float
    is_active: bool

    model_config = {"from_attributes": True}


class MaintenanceCostRateCreate(BaseModel):
    plant_id: UUID
    category: str
    default_cost: float
    is_active: bool = True


class MaintenanceCostRateUpdate(BaseModel):
    category: Optional[str] = None
    default_cost: Optional[float] = None
    is_active: Optional[bool] = None


class MaintenanceCostRateResponse(BaseModel):
    id: UUID
    plant_id: UUID
    category: str
    default_cost: float
    is_active: bool

    model_config = {"from_attributes": True}


# --- Mapping ---


class CostMappingRuleCreate(BaseModel):
    template_version_id: UUID
    source_type: CostMappingSourceType
    source_key: str
    child_key: Optional[str] = None
    material_field_key: Optional[str] = None
    cost_category: CostCategory
    item_label_override: Optional[str] = None
    unit_override: Optional[str] = None
    labour_role_label: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0


class CostMappingRuleUpdate(BaseModel):
    source_type: Optional[CostMappingSourceType] = None
    source_key: Optional[str] = None
    child_key: Optional[str] = None
    material_field_key: Optional[str] = None
    cost_category: Optional[CostCategory] = None
    item_label_override: Optional[str] = None
    unit_override: Optional[str] = None
    labour_role_label: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class CostMappingRuleResponse(BaseModel):
    id: UUID
    template_version_id: UUID
    source_type: CostMappingSourceType
    source_key: str
    child_key: Optional[str] = None
    material_field_key: Optional[str] = None
    cost_category: CostCategory
    item_label_override: Optional[str] = None
    unit_override: Optional[str] = None
    labour_role_label: Optional[str] = None
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class TemplateFieldOption(BaseModel):
    section_key: str
    section_title: str
    field_name: str
    field_label: str
    field_type: str
    section_type: str


class TemplateMappingContext(BaseModel):
    template_version_id: UUID
    template_name: Optional[str] = None
    rev_no: Optional[str] = None
    available_fields: list[TemplateFieldOption] = Field(default_factory=list)
    rules: list[CostMappingRuleResponse] = Field(default_factory=list)


# --- Calculations ---


class CostLineItemResponse(BaseModel):
    id: UUID
    cost_category: CostCategory
    item_name: str
    quantity: float
    unit: str
    rate: float
    amount: float
    source_mapping_id: Optional[UUID] = None
    source_ref: dict[str, Any] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class CostCalculationResponse(BaseModel):
    id: UUID
    process_run_id: UUID
    calculated_at: datetime
    total_cost: float
    version: int
    status: CostCalculationStatus
    warnings: list[str] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)
    line_items: list[CostLineItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class CostCalculationSummary(BaseModel):
    id: UUID
    process_run_id: UUID
    run_number: Optional[str] = None
    calculated_at: datetime
    total_cost: float
    version: int
    status: CostCalculationStatus


class BulkComputeRequest(BaseModel):
    plant_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    process_id: Optional[UUID] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None


class BulkComputeResponse(BaseModel):
    computed: int
    failed: int
    skipped: int


# --- Dashboard ---


class CategoryBreakdown(BaseModel):
    category: CostCategory
    amount: float
    percentage: float = 0


class DepartmentCostSummary(BaseModel):
    department_id: UUID
    department_code: str
    department_name: str
    total_cost: float
    run_count: int


class PlantCostSummary(BaseModel):
    total_cost_today: float
    total_cost_month: float
    run_count_today: int
    run_count_month: int
    by_department: list[DepartmentCostSummary] = Field(default_factory=list)
    by_category: list[CategoryBreakdown] = Field(default_factory=list)


class DepartmentCostDetail(BaseModel):
    department_id: UUID
    department_code: str
    department_name: str
    total_cost: float
    run_count: int
    cost_per_run: float
    cost_per_ton: Optional[float] = None
    breakdown: list[CategoryBreakdown] = Field(default_factory=list)


class ProcessCostDetail(BaseModel):
    process_id: UUID
    process_code: str
    process_name: str
    total_cost: float
    run_count: int
    average_cost: float
    highest_cost_run_id: Optional[UUID] = None
    highest_cost_run_number: Optional[str] = None
    highest_cost: float = 0
    lowest_cost_run_id: Optional[UUID] = None
    lowest_cost_run_number: Optional[str] = None
    lowest_cost: float = 0


class AssetCostDetail(BaseModel):
    asset_id: UUID
    asset_no: str
    asset_name: str
    total_production_kg: float
    power_cost: float
    maintenance_cost: float
    total_cost: float
    cost_per_ton: Optional[float] = None


class RunCostSheet(BaseModel):
    run_id: UUID
    run_number: str
    process_code: Optional[str] = None
    department_code: Optional[str] = None
    calculation: CostCalculationResponse
    breakdown: list[CategoryBreakdown] = Field(default_factory=list)


class TopCostDriver(BaseModel):
    category: CostCategory
    amount: float
    percentage: float


class CostTrendPoint(BaseModel):
    label: str
    total_cost: float
    run_count: int
