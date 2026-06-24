import { apiClient } from './client';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Contractor,
  ContractorAttendance,
  ContractWorker,
  DepartmentAttendanceSummary,
  Shift,
  ShiftAssignment,
  ShiftHandoverNote,
  User,
  WorkforceDailySummary,
  WorkforceEmployeePayload,
  WorkforceEmployeeUpdatePayload,
  WorkforceMeResponse,
} from '../types';

export async function fetchWorkforceEmployees(departmentId?: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/workforce/employees', {
    params: departmentId ? { department_id: departmentId } : undefined,
  });
  return data;
}

export async function createWorkforceEmployee(payload: WorkforceEmployeePayload): Promise<User> {
  const { data } = await apiClient.post<User>('/workforce/employees', payload);
  return data;
}

export async function updateWorkforceEmployee(
  userId: string,
  payload: WorkforceEmployeeUpdatePayload
): Promise<User> {
  const { data } = await apiClient.patch<User>(`/workforce/employees/${userId}`, payload);
  return data;
}

export async function fetchContractors(departmentId?: string): Promise<Contractor[]> {
  const { data } = await apiClient.get<Contractor[]>('/workforce/contractors', {
    params: departmentId ? { department_id: departmentId } : undefined,
  });
  return data;
}

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

export async function updateContractor(
  id: string,
  payload: Partial<{ name: string; contact_person: string; phone: string; is_active: boolean }>
): Promise<Contractor> {
  const { data } = await apiClient.patch<Contractor>(`/workforce/contractors/${id}`, payload);
  return data;
}

export async function fetchContractWorkers(departmentId?: string): Promise<ContractWorker[]> {
  const { data } = await apiClient.get<ContractWorker[]>('/workforce/contract-workers', {
    params: departmentId ? { department_id: departmentId } : undefined,
  });
  return data;
}

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

export async function updateContractWorker(
  id: string,
  payload: Partial<{ full_name: string; department_id: string; phone: string; is_active: boolean }>
): Promise<ContractWorker> {
  const { data } = await apiClient.patch<ContractWorker>(`/workforce/contract-workers/${id}`, payload);
  return data;
}

export async function fetchShiftAssignments(
  departmentId?: string,
  shiftId?: string
): Promise<ShiftAssignment[]> {
  const { data } = await apiClient.get<ShiftAssignment[]>('/workforce/shift-assignments', {
    params: { department_id: departmentId, shift_id: shiftId },
  });
  return data;
}

export async function createShiftAssignment(payload: {
  user_id: string;
  department_id: string;
  shift_id: string;
  effective_date: string;
}): Promise<ShiftAssignment> {
  const { data } = await apiClient.post<ShiftAssignment>('/workforce/shift-assignments', payload);
  return data;
}

export async function updateShiftAssignment(
  id: string,
  payload: Partial<{ department_id: string; shift_id: string; effective_date: string }>
): Promise<ShiftAssignment> {
  const { data } = await apiClient.patch<ShiftAssignment>(
    `/workforce/shift-assignments/${id}`,
    payload
  );
  return data;
}

export async function fetchWorkforceShifts(plantId?: string): Promise<Shift[]> {
  const { data } = await apiClient.get<Shift[]>('/workforce/shifts', {
    params: plantId ? { plant_id: plantId } : undefined,
  });
  return data;
}

export async function fetchAttendance(
  attendanceDate: string,
  departmentId: string,
  shiftId: string
): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.get<AttendanceRecord[]>('/workforce/attendance', {
    params: { attendance_date: attendanceDate, department_id: departmentId, shift_id: shiftId },
  });
  return data;
}

export async function saveAttendanceBulk(payload: {
  attendance_date: string;
  department_id: string;
  shift_id: string;
  entries: { user_id: string; status: AttendanceStatus; remarks?: string }[];
}): Promise<AttendanceRecord[]> {
  const { data } = await apiClient.post<AttendanceRecord[]>('/workforce/attendance/bulk', payload);
  return data;
}

export async function fetchContractorAttendance(
  attendanceDate: string,
  departmentId: string,
  shiftId: string
): Promise<ContractorAttendance[]> {
  const { data } = await apiClient.get<ContractorAttendance[]>('/workforce/contractor-attendance', {
    params: { attendance_date: attendanceDate, department_id: departmentId, shift_id: shiftId },
  });
  return data;
}

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

export async function fetchHandoverNotes(params?: {
  note_date?: string;
  department_id?: string;
  shift_id?: string;
}): Promise<ShiftHandoverNote[]> {
  const { data } = await apiClient.get<ShiftHandoverNote[]>('/workforce/handover-notes', { params });
  return data;
}

export async function createHandoverNote(payload: {
  note_date: string;
  department_id: string;
  shift_id: string;
  note: string;
}): Promise<ShiftHandoverNote> {
  const { data } = await apiClient.post<ShiftHandoverNote>('/workforce/handover-notes', payload);
  return data;
}

export async function fetchPreviousHandover(
  departmentId: string,
  shiftId: string,
  noteDate?: string
): Promise<ShiftHandoverNote | null> {
  const { data } = await apiClient.get<ShiftHandoverNote | null>(
    '/workforce/handover-notes/previous',
    {
      params: {
        department_id: departmentId,
        shift_id: shiftId,
        note_date: noteDate,
      },
    }
  );
  return data;
}

export async function fetchDepartmentAttendance(
  attendanceDate?: string
): Promise<DepartmentAttendanceSummary[]> {
  const { data } = await apiClient.get<DepartmentAttendanceSummary[]>(
    '/workforce/dashboard/departments',
    { params: attendanceDate ? { attendance_date: attendanceDate } : undefined }
  );
  return data;
}

export async function fetchWorkforceSummary(attendanceDate?: string): Promise<WorkforceDailySummary> {
  const { data } = await apiClient.get<WorkforceDailySummary>('/workforce/summary', {
    params: attendanceDate ? { attendance_date: attendanceDate } : undefined,
  });
  return data;
}

export async function fetchWorkforceMe(): Promise<WorkforceMeResponse> {
  const { data } = await apiClient.get<WorkforceMeResponse>('/workforce/me');
  return data;
}
