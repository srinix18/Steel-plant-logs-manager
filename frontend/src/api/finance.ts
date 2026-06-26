import { apiClient } from './client';

export type CostCategory =
  | 'raw_material'
  | 'power'
  | 'fuel'
  | 'labour'
  | 'maintenance'
  | 'consumables'
  | 'other';

export type CostMappingSourceType = 'scalar_field' | 'section_row' | 'section_aggregate';

export interface RawMaterialCostRate {
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
}

export interface PowerCostRate {
  id: string;
  plant_id: string;
  cost_per_unit: number;
  effective_from: string;
  effective_to?: string | null;
}

export interface FuelCostRate {
  id: string;
  plant_id: string;
  fuel_name: string;
  unit: string;
  rate: number;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
}

export interface LabourCostRate {
  id: string;
  plant_id: string;
  department_id?: string | null;
  role_label: string;
  cost_per_hour: number;
  is_active: boolean;
}

export interface MaintenanceCostRate {
  id: string;
  plant_id: string;
  category: string;
  default_cost: number;
  is_active: boolean;
}

export interface CostMappingRule {
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
}

export interface TemplateFieldOption {
  section_key: string;
  section_title: string;
  field_name: string;
  field_label: string;
  field_type: string;
  section_type: string;
}

export interface TemplateMappingContext {
  template_version_id: string;
  template_name?: string | null;
  rev_no?: string | null;
  available_fields: TemplateFieldOption[];
  rules: CostMappingRule[];
}

export interface CostLineItem {
  id: string;
  cost_category: CostCategory;
  item_name: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  source_mapping_id?: string | null;
  source_ref: Record<string, unknown>;
}

export interface CostCalculation {
  id: string;
  process_run_id: string;
  calculated_at: string;
  total_cost: number;
  version: number;
  status: 'complete' | 'partial' | 'failed';
  warnings: string[];
  context: Record<string, unknown>;
  line_items: CostLineItem[];
}

export interface CategoryBreakdown {
  category: CostCategory;
  amount: number;
  percentage: number;
}

export interface DepartmentCostSummary {
  department_id: string;
  department_code: string;
  department_name: string;
  total_cost: number;
  run_count: number;
}

export interface PlantCostSummary {
  total_cost_today: number;
  total_cost_month: number;
  run_count_today: number;
  run_count_month: number;
  by_department: DepartmentCostSummary[];
  by_category: CategoryBreakdown[];
}

export interface DepartmentCostDetail {
  department_id: string;
  department_code: string;
  department_name: string;
  total_cost: number;
  run_count: number;
  cost_per_run: number;
  cost_per_ton?: number | null;
  breakdown: CategoryBreakdown[];
}

export interface ProcessCostDetail {
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
}

export interface AssetCostDetail {
  asset_id: string;
  asset_no: string;
  asset_name: string;
  total_production_kg: number;
  power_cost: number;
  maintenance_cost: number;
  total_cost: number;
  cost_per_ton?: number | null;
}

export interface RunCostSheet {
  run_id: string;
  run_number: string;
  process_code?: string | null;
  department_code?: string | null;
  calculation: CostCalculation;
  breakdown: CategoryBreakdown[];
}

export interface TopCostDriver {
  category: CostCategory;
  amount: number;
  percentage: number;
}

export interface CostTrendPoint {
  label: string;
  total_cost: number;
  run_count: number;
}

// Masters
export async function fetchRawMaterialRates(orgId?: string) {
  const { data } = await apiClient.get<RawMaterialCostRate[]>('/finance/masters/raw-materials', {
    params: orgId ? { organisation_id: orgId } : undefined,
  });
  return data;
}

export async function createRawMaterialRate(payload: {
  organisation_id: string;
  material_id: string;
  unit?: string;
  rate: number;
  effective_from: string;
  effective_to?: string;
}) {
  const { data } = await apiClient.post<RawMaterialCostRate>('/finance/masters/raw-materials', payload);
  return data;
}

export async function fetchPowerRates(plantId?: string) {
  const { data } = await apiClient.get<PowerCostRate[]>('/finance/masters/power', {
    params: plantId ? { plant_id: plantId } : undefined,
  });
  return data;
}

