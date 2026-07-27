import { apiClient } from '@/src/api/client';

export type CostCategory =
  | 'raw_material'
  | 'power'
  | 'fuel'
  | 'labour'
  | 'maintenance'
  | 'consumables'
  | 'other';

export type CategoryBreakdown = {
  category: CostCategory | string;
  amount: number;
  percentage: number;
};

export type DepartmentCostSummary = {
  department_id: string;
  department_code: string;
  department_name: string;
  total_cost: number;
  run_count: number;
};

export type PlantCostSummary = {
  total_cost_today: number;
  total_cost_month: number;
  run_count_today: number;
  run_count_month: number;
  by_department: DepartmentCostSummary[];
  by_category: CategoryBreakdown[];
};

export type DepartmentCostDetail = {
  department_id: string;
  department_code: string;
  department_name: string;
  total_cost: number;
  run_count: number;
  cost_per_run: number;
  cost_per_ton?: number | null;
  breakdown: CategoryBreakdown[];
};

export type ProcessCostDetail = {
  process_id: string;
  process_code: string;
  process_name: string;
  total_cost: number;
  run_count: number;
  average_cost: number;
  highest_cost_run_id?: string | null;
  highest_cost_run_number?: string | null;
  highest_cost: number;
  lowest_cost_run_id?: string | null;
  lowest_cost_run_number?: string | null;
  lowest_cost: number;
};

export type AssetCostDetail = {
  asset_id: string;
  asset_no: string;
  asset_name: string;
  total_production_kg: number;
  power_cost: number;
  maintenance_cost: number;
  total_cost: number;
  cost_per_ton?: number | null;
};

export const COST_CATEGORY_LABELS: Record<string, string> = {
  raw_material: 'Raw Material',
  power: 'Power',
  fuel: 'Fuel',
  labour: 'Labour',
  maintenance: 'Maintenance',
  consumables: 'Consumables',
  other: 'Other',
};

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** GET /finance/dashboard/plant-summary?plant_id= */
export async function fetchPlantCostSummary(plantId: string): Promise<PlantCostSummary> {
  const { data } = await apiClient.get<PlantCostSummary>(
    `/finance/dashboard/plant-summary?plant_id=${encodeURIComponent(plantId)}`
  );
  return data;
}

/** GET /finance/dashboard/departments/{deptId} */
export async function fetchDepartmentCostDetail(deptId: string): Promise<DepartmentCostDetail> {
  const { data } = await apiClient.get<DepartmentCostDetail>(
    `/finance/dashboard/departments/${deptId}`
  );
  return data;
}

/** GET /finance/dashboard/processes/{processId} */
export async function fetchProcessCostDetail(processId: string): Promise<ProcessCostDetail> {
  const { data } = await apiClient.get<ProcessCostDetail>(
    `/finance/dashboard/processes/${processId}`
  );
  return data;
}

/** GET /finance/dashboard/assets/{assetId} */
export async function fetchAssetCostDetail(assetId: string): Promise<AssetCostDetail> {
  const { data } = await apiClient.get<AssetCostDetail>(
    `/finance/dashboard/assets/${assetId}`
  );
  return data;
}

export type CostLineItem = {
  id: string;
  cost_category: string;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  source_mapping_id?: string | null;
  source_ref?: Record<string, unknown>;
};

export type CostCalculation = {
  id: string;
  process_run_id: string;
  calculated_at: string;
  total_cost: number;
  version: number;
  status: 'complete' | 'partial' | 'failed' | string;
  warnings: string[];
  context?: Record<string, unknown>;
  line_items: CostLineItem[];
};

export type RunCostSheet = {
  run_id: string;
  run_number: string;
  process_code?: string | null;
  department_code?: string | null;
  calculation: CostCalculation;
  breakdown: CategoryBreakdown[];
};

/** GET /finance/dashboard/runs/{runId}/cost-sheet */
export async function fetchRunCostSheet(runId: string): Promise<RunCostSheet> {
  const { data } = await apiClient.get<RunCostSheet>(
    `/finance/dashboard/runs/${runId}/cost-sheet`
  );
  return data;
}

/** POST /finance/calculations/runs/{runId}/compute */
export async function computeRunCost(runId: string): Promise<CostCalculation> {
  const { data } = await apiClient.post<CostCalculation>(
    `/finance/calculations/runs/${runId}/compute`
  );
  return data;
}

// --- Cost masters (P5-FIN-MASTERS) ---

export type RawMaterialCostRate = {
  id: string;
  organisation_id: string;
  material_id: string;
  material_code?: string;
  material_name?: string;
  unit: string;
  rate: number;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
};

export type PowerCostRate = {
  id: string;
  plant_id: string;
  cost_per_unit: number;
  effective_from: string;
  effective_to?: string | null;
};

export type FuelCostRate = {
  id: string;
  plant_id: string;
  fuel_name: string;
  unit: string;
  rate: number;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
};

