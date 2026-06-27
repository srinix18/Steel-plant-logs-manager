import { apiClient } from './client';

export interface InventoryItem {
  material_code: string;
  material_name: string;
  quantity: number;
  unit: string;
  quality_grade?: string;
  location?: string;
  avg_daily_consumption?: number;
  days_remaining?: number;
  current_value?: number;
  supplier?: string;
  low_stock_threshold?: number;
  status: string;
  last_updated: string;
}

export async function fetchInventoryPulse(plantId: string) {
  const { data } = await apiClient.get<InventoryItem[]>(`/inventory-pulse/${plantId}`);
  return data;
}

export async function adjustInventory(
  plantId: string,
  body: { material_code: string; quantity: number; quality_grade?: string; location?: string },
) {
  const { data } = await apiClient.post(`/inventory-pulse/${plantId}/adjust`, body);
  return data;
}
