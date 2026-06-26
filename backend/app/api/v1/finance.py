from datetime import date
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.finance import (
    AssetCostDetail,
    BulkComputeRequest,
    BulkComputeResponse,
    CostCalculationResponse,
    CostCalculationSummary,
    CostMappingRuleCreate,
    CostMappingRuleResponse,
    CostMappingRuleUpdate,
    CostTrendPoint,
    DepartmentCostDetail,
    FuelCostRateCreate,
    FuelCostRateResponse,
    FuelCostRateUpdate,
    LabourCostRateCreate,
    LabourCostRateResponse,
    LabourCostRateUpdate,
    MaintenanceCostRateCreate,
    MaintenanceCostRateResponse,
    MaintenanceCostRateUpdate,
    PlantCostSummary,
    PowerCostRateCreate,
    PowerCostRateResponse,
    PowerCostRateUpdate,
    ProcessCostDetail,
    RawMaterialCostRateCreate,
    RawMaterialCostRateResponse,
    RawMaterialCostRateUpdate,
    RunCostSheet,
    TemplateMappingContext,
    TopCostDriver,
)
from app.services.cost_engine_service import CostEngineService
from app.services.finance_service import FinanceService

router = APIRouter()
finance_service = FinanceService()
cost_engine = CostEngineService()


# --- Cost Masters ---


@router.get("/finance/masters/raw-materials", response_model=list[RawMaterialCostRateResponse])
async def list_raw_material_rates(
    session: DbSession,
    user: CurrentUser,
    organisation_id: UUID | None = None,
):
    return await finance_service.list_raw_material_rates(session, user, organisation_id)


@router.post("/finance/masters/raw-materials", response_model=RawMaterialCostRateResponse, status_code=201)
async def create_raw_material_rate(
    session: DbSession, user: CurrentUser, data: RawMaterialCostRateCreate
):
    return await finance_service.create_raw_material_rate(session, user, data)


@router.patch("/finance/masters/raw-materials/{rate_id}", response_model=RawMaterialCostRateResponse)
async def update_raw_material_rate(
    session: DbSession, user: CurrentUser, rate_id: UUID, data: RawMaterialCostRateUpdate
):
    return await finance_service.update_raw_material_rate(session, user, rate_id, data)


