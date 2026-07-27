import { apiClient } from '@/src/api/client';

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

export type MaintenanceWorkOrderTask = {
  id: string;
  work_order_id: string;
  template_id?: string | null;
  name: string;
  status: string;
  /** Present when API/template embeds checklist items on the task. */
  checklist?: { key?: string; label?: string; type?: string }[];
  checklist_responses?: Record<string, unknown>;
  photos?: unknown[];
  remarks?: string | null;
  time_spent_min?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MaintenanceWorkOrder = {
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
};

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

/** Mirrors backend `_VALID_TRANSITIONS` in pm_work_order_service.py */
export const WO_ALLOWED_TRANSITIONS: Record<string, MaintenanceWorkOrderStatus[]> = {
  draft: ['assigned'],
  assigned: ['accepted', 'draft'],
  accepted: ['in_progress'],
  in_progress: ['waiting_shutdown', 'waiting_parts', 'completed'],
  waiting_shutdown: ['in_progress', 'completed'],
  waiting_parts: ['in_progress'],
  completed: ['verified', 'in_progress'],
  verified: ['closed'],
  closed: [],
};

export const WO_TRANSITION_ACTION_LABELS: Record<MaintenanceWorkOrderStatus, string> = {
  draft: 'Return to draft',
  assigned: 'Assign',
  accepted: 'Accept',
  in_progress: 'Start / resume',
  waiting_shutdown: 'Waiting shutdown',
  waiting_parts: 'Waiting parts',
  completed: 'Mark completed',
  verified: 'Verify',
  closed: 'Close',
};

export async function fetchWorkOrders(params?: {
  plant_id?: string;
  status?: MaintenanceWorkOrderStatus;
  assigned_to?: string;
}): Promise<MaintenanceWorkOrder[]> {
  const qs = new URLSearchParams();
  if (params?.plant_id) qs.set('plant_id', params.plant_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.assigned_to) qs.set('assigned_to', params.assigned_to);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.get<MaintenanceWorkOrder[]>(
    `/maintenance/pm/work-orders${q}`
  );
  return data;
}

export async function fetchWorkOrder(workOrderId: string): Promise<MaintenanceWorkOrder> {
  const { data } = await apiClient.get<MaintenanceWorkOrder>(
    `/maintenance/pm/work-orders/${workOrderId}`
  );
  return data;
}

export async function transitionWorkOrder(
  workOrderId: string,
  payload: { to_state: MaintenanceWorkOrderStatus; notes?: string }
): Promise<MaintenanceWorkOrder> {
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
): Promise<MaintenanceWorkOrderTask> {
  const { data } = await apiClient.post<MaintenanceWorkOrderTask>(
    `/maintenance/pm/work-orders/${workOrderId}/tasks/${taskId}/execute`,
    payload
  );
  return data;
}

export async function generateWorkOrderFromProgram(
  programId: string
): Promise<MaintenanceWorkOrder> {
  const { data } = await apiClient.post<MaintenanceWorkOrder>(
    `/maintenance/pm/programs/${programId}/generate-work-order`
  );
  return data;
}

export type MaintenanceProgramStatus = 'draft' | 'active' | 'inactive';

export type MaintenanceProgram = {
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
};

export async function fetchMaintenancePrograms(
  plantId?: string
): Promise<MaintenanceProgram[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<MaintenanceProgram[]>(`/maintenance/pm/programs${q}`);
  return data;
}

export async function createMaintenanceProgram(payload: {
  plant_id: string;
  name: string;
  category: string;
  description?: string;
  priority?: string;
  department_id?: string;
  asset_id?: string;
  asset_group_id?: string;
  responsible_team?: string;
  estimated_duration_min?: number;
  status?: MaintenanceProgramStatus;
  is_active?: boolean;
  auto_generate_work_orders?: boolean;
}): Promise<MaintenanceProgram> {
  const { data } = await apiClient.post<MaintenanceProgram>(
    '/maintenance/pm/programs',
    payload
  );
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
): Promise<MaintenanceProgram> {
  const { data } = await apiClient.patch<MaintenanceProgram>(
    `/maintenance/pm/programs/${programId}`,
    payload
  );
  return data;
}

export type MaintenanceTriggerType =
  | 'time'
  | 'runtime_hours'
  | 'heat_count'
  | 'production_count'
  | 'tonnage'
  | 'manual'
  | 'condition';

export type MaintenanceTrigger = {
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
};

export type MaintenanceTaskTemplate = {
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
};

export type MaintenanceNotificationRule = {
  id: string;
  program_id: string;
  offset_days: number;
  recipient_role: string;
  channel: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MaintenanceProgramDetail = {
  program: MaintenanceProgram;
  triggers: MaintenanceTrigger[];
  task_templates: MaintenanceTaskTemplate[];
  notification_rules: MaintenanceNotificationRule[];
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

export async function fetchMaintenanceProgramDetail(
  programId: string
): Promise<MaintenanceProgramDetail> {
  const { data } = await apiClient.get<MaintenanceProgramDetail>(
    `/maintenance/pm/programs/${programId}`
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
): Promise<MaintenanceTrigger> {
  const { data } = await apiClient.post<MaintenanceTrigger>(
    `/maintenance/pm/programs/${programId}/triggers`,
    payload
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
): Promise<MaintenanceTaskTemplate> {
  const { data } = await apiClient.post<MaintenanceTaskTemplate>(
    `/maintenance/pm/programs/${programId}/tasks`,
    payload
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
): Promise<MaintenanceNotificationRule> {
  const { data } = await apiClient.post<MaintenanceNotificationRule>(
    `/maintenance/pm/programs/${programId}/notifications`,
    payload
  );
  return data;
}

export async function createWorkOrder(payload: {
  plant_id: string;
  title: string;
  program_id?: string;
  asset_id?: string;
  department_id?: string;
  source_issue_id?: string;
  assigned_team?: string;
  assigned_to?: string;
  scheduled_at?: string;
  due_at?: string;
  estimated_duration_min?: number;
}): Promise<MaintenanceWorkOrder> {
  const { data } = await apiClient.post<MaintenanceWorkOrder>(
    '/maintenance/pm/work-orders',
    payload
  );
  return data;
}

/** GET /maintenance/intelligence — plant operational KPIs (pulse). */
export type MaintenanceIntelligence = {
  assets_running: number;
  under_pm: number;
  breakdown: number;
  waiting_parts: number;
  waiting_shutdown: number;
  completed_today: number;
  upcoming_pm: number;
  pm_compliance_pct?: number | null;
  mtbf_hours?: number | null;
  mttr_hours?: number | null;
  maintenance_cost?: number | null;
  downtime_hours?: number | null;
};

export type MaintenanceAnalytics = {
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
  kpis?: Record<string, unknown>;
};

export type PmEvaluateResult = {
  triggers_evaluated: number;
  notifications_sent: number;
  work_orders_generated: number;
};

export async function fetchMaintenanceIntelligence(
  plantId: string
): Promise<MaintenanceIntelligence> {
  const { data } = await apiClient.get<MaintenanceIntelligence>(
    `/maintenance/intelligence?plant_id=${encodeURIComponent(plantId)}`
  );
  return data;
}

export async function fetchMaintenanceAnalytics(params: {
  plant_id: string;
  from_date?: string;
  to_date?: string;
}): Promise<MaintenanceAnalytics> {
  const qs = new URLSearchParams();
  qs.set('plant_id', params.plant_id);
  if (params.from_date) qs.set('from_date', params.from_date);
  if (params.to_date) qs.set('to_date', params.to_date);
  const { data } = await apiClient.get<MaintenanceAnalytics>(
    `/maintenance/pm/analytics?${qs.toString()}`
  );
  return data;
}

export async function evaluatePmTriggers(options?: {
  plantId?: string;
  force?: boolean;
}): Promise<PmEvaluateResult> {
  const qs = new URLSearchParams();
  if (options?.plantId) qs.set('plant_id', options.plantId);
  if (options?.force) qs.set('force', 'true');
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.post<PmEvaluateResult>(`/maintenance/pm/evaluate${q}`);
  return data;
}

export type AssetMaintenanceHistoryEntry = {
  id: string;
  entry_type: 'work_order' | 'issue' | 'downtime' | 'pm_due' | string;
  title: string;
  status?: string | null;
  occurred_at: string;
  details?: Record<string, unknown>;
};

export type AssetMaintenanceHistory = {
  asset_id: string;
  last_pm_at?: string | null;
  next_pm_due_at?: string | null;
  total_maintenance_cost: number;
  entries: AssetMaintenanceHistoryEntry[];
};

/** GET /foundation/assets/{assetId}/maintenance-history */
export async function fetchAssetMaintenanceHistory(
  assetId: string
): Promise<AssetMaintenanceHistory> {
  const { data } = await apiClient.get<AssetMaintenanceHistory>(
    `/foundation/assets/${assetId}/maintenance-history`
  );
  return data;
}
