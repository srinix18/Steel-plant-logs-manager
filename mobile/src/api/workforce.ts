import { apiClient } from '@/src/api/client';

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day';

export type DepartmentAttendanceSummary = {
  department_id: string;
  department_code: string;
  department_name: string;
  expected: number;
  present: number;
  understaffed_by: number;
  contract_workers_present: number;
  contract_workers_absent: number;
};

export type WorkforceDailySummary = {
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
};

/** GET /workforce/summary?attendance_date=YYYY-MM-DD */
export async function fetchWorkforceSummary(
  attendanceDate?: string
): Promise<WorkforceDailySummary> {
  const q = attendanceDate
    ? `?attendance_date=${encodeURIComponent(attendanceDate)}`
    : '';
  const { data } = await apiClient.get<WorkforceDailySummary>(`/workforce/summary${q}`);
  return data;
}

/** Local calendar date as YYYY-MM-DD (matches web `todayIso`). */
export function toAttendanceDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseAttendanceDateIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
