import { apiClient } from '@/src/api/client';

export type InventoryItem = {
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
};

export type InventoryAdjustBody = {
  material_code: string;
  quantity: number;
  quality_grade?: string;
  location?: string;
};

export type InventoryAdjustResult = {
  material_code: string;
  quantity: number;
  status: string;
};

/** GET /inventory-pulse/{plantId} */
export async function fetchInventoryPulse(plantId: string): Promise<InventoryItem[]> {
  const { data } = await apiClient.get<InventoryItem[]>(`/inventory-pulse/${plantId}`);
  return data;
}

/** POST /inventory-pulse/{plantId}/adjust — sets absolute quantity. */
export async function adjustInventory(
  plantId: string,
  body: InventoryAdjustBody
): Promise<InventoryAdjustResult> {
  const { data } = await apiClient.post<InventoryAdjustResult>(
    `/inventory-pulse/${plantId}/adjust`,
    body
  );
  return data;
}

export function inventoryStatusTone(
  status: string
): 'success' | 'danger' | 'brand' | 'neutral' {
  const key = status.toLowerCase();
  if (key === 'critical') return 'danger';
  if (key === 'warning') return 'brand';
  if (key === 'normal') return 'success';
  return 'neutral';
}
