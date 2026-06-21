import { apiClient } from './client';
import type { ProcessRun, ProcessRunDetail, TemplateVersionDetail } from '../types';

export async function fetchAllRuns(params?: {
  plant_id?: string;
  organisation_id?: string;
  department_id?: string;
  process_id?: string;
  process_code?: string;
  active_only?: boolean;
  state?: string;
}): Promise<ProcessRun[]> {
  const { data } = await apiClient.get<ProcessRun[]>('/process-runs', { params });
  return data;
}

export async function fetchTemplateVersion(versionId: string): Promise<TemplateVersionDetail> {
  const { data } = await apiClient.get<TemplateVersionDetail>(`/templates/versions/${versionId}`);
  return data;
}

export async function createProcessRun(
  instanceId: string,
  payload: { run_type?: string; shift_id?: string; grade_id?: string; run_number?: string },
): Promise<ProcessRunDetail> {
  const { data } = await apiClient.post<ProcessRunDetail>(`/process-instances/${instanceId}/runs`, payload);
  return data;
}

export async function fetchProcessRun(runId: string): Promise<ProcessRunDetail> {
  const { data } = await apiClient.get<ProcessRunDetail>(`/process-runs/${runId}`);
  return data;
}

export async function updateProcessRun(
  runId: string,
  payload: {
    field_values?: { field_key: string; value: unknown }[];
    section_data?: { section_key: string; data: unknown }[];
  },
): Promise<ProcessRunDetail> {
  const { data } = await apiClient.patch<ProcessRunDetail>(`/process-runs/${runId}`, payload);
  return data;
}

export async function transitionProcessRun(
  runId: string,
  toState: string,
  notes?: string,
): Promise<ProcessRunDetail> {
  const { data } = await apiClient.post<ProcessRunDetail>(`/process-runs/${runId}/transitions`, {
    to_state: toState,
    notes,
  });
  return data;
}

export async function fetchActiveRuns(plantId: string): Promise<ProcessRun[]> {
  const { data } = await apiClient.get<ProcessRun[]>(`/plants/${plantId}/runs/active`);
  return data;
}

export async function fetchInstanceRuns(instanceId: string, activeOnly = false): Promise<ProcessRun[]> {
  const { data } = await apiClient.get<ProcessRun[]>(`/process-instances/${instanceId}/runs`, {
    params: { active_only: activeOnly },
  });
  return data;
}

export async function fetchRunEvents(runId: string) {
  const { data } = await apiClient.get(`/process-runs/${runId}/events`);
  return data;
}
