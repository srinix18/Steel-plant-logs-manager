import { apiClient } from '@/src/api/client';

export type WorkforceOpsSummary = {
  pending_leave_requests: number;
  certifications_expiring_soon: number;
  latest_payroll_status?: string | null;
  latest_payroll_month?: number | null;
  latest_payroll_year?: number | null;
  total_payroll_net?: number | null;
};

/** GET /workforce/ops/summary */
export async function fetchWorkforceOpsSummary(): Promise<WorkforceOpsSummary> {
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
