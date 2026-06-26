type JsonObject = { [key: string]: unknown };

export type UserRole =
  | 'super_admin'
  | 'ceo'
  | 'hr'
  | 'hod'
  | 'org_admin'
  | 'plant_admin'
  | 'supervisor'
  | 'worker'
  | 'maintenance'
  | 'maintenance_manager'
  | 'admin'
  | 'department'
  | 'member';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organisation_id?: string | null;
  plant_id?: string | null;
  department_id?: string | null;
  process_id?: string | null;
  maintenance_division?: string | null;
  is_active?: boolean;
  employee_uid?: string | null;
  phone?: string | null;
  designation?: string | null;
  date_of_joining?: string | null;
  employment_status?: EmploymentStatus | null;
  employment_type?: EmploymentType | null;
  manager_id?: string | null;
}

export type EmploymentStatus = 'active' | 'on_leave' | 'resigned' | 'terminated';
export type EmploymentType = 'permanent' | 'contract' | 'temporary';
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day';

export interface Contractor {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  is_active: boolean;
}

export interface ContractWorker {
  id: string;
  contractor_id: string;
  full_name: string;
  department_id: string;
  phone?: string | null;
  is_active: boolean;
  contractor_name?: string | null;
  department_code?: string | null;
}

export interface ShiftAssignment {
  id: string;
  user_id: string;
  department_id: string;
  shift_id: string;
  effective_date: string;
  user_name?: string | null;
  employee_uid?: string | null;
  department_code?: string | null;
  shift_code?: string | null;
}

export interface AttendanceRecord {
  id?: string | null;
  attendance_date: string;
  user_id: string;
  department_id: string;
  shift_id: string;
  status: AttendanceStatus;
  remarks?: string | null;
  marked_by_id: string;
  marked_at: string;
  user_name?: string | null;
}

export interface ContractorAttendance {
  id: string;
  attendance_date: string;
  contractor_id: string;
  department_id: string;
  shift_id: string;
  workers_present: number;
  workers_absent: number;
  remarks?: string | null;
  marked_by_id: string;
  marked_at: string;
  contractor_name?: string | null;
}

export interface ShiftHandoverNote {
  id: string;
  note_date: string;
  department_id: string;
  shift_id: string;
  author_id: string;
  note: string;
  created_at: string;
  author_name?: string | null;
  department_code?: string | null;
  shift_code?: string | null;
}

export interface DepartmentAttendanceSummary {
  department_id: string;
  department_code: string;
  department_name: string;
  expected: number;
  present: number;
  understaffed_by: number;
  contract_workers_present: number;
  contract_workers_absent: number;
}

export interface WorkforceDailySummary {
  attendance_date: string;
  employees_present: number;
  employees_absent: number;
  employees_expected: number;
  contract_workers_present: number;
  contract_workers_absent: number;
  departments_understaffed: string[];
  shift_notes_submitted: number;
  pending_shift_notes: number;
  departments: DepartmentAttendanceSummary[];
}

export interface WorkforceEmployeePayload {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  department_id?: string | null;
  process_id?: string | null;
  plant_id?: string | null;
  designation?: string | null;
  phone?: string | null;
  maintenance_division?: string | null;
  employment_status?: EmploymentStatus;
  date_of_joining?: string | null;
  employment_type?: EmploymentType;
  manager_id?: string | null;
}

export interface WorkforceEmployeeUpdatePayload {
  full_name?: string;
  role?: UserRole;
  department_id?: string | null;
  process_id?: string | null;
  plant_id?: string | null;
  designation?: string | null;
  phone?: string | null;
  is_active?: boolean;
  password?: string;
  maintenance_division?: string | null;
  employment_status?: EmploymentStatus;
  date_of_joining?: string | null;
  employment_type?: EmploymentType;
  manager_id?: string | null;
}

export interface WorkforceMeResponse {
  shift_assignment?: ShiftAssignment | null;
  recent_attendance: AttendanceRecord[];
}

