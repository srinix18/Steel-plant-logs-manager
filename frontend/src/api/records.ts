import { apiClient } from './client';
import type { LogRecord } from '../types';

export async function fetchRecords(): Promise<LogRecord[]> {
  const { data } = await apiClient.get<LogRecord[]>('/records');
  return data;
}

export async function fetchRecord(id: string): Promise<LogRecord> {
  const { data } = await apiClient.get<LogRecord>(`/records/${id}`);
  return data;
}

export async function createRecord(payload: {
  template_id: string;
  status?: 'draft' | 'submitted';
  values: { field_id: string; value: unknown }[];
}): Promise<LogRecord> {
  const { data } = await apiClient.post<LogRecord>('/records', payload);
  return data;
}

export async function deleteRecord(id: string): Promise<void> {
  await apiClient.delete(`/records/${id}`);
}

export async function exportRecords(): Promise<Blob> {
  const { data } = await apiClient.get('/records/export', { responseType: 'blob' });
  return data;
}
