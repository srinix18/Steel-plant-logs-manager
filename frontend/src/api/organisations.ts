import { apiClient } from './client';
import type { Organisation } from '../types';

export async function fetchOrganisations(): Promise<Organisation[]> {
  const { data } = await apiClient.get<Organisation[]>('/organisations');
  return data;
}

export async function createOrganisation(payload: { name: string; description?: string }): Promise<Organisation> {
  const { data } = await apiClient.post<Organisation>('/organisations', payload);
  return data;
}

export async function updateOrganisation(
  id: string,
  payload: { name?: string; description?: string },
): Promise<Organisation> {
  const { data } = await apiClient.put<Organisation>(`/organisations/${id}`, payload);
  return data;
}

export async function deleteOrganisation(id: string): Promise<void> {
  await apiClient.delete(`/organisations/${id}`);
}