export async function createPowerRate(payload: {
  plant_id: string;
  cost_per_unit: number;
  effective_from: string;
  effective_to?: string;
}) {
  const { data } = await apiClient.post<PowerCostRate>('/finance/masters/power', payload);
  return data;
}

export async function fetchFuelRates(plantId?: string) {
  const { data } = await apiClient.get<FuelCostRate[]>('/finance/masters/fuel', {
    params: plantId ? { plant_id: plantId } : undefined,
  });
  return data;
}

export async function createFuelRate(payload: {
  plant_id: string;
  fuel_name: string;
  unit?: string;
  rate: number;
  effective_from: string;
}) {
  const { data } = await apiClient.post<FuelCostRate>('/finance/masters/fuel', payload);
  return data;
}

export async function fetchLabourRates(plantId?: string) {
  const { data } = await apiClient.get<LabourCostRate[]>('/finance/masters/labour', {
    params: plantId ? { plant_id: plantId } : undefined,
  });
  return data;
}

export async function createLabourRate(payload: {
  plant_id: string;
  role_label: string;
  cost_per_hour: number;
  department_id?: string;
}) {
  const { data } = await apiClient.post<LabourCostRate>('/finance/masters/labour', payload);
  return data;
}

export async function fetchMaintenanceRates(plantId?: string) {
  const { data } = await apiClient.get<MaintenanceCostRate[]>('/finance/masters/maintenance', {
    params: plantId ? { plant_id: plantId } : undefined,
  });
  return data;
}

export async function createMaintenanceRate(payload: {
  plant_id: string;
  category: string;
  default_cost: number;
}) {
  const { data } = await apiClient.post<MaintenanceCostRate>('/finance/masters/maintenance', payload);
  return data;
}

// Mappings
export async function fetchMappingContext(versionId: string) {
  const { data } = await apiClient.get<TemplateMappingContext>(
    `/finance/mappings/template-versions/${versionId}`
  );
  return data;
}

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
}) {
  const { data } = await apiClient.post<CostMappingRule>('/finance/mappings/rules', payload);
  return data;
}

export async function deleteMappingRule(ruleId: string) {
  await apiClient.delete(`/finance/mappings/rules/${ruleId}`);
}

// Calculations
export async function computeRunCost(runId: string) {
  const { data } = await apiClient.post<CostCalculation>(`/finance/calculations/runs/${runId}/compute`);
  return data;
}

export async function bulkComputeCosts(payload: {
  plant_id?: string;
  department_id?: string;
  process_id?: string;
  from_date?: string;
  to_date?: string;
}) {
  const { data } = await apiClient.post<{ computed: number; failed: number; skipped: number }>(
    '/finance/calculations/bulk-compute',
    payload
  );
  return data;
}

// Dashboard
export async function fetchPlantCostSummary(plantId: string) {
  const { data } = await apiClient.get<PlantCostSummary>('/finance/dashboard/plant-summary', {
    params: { plant_id: plantId },
  });
  return data;
}

export async function fetchDepartmentCostDetail(deptId: string) {
  const { data } = await apiClient.get<DepartmentCostDetail>(`/finance/dashboard/departments/${deptId}`);
  return data;
}

export async function fetchProcessCostDetail(processId: string) {
  const { data } = await apiClient.get<ProcessCostDetail>(`/finance/dashboard/processes/${processId}`);
  return data;
}

export async function fetchAssetCostDetail(assetId: string) {
  const { data } = await apiClient.get<AssetCostDetail>(`/finance/dashboard/assets/${assetId}`);
  return data;
}

export async function fetchRunCostSheet(runId: string) {
  const { data } = await apiClient.get<RunCostSheet>(`/finance/dashboard/runs/${runId}/cost-sheet`);
  return data;
}

export async function fetchTopCostDrivers(plantId: string) {
  const { data } = await apiClient.get<TopCostDriver[]>('/finance/analytics/top-drivers', {
    params: { plant_id: plantId },
  });
  return data;
}

export async function fetchCostTrends(plantId: string, groupBy: string) {
  const { data } = await apiClient.get<CostTrendPoint[]>('/finance/analytics/trends', {
    params: { plant_id: plantId, group_by: groupBy },
  });
  return data;
}

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
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
