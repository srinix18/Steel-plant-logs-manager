export type UserRole = 'admin' | 'department' | 'member';

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'date'
  | 'boolean'
  | 'dropdown'
  | 'textarea';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Organisation {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organisation_id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldValidation {
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  options?: string[];
}

export interface TemplateField {
  id: string;
  template_id: string;
  name: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  placeholder?: string | null;
  default_value?: unknown;
  validation: FieldValidation;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  department_id: string;
  is_active: boolean;
  allow_member_create: boolean;
  created_at: string;
  updated_at: string;
  fields?: TemplateField[];
}

export interface RecordValue {
  id: string;
  field_id: string;
  field_name: string;
  value: unknown;
}

export interface Record {
  id: string;
  template_id: string;
  department_id: string;
  submitted_by: string;
  status: 'draft' | 'submitted';
  created_at: string;
  updated_at: string;
  values: RecordValue[];
}

export interface DashboardMetrics {
  total_organisations: number;
  total_users: number;
  total_departments: number;
  total_templates: number;
  total_records: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
