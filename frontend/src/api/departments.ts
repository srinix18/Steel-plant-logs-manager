import { apiClient } from './client';
import type { Department } from '../types';

export async function fetchDepartments(organisationId?: string): Promise<Department[]> {
  const params = organisationId ? { organisation_id: organisationId } : undefined;
  const { data } = await apiClient.get<Department[]>('/departments', { params });
  return data;
}

export async function createDepartment(payload: {
  organisation_id: string;
  name: string;
  description?: string;
}): Promise<Department> {
  const { data } = await apiClient.post<Department>('/departments', payload);
  return data;
}

export async function updateDepartment(
  id: string,
  payload: { organisation_id?: string; name?: string; description?: string },
): Promise<Department> {
  const { data } = await apiClient.put<Department>(`/departments/${id}`, payload);
  return data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await apiClient.delete(`/departments/${id}`);
}
