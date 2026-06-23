import { apiClient } from './client';

export interface Customer {
  id: string;
  plant_id: string;
  name: string;
  code?: string | null;
  is_active: boolean;
}

export async function fetchCustomers(plantId: string): Promise<Customer[]> {
  const { data } = await apiClient.get<Customer[]>('/customers', {
    params: { plant_id: plantId },
  });
  return data;
}
