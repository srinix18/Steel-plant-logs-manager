import { apiClient } from './client';

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';
export type EmploymentType = 'permanent' | 'contract' | 'temporary';
export type PayrollRunStatus = 'draft' | 'processing' | 'completed' | 'failed';
export type RosterPeriodType = 'weekly' | 'monthly';

export interface LeaveType {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  status: string;
  remarks?: string | null;
  approver_id?: string | null;
  decided_at?: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  leave_type_name?: string | null;
}

export interface ShiftRosterEntry {
  id: string;
  roster_id: string;
  user_id: string;
  shift_id: string;
  roster_date: string;
  user_name?: string | null;
  shift_code?: string | null;
}

export interface ShiftRoster {
  id: string;
  department_id: string;
  period_start: string;
  period_end: string;
  period_type: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  entries: ShiftRosterEntry[];
}

export interface Skill {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  department_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSkill {
  id: string;
  user_id: string;
  skill_id: string;
  proficiency_level: string;
  skill_name?: string | null;
  skill_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingRecord {
  id: string;
  user_id: string;
  name: string;
  certification?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  status: string;
  document_id?: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
}

export interface SalaryStructure {
  id: string;
  user_id: string;
  basic: number;
  hra: number;
  allowances: number;
  pf: number;
  esi: number;
  other_deductions: number;
  effective_from: string;
  effective_to?: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
}

export interface PayrollRun {
  id: string;
  plant_id: string;
  month: number;
  year: number;
  status: string;
  processed_by?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollLineItem {
  id: string;
  payroll_run_id: string;
  user_id: string;
  payable_days: number;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  payslip_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
}

export interface Payslip {
  line_item_id: string;
  html: string;
}

export interface WorkforceOpsSummary {
  pending_leave_requests: number;
  certifications_expiring_soon: number;
  latest_payroll_status?: string | null;
  latest_payroll_month?: number | null;
  latest_payroll_year?: number | null;
  total_payroll_net?: number | null;
}

// Leave
export async function fetchLeaveTypes() {
  const { data } = await apiClient.get<LeaveType[]>('/workforce/leave/types');
  return data;
}

export async function fetchLeaveRequests(status?: LeaveRequestStatus) {
  const { data } = await apiClient.get<LeaveRequest[]>('/workforce/leave/requests', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function fetchMyLeaveRequests() {
  const { data } = await apiClient.get<LeaveRequest[]>('/workforce/leave/requests/mine');
  return data;
}

export async function createLeaveRequest(payload: {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  remarks?: string;
}) {
  const { data } = await apiClient.post<LeaveRequest>('/workforce/leave/requests', payload);
  return data;
}

export async function approveLeaveRequest(requestId: string, remarks?: string) {
  const { data } = await apiClient.post<LeaveRequest>(
    `/workforce/leave/requests/${requestId}/approve`,
    { remarks }
  );
  return data;
}

export async function rejectLeaveRequest(requestId: string, remarks?: string) {
  const { data } = await apiClient.post<LeaveRequest>(
    `/workforce/leave/requests/${requestId}/reject`,
    { remarks }
  );
  return data;
}

// Shift rosters
export async function fetchShiftRosters(departmentId?: string) {
  const { data } = await apiClient.get<ShiftRoster[]>('/workforce/ops/rosters', {
    params: departmentId ? { department_id: departmentId } : undefined,
  });
  return data;
}

export async function createShiftRoster(payload: {
  department_id: string;
  period_start: string;
  period_end: string;
  period_type?: RosterPeriodType;
  entries?: { user_id: string; shift_id: string; roster_date: string }[];
}) {
  const { data } = await apiClient.post<ShiftRoster>('/workforce/ops/rosters', payload);
  return data;
}

export async function updateShiftRoster(
  rosterId: string,
  payload: Partial<{
    status: string;
    period_end: string;
    period_start: string;
    entries: { user_id: string; shift_id: string; roster_date: string }[];
  }>
) {
  const { data } = await apiClient.patch<ShiftRoster>(
    `/workforce/ops/rosters/${rosterId}`,
    payload
  );
  return data;
}

export async function publishShiftRoster(rosterId: string) {
  const { data } = await apiClient.post<ShiftRoster>(
    `/workforce/ops/rosters/${rosterId}/publish`
  );
  return data;
}

// Skills
export async function fetchSkills() {
  const { data } = await apiClient.get<Skill[]>('/workforce/ops/skills');
  return data;
}

export async function createSkill(payload: {
  code: string;
  name: string;
  department_id?: string;
}) {
  const { data } = await apiClient.post<Skill>('/workforce/ops/skills', payload);
  return data;
}

export async function fetchEmployeeSkills(userId: string) {
  const { data } = await apiClient.get<EmployeeSkill[]>(
    `/workforce/ops/employees/${userId}/skills`
  );
  return data;
}

export async function fetchAllEmployeeSkills() {
  const { data } = await apiClient.get<EmployeeSkill[]>('/workforce/ops/employee-skills');
  return data;
}

export async function assignEmployeeSkill(
  userId: string,
  payload: {
    skill_id: string;
    proficiency_level?: string;
  }
) {
  const { data } = await apiClient.post<EmployeeSkill>(
    `/workforce/ops/employees/${userId}/skills`,
    payload
  );
  return data;
}

// Training
export async function fetchTrainingRecords(params?: { user_id?: string; expiring_soon?: boolean }) {
  const { data } = await apiClient.get<TrainingRecord[]>('/workforce/ops/training', { params });
  return data;
}

export async function createTrainingRecord(payload: {
  user_id: string;
  name: string;
  certification?: string;
  issue_date?: string;
  expiry_date?: string;
  document_id?: string;
}) {
  const { data } = await apiClient.post<TrainingRecord>('/workforce/ops/training', payload);
  return data;
}

export async function updateTrainingRecord(
  recordId: string,
  payload: Partial<{
    name: string;
    certification: string;
    issue_date: string;
    expiry_date: string;
    status: string;
    document_id: string;
  }>
) {
  const { data } = await apiClient.patch<TrainingRecord>(
    `/workforce/ops/training/${recordId}`,
    payload
  );
  return data;
}

// Payroll
export async function fetchPayrollRuns(plantId?: string) {
  const { data } = await apiClient.get<PayrollRun[]>('/workforce/payroll/runs', {
    params: plantId ? { plant_id: plantId } : undefined,
  });
  return data;
}

export async function createPayrollRun(payload: { plant_id: string; month: number; year: number }) {
  const { data } = await apiClient.post<PayrollRun>('/workforce/payroll/runs', payload);
  return data;
}

export async function processPayrollRun(runId: string) {
  const { data } = await apiClient.post<PayrollRun>(`/workforce/payroll/runs/${runId}/process`);
  return data;
}

export async function fetchPayrollLineItems(runId: string) {
  const { data } = await apiClient.get<PayrollLineItem[]>(
    `/workforce/payroll/runs/${runId}/line-items`
  );
  return data;
}

export async function fetchMyPayslips() {
  const { data } = await apiClient.get<PayrollLineItem[]>('/workforce/payroll/payslips/mine');
  return data;
}

export async function fetchPayslipHtml(lineItemId: string) {
  const { data } = await apiClient.get<string>(`/workforce/payroll/payslips/${lineItemId}`, {
    responseType: 'text',
  });
  return { line_item_id: lineItemId, html: data };
}

export async function fetchSalaryStructures(userId?: string) {
  const { data } = await apiClient.get<SalaryStructure[]>('/workforce/payroll/salary-structures', {
    params: userId ? { user_id: userId } : undefined,
  });
  return data;
}

// Dashboard summary
export async function fetchWorkforceOpsSummary() {
  const { data } = await apiClient.get<WorkforceOpsSummary>('/workforce/ops/summary');
  return data;
}

export function formatPayrollMonth(month: number, year: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
