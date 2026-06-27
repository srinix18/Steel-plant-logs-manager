import { apiClient } from './client';

export interface EnergyDashboard {
  plant_id: string;
  today_kwh: number;
  week_kwh: number;
  month_kwh: number;
  today_cost: number;
  peak_load_kw?: number;
  avg_load_kw?: number;
  departments: { department_id: string; code: string; name: string; kwh: number }[];
  assets: { asset_id: string; name: string; kwh: number }[];
  history: { reading_at: string; kwh: number; cost?: number }[];
}

export async function fetchEnergyPlant(plantId: string) {
  const { data } = await apiClient.get<EnergyDashboard>(`/energy/plant/${plantId}`);
  return data;
}

export async function fetchEnergyDepartments(plantId: string) {
  const { data } = await apiClient.get(`/energy/departments/${plantId}`);
  return data;
}

export async function fetchEnergyAssets(plantId: string) {
  const { data } = await apiClient.get(`/energy/assets/${plantId}`);
  return data;
}

export async function fetchEnergyHistory(plantId: string) {
  const { data } = await apiClient.get(`/energy/history/${plantId}`);
  return data;
}
