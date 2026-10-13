import * as FileSystem from 'expo-file-system/legacy';

import { apiClient, getApiBaseUrl } from '@/src/api/client';
import { getToken } from '@/src/api/storage';

export type ImportRow = {
  id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  status: string;
  errors: string[];
  entity_id?: string | null;
};

export type ImportJob = { id: string; file_name: string; status: string; summary: Record<string, unknown> };

export type ImportValidation = { job: ImportJob; valid_count: number; invalid_count: number; rows: ImportRow[] };
export type ImportCommit = { job: ImportJob; imported: number; failed: number; skipped: number };

export type ImportFilePick = { uri: string; name: string; mimeType: string };

/** GET /imports/{module}/template → local file URI (shared so HR can open it in Excel). */
export async function downloadImportTemplate(moduleKey: string, fileName: string): Promise<string> {
  const token = await getToken();
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  const result = await FileSystem.downloadAsync(`${getApiBaseUrl()}/imports/${moduleKey}/template`, dest, {
    headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (result.status !== 200) {
    throw new Error(`Could not download the template (${result.status})`);
  }
  return result.uri;
}

/** POST /imports/{module}/upload — multipart */
export async function uploadImportFile(moduleKey: string, file: ImportFilePick): Promise<ImportJob> {
  const token = await getToken();
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const res = await fetch(`${getApiBaseUrl()}/imports/${moduleKey}/upload`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const detail =
      typeof json === 'object' && json && 'detail' in json && typeof (json as { detail: unknown }).detail === 'string'
        ? (json as { detail: string }).detail
        : text || `Upload failed (${res.status})`;
    throw new Error(detail);
  }
  return json as ImportJob;
}

/** Reads the file, then checks every row; nothing is created yet. */
export async function previewAndValidate(jobId: string): Promise<ImportValidation> {
  await apiClient.post(`/imports/jobs/${jobId}/preview`);
  const { data } = await apiClient.post<ImportValidation>(`/imports/jobs/${jobId}/validate`);
  return data;
}

/** Creates the rows that passed validation. */
export async function commitImport(jobId: string): Promise<ImportCommit> {
  const { data } = await apiClient.post<ImportCommit>(`/imports/jobs/${jobId}/commit`);
  return data;
}
