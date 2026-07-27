import * as FileSystem from 'expo-file-system/legacy';

import { apiClient, getApiBaseUrl } from '@/src/api/client';
import { getToken } from '@/src/api/storage';

export type FoundationAssetGroup = {
  id: string;
  plant_id: string;
  code: string;
  name: string;
};

export type FoundationAsset = {
  id: string;
  group_id: string;
  plant_id: string;
  department_id?: string | null;
  asset_no: string;
  name: string;
  status: string;
  life_counters: Record<string, number>;
  expected_life: Record<string, unknown>;
  remaining_life?: Record<string, unknown> | null;
  installation_date?: string | null;
  remarks?: string | null;
  last_inspection_at?: string | null;
  plc_tag_prefix?: string | null;
  group_code?: string | null;
  group_name?: string | null;
};

export type AssetEvent = {
  id: string;
  plant_id: string;
  asset_id?: string | null;
  event_type: string;
  source: string;
  occurred_at: string;
  payload: Record<string, unknown>;
};

export type AssetResponsibility = {
  id: string;
  asset_id: string;
  user_id: string;
  role_label: string;
  is_primary: boolean;
  user_name?: string | null;
};

/** GET /foundation/asset-groups */
export async function fetchFoundationAssetGroups(
  plantId?: string
): Promise<FoundationAssetGroup[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<FoundationAssetGroup[]>(`/foundation/asset-groups${q}`);
  return data;
}

/** GET /foundation/assets */
export async function fetchFoundationAssets(params?: {
  plant_id?: string;
  group_id?: string;
  department_id?: string;
  status?: string;
}): Promise<FoundationAsset[]> {
  const qs = new URLSearchParams();
  if (params?.plant_id) qs.set('plant_id', params.plant_id);
  if (params?.group_id) qs.set('group_id', params.group_id);
  if (params?.department_id) qs.set('department_id', params.department_id);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.get<FoundationAsset[]>(`/foundation/assets${q}`);
  return data;
}

/** POST /foundation/assets */
export async function createFoundationAsset(
  payload: Record<string, unknown>
): Promise<FoundationAsset> {
  const { data } = await apiClient.post<FoundationAsset>('/foundation/assets', payload);
  return data;
}

/** PATCH /foundation/assets/{assetId} */
export async function updateFoundationAsset(
  assetId: string,
  payload: Record<string, unknown>
): Promise<FoundationAsset> {
  const { data } = await apiClient.patch<FoundationAsset>(
    `/foundation/assets/${assetId}`,
    payload
  );
  return data;
}

/** GET /foundation/assets/{id}/events */
export async function fetchAssetEvents(assetId: string): Promise<AssetEvent[]> {
  const { data } = await apiClient.get<AssetEvent[]>(
    `/foundation/assets/${assetId}/events`
  );
  return data;
}

/** POST /foundation/assets/{id}/events */
export async function createAssetEvent(
  assetId: string,
  payload: { event_type: string; occurred_at: string; payload?: Record<string, unknown> }
): Promise<AssetEvent> {
  const { data } = await apiClient.post<AssetEvent>(
    `/foundation/assets/${assetId}/events`,
    payload
  );
  return data;
}

/** GET /foundation/assets/{id}/responsibilities */
export async function fetchAssetResponsibilities(
  assetId: string
): Promise<AssetResponsibility[]> {
  const { data } = await apiClient.get<AssetResponsibility[]>(
    `/foundation/assets/${assetId}/responsibilities`
  );
  return data;
}

/** POST /foundation/assets/{id}/responsibilities */
export async function addAssetResponsibility(
  assetId: string,
  payload: { user_id: string; role_label?: string; is_primary?: boolean }
): Promise<AssetResponsibility> {
  const { data } = await apiClient.post<AssetResponsibility>(
    `/foundation/assets/${assetId}/responsibilities`,
    payload
  );
  return data;
}

export function formatRemainingLife(
  remaining: Record<string, unknown> | null | undefined
): string {
  if (!remaining) return '—';
  const value = remaining.value;
  const unit = remaining.unit;
  if (value != null && unit != null) return `${value} ${unit}`;
  return '—';
}

// --- Masters (P5-FND-MASTERS) ---

export type MasterGrade = {
  id: string;
  organisation_id: string;
  code: string;
  description?: string | null;
};

export type MasterMaterial = {
  id: string;
  organisation_id: string;
  type: string;
  code: string;
  name: string;
};

export type MasterProduct = {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  department_id?: string | null;
  is_active: boolean;
};

