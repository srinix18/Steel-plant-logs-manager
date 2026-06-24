import { apiClient } from './client';

export interface AssetGroup {
  id: string;
  plant_id: string;
  code: string;
  name: string;
}

export interface FoundationAsset {
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
}

export interface AssetEvent {
  id: string;
  plant_id: string;
  asset_id?: string | null;
  event_type: string;
  source: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface AssetResponsibility {
  id: string;
  asset_id: string;
  user_id: string;
  role_label: string;
  is_primary: boolean;
  user_name?: string | null;
}

export interface ProductMaster {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  department_id?: string | null;
  is_active: boolean;
}

export interface CustomerMaster {
  id: string;
  plant_id: string;
  name: string;
  code?: string | null;
  is_active: boolean;
}

export interface DelayCodeMaster {
  id: string;
  plant_id: string;
  code: string;
  description: string;
  category: string;
  is_active: boolean;
}

export interface FoundationObservation {
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
}

export interface FoundationCorrectiveAction {
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
}

export interface DepartmentDocument {
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
}

export interface KpiDefinitionAdmin {
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
}

export interface ApprovalRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  user_id: string;
  comments?: string | null;
  created_at: string;
  user_name?: string | null;
}

// Masters
export async function fetchMasterGrades() {
  const { data } = await apiClient.get('/masters/grades');
  return data;
}

export async function createMasterGrade(payload: { organisation_id: string; code: string; description?: string }) {
  const { data } = await apiClient.post('/masters/grades', payload);
  return data;
}

export async function fetchMasterMaterials() {
  const { data } = await apiClient.get('/masters/materials');
  return data;
}

export async function createMasterMaterial(payload: {
  organisation_id: string;
  type: string;
  code: string;
  name: string;
}) {
  const { data } = await apiClient.post('/masters/materials', payload);
  return data;
}

export async function fetchMasterProducts(): Promise<ProductMaster[]> {
  const { data } = await apiClient.get<ProductMaster[]>('/masters/products');
  return data;
}

export async function createMasterProduct(payload: {
  organisation_id: string;
  code: string;
  name: string;
  department_id?: string;
}) {
  const { data } = await apiClient.post('/masters/products', payload);
  return data;
}

export async function fetchMasterCustomers(plantId?: string): Promise<CustomerMaster[]> {
  const { data } = await apiClient.get<CustomerMaster[]>('/masters/customers', { params: { plant_id: plantId } });
  return data;
}

export async function createMasterCustomer(payload: { plant_id: string; name: string; code?: string }) {
  const { data } = await apiClient.post('/masters/customers', payload);
  return data;
}

export async function fetchMasterDelayCodes(plantId?: string): Promise<DelayCodeMaster[]> {
  const { data } = await apiClient.get<DelayCodeMaster[]>('/masters/delay-codes', { params: { plant_id: plantId } });
  return data;
}

export async function createMasterDelayCode(payload: {
  plant_id: string;
  code: string;
  description: string;
  category: string;
}) {
  const { data } = await apiClient.post('/masters/delay-codes', payload);
  return data;
}

export async function fetchMasterContractors() {
  const { data } = await apiClient.get('/masters/contractors');
  return data;
}

// Assets
export async function fetchAssetGroups(plantId?: string): Promise<AssetGroup[]> {
  const { data } = await apiClient.get<AssetGroup[]>('/foundation/asset-groups', { params: { plant_id: plantId } });
  return data;
}

export async function fetchFoundationAssets(params?: {
  plant_id?: string;
  group_id?: string;
  department_id?: string;
  status?: string;
}): Promise<FoundationAsset[]> {
  const { data } = await apiClient.get<FoundationAsset[]>('/foundation/assets', { params });
  return data;
}

export async function createFoundationAsset(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/foundation/assets', payload);
  return data;
}

export async function updateFoundationAsset(assetId: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/foundation/assets/${assetId}`, payload);
  return data;
}

export async function fetchAssetEvents(assetId: string): Promise<AssetEvent[]> {
  const { data } = await apiClient.get<AssetEvent[]>(`/foundation/assets/${assetId}/events`);
  return data;
}

export async function createAssetEvent(assetId: string, payload: { event_type: string; occurred_at: string; payload?: Record<string, unknown> }) {
  const { data } = await apiClient.post(`/foundation/assets/${assetId}/events`, payload);
  return data;
}

export async function fetchAssetResponsibilities(assetId: string): Promise<AssetResponsibility[]> {
  const { data } = await apiClient.get<AssetResponsibility[]>(`/foundation/assets/${assetId}/responsibilities`);
  return data;
}

export async function addAssetResponsibility(assetId: string, payload: { user_id: string; role_label?: string; is_primary?: boolean }) {
  const { data } = await apiClient.post(`/foundation/assets/${assetId}/responsibilities`, payload);
  return data;
}

// Observations
export async function fetchFoundationObservations(params?: { plant_id?: string; status?: string }): Promise<FoundationObservation[]> {
  const { data } = await apiClient.get<FoundationObservation[]>('/foundation/observations', { params });
  return data;
}

export async function createFoundationObservation(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/foundation/observations', payload);
  return data;
}

export async function fetchFoundationCorrectiveActions(params?: { plant_id?: string; status?: string }): Promise<FoundationCorrectiveAction[]> {
  const { data } = await apiClient.get<FoundationCorrectiveAction[]>('/foundation/corrective-actions', { params });
  return data;
}

export async function createFoundationCorrectiveAction(observationId: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.post(`/foundation/observations/${observationId}/corrective-actions`, payload);
  return data;
}

export async function updateFoundationCorrectiveAction(actionId: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/foundation/corrective-actions/${actionId}`, payload);
  return data;
}

// Documents
export async function fetchFoundationDocuments(params?: {
  plant_id?: string;
  department_id?: string;
  category?: string;
}): Promise<DepartmentDocument[]> {
  const { data } = await apiClient.get<DepartmentDocument[]>('/foundation/documents', { params });
  return data;
}

export async function uploadFoundationDocument(form: FormData) {
  const { data } = await apiClient.post('/foundation/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function downloadFoundationDocument(docId: string, fileName: string) {
  const { data } = await apiClient.get(`/foundation/documents/${docId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// KPI
export async function fetchKpiDefinitionsAdmin(): Promise<KpiDefinitionAdmin[]> {
  const { data } = await apiClient.get<KpiDefinitionAdmin[]>('/foundation/kpi-definitions');
  return data;
}

export async function createKpiDefinition(payload: Record<string, unknown>) {
  const { data } = await apiClient.post('/foundation/kpi-definitions', payload);
  return data;
}

export async function updateKpiDefinition(kpiId: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/foundation/kpi-definitions/${kpiId}`, payload);
  return data;
}

// Approvals
export async function fetchApprovalRecords(entityType: string, entityId: string): Promise<ApprovalRecord[]> {
  const { data } = await apiClient.get<ApprovalRecord[]>(`/foundation/approvals/${entityType}/${entityId}`);
  return data;
}

export async function transitionApproval(entityType: string, entityId: string, payload: { action: string; comments?: string }) {
  const { data } = await apiClient.post(`/foundation/approvals/${entityType}/${entityId}/transition`, payload);
  return data;
}
