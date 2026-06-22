import { apiClient } from './client';

export type IssueCategory = 'quality' | 'safety' | 'energy' | 'equipment' | 'process';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceIssueStatus = 'open' | 'in_progress' | 'closed';

export interface MaintenanceCategory {
  value: IssueCategory;
  label: string;
}

export interface MaintenanceIssue {
  id: string;
  organisation_id: string;
  plant_id: string;
  run_id?: string | null;
  asset_id?: string | null;
  category: IssueCategory;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: MaintenanceIssueStatus;
  raised_by: string;
  raised_at: string;
  assigned_to?: string | null;
  assigned_at?: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
  raised_by_user?: { id: string; full_name: string; email?: string; role?: string };
  assigned_to_user?: { id: string; full_name: string };
  closed_by_user?: { id: string; full_name: string };
}

export async function fetchMaintenanceCategories(): Promise<MaintenanceCategory[]> {
  const { data } = await apiClient.get<MaintenanceCategory[]>('/maintenance/categories');
  return data;
}

export async function createMaintenanceIssue(payload: {
  plant_id?: string;
  run_id?: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
}): Promise<MaintenanceIssue> {
  const { data } = await apiClient.post<MaintenanceIssue>('/maintenance/issues', payload);
  return data;
}

export async function fetchMaintenanceIssues(params?: {
  category?: IssueCategory;
  status?: MaintenanceIssueStatus;
  run_id?: string;
}): Promise<MaintenanceIssue[]> {
  const { data } = await apiClient.get<MaintenanceIssue[]>('/maintenance/issues', { params });
  return data;
}

export async function fetchMyMaintenanceIssues(status?: MaintenanceIssueStatus): Promise<MaintenanceIssue[]> {
  const { data } = await apiClient.get<MaintenanceIssue[]>('/maintenance/issues/mine', {
    params: status ? { status } : {},
  });
  return data;
}

export async function fetchRunMaintenanceIssues(runId: string): Promise<MaintenanceIssue[]> {
  const { data } = await apiClient.get<MaintenanceIssue[]>(`/process-runs/${runId}/maintenance-issues`);
  return data;
}

export async function fetchOpenMaintenanceCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/maintenance/issues/open-count');
  return data.count;
}

export async function assignMaintenanceIssue(issueId: string): Promise<MaintenanceIssue> {
  const { data } = await apiClient.post<MaintenanceIssue>(`/maintenance/issues/${issueId}/assign`);
  return data;
}

export async function closeMaintenanceIssue(issueId: string, resolution_notes: string): Promise<MaintenanceIssue> {
  const { data } = await apiClient.post<MaintenanceIssue>(`/maintenance/issues/${issueId}/close`, {
    resolution_notes,
  });
  return data;
}