export type MasterCustomer = {
  id: string;
  plant_id: string;
  name: string;
  code?: string | null;
  is_active: boolean;
};

export type MasterDelayCode = {
  id: string;
  plant_id: string;
  code: string;
  description: string;
  category: string;
  is_active?: boolean;
};

export type MasterContractor = {
  id: string;
  code: string;
  name: string;
  contact_person?: string | null;
};

/** GET /masters/grades */
export async function fetchMasterGrades(): Promise<MasterGrade[]> {
  const { data } = await apiClient.get<MasterGrade[]>('/masters/grades');
  return data;
}

/** POST /masters/grades */
export async function createMasterGrade(payload: {
  organisation_id: string;
  code: string;
  description?: string;
}): Promise<MasterGrade> {
  const { data } = await apiClient.post<MasterGrade>('/masters/grades', payload);
  return data;
}

/** GET /masters/materials */
export async function fetchMasterMaterials(): Promise<MasterMaterial[]> {
  const { data } = await apiClient.get<MasterMaterial[]>('/masters/materials');
  return data;
}

/** POST /masters/materials — `type` required (alloy|scrap) */
export async function createMasterMaterial(payload: {
  organisation_id: string;
  type: string;
  code: string;
  name: string;
}): Promise<MasterMaterial> {
  const { data } = await apiClient.post<MasterMaterial>('/masters/materials', payload);
  return data;
}

/** GET /masters/products */
export async function fetchMasterProducts(): Promise<MasterProduct[]> {
  const { data } = await apiClient.get<MasterProduct[]>('/masters/products');
  return data;
}

/** POST /masters/products */
export async function createMasterProduct(payload: {
  organisation_id: string;
  code: string;
  name: string;
  department_id?: string;
}): Promise<MasterProduct> {
  const { data } = await apiClient.post<MasterProduct>('/masters/products', payload);
  return data;
}

/** GET /masters/customers */
export async function fetchMasterCustomers(plantId?: string): Promise<MasterCustomer[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<MasterCustomer[]>(`/masters/customers${q}`);
  return data;
}

/** POST /masters/customers */
export async function createMasterCustomer(payload: {
  plant_id: string;
  name: string;
  code?: string;
}): Promise<MasterCustomer> {
  const { data } = await apiClient.post<MasterCustomer>('/masters/customers', payload);
  return data;
}

/** GET /masters/delay-codes */
export async function fetchMasterDelayCodes(plantId?: string): Promise<MasterDelayCode[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<MasterDelayCode[]>(`/masters/delay-codes${q}`);
  return data;
}

/** POST /masters/delay-codes — `category` required (equipment|process) */
export async function createMasterDelayCode(payload: {
  plant_id: string;
  code: string;
  description: string;
  category: string;
}): Promise<MasterDelayCode> {
  const { data } = await apiClient.post<MasterDelayCode>('/masters/delay-codes', payload);
  return data;
}

/** GET /masters/contractors — read-only */
export async function fetchMasterContractors(): Promise<MasterContractor[]> {
  const { data } = await apiClient.get<MasterContractor[]>('/masters/contractors');
  return data;
}

// --- Observations (P5-FND-OBS) ---

export type FoundationObservation = {
  id: string;
  plant_id: string;
  title?: string | null;
  description: string;
  department_id?: string | null;
  process_id?: string | null;
  category: string;
  severity: string;
  status: string;
  observed_by: string;
  observed_at: string;
  run_id?: string | null;
  asset_id?: string | null;
  maintenance_issue_id?: string | null;
};

/** GET /foundation/observations */
export async function fetchFoundationObservations(params?: {
  plant_id?: string;
  status?: string;
}): Promise<FoundationObservation[]> {
  const qs = new URLSearchParams();
  if (params?.plant_id) qs.set('plant_id', params.plant_id);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.get<FoundationObservation[]>(
    `/foundation/observations${q}`
  );
  return data;
}

/** POST /foundation/observations */
export async function createFoundationObservation(payload: {
  plant_id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  department_id?: string;
}): Promise<FoundationObservation> {
  const { data } = await apiClient.post<FoundationObservation>(
    '/foundation/observations',
    payload
  );
  return data;
}

// --- Corrective actions (P5-FND-CA) ---

export type FoundationCorrectiveAction = {
  id: string;
  observation_id: string;
  title: string;
  description?: string | null;
  assigned_to: string;
  assigned_by: string;
  due_date?: string | null;
  priority: string;
  status: string;
  closure_notes?: string | null;
  closed_at?: string | null;
  observation_title?: string | null;
};

