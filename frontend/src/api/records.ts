import { apiClient } from './client';
import type { Record } from '../types';

export async function fetchRecords(): Promise<Record[]> {
  const { data } = await apiClient.get<Record[]>('/records');
  return data;
}

export async function fetchRecord(id: string): Promise<Record> {
  const { data } = await apiClient.get<Record>(`/records/${id}`);
  return data;
}

export async function createRecord(payload: {
  template_id: string;
  status?: 'draft' | 'submitted';
  values: { field_id: string; value: unknown }[];
}): Promise<Record> {
  const { data } = await apiClient.post<Record>('/records', payload);
  return data;
}

export async function deleteRecord(id: string): Promise<void> {
  await apiClient.delete(`/records/${id}`);
}

export async function exportRecords(): Promise<Blob> {
  const { data } = await apiClient.get('/records/export', { responseType: 'blob' });
  return data;
}
