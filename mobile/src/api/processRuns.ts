import { apiClient } from '@/src/api/client';
import { fetchProcesses } from '@/src/api/lookups';
import type {
  OperationalEvent,
  ProcessRun,
  ProcessRunDetail,
  RunRemark,
  TemplateDetail,
  TemplateVersionDetail,
} from '@/src/types/processRun';

export async function fetchMyRuns(): Promise<ProcessRun[]> {
  const { data } = await apiClient.get<ProcessRun[]>('/process-runs/mine');
  return data;
}

export async function fetchAllRuns(params?: {
  plant_id?: string;
  organisation_id?: string;
  department_id?: string;
  process_id?: string;
  process_code?: string;
  active_only?: boolean;
  state?: string;
  created_by?: string;
}): Promise<ProcessRun[]> {
  const qs = new URLSearchParams();
  if (params?.plant_id) qs.set('plant_id', params.plant_id);
  if (params?.organisation_id) qs.set('organisation_id', params.organisation_id);
  if (params?.department_id) qs.set('department_id', params.department_id);
  if (params?.process_id) qs.set('process_id', params.process_id);
  if (params?.process_code) qs.set('process_code', params.process_code);
  if (params?.active_only != null) qs.set('active_only', String(params.active_only));
  if (params?.state) qs.set('state', params.state);
  if (params?.created_by) qs.set('created_by', params.created_by);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.get<ProcessRun[]>(`/process-runs${q}`);
  return data;
}

export async function fetchProcessRun(runId: string): Promise<ProcessRunDetail> {
  const { data } = await apiClient.get<ProcessRunDetail>(`/process-runs/${runId}`);
  return data;
}

/**
 * GET /templates (platform admin). Falls back to process-linked templates
 * when list is forbidden/empty — same pattern as web CostMappingBuilder.
 */
export async function fetchTemplates(): Promise<TemplateDetail[]> {
  try {
    const { data } = await apiClient.get<TemplateDetail[]>('/templates');
    if (data.length > 0) return data;
  } catch {
    // Fall through when list route requires AdminUser.
  }
  return fetchTemplatesViaProcess();
}

async function fetchTemplatesViaProcess(): Promise<TemplateDetail[]> {
  const processes = await fetchProcesses();
  const withTemplate = processes.filter((p) => p.default_template_id);
  const templates: TemplateDetail[] = [];
  for (const proc of withTemplate) {
    const { data } = await apiClient.get<TemplateDetail>(
      `/templates/${proc.default_template_id}`
    );
    if (!templates.some((t) => t.id === data.id)) {
      templates.push(data);
    }
  }
  return templates.sort((a, b) => a.doc_no.localeCompare(b.doc_no));
}

export async function fetchTemplate(templateId: string): Promise<TemplateDetail> {
  const { data } = await apiClient.get<TemplateDetail>(`/templates/${templateId}`);
  return data;
}

export async function fetchTemplateVersion(versionId: string): Promise<TemplateVersionDetail> {
  const { data } = await apiClient.get<TemplateVersionDetail>(`/templates/versions/${versionId}`);
  return data;
}

export async function updateProcessRun(
  runId: string,
  payload: {
    field_values?: { field_key: string; value: unknown }[];
    section_data?: { section_key: string; data: unknown }[];
  }
): Promise<ProcessRunDetail> {
  const { data } = await apiClient.patch<ProcessRunDetail>(`/process-runs/${runId}`, payload);
  return data;
}

export async function transitionProcessRun(
  runId: string,
  toState: string,
  notes?: string
): Promise<ProcessRunDetail> {
  const { data } = await apiClient.post<ProcessRunDetail>(`/process-runs/${runId}/transitions`, {
    to_state: toState,
    notes,
  });
  return data;
}

export async function createProcessRun(
  instanceId: string,
  payload: {
    run_type?: string;
    shift_id?: string;
    grade_id?: string;
    run_number?: string;
  }
): Promise<ProcessRunDetail> {
  const { data } = await apiClient.post<ProcessRunDetail>(
    `/process-instances/${instanceId}/runs`,
    payload
  );
  return data;
}

export async function fetchActiveRuns(plantId: string): Promise<ProcessRun[]> {
  const { data } = await apiClient.get<ProcessRun[]>(`/plants/${plantId}/runs/active`);
  return data;
}

export async function fetchRunEvents(runId: string): Promise<OperationalEvent[]> {
  const { data } = await apiClient.get<OperationalEvent[]>(`/process-runs/${runId}/events`);
  return data;
}

export async function fetchRunRemarks(runId: string): Promise<RunRemark[]> {
  const { data } = await apiClient.get<RunRemark[]>(`/process-runs/${runId}/remarks`);
  return data;
}

export async function createRunRemark(runId: string, body: string): Promise<RunRemark> {
  const { data } = await apiClient.post<RunRemark>(`/process-runs/${runId}/remarks`, { body });
  return data;
}

export async function replyToRunRemark(
  runId: string,
  parentId: string,
  body: string
): Promise<RunRemark> {
  const { data } = await apiClient.post<RunRemark>(
    `/process-runs/${runId}/remarks/${parentId}/reply`,
    { body }
  );
  return data;
}