/** GET /foundation/corrective-actions */
export async function fetchFoundationCorrectiveActions(params?: {
  plant_id?: string;
  status?: string;
}): Promise<FoundationCorrectiveAction[]> {
  const qs = new URLSearchParams();
  if (params?.plant_id) qs.set('plant_id', params.plant_id);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.get<FoundationCorrectiveAction[]>(
    `/foundation/corrective-actions${q}`
  );
  return data;
}

/** POST /foundation/observations/{observationId}/corrective-actions */
export async function createFoundationCorrectiveAction(
  observationId: string,
  payload: { title: string; assigned_to: string; due_date?: string }
): Promise<FoundationCorrectiveAction> {
  const { data } = await apiClient.post<FoundationCorrectiveAction>(
    `/foundation/observations/${observationId}/corrective-actions`,
    payload
  );
  return data;
}

/** PATCH /foundation/corrective-actions/{actionId} */
export async function updateFoundationCorrectiveAction(
  actionId: string,
  payload: { status?: string; closure_notes?: string }
): Promise<FoundationCorrectiveAction> {
  const { data } = await apiClient.patch<FoundationCorrectiveAction>(
    `/foundation/corrective-actions/${actionId}`,
    payload
  );
  return data;
}

// --- Documents (P5-FND-DOCS) ---

export type FoundationDocument = {
  id: string;
  plant_id: string;
  department_id: string;
  category: string;
  title: string;
  version: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  is_active: boolean;
  created_at: string;
  uploader_name?: string | null;
};

export type DocumentPick = {
  uri: string;
  name: string;
  mimeType: string;
};

/** GET /foundation/documents */
export async function fetchFoundationDocuments(params?: {
  plant_id?: string;
  department_id?: string;
  category?: string;
}): Promise<FoundationDocument[]> {
  const qs = new URLSearchParams();
  if (params?.plant_id) qs.set('plant_id', params.plant_id);
  if (params?.department_id) qs.set('department_id', params.department_id);
  if (params?.category) qs.set('category', params.category);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.get<FoundationDocument[]>(`/foundation/documents${q}`);
  return data;
}

/** POST /foundation/documents — multipart FormData */
export async function uploadFoundationDocument(input: {
  plant_id: string;
  department_id: string;
  category: string;
  title: string;
  version: string;
  file: DocumentPick;
}): Promise<FoundationDocument> {
  const token = await getToken();
  const form = new FormData();
  form.append('plant_id', input.plant_id);
  form.append('department_id', input.department_id);
  form.append('category', input.category);
  form.append('title', input.title);
  form.append('version', input.version);
  form.append('file', {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.mimeType,
  } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/foundation/documents`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
      typeof json === 'object' &&
      json &&
      'detail' in json &&
      typeof (json as { detail: unknown }).detail === 'string'
        ? (json as { detail: string }).detail
        : text || `Upload failed (${res.status})`;
    throw new Error(detail);
  }
  return json as FoundationDocument;
}

/** GET /foundation/documents/{docId}/download → local file URI for sharing */
export async function downloadFoundationDocument(
  docId: string,
  fileName: string
): Promise<string> {
  const token = await getToken();
  const safe = fileName.replace(/[^\w.\-]+/g, '_');
  const dest = `${FileSystem.cacheDirectory}fnd-doc-${docId}-${safe}`;
  const result = await FileSystem.downloadAsync(
    `${getApiBaseUrl()}/foundation/documents/${docId}/download`,
    dest,
    {
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  if (result.status !== 200) {
    throw new Error(`Download failed (${result.status})`);
  }
  return result.uri;
}

// --- KPI definitions (P5-FND-AN) ---

export type KpiDefinition = {
  id: string;
  code: string;
  name: string;
  formula: string;
  description?: string | null;
  department_id?: string | null;
  target_value?: number | null;
  frequency?: string | null;
  dimensions: string[];
  refresh_interval_minutes: number;
};

/** GET /foundation/kpi-definitions */
export async function fetchKpiDefinitions(): Promise<KpiDefinition[]> {
  const { data } = await apiClient.get<KpiDefinition[]>('/foundation/kpi-definitions');
  return data;
}

/** POST /foundation/kpi-definitions */
export async function createKpiDefinition(payload: {
  code: string;
  name: string;
  formula: string;
  target_value?: number;
  frequency?: string;
  department_id?: string;
}): Promise<KpiDefinition> {
  const { data } = await apiClient.post<KpiDefinition>('/foundation/kpi-definitions', payload);
  return data;
}