export interface RunRemarkAttachment {
  id: string;
  remark_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface RunRemark {
  id: string;
  run_id: string;
  author_id: string;
  body: string;
  role: string;
  parent_id?: string | null;
  created_at: string;
  author?: { id: string; full_name: string; employee_uid?: string | null };
  attachments: RunRemarkAttachment[];
}

export interface Plant {
  id: string;
  organisation_id: string;
  name: string;
  code: string;
  timezone: string;
}

export interface Process {
  id: string;
  department_id: string;
  code: string;
  name: string;
  default_template_id?: string | null;
}

export interface ProcessInstance {
  id: string;
  process_id: string;
  asset_id: string;
  name: string;
  status: string;
}

export interface TemplateSection {
  id: string;
  key: string;
  title: string;
  sort_order: number;
  section_type: string;
  config: JsonObject;
  fields: TemplateField[];
}

export interface TemplateField {
  id: string;
  name: string;
  label: string;
  field_type: string;
  required: boolean;
  sort_order: number;
  config: JsonObject;
  formula?: string | null;
}

export interface TemplateVersionDetail {
  id: string;
  template_id: string;
  rev_no: string;
  status: string;
  effective_from?: string | null;
  published_at?: string | null;
  change_summary?: string | null;
  is_immutable: boolean;
  sections: TemplateSection[];
}

export interface WorkflowTransition {
  from_state: string;
  to_state: string;
  label: string;
  allowed_roles: string[];
  requires_approval?: boolean;
}

export interface WorkflowStatus {
  current_state: string;
  available_transitions: WorkflowTransition[];
  states: { key: string; label: string; is_terminal: boolean; color?: string }[];
}

export interface ProcessRun {
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
  metadata: JsonObject;
  created_at: string;
}

export interface ProcessRunDetail extends ProcessRun {
  field_values: { field_key: string; value: unknown; source: string }[];
  section_data: { section_key: string; data: JsonObject }[];
  workflow?: WorkflowStatus;
}

export interface OperationalEvent {
  id: string;
  event_type: string;
  severity: string;
  occurred_at: string;
  source: string;
  payload: JsonObject;
}

export interface Observation {
  id: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  observed_at: string;
}

export interface CorrectiveAction {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string;
  due_date?: string | null;
}

export interface DashboardMetrics {
  total_organisations: number;
  total_plants: number;
  active_runs: number;
  open_observations: number;
  open_corrective_actions: number;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface AppMessage {
  id: string;
  organisation_id: string;
  sender_id: string;
  subject: string;
  body: string;
  is_broadcast: boolean;
  created_at: string;
  sender?: { id: string; full_name: string; role: UserRole };
  attachments: MessageAttachment[];
  read_at?: string | null;
}

export interface AppNotification {
  id: string;
  message_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  notification_type: string;
  read_at?: string | null;
  created_at: string;
  message?: AppMessage | null;
  maintenance_issue?: {
    id: string;
    title: string;
    category: string;
    status: string;
    run_id?: string | null;
    closed_at?: string | null;
    resolution_notes?: string | null;
    closed_by_user?: { id: string; full_name: string };
    raised_by_user?: { id: string; full_name: string };
  } | null;
}

export interface OrgUserPayload {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  department_id?: string | null;
  process_id?: string | null;
  plant_id?: string | null;
  designation?: string | null;
  phone?: string | null;
  maintenance_division?: string | null;
}

export interface OrgUserUpdatePayload {
  full_name?: string;
  role?: UserRole;
  department_id?: string | null;
  process_id?: string | null;
  plant_id?: string | null;
  designation?: string | null;
  phone?: string | null;
  is_active?: boolean;
  password?: string;
  maintenance_division?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Shift {
  id: string;
  code: string;
  name: string;
}

export interface SteelGrade {
  id: string;
  code: string;
  description?: string | null;
}

export interface GradeElement {
  element: string;
  min_value: number;
  max_value: number;
}

export interface MaterialCatalogItem {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface ChemistryRow {
  element: string;
  min: number;
  max: number;
  samples: (number | null)[];
}

export interface ChemistrySectionData {
  rows: ChemistryRow[];
}

export interface MaterialRow {
  material: string;
  quantity_kg: number | null;
}

export interface MaterialSectionData {
  rows: MaterialRow[];
}

export interface StaticMaterialConfig {
  code: string;
  label: string;
}

export interface StaticMaterialSectionData {
  rows: MaterialRow[];
}

export interface MatrixColumnDef {
  key: string;
  label: string;
  group: string;
  type: string;
}

export interface BlowProcessRow {
  blow_no: string;
  values: Record<string, string | number | null>;
}

export interface BlowProcessSectionData {
  rows: BlowProcessRow[];
}

export interface TargetChemistrySectionData {
  targets: Record<string, number | null>;
}

export interface SampleChemistryRow {
  sample: string;
  temperature: number | null;
  elements: Record<string, number | null>;
}

export interface SampleChemistrySectionData {
  rows: SampleChemistryRow[];
}

export interface ProductionLogObjectField {
  key: string;
  label: string;
  type: string;
}

export interface ProductionLogColumnDef {
  key: string;
  label: string;
  type: string;
  group?: string;
  subtype?: string;
  fields?: ProductionLogObjectField[];
  zones?: string[];
  asset_group?: string;
  options?: string[];
  formula?: string;
}

export interface StrandPairValue {
  strand_1: string | number | null;
  strand_2: string | number | null;
}

export interface ZoneStrandValue {
  zone_1: StrandPairValue;
  zone_2: StrandPairValue;
}

export interface TimeRangeValue {
  start: string | null;
  end: string | null;
  total_minutes: number | null;
}

export interface MouldTubeStrandValue {
  no: string;
  life: string | number | null;
}

export interface MouldTubeValue {
  strand_1: MouldTubeStrandValue;
  strand_2: MouldTubeStrandValue;
}

export interface LadleTempValue {
  before_purging: number | null;
  after_purging: number | null;
}

export interface FurnaceZonesValue {
  heat_zone_1: number | null;
  heat_zone_2: number | null;
  soak_zone_1: number | null;
  soak_zone_2: number | null;
}

export interface HeatRefValue {
  run_id: string;
  heat_no: string;
}

export interface CoilRefValue {
  coil_id: string;
  coil_no: string;
}

export type ProductionLogCellValue =
  | string
  | number
  | null
  | StrandPairValue
  | ZoneStrandValue
  | TimeRangeValue
  | MouldTubeValue
  | LadleTempValue
  | FurnaceZonesValue
  | HeatRefValue
  | CoilRefValue;

export interface ProductionLogRow {
  values: Record<string, ProductionLogCellValue>;
}

export interface ProductionLogSectionData {
  rows: ProductionLogRow[];
}

export interface SectionRenderContext {
  gradeElements: GradeElement[];
  alloyMaterials: MaterialCatalogItem[];
  scrapMaterials: MaterialCatalogItem[];
  steelGrades?: SteelGrade[];
  plantUsers?: User[];
  plantId?: string;
  currentUserId?: string;
  currentUser?: User;
  runId?: string;
  runState?: string;
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onFieldNow?: (key: string) => void;
}

// Legacy types (deprecated pages)
export type FieldType = 'text' | 'number' | 'email' | 'date' | 'boolean' | 'dropdown' | 'textarea';

export interface Organisation {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface Department {
  id: string;
  plant_id: string;
  organisation_id: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface TemplateSummary {
  id: string;
  scope_type: string;
  scope_id: string;
  doc_no: string;
  name: string;
  versions: TemplateVersionSummary[];
}

export interface TemplateVersionSummary {
  id: string;
  template_id: string;
  rev_no: string;
  status: string;
  effective_from?: string | null;
  published_at?: string | null;
  change_summary?: string | null;
  is_immutable: boolean;
}

export interface FieldValidation {
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  options?: string[];
}

export interface LegacyTemplateField {
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
}

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  department_id: string;
  is_active: boolean;
  allow_member_create: boolean;
  fields?: LegacyTemplateField[];
}

export interface RecordValue {
  id: string;
  field_id: string;
  field_name: string;
  value: unknown;
}

export interface LogRecord {
  id: string;
  template_id: string;
  department_id: string;
  submitted_by: string;
  status: string;
  created_at: string;
  updated_at: string;
  values: RecordValue[];
}