/** Process-run + template types for the mobile run host (P2-ENGINE-01). */

export type JsonObject = Record<string, unknown>;

export type TemplateField = {
  id: string;
  name: string;
  label: string;
  field_type: string;
  required: boolean;
  sort_order: number;
  config: JsonObject;
  formula?: string | null;
};

export type TemplateSection = {
  id: string;
  key: string;
  title: string;
  sort_order: number;
  section_type: string;
  config: JsonObject;
  fields: TemplateField[];
};

export type TemplateVersionDetail = {
  id: string;
  template_id: string;
  rev_no: string;
  status: string;
  effective_from?: string | null;
  published_at?: string | null;
  change_summary?: string | null;
  is_immutable: boolean;
  sections: TemplateSection[];
};

export type WorkflowTransition = {
  from_state: string;
  to_state: string;
  label: string;
  allowed_roles: string[];
  requires_approval?: boolean;
};

export type WorkflowStatus = {
  current_state: string;
  available_transitions: WorkflowTransition[];
  states: { key: string; label: string; is_terminal: boolean; color?: string }[];
};

export type ProcessRun = {
  id: string;
  run_number: string;
  run_type: string;
  process_instance_id: string;
  template_version_id: string;
  current_state: string;
  shift_id?: string | null;
  grade_id?: string | null;
  created_by?: string;
  started_at?: string | null;
  completed_at?: string | null;
  metadata?: JsonObject;
  created_at: string;
};

export type ProcessRunDetail = ProcessRun & {
  field_values: { field_key: string; value: unknown; source: string }[];
  section_data: { section_key: string; data: JsonObject }[];
  workflow?: WorkflowStatus;
};

export type OperationalEvent = {
  id: string;
  event_type: string;
  severity: string;
  occurred_at: string;
  source: string;
  payload: JsonObject;
};

export type RunRemarkAttachment = {
  id: string;
  remark_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type RunRemark = {
  id: string;
  run_id: string;
  author_id: string;
  body: string;
  role: string;
  parent_id?: string | null;
  created_at: string;
  author?: { id: string; full_name: string; employee_uid?: string | null };
  attachments: RunRemarkAttachment[];
};
