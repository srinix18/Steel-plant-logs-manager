import { apiClient } from './client';

export type ImportJobStatus = 'uploaded' | 'previewed' | 'validated' | 'committed' | 'failed';
export type ImportRowStatus = 'pending' | 'valid' | 'invalid' | 'imported' | 'skipped';

export interface ImportJob {
  id: string;
  module_key: string;
  file_name: string;
  status: ImportJobStatus;
  summary: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface ImportJobRow {
  id: string;
  job_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  status: ImportRowStatus;
  errors: unknown[];
  entity_id?: string | null;
}

export interface ImportPreview {
  job: ImportJob;
  rows: ImportJobRow[];
  columns: string[];
  total_rows: number;
}

export interface ImportValidationResult {
  job: ImportJob;
  valid_count: number;
  invalid_count: number;
  rows: ImportJobRow[];
}

export interface ImportCommitResult {
  job: ImportJob;
  imported: number;
  failed: number;
  skipped: number;
}

export async function listImportModules(): Promise<string[]> {
  const { data } = await apiClient.get<{ modules: string[] }>('/imports/modules');
  return data.modules;
}

export async function downloadImportTemplate(moduleKey: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/imports/${moduleKey}/template`, {
    responseType: 'blob',
  });
  return data;
}

export async function uploadImportFile(moduleKey: string, file: File): Promise<ImportJob> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<ImportJob>(`/imports/${moduleKey}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchImportPreview(jobId: string): Promise<ImportPreview> {
  const { data } = await apiClient.post<ImportPreview>(`/imports/jobs/${jobId}/preview`);
  return data;
}

export async function validateImportJob(jobId: string): Promise<ImportValidationResult> {
  const { data } = await apiClient.post<ImportValidationResult>(`/imports/jobs/${jobId}/validate`);
  return data;
}

export async function commitImportJob(jobId: string): Promise<ImportCommitResult> {
  const { data } = await apiClient.post<ImportCommitResult>(`/imports/jobs/${jobId}/commit`);
  return data;
}

export async function downloadImportErrorReport(jobId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/imports/jobs/${jobId}/errors`, {
    responseType: 'blob',
  });
  return data;
}

export function triggerTemplateDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