@router.get("/finance/masters/power", response_model=list[PowerCostRateResponse])
async def list_power_rates(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    return await finance_service.list_power_rates(session, user, plant_id)


@router.post("/finance/masters/power", response_model=PowerCostRateResponse, status_code=201)
async def create_power_rate(session: DbSession, user: CurrentUser, data: PowerCostRateCreate):
    return await finance_service.create_power_rate(session, user, data)


@router.patch("/finance/masters/power/{rate_id}", response_model=PowerCostRateResponse)
async def update_power_rate(
    session: DbSession, user: CurrentUser, rate_id: UUID, data: PowerCostRateUpdate
):
    return await finance_service.update_power_rate(session, user, rate_id, data)


@router.get("/finance/masters/fuel", response_model=list[FuelCostRateResponse])
async def list_fuel_rates(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    return await finance_service.list_fuel_rates(session, user, plant_id)


@router.post("/finance/masters/fuel", response_model=FuelCostRateResponse, status_code=201)
async def create_fuel_rate(session: DbSession, user: CurrentUser, data: FuelCostRateCreate):
    return await finance_service.create_fuel_rate(session, user, data)


@router.patch("/finance/masters/fuel/{rate_id}", response_model=FuelCostRateResponse)
async def update_fuel_rate(
    session: DbSession, user: CurrentUser, rate_id: UUID, data: FuelCostRateUpdate
):
    return await finance_service.update_fuel_rate(session, user, rate_id, data)


@router.get("/finance/masters/labour", response_model=list[LabourCostRateResponse])
async def list_labour_rates(session: DbSession, user: CurrentUser, plant_id: UUID | None = None):
    return await finance_service.list_labour_rates(session, user, plant_id)


@router.post("/finance/masters/labour", response_model=LabourCostRateResponse, status_code=201)
async def create_labour_rate(session: DbSession, user: CurrentUser, data: LabourCostRateCreate):
    return await finance_service.create_labour_rate(session, user, data)


@router.patch("/finance/masters/labour/{rate_id}", response_model=LabourCostRateResponse)
async def update_labour_rate(
    session: DbSession, user: CurrentUser, rate_id: UUID, data: LabourCostRateUpdate
):
    return await finance_service.update_labour_rate(session, user, rate_id, data)


@router.get("/finance/masters/maintenance", response_model=list[MaintenanceCostRateResponse])
async def list_maintenance_rates(
    session: DbSession, user: CurrentUser, plant_id: UUID | None = None
):
    return await finance_service.list_maintenance_rates(session, user, plant_id)


@router.post("/finance/masters/maintenance", response_model=MaintenanceCostRateResponse, status_code=201)
async def create_maintenance_rate(
    session: DbSession, user: CurrentUser, data: MaintenanceCostRateCreate
):
    return await finance_service.create_maintenance_rate(session, user, data)


@router.patch("/finance/masters/maintenance/{rate_id}", response_model=MaintenanceCostRateResponse)
async def update_maintenance_rate(
    session: DbSession, user: CurrentUser, rate_id: UUID, data: MaintenanceCostRateUpdate
):
    return await finance_service.update_maintenance_rate(session, user, rate_id, data)


# --- Mapping ---


@router.get("/finance/mappings/template-versions/{version_id}", response_model=TemplateMappingContext)
async def get_mapping_context(session: DbSession, user: CurrentUser, version_id: UUID):
    return await finance_service.get_mapping_context(session, user, version_id)


@router.post("/finance/mappings/rules", response_model=CostMappingRuleResponse, status_code=201)
async def create_mapping_rule(session: DbSession, user: CurrentUser, data: CostMappingRuleCreate):
    return await finance_service.create_mapping_rule(session, user, data)


@router.patch("/finance/mappings/rules/{rule_id}", response_model=CostMappingRuleResponse)
async def update_mapping_rule(
    session: DbSession, user: CurrentUser, rule_id: UUID, data: CostMappingRuleUpdate
):
    return await finance_service.update_mapping_rule(session, user, rule_id, data)


@router.delete("/finance/mappings/rules/{rule_id}", status_code=204)
async def delete_mapping_rule(session: DbSession, user: CurrentUser, rule_id: UUID):
    await finance_service.delete_mapping_rule(session, user, rule_id)


@router.post(
    "/finance/mappings/template-versions/{version_id}/clone-from/{source_version_id}",
    response_model=list[CostMappingRuleResponse],
)
async def clone_mappings(
    session: DbSession, user: CurrentUser, version_id: UUID, source_version_id: UUID
):
    return await finance_service.clone_mappings(session, user, version_id, source_version_id)


# --- Calculations ---


@router.get("/finance/calculations/runs/{run_id}", response_model=list[CostCalculationSummary])
async def list_run_calculations(session: DbSession, user: CurrentUser, run_id: UUID):
    return await finance_service.list_run_calculations(session, user, run_id)


@router.get(
    "/finance/calculations/runs/{run_id}/versions/{version}",
    response_model=CostCalculationResponse,
)
async def get_calculation_version(
    session: DbSession, user: CurrentUser, run_id: UUID, version: int
):
    return await finance_service.get_calculation_version(session, user, run_id, version)


@router.post("/finance/calculations/runs/{run_id}/compute", response_model=CostCalculationResponse)
async def compute_run_cost(session: DbSession, user: CurrentUser, run_id: UUID):
    calc = await cost_engine.compute_for_run(session, run_id, user)
    return await finance_service.get_calculation_version(session, user, run_id, calc.version)


@router.post("/finance/calculations/bulk-compute", response_model=BulkComputeResponse)
async def bulk_compute_costs(session: DbSession, user: CurrentUser, data: BulkComputeRequest):
    result = await cost_engine.bulk_compute(
        session,
        user,
        plant_id=data.plant_id,
        department_id=data.department_id,
        process_id=data.process_id,
        from_date=data.from_date,
        to_date=data.to_date,
    )
    return BulkComputeResponse(**result)


# --- Dashboard ---


@router.get("/finance/dashboard/plant-summary", response_model=PlantCostSummary)
async def plant_cost_summary(
    session: DbSession, user: CurrentUser, plant_id: UUID = Query(...)
):
    return await finance_service.plant_summary(session, user, plant_id)


@router.get("/finance/dashboard/departments/{dept_id}", response_model=DepartmentCostDetail)
async def department_cost_detail(session: DbSession, user: CurrentUser, dept_id: UUID):
    return await finance_service.department_detail(session, user, dept_id)


@router.get("/finance/dashboard/processes/{process_id}", response_model=ProcessCostDetail)
async def process_cost_detail(session: DbSession, user: CurrentUser, process_id: UUID):
    return await finance_service.process_detail(session, user, process_id)


@router.get("/finance/dashboard/assets/{asset_id}", response_model=AssetCostDetail)
async def asset_cost_detail(session: DbSession, user: CurrentUser, asset_id: UUID):
    return await finance_service.asset_detail(session, user, asset_id)


@router.get("/finance/dashboard/runs/{run_id}/cost-sheet", response_model=RunCostSheet)
async def run_cost_sheet(session: DbSession, user: CurrentUser, run_id: UUID):
    return await finance_service.run_cost_sheet(session, user, run_id)


# --- Analytics ---


@router.get("/finance/analytics/top-drivers", response_model=list[TopCostDriver])
async def top_cost_drivers(
    session: DbSession, user: CurrentUser, plant_id: UUID = Query(...)
):
    return await finance_service.top_drivers(session, user, plant_id)


@router.get("/finance/analytics/trends", response_model=list[CostTrendPoint])
async def cost_trends(
    session: DbSession,
    user: CurrentUser,
    plant_id: UUID = Query(...),
    group_by: str = Query("day", pattern="^(day|department|process|asset)$"),
):
    return await finance_service.cost_trends(session, user, plant_id, group_by)
