import { apiClient } from '@/src/api/client';

export type WorkforceOpsSummary = {
  pending_leave_requests: number;
  certifications_expiring_soon: number;
  latest_payroll_status?: string | null;
  latest_payroll_month?: number | null;
  latest_payroll_year?: number | null;
  total_payroll_net?: number | null;
};

export type RosterPeriodType = 'weekly' | 'monthly';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export type LeaveType = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type LeaveRequest = {
  id: string;
  user_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  status: LeaveRequestStatus;
  remarks?: string | null;
  user_name?: string | null;
  leave_type_name?: string | null;
};

export type Skill = { id: string; code: string; name: string; department_id?: string | null };
export type EmployeeSkill = { id: string; user_id: string; skill_id: string; proficiency_level: string; skill_name?: string | null; skill_code?: string | null };
export type TrainingRecord = { id: string; user_id: string; name: string; certification?: string | null; issue_date?: string | null; expiry_date?: string | null; status: string; user_name?: string | null };
export type SalaryStructure = { id: string; user_id: string; basic: number; hra: number; allowances: number; pf: number; esi: number; other_deductions: number; effective_from: string; user_name?: string | null };
export type PayrollRun = { id: string; plant_id: string; month: number; year: number; status: string };
export type PayrollLineItem = {
  id: string;
  payroll_run_id: string;
  user_id: string;
  payable_days: number;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  payslip_data?: Record<string, unknown>;
  user_name?: string | null;
};

export type ShiftRosterEntry = {
  id: string;
  roster_id: string;
  user_id: string;
  shift_id: string;
  roster_date: string;
  user_name?: string | null;
  shift_code?: string | null;
};

export type ShiftRoster = {
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
};

/** GET /workforce/ops/summary */
export async function fetchWorkforceOpsSummary(): Promise<WorkforceOpsSummary> {
  const { data } = await apiClient.get<WorkforceOpsSummary>('/workforce/ops/summary');
  return data;
}

/** GET /workforce/ops/rosters */
export async function fetchShiftRosters(departmentId?: string): Promise<ShiftRoster[]> {
  const q = departmentId
    ? `?department_id=${encodeURIComponent(departmentId)}`
    : '';
  const { data } = await apiClient.get<ShiftRoster[]>(`/workforce/ops/rosters${q}`);
  return data;
}

/** POST /workforce/ops/rosters */
export async function createShiftRoster(payload: {
  department_id: string;
  period_start: string;
  period_end: string;
  period_type?: RosterPeriodType;
  entries?: { user_id: string; shift_id: string; roster_date: string }[];
}): Promise<ShiftRoster> {
  const { data } = await apiClient.post<ShiftRoster>('/workforce/ops/rosters', payload);
  return data;
}

/** PATCH /workforce/ops/rosters/{id} */
export async function updateShiftRoster(
  rosterId: string,
  payload: Partial<{
    status: string;
    period_end: string;
    period_start: string;
    entries: { user_id: string; shift_id: string; roster_date: string }[];
  }>
): Promise<ShiftRoster> {
  const { data } = await apiClient.patch<ShiftRoster>(
    `/workforce/ops/rosters/${rosterId}`,
    payload
  );
  return data;
}

/** POST /workforce/ops/rosters/{id}/publish */
export async function publishShiftRoster(rosterId: string): Promise<ShiftRoster> {
  const { data } = await apiClient.post<ShiftRoster>(
    `/workforce/ops/rosters/${rosterId}/publish`
  );
  return data;
}

/** GET /workforce/leave/types */
export async function fetchLeaveTypes(): Promise<LeaveType[]> {
  const { data } = await apiClient.get<LeaveType[]>('/workforce/leave/types');
  return data;
}

/** GET /workforce/leave/requests */
export async function fetchLeaveRequests(status?: LeaveRequestStatus): Promise<LeaveRequest[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const { data } = await apiClient.get<LeaveRequest[]>(`/workforce/leave/requests${q}`);
  return data;
}

/** POST /workforce/leave/requests */
export async function createLeaveRequest(payload: {
  leave_type_id: string;
  from_date: string;
  to_date: string;
  remarks?: string;
}): Promise<LeaveRequest> {
  const { data } = await apiClient.post<LeaveRequest>('/workforce/leave/requests', payload);
  return data;
}

/** GET /workforce/leave/requests/mine */
export async function fetchMyLeaveRequests(): Promise<LeaveRequest[]> {
  const { data } = await apiClient.get<LeaveRequest[]>('/workforce/leave/requests/mine');
  return data;
}