export type LabourCostRate = {
  id: string;
  plant_id: string;
  department_id?: string | null;
  role_label: string;
  cost_per_hour: number;
  is_active: boolean;
};

export type MaintenanceCostRate = {
  id: string;
  plant_id: string;
  category: string;
  default_cost: number;
  is_active: boolean;
};

export async function fetchRawMaterialRates(orgId?: string): Promise<RawMaterialCostRate[]> {
  const q = orgId ? `?organisation_id=${encodeURIComponent(orgId)}` : '';
  const { data } = await apiClient.get<RawMaterialCostRate[]>(
    `/finance/masters/raw-materials${q}`
  );
  return data;
}

export async function createRawMaterialRate(payload: {
  organisation_id: string;
  material_id: string;
  unit?: string;
  rate: number;
  effective_from: string;
  effective_to?: string;
}): Promise<RawMaterialCostRate> {
  const { data } = await apiClient.post<RawMaterialCostRate>(
    '/finance/masters/raw-materials',
    payload
  );
  return data;
}

export async function fetchPowerRates(plantId?: string): Promise<PowerCostRate[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<PowerCostRate[]>(`/finance/masters/power${q}`);
  return data;
}

export async function createPowerRate(payload: {
  plant_id: string;
  cost_per_unit: number;
  effective_from: string;
  effective_to?: string;
}): Promise<PowerCostRate> {
  const { data } = await apiClient.post<PowerCostRate>('/finance/masters/power', payload);
  return data;
}

export async function fetchFuelRates(plantId?: string): Promise<FuelCostRate[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<FuelCostRate[]>(`/finance/masters/fuel${q}`);
  return data;
}

export async function createFuelRate(payload: {
  plant_id: string;
  fuel_name: string;
  unit?: string;
  rate: number;
  effective_from: string;
}): Promise<FuelCostRate> {
  const { data } = await apiClient.post<FuelCostRate>('/finance/masters/fuel', payload);
  return data;
}

export async function fetchLabourRates(plantId?: string): Promise<LabourCostRate[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<LabourCostRate[]>(`/finance/masters/labour${q}`);
  return data;
}

export async function createLabourRate(payload: {
  plant_id: string;
  role_label: string;
  cost_per_hour: number;
  department_id?: string;
}): Promise<LabourCostRate> {
  const { data } = await apiClient.post<LabourCostRate>('/finance/masters/labour', payload);
  return data;
}

export async function fetchMaintenanceRates(plantId?: string): Promise<MaintenanceCostRate[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<MaintenanceCostRate[]>(
    `/finance/masters/maintenance${q}`
  );
  return data;
}

export async function createMaintenanceRate(payload: {
  plant_id: string;
  category: string;
  default_cost: number;
}): Promise<MaintenanceCostRate> {
  const { data } = await apiClient.post<MaintenanceCostRate>(
    '/finance/masters/maintenance',
    payload
  );
  return data;
}

// --- Cost mappings (P5-FIN-MAP) ---

export type CostMappingSourceType = 'scalar_field' | 'section_row' | 'section_aggregate';

export type CostMappingRule = {
  id: string;
  template_version_id: string;
  source_type: CostMappingSourceType;
  source_key: string;
  child_key?: string | null;
  material_field_key?: string | null;
  cost_category: CostCategory;
  item_label_override?: string | null;
  unit_override?: string | null;
  labour_role_label?: string | null;
  is_active: boolean;
  sort_order: number;
};

export type TemplateFieldOption = {
  section_key: string;
  section_title: string;
  field_name: string;
  field_label: string;
  field_type: string;
  section_type: string;
};

export type TemplateMappingContext = {
  template_version_id: string;
  template_name?: string | null;
  rev_no?: string | null;
  available_fields: TemplateFieldOption[];
  rules: CostMappingRule[];
};

/** GET /finance/mappings/template-versions/{versionId} */
export async function fetchMappingContext(versionId: string): Promise<TemplateMappingContext> {
  const { data } = await apiClient.get<TemplateMappingContext>(
    `/finance/mappings/template-versions/${versionId}`
  );
  return data;
}

/** POST /finance/mappings/rules */
export async function createMappingRule(payload: {
  template_version_id: string;
  source_type: CostMappingSourceType;
  source_key: string;
  cost_category: CostCategory;
  child_key?: string;
  material_field_key?: string;
  item_label_override?: string;
  unit_override?: string;
  labour_role_label?: string;
  sort_order?: number;
}): Promise<CostMappingRule> {
  const { data } = await apiClient.post<CostMappingRule>('/finance/mappings/rules', payload);
  return data;
}

/** DELETE /finance/mappings/rules/{ruleId} */
export async function deleteMappingRule(ruleId: string): Promise<void> {
  await apiClient.delete(`/finance/mappings/rules/${ruleId}`);
}
