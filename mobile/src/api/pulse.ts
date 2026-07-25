import { apiClient } from '@/src/api/client';

export type OEEMetrics = {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  is_estimated?: boolean;
};

export type DepartmentPulseCard = {
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
};

export type PlantPulse = {
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
};

export type DepartmentPulse = {
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
};

export type PulseEvent = {
  id: string;
  event_type: string;
  severity: string;
  occurred_at: string;
  asset_id?: string;
  run_id?: string;
  payload: Record<string, unknown>;
};

export type PulseAlert = {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  occurred_at: string;
};

export type LiveParameter = {
  param_key: string;
  label?: string;
  value?: number;
  value_text?: string;
  unit?: string;
  source: string;
};

export type AssetPulse = {
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
  live_parameters: LiveParameter[];
  metrics: Record<string, unknown>;
};

export type AssetWorkspace = {
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
  live_parameters: LiveParameter[];
  open_alerts: PulseAlert[];
  oee: OEEMetrics;
  energy_kwh_today?: number;
  maintenance: {
    open_work_orders: { id: string; title: string; status: string; due_at?: string }[];
  };
  inspections: { id: string; type: string; inspected_at: string }[];
  sops: { id: string; title: string; category: string }[];
  incidents: { id: string; title: string }[];
  emergency_contacts: { name: string; phone: string; role: string }[];
};

/** GET /pulse/plant/{plantId} */
export async function fetchPlantPulse(plantId: string): Promise<PlantPulse> {
  const { data } = await apiClient.get<PlantPulse>(`/pulse/plant/${plantId}`);
  return data;
}

/** GET /pulse/department/{departmentId} */
export async function fetchDepartmentPulse(departmentId: string): Promise<DepartmentPulse> {
  const { data } = await apiClient.get<DepartmentPulse>(`/pulse/department/${departmentId}`);
  return data;
}

/** GET /pulse/asset/{assetId} */
export async function fetchAssetPulse(assetId: string): Promise<AssetPulse> {
  const { data } = await apiClient.get<AssetPulse>(`/pulse/asset/${assetId}`);
  return data;
}

/** GET /pulse/feed?plant_id&limit */
export async function fetchPulseFeed(plantId: string, limit = 30): Promise<PulseEvent[]> {
  const q = `?plant_id=${encodeURIComponent(plantId)}&limit=${limit}`;
  const { data } = await apiClient.get<PulseEvent[]>(`/pulse/feed${q}`);
  return data;
}

/** GET /pulse/alerts?plant_id */
export async function fetchPulseAlerts(plantId: string): Promise<PulseAlert[]> {
  const q = `?plant_id=${encodeURIComponent(plantId)}`;
  const { data } = await apiClient.get<PulseAlert[]>(`/pulse/alerts${q}`);
  return data;
}

/** POST /pulse/refresh?plant_id (CEO-tier) */
export async function refreshPulse(plantId?: string): Promise<unknown> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.post(`/pulse/refresh${q}`);
  return data;
}

/** GET /assets/{assetId}/workspace */
export async function fetchAssetWorkspace(assetId: string): Promise<AssetWorkspace> {
  const { data } = await apiClient.get<AssetWorkspace>(`/assets/${assetId}/workspace`);
  return data;
}

/** GET /assets/{assetId}/qr */
export async function fetchAssetQr(
  assetId: string
): Promise<{ asset_id: string; qr_payload: string; workspace_url: string }> {
  const { data } = await apiClient.get<{ asset_id: string; qr_payload: string; workspace_url: string }>(
    `/assets/${assetId}/qr`
  );
  return data;
}

export function formatOeePct(fraction: number | null | undefined, digits = 0): string {
  if (fraction == null || Number.isNaN(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function pulseStatusTone(status: string): 'success' | 'danger' | 'brand' | 'neutral' {
  const key = status.toLowerCase();
  if (key === 'critical') return 'danger';
  if (key === 'warning') return 'brand';
  if (key === 'normal' || key === 'healthy') return 'success';
  return 'neutral';
}
