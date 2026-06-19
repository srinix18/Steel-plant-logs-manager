import { apiClient } from './client';
import type { Template, TemplateField, FieldType } from '../types';

export async function fetchTemplates(): Promise<Template[]> {
  const { data } = await apiClient.get<Template[]>('/templates');
  return data;
}

export async function fetchTemplate(id: string): Promise<Template> {
  const { data } = await apiClient.get<Template>(`/templates/${id}`);
  return data;
}

export async function createTemplate(payload: {
  name: string;
  description?: string;
  department_id: string;
  is_active?: boolean;
  allow_member_create?: boolean;
}): Promise<Template> {
  const { data } = await apiClient.post<Template>('/templates', payload);
  return data;
}

export async function updateTemplate(id: string, payload: Partial<Template>): Promise<Template> {
  const { data } = await apiClient.put<Template>(`/templates/${id}`, payload);
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient.delete(`/templates/${id}`);
}

export async function addTemplateField(
  templateId: string,
  payload: {
    name: string;
    label: string;
    field_type: FieldType;
    required?: boolean;
    placeholder?: string;
    default_value?: unknown;
    validation?: Record<string, unknown>;
    sort_order?: number;
  }
): Promise<TemplateField> {
  const { data } = await apiClient.post<TemplateField>(`/templates/${templateId}/fields`, payload);
  return data;
}

export async function deleteTemplateField(templateId: string, fieldId: string): Promise<void> {
  await apiClient.delete(`/templates/${templateId}/fields/${fieldId}`);
}
