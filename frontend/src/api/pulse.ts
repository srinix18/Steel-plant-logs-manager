import { apiClient } from './client';

export interface OEEMetrics {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  is_estimated?: boolean;
}

export interface DepartmentPulseCard {
  department_id: string;
  department_code: string;
  department_name: string;
  status: string;
  current_shift_code?: string;
  current_run_label?: string;
  production?: number;
  oee?: number;
  downtime_minutes?: number;
  power_kwh?: number;
  open_issues: number;
  maintenance_alerts: number;
  health_score?: number;
  metrics: Record<string, unknown>;
}

export interface PlantPulse {
  plant_id: string;
  plant_name: string;
  snapshot_at: string;
  plant_status: string;
  overall_oee?: number;
  today_production?: number;
  today_cost?: number;
  power_consumption_kwh?: number;
  downtime_minutes?: number;
  active_alerts: number;
  pending_maintenance: number;
  current_shift_code?: string;
  attendance_pct?: number;
  oee: OEEMetrics;
  departments: DepartmentPulseCard[];
}

export interface DepartmentPulse {
  department_id: string;
  department_code: string;
  department_name: string;
  snapshot_at: string;
  status: string;
  current_shift_code?: string;
  current_run_id?: string;
  current_run_label?: string;
  production?: number;
  oee?: number;
  downtime_minutes?: number;
  power_kwh?: number;
  open_issues: number;
  maintenance_alerts: number;
  health_score?: number;
  attendance_pct?: number;
  production_target?: number;
  actual_production?: number;
  shift_completion_pct?: number;
  department_cost?: number;
  oee_detail: OEEMetrics;
  metrics: Record<string, unknown>;
  active_runs: { id: string; run_number: string; state: string }[];
}

export interface PulseEvent {
  id: string;
  event_type: string;
  severity: string;
  occurred_at: string;
  asset_id?: string;
  run_id?: string;
  payload: Record<string, unknown>;
}

export interface PulseAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  occurred_at: string;
}

export interface AssetPulse {
  asset_id: string;
  asset_name: string;
  asset_no: string;
  department_name?: string;
  status: string;
  health_score?: number;
  health_category?: string;
  current_operator?: string;
  current_run_id?: string;
  current_run_label?: string;
  oee: OEEMetrics;
  live_parameters: {
    param_key: string;
    label?: string;
    value?: number;
    value_text?: string;
    unit?: string;
    source: string;
  }[];
  metrics: Record<string, unknown>;
}

export interface AssetWorkspace {
  asset_id: string;
  asset_no: string;
  asset_name: string;
  department_name?: string;
  status: string;
  health_score?: number;
  health_category?: string;
  current_operator?: string;
  current_run_id?: string;
  current_run_label?: string;
  location?: string;
  installation_date?: string;
  remaining_useful_life_pct?: number;
  qr_payload?: string;
  live_parameters: AssetPulse['live_parameters'];
  open_alerts: PulseAlert[];
  oee: OEEMetrics;
  energy_kwh_today?: number;
  maintenance: { open_work_orders: { id: string; title: string; status: string; due_at?: string }[] };
  inspections: { id: string; type: string; inspected_at: string }[];
  sops: { id: string; title: string; category: string }[];
  incidents: { id: string; title: string }[];
  emergency_contacts: { name: string; phone: string; role: string }[];
}

export async function fetchPlantPulse(plantId: string) {
  const { data } = await apiClient.get<PlantPulse>(`/pulse/plant/${plantId}`);
  return data;
}

export async function fetchDepartmentPulse(departmentId: string) {
  const { data } = await apiClient.get<DepartmentPulse>(`/pulse/department/${departmentId}`);
  return data;
}

export async function fetchAssetPulse(assetId: string) {
  const { data } = await apiClient.get<AssetPulse>(`/pulse/asset/${assetId}`);
  return data;
}

export async function fetchPulseFeed(plantId: string, limit = 30) {
  const { data } = await apiClient.get<PulseEvent[]>('/pulse/feed', { params: { plant_id: plantId, limit } });
  return data;
}

export async function fetchPulseAlerts(plantId: string) {
  const { data } = await apiClient.get<PulseAlert[]>('/pulse/alerts', { params: { plant_id: plantId } });
  return data;
}

export async function refreshPulse(plantId?: string) {
  const { data } = await apiClient.post('/pulse/refresh', null, {
    params: plantId ? { plant_id: plantId } : undefined,
  });
  return data;
}

export async function fetchAssetWorkspace(assetId: string) {
  const { data } = await apiClient.get<AssetWorkspace>(`/assets/${assetId}/workspace`);
  return data;
}

export async function fetchAssetQr(assetId: string) {
  const { data } = await apiClient.get<{ asset_id: string; qr_payload: string; workspace_url: string }>(
    `/assets/${assetId}/qr`,
  );
  return data;
}

export async function fetchMaintenanceIntelligence(plantId: string) {
  const { data } = await apiClient.get('/maintenance/intelligence', { params: { plant_id: plantId } });
  return data;
}

export async function scanQrPayload(payload: string) {
  const { data } = await apiClient.post<{ asset_id: string; workspace_url: string }>('/safety/scan', { payload });
  return data;
}
