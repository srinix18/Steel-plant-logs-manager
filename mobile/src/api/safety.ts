import { apiClient } from '@/src/api/client';

export type SafetyAssetMatch = {
  id: string;
  asset_no: string;
  name: string;
  status: string;
};

export type SafetyScanResult = {
  asset_id: string;
  workspace_url: string;
};

export type SafetyDashboard = {
  assets_under_maintenance: number;
  unsafe_assets: number;
  expired_certifications: number;
  inspection_due: number;
  recent_incidents: {
    id: string;
    title: string;
    severity: string;
    status: string;
    occurred_at: string;
  }[];
  safety_alerts?: unknown[];
  emergency_contacts: { name: string; phone: string; role: string }[];
};

export async function searchSafetyAssets(
  q: string,
  plantId?: string | null
): Promise<SafetyAssetMatch[]> {
  const params = new URLSearchParams({ q, limit: '10' });
  if (plantId) params.set('plant_id', plantId);
  const { data } = await apiClient.get<SafetyAssetMatch[]>(
    `/safety/assets/search?${params.toString()}`
  );
  return data;
}

export async function scanQrPayload(payload: string): Promise<SafetyScanResult> {
  const { data } = await apiClient.post<SafetyScanResult>('/safety/scan', { payload });
  return data;
}

export async function fetchSafetyDashboard(plantId: string): Promise<SafetyDashboard> {
  const { data } = await apiClient.get<SafetyDashboard>(`/safety/dashboard/${plantId}`);
  return data;
}

export type SafetyInspection = {
  id: string;
  asset_id?: string | null;
  inspection_type: string;
  status?: string;
  findings?: string | null;
  inspected_at: string;
  next_due_at?: string | null;
};

export type SafetySop = {
  id: string;
  title: string;
  category: string;
  version?: string;
};

export type SafetyIncident = {
  id: string;
  title: string;
  severity: string;
  status?: string;
  occurred_at?: string;
};

export async function fetchSafetyInspections(plantId: string): Promise<SafetyInspection[]> {
  const { data } = await apiClient.get<SafetyInspection[]>(`/safety/inspections/${plantId}`);
  return data;
}

export async function fetchSafetySops(plantId: string, assetId?: string): Promise<SafetySop[]> {
  const q = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : '';
  const { data } = await apiClient.get<SafetySop[]>(`/safety/sops/${plantId}${q}`);
  return data;
}

export async function fetchSafetyIncidents(plantId: string): Promise<SafetyIncident[]> {
  const { data } = await apiClient.get<SafetyIncident[]>(`/safety/incidents/${plantId}`);
  return data;
}