export async function approveLeaveRequest(id: string, remarks?: string): Promise<LeaveRequest> {
  const { data } = await apiClient.post<LeaveRequest>(`/workforce/leave/requests/${id}/approve`, {
    remarks,
  });
  return data;
}

export async function rejectLeaveRequest(id: string, remarks?: string): Promise<LeaveRequest> {
  const { data } = await apiClient.post<LeaveRequest>(`/workforce/leave/requests/${id}/reject`, { remarks });
  return data;
}

export async function fetchSkills(): Promise<Skill[]> { const { data } = await apiClient.get<Skill[]>('/workforce/ops/skills'); return data; }
export async function createSkill(payload: { code: string; name: string; department_id?: string }): Promise<Skill> { const { data } = await apiClient.post<Skill>('/workforce/ops/skills', payload); return data; }
export async function fetchAllEmployeeSkills(): Promise<EmployeeSkill[]> { const { data } = await apiClient.get<EmployeeSkill[]>('/workforce/ops/employee-skills'); return data; }
export async function assignEmployeeSkill(userId: string, payload: { skill_id: string; proficiency_level?: string }): Promise<EmployeeSkill> { const { data } = await apiClient.post<EmployeeSkill>(`/workforce/ops/employees/${userId}/skills`, payload); return data; }

export async function fetchTrainingRecords(filters?: { user_id?: string; expiring_soon?: boolean }): Promise<TrainingRecord[]> {
  const qs = new URLSearchParams(); if (filters?.user_id) qs.set('user_id', filters.user_id); if (filters?.expiring_soon !== undefined) qs.set('expiring_soon', String(filters.expiring_soon));
  const { data } = await apiClient.get<TrainingRecord[]>(`/workforce/ops/training${qs.toString() ? `?${qs.toString()}` : ''}`); return data;
}
export async function createTrainingRecord(payload: { user_id: string; name: string; certification?: string; issue_date?: string; expiry_date?: string }): Promise<TrainingRecord> { const { data } = await apiClient.post<TrainingRecord>('/workforce/ops/training', payload); return data; }

export async function fetchPayrollRuns(plantId?: string): Promise<PayrollRun[]> { const { data } = await apiClient.get<PayrollRun[]>(`/workforce/payroll/runs${plantId ? `?plant_id=${encodeURIComponent(plantId)}` : ''}`); return data; }
export async function createPayrollRun(payload: { plant_id: string; month: number; year: number }): Promise<PayrollRun> { const { data } = await apiClient.post<PayrollRun>('/workforce/payroll/runs', payload); return data; }
export async function processPayrollRun(runId: string): Promise<PayrollRun> { const { data } = await apiClient.post<PayrollRun>(`/workforce/payroll/runs/${runId}/process`); return data; }
export async function fetchPayrollLineItems(runId: string): Promise<PayrollLineItem[]> { const { data } = await apiClient.get<PayrollLineItem[]>(`/workforce/payroll/runs/${runId}/line-items`); return data; }
export async function fetchSalaryStructures(userId?: string): Promise<SalaryStructure[]> { const { data } = await apiClient.get<SalaryStructure[]>(`/workforce/payroll/salary-structures${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`); return data; }
export async function createSalaryStructure(payload: {
  user_id: string;
  basic: number;
  hra: number;
  allowances: number;
  pf: number;
  esi: number;
  other_deductions: number;
  effective_from: string;
}): Promise<SalaryStructure> {
  const { data } = await apiClient.post<SalaryStructure>(
    '/workforce/payroll/salary-structures',
    payload
  );
  return data;
}

/** GET /workforce/payroll/payslips/mine */
export async function fetchMyPayslips(): Promise<PayrollLineItem[]> {
  const { data } = await apiClient.get<PayrollLineItem[]>('/workforce/payroll/payslips/mine');
  return data;
}

/** GET /workforce/payroll/payslips/{lineItemId} — HTML body. */
export async function fetchPayslipHtml(
  lineItemId: string
): Promise<{ line_item_id: string; html: string }> {
  const { getToken } = await import('@/src/api/storage');
  const { getApiBaseUrl } = await import('@/src/api/client');
  const token = await getToken();
  const res = await fetch(`${getApiBaseUrl()}/workforce/payroll/payslips/${lineItemId}`, {
    headers: {
      Accept: 'text/html, application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const json = JSON.parse(text) as { detail?: string };
      if (typeof json.detail === 'string') detail = json.detail;
    } catch {
      /* keep */
    }
    throw new Error(detail || `Payslip fetch failed (${res.status})`);
  }
  return { line_item_id: lineItemId, html: text };
}

export function formatPayrollMonth(month: number, year: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
