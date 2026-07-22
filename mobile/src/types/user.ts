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

export type EmploymentStatus = 'active' | 'on_leave' | 'resigned' | 'terminated';
export type EmploymentType = 'permanent' | 'contract' | 'temporary';

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

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
