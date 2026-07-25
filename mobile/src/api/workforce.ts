import { apiClient } from '@/src/api/client';
import type {
  EmploymentStatus,
  EmploymentType,
  User,
  UserRole,
} from '@/src/types/user';

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

export type WorkforceEmployeePayload = {
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
};

export type WorkforceEmployeeUpdatePayload = {
  full_name?: string;
  role?: UserRole;
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
  password?: string;
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

/** GET /workforce/employees */
export async function fetchWorkforceEmployees(departmentId?: string): Promise<User[]> {
  const q = departmentId
    ? `?department_id=${encodeURIComponent(departmentId)}`
    : '';
  const { data } = await apiClient.get<User[]>(`/workforce/employees${q}`);
  return data;
}

/** POST /workforce/employees */
export async function createWorkforceEmployee(
  payload: WorkforceEmployeePayload
): Promise<User> {
  const { data } = await apiClient.post<User>('/workforce/employees', payload);
  return data;
}

/** PATCH /workforce/employees/{id} */
export async function updateWorkforceEmployee(
  userId: string,
  payload: WorkforceEmployeeUpdatePayload
): Promise<User> {
  const { data } = await apiClient.patch<User>(`/workforce/employees/${userId}`, payload);
  return data;
}

export type Contractor = {
  id: string;
  organisation_id: string;
  code: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  is_active: boolean;
};

export type ContractWorker = {
  id: string;
  contractor_id: string;
  full_name: string;
  department_id: string;
  phone?: string | null;
  is_active: boolean;
  contractor_name?: string | null;
  department_code?: string | null;
};

/** GET /workforce/contractors */
export async function fetchContractors(departmentId?: string): Promise<Contractor[]> {
  const q = departmentId
    ? `?department_id=${encodeURIComponent(departmentId)}`
    : '';
  const { data } = await apiClient.get<Contractor[]>(`/workforce/contractors${q}`);
  return data;
}

/** POST /workforce/contractors */
export async function createContractor(payload: {
  code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  is_active?: boolean;
}): Promise<Contractor> {
  const { data } = await apiClient.post<Contractor>('/workforce/contractors', payload);
  return data;
}

/** PATCH /workforce/contractors/{id} */
export async function updateContractor(
  id: string,
  payload: Partial<{
    name: string;
    contact_person: string | null;
    phone: string | null;
    is_active: boolean;
  }>
): Promise<Contractor> {
  const { data } = await apiClient.patch<Contractor>(`/workforce/contractors/${id}`, payload);
  return data;
}

/** GET /workforce/contract-workers */
export async function fetchContractWorkers(departmentId?: string): Promise<ContractWorker[]> {
  const q = departmentId
    ? `?department_id=${encodeURIComponent(departmentId)}`
    : '';
  const { data } = await apiClient.get<ContractWorker[]>(`/workforce/contract-workers${q}`);
  return data;
}

/** POST /workforce/contract-workers */
export async function createContractWorker(payload: {
  contractor_id: string;
  full_name: string;
  department_id: string;
  phone?: string;
  is_active?: boolean;
}): Promise<ContractWorker> {
  const { data } = await apiClient.post<ContractWorker>('/workforce/contract-workers', payload);
  return data;
}

/** PATCH /workforce/contract-workers/{id} */
export async function updateContractWorker(
  id: string,
  payload: Partial<{
    full_name: string;
    department_id: string;
    phone: string | null;
    is_active: boolean;
  }>
): Promise<ContractWorker> {
  const { data } = await apiClient.patch<ContractWorker>(
    `/workforce/contract-workers/${id}`,
    payload
  );
  return data;
}

export type ShiftAssignment = {
  id: string;
  user_id: string;
  department_id: string;
  shift_id: string;
  effective_date: string;
  user_name?: string | null;
  employee_uid?: string | null;
  department_code?: string | null;
  shift_code?: string | null;
};

export type WorkforceShift = {
  id: string;
  code: string;
  name: string;
};

export type ShiftHandoverNote = {
  id: string;
  note_date: string;
  department_id: string;
  shift_id: string;
  note: string;
  author_id?: string | null;
  department_code?: string | null;
  shift_code?: string | null;
  author_name?: string | null;
  created_at?: string;
};

/** GET /workforce/handover-notes */
export async function fetchHandoverNotes(filters?: {
  note_date?: string;
  department_id?: string;
  shift_id?: string;
}): Promise<ShiftHandoverNote[]> {
  const qs = new URLSearchParams();
  if (filters?.note_date) qs.set('note_date', filters.note_date);
  if (filters?.department_id) qs.set('department_id', filters.department_id);
  if (filters?.shift_id) qs.set('shift_id', filters.shift_id);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.get<ShiftHandoverNote[]>(`/workforce/handover-notes${q}`);
  return data;
}

/** POST /workforce/handover-notes */
export async function createHandoverNote(payload: {
  note_date: string;
  department_id: string;
  shift_id: string;
  note: string;
}): Promise<ShiftHandoverNote> {
  const { data } = await apiClient.post<ShiftHandoverNote>('/workforce/handover-notes', payload);
  return data;
}

/** GET /workforce/shift-assignments */
export async function fetchShiftAssignments(
  departmentId?: string,
  shiftId?: string
): Promise<ShiftAssignment[]> {
  const qs = new URLSearchParams();
  if (departmentId) qs.set('department_id', departmentId);
  if (shiftId) qs.set('shift_id', shiftId);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await apiClient.get<ShiftAssignment[]>(`/workforce/shift-assignments${q}`);
  return data;
}

/** POST /workforce/shift-assignments */
export async function createShiftAssignment(payload: {
  user_id: string;
  department_id: string;
  shift_id: string;
  effective_date: string;
}): Promise<ShiftAssignment> {
  const { data } = await apiClient.post<ShiftAssignment>(
    '/workforce/shift-assignments',
    payload
  );
  return data;
}

/** GET /workforce/shifts */
export async function fetchWorkforceShifts(plantId?: string): Promise<WorkforceShift[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<WorkforceShift[]>(`/workforce/shifts${q}`);
  return data;
}

export type AttendanceRecord = {
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
};

export type ContractorAttendance = {
  id: string;
  attendance_date: string;
  contractor_id: string;
  department_id: string;
  shift_id: string;
  workers_present: number;
  workers_absent: number;
  remarks?: string | null;
};

/** GET /workforce/attendance */
export async function fetchAttendance(
  attendanceDate: string,
  departmentId: string,
  shiftId: string
): Promise<AttendanceRecord[]> {
  const qs = new URLSearchParams({
    attendance_date: attendanceDate,
    department_id: departmentId,
    shift_id: shiftId,
  });
  const { data } = await apiClient.get<AttendanceRecord[]>(
    `/workforce/attendance?${qs.toString()}`
  );
  return data;
}

/** POST /workforce/attendance/bulk */
export async function saveAttendanceBulk(payload: {
  attendance_date: string;
  department_id: string;
  shift_id: string;
  entries: { user_id: string; status: AttendanceStatus; remarks?: string }[];
}): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.post<AttendanceRecord[]>(
    '/workforce/attendance/bulk',
    payload
  );
  return data;
}

