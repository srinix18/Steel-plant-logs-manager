import { apiClient } from './client';

export type MaintenanceProgramStatus = 'draft' | 'active' | 'inactive';
export type MaintenanceTriggerType =
  | 'time'
  | 'runtime_hours'
  | 'heat_count'
  | 'production_count'
  | 'tonnage'
  | 'manual'
  | 'condition';
export type MaintenanceWorkOrderStatus =
  | 'draft'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'waiting_shutdown'
  | 'waiting_parts'
  | 'completed'
  | 'verified'
  | 'closed';
export type MaintenanceTaskExecutionStatus = 'pending' | 'pass' | 'fail' | 'not_applicable';
export type DowntimeType = 'planned' | 'unplanned';

export interface MaintenanceProgram {
  id: string;
  organisation_id: string;
  plant_id: string;
  department_id?: string | null;
  asset_id?: string | null;
  asset_group_id?: string | null;
  name: string;
  description?: string | null;
  category: string;
  priority: string;
  responsible_team?: string | null;
  estimated_duration_min?: number | null;
  status: string;
  is_active: boolean;
  auto_generate_work_orders: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceTrigger {
  id: string;
  program_id: string;
  trigger_type: string;
  threshold_value?: number | null;
  interval_days?: number | null;
  last_fired_at?: string | null;
  next_due_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceTaskTemplate {
  id: string;
  program_id: string;
  name: string;
  description?: string | null;
  estimated_duration_min?: number | null;
  is_required: boolean;
  checklist: unknown[];
  photo_required: boolean;
  remarks_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceNotificationRule {
  id: string;
  program_id: string;
  offset_days: number;
  recipient_role: string;
  channel: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWorkOrderTask {
  id: string;
  work_order_id: string;
  template_id?: string | null;
  name: string;
  status: string;
  checklist_responses: Record<string, unknown>;
  photos: unknown[];
  remarks?: string | null;
  time_spent_min?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWorkOrderPart {
  id: string;
  work_order_id: string;
  part_name: string;
  material_id?: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWorkOrderTransition {
  id: string;
  work_order_id: string;
  from_state?: string | null;
  to_state: string;
  actor_id: string;
  notes?: string | null;
  created_at: string;
}

export interface MaintenanceDowntimeRecord {
  id: string;
  work_order_id: string;
  asset_id: string;
  started_at: string;
  ended_at?: string | null;
  duration_min?: number | null;
  reason?: string | null;
  downtime_type: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWorkOrder {
  id: string;
  organisation_id: string;
  plant_id: string;
  program_id?: string | null;
  asset_id?: string | null;
  department_id?: string | null;
  source_issue_id?: string | null;
  wo_number: string;
  title: string;
  status: string;
  assigned_team?: string | null;
  assigned_to?: string | null;
  scheduled_at?: string | null;
  due_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  verified_at?: string | null;
  closed_at?: string | null;
  estimated_duration_min?: number | null;
  created_at: string;
  updated_at: string;
  tasks: MaintenanceWorkOrderTask[];
  parts: MaintenanceWorkOrderPart[];
  transitions: MaintenanceWorkOrderTransition[];
  downtime_records: MaintenanceDowntimeRecord[];
}

export interface MaintenanceAnalytics {
  plant_id?: string | null;
  from_date?: string | null;
  to_date?: string | null;
  mtbf_hours?: number | null;
  mttr_hours?: number | null;
  pm_compliance_pct?: number | null;
  open_work_orders: number;
  overdue_work_orders: number;
  completed_work_orders: number;
  total_downtime_min: number;
  kpis: Record<string, unknown>;
}

export interface AssetMaintenanceHistoryEntry {
  id: string;
  entry_type: 'work_order' | 'issue' | 'downtime' | 'pm_due';
  title: string;
  status?: string | null;
  occurred_at: string;
  details?: Record<string, unknown>;
}

export interface AssetMaintenanceHistory {
  asset_id: string;
  last_pm_at?: string | null;
  next_pm_due_at?: string | null;
  total_maintenance_cost: number;
  entries: AssetMaintenanceHistoryEntry[];
}

export interface PmEvaluateResult {
  triggers_evaluated: number;
  notifications_sent: number;
  work_orders_generated: number;
}

// Programs
export async function fetchMaintenancePrograms(plantId?: string) {
  const { data } = await apiClient.get<MaintenanceProgram[]>('/maintenance/pm/programs', {
    params: plantId ? { plant_id: plantId } : undefined,
  });
  return data;
}

export interface MaintenanceProgramDetail {
  program: MaintenanceProgram;
  triggers: MaintenanceTrigger[];
  task_templates: MaintenanceTaskTemplate[];
  notification_rules: MaintenanceNotificationRule[];
}

export async function fetchMaintenanceProgramDetail(programId: string) {
  const { data } = await apiClient.get<MaintenanceProgramDetail>(
    `/maintenance/pm/programs/${programId}`
  );
  return data;
}

/** @deprecated use fetchMaintenanceProgramDetail — GET returns nested detail payload */
export async function fetchMaintenanceProgram(programId: string) {
  const detail = await fetchMaintenanceProgramDetail(programId);
  return detail.program;
}

export async function createMaintenanceProgram(payload: {
  plant_id: string;
  department_id?: string;
  asset_id?: string;
  asset_group_id?: string;
  name: string;
  description?: string;
  category: string;
  priority?: string;
  responsible_team?: string;
  estimated_duration_min?: number;
  status?: MaintenanceProgramStatus;
  is_active?: boolean;
  auto_generate_work_orders?: boolean;
}) {
  const { data } = await apiClient.post<MaintenanceProgram>('/maintenance/pm/programs', payload);
  return data;
}

export async function updateMaintenanceProgram(
  programId: string,
  payload: Partial<{
    name: string;
    description: string;
    category: string;
    priority: string;
    responsible_team: string;
    estimated_duration_min: number;
    status: MaintenanceProgramStatus;
    is_active: boolean;
    auto_generate_work_orders: boolean;
    department_id: string;
    asset_id: string;
    asset_group_id: string;
  }>
) {
  const { data } = await apiClient.patch<MaintenanceProgram>(
    `/maintenance/pm/programs/${programId}`,
    payload
  );
  return data;
}

// Triggers
export async function fetchProgramTriggers(programId: string) {
  const { data } = await apiClient.get<MaintenanceTrigger[]>(
    `/maintenance/pm/programs/${programId}/triggers`
  );
  return data;
}

export async function createProgramTrigger(
  programId: string,
  payload: {
    trigger_type: MaintenanceTriggerType;
    threshold_value?: number;
    interval_days?: number;
    is_active?: boolean;
  }
) {
  const { data } = await apiClient.post<MaintenanceTrigger>(
    `/maintenance/pm/programs/${programId}/triggers`,
    payload
  );
  return data;
}

export async function updateProgramTrigger(
  programId: string,
  triggerId: string,
  payload: Partial<{
    trigger_type: MaintenanceTriggerType;
    threshold_value: number;
    interval_days: number;
    is_active: boolean;
  }>
) {
  const { data } = await apiClient.patch<MaintenanceTrigger>(
    `/maintenance/pm/programs/${programId}/triggers/${triggerId}`,
    payload
  );
  return data;
}

export async function deleteProgramTrigger(programId: string, triggerId: string) {
  await apiClient.delete(`/maintenance/pm/programs/${programId}/triggers/${triggerId}`);
}

// Task templates
export async function fetchProgramTaskTemplates(programId: string) {
  const { data } = await apiClient.get<MaintenanceTaskTemplate[]>(
    `/maintenance/pm/programs/${programId}/tasks`
  );
  return data;
}

export async function createProgramTaskTemplate(
  programId: string,
  payload: {
    name: string;
    description?: string;
    estimated_duration_min?: number;
    is_required?: boolean;
    checklist?: unknown[];
    photo_required?: boolean;
    remarks_required?: boolean;
    sort_order?: number;
  }
) {
  const { data } = await apiClient.post<MaintenanceTaskTemplate>(
    `/maintenance/pm/programs/${programId}/tasks`,
    payload
  );
  return data;
}

export async function updateProgramTaskTemplate(
  programId: string,
  taskId: string,
  payload: Partial<{
    name: string;
    description: string;
    estimated_duration_min: number;
    is_required: boolean;
    checklist: unknown[];
    photo_required: boolean;
    remarks_required: boolean;
    sort_order: number;
  }>
) {
  const { data } = await apiClient.patch<MaintenanceTaskTemplate>(
    `/maintenance/pm/programs/${programId}/tasks/${taskId}`,
    payload
  );
  return data;
}

export async function deleteProgramTaskTemplate(programId: string, taskId: string) {
  await apiClient.delete(`/maintenance/pm/programs/${programId}/tasks/${taskId}`);
}

// Notification rules
export async function fetchProgramNotificationRules(programId: string) {
  const { data } = await apiClient.get<MaintenanceNotificationRule[]>(
    `/maintenance/pm/programs/${programId}/notifications`
  );
  return data;
}

export async function createProgramNotificationRule(
  programId: string,
  payload: {
    offset_days?: number;
    recipient_role: string;
    channel?: string;
    is_active?: boolean;
  }
) {
  const { data } = await apiClient.post<MaintenanceNotificationRule>(
    `/maintenance/pm/programs/${programId}/notifications`,
    payload
  );
  return data;
}

export async function deleteProgramNotificationRule(programId: string, ruleId: string) {
  await apiClient.delete(`/maintenance/pm/programs/${programId}/notifications/${ruleId}`);
}

// Work orders
export async function fetchWorkOrders(params?: {
  plant_id?: string;
  status?: MaintenanceWorkOrderStatus;
  assigned_to?: string;
}) {
  const { data } = await apiClient.get<MaintenanceWorkOrder[]>('/maintenance/pm/work-orders', {
    params,
  });
  return data;
}

export async function fetchWorkOrder(workOrderId: string) {
  const { data } = await apiClient.get<MaintenanceWorkOrder>(
    `/maintenance/pm/work-orders/${workOrderId}`
  );
  return data;
}

export async function createWorkOrder(payload: {
  plant_id: string;
  program_id?: string;
  asset_id?: string;
  department_id?: string;
  source_issue_id?: string;
  title: string;
  assigned_team?: string;
  assigned_to?: string;
  scheduled_at?: string;
  due_at?: string;
  estimated_duration_min?: number;
}) {
  const { data } = await apiClient.post<MaintenanceWorkOrder>('/maintenance/pm/work-orders', payload);
  return data;
}

export async function transitionWorkOrder(
  workOrderId: string,
  payload: { to_state: MaintenanceWorkOrderStatus; notes?: string }
) {
  const { data } = await apiClient.post<MaintenanceWorkOrder>(
    `/maintenance/pm/work-orders/${workOrderId}/transition`,
    payload
  );
  return data;
}

export async function executeWorkOrderTask(
  workOrderId: string,
  taskId: string,
  payload: {
    status: MaintenanceTaskExecutionStatus;
    checklist_responses?: Record<string, unknown>;
    photos?: unknown[];
    remarks?: string;
    time_spent_min?: number;
  }
) {
  const { data } = await apiClient.post<MaintenanceWorkOrderTask>(
    `/maintenance/pm/work-orders/${workOrderId}/tasks/${taskId}/execute`,
    payload
  );
  return data;
}

// Analytics & evaluate
export async function fetchMaintenanceAnalytics(params?: {
  plant_id?: string;
  from_date?: string;
  to_date?: string;
}) {
  const { data } = await apiClient.get<MaintenanceAnalytics>('/maintenance/pm/analytics', { params });
  return data;
}

export async function evaluatePmTriggers(options?: { plantId?: string; force?: boolean }) {
  const { data } = await apiClient.post<PmEvaluateResult>('/maintenance/pm/evaluate', null, {
    params: {
      ...(options?.plantId ? { plant_id: options.plantId } : {}),
      ...(options?.force ? { force: true } : {}),
    },
  });
  return data;
}

export async function generateWorkOrderFromProgram(programId: string) {
  const { data } = await apiClient.post<MaintenanceWorkOrder>(
    `/maintenance/pm/programs/${programId}/generate-work-order`
  );
  return data;
}

export async function fetchAssetMaintenanceHistory(assetId: string) {
  const { data } = await apiClient.get<AssetMaintenanceHistory>(
    `/foundation/assets/${assetId}/maintenance-history`
  );
  return data;
}

export const WO_STATUS_LABELS: Record<MaintenanceWorkOrderStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  waiting_shutdown: 'Waiting Shutdown',
  waiting_parts: 'Waiting Parts',
  completed: 'Completed',
  verified: 'Verified',
  closed: 'Closed',
};

export const TRIGGER_TYPE_LABELS: Record<MaintenanceTriggerType, string> = {
  time: 'Calendar time',
  runtime_hours: 'Runtime hours',
  heat_count: 'Heat count',
  production_count: 'Production count',
  tonnage: 'Tonnage',
  manual: 'Manual only',
  condition: 'Condition',
};
