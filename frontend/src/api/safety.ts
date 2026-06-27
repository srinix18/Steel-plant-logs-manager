import { apiClient } from './client';
import type { PulseAlert } from './pulse';

export interface SafetyDashboard {
  assets_under_maintenance: number;
  unsafe_assets: number;
  expired_certifications: number;
  inspection_due: number;
  recent_incidents: { id: string; title: string; severity: string; status: string; occurred_at: string }[];
  safety_alerts: PulseAlert[];
  emergency_contacts: { name: string; phone: string; role: string }[];
}

export async function fetchSafetyDashboard(plantId: string) {
  const { data } = await apiClient.get<SafetyDashboard>(`/safety/dashboard/${plantId}`);
  return data;
}

export async function fetchSafetyInspections(plantId: string) {
  const { data } = await apiClient.get(`/safety/inspections/${plantId}`);
  return data;
}

export async function fetchSafetyIncidents(plantId: string) {
  const { data } = await apiClient.get(`/safety/incidents/${plantId}`);
  return data;
}

export async function fetchSafetySops(plantId: string, assetId?: string) {
  const { data } = await apiClient.get(`/safety/sops/${plantId}`, { params: assetId ? { asset_id: assetId } : {} });
  return data;
}

export async function searchSafetyAssets(q: string, plantId?: string) {
  const { data } = await apiClient.get<
    { id: string; asset_no: string; name: string; status: string }[]
  >('/safety/assets/search', { params: { q, plant_id: plantId, limit: 10 } });
  return data;
}

export async function createSafetyIncident(
  plantId: string,
  body: { title: string; description: string; severity: string; occurred_at: string; asset_id?: string },
) {
  const { data } = await apiClient.post(`/safety/incidents/${plantId}`, body);
  return data;
}

export async function createSafetyInspection(
  plantId: string,
  body: { inspection_type: string; findings?: string; asset_id?: string },
) {
  const { data } = await apiClient.post(`/safety/inspections/${plantId}`, body);
  return data;
}