/** GET /workforce/contractor-attendance */
export async function fetchContractorAttendance(
  attendanceDate: string,
  departmentId: string,
  shiftId: string
): Promise<ContractorAttendance[]> {
  const qs = new URLSearchParams({
    attendance_date: attendanceDate,
    department_id: departmentId,
    shift_id: shiftId,
  });
  const { data } = await apiClient.get<ContractorAttendance[]>(
    `/workforce/contractor-attendance?${qs.toString()}`
  );
  return data;
}

/** POST /workforce/contractor-attendance */
export async function saveContractorAttendance(payload: {
  attendance_date: string;
  contractor_id: string;
  department_id: string;
  shift_id: string;
  workers_present: number;
  workers_absent: number;
  remarks?: string;
}): Promise<ContractorAttendance> {
  const { data } = await apiClient.post<ContractorAttendance>(
    '/workforce/contractor-attendance',
    payload
  );
  return data;
}

export type WorkforceMeResponse = {
  shift_assignment?: ShiftAssignment | null;
  recent_attendance: AttendanceRecord[];
};

/** GET /workforce/me — worker self: current assignment + recent attendance. */
export async function fetchWorkforceMe(): Promise<WorkforceMeResponse> {
  const { data } = await apiClient.get<WorkforceMeResponse>('/workforce/me');
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
