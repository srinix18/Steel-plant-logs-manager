import { apiClient } from './client';
import { fetchProcesses } from './platform';
import type { TemplateSummary, TemplateVersionDetail } from '../types';

export async function fetchTemplates(): Promise<TemplateSummary[]> {
  try {
    const { data } = await apiClient.get<TemplateSummary[]>('/templates');
    if (data.length > 0) return data;
  } catch {
    // Fall through to process-linked lookup when list route is unavailable.
  }
  return fetchTemplatesViaProcess();
}

async function fetchTemplatesViaProcess(): Promise<TemplateSummary[]> {
  const processes = await fetchProcesses();
  const withTemplate = processes.filter((p) => p.default_template_id);
  const templates: TemplateSummary[] = [];
  for (const proc of withTemplate) {
    const { data } = await apiClient.get<TemplateSummary>(`/templates/${proc.default_template_id}`);
    if (!templates.some((t) => t.id === data.id)) {
      templates.push(data);
    }
  }
  return templates.sort((a, b) => a.doc_no.localeCompare(b.doc_no));
}

export async function fetchTemplate(templateId: string): Promise<TemplateSummary> {
  const { data } = await apiClient.get<TemplateSummary>(`/templates/${templateId}`);
  return data;
}

export async function fetchTemplateVersion(versionId: string): Promise<TemplateVersionDetail> {
  const { data } = await apiClient.get<TemplateVersionDetail>(`/templates/versions/${versionId}`);
  return data;
}
