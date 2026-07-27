import { apiClient } from '@/src/api/client';
import type { User } from '@/src/types/user';

export type DashboardMetrics = {
  total_organisations: number;
  total_plants: number;
  active_runs: number;
  open_observations: number;
  open_corrective_actions: number;
};

export type Organisation = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
};

/** GET /dashboard */
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const { data } = await apiClient.get<DashboardMetrics>('/dashboard');
  return data;
}

/** GET /organisations */
export async function fetchOrganisations(): Promise<Organisation[]> {
  const { data } = await apiClient.get<Organisation[]>('/organisations');
  return data;
}

export type OpsObservation = {
  id: string;
  plant_id: string;
  run_id?: string | null;
  category: string;
  description: string;
  severity: string;
  status?: string;
  created_at?: string;
};

export type OpsCorrectiveAction = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
};

/** GET /observations?plant_id= (ops, not foundation) */
export async function fetchOpsObservations(plantId?: string): Promise<OpsObservation[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<OpsObservation[]>(`/observations${q}`);
  return data;
}

/** GET /dashboards/actions/open?plant_id= */
export async function fetchOpenCorrectiveActions(
  plantId?: string
): Promise<OpsCorrectiveAction[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<OpsCorrectiveAction[]>(
    `/dashboards/actions/open${q}`
  );
  return data;
}

/** GET /users (platform admin list) */
export async function fetchUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users');
  return data;
}

export type OrgUserPayload = {
  email: string;
  password: string;
  full_name: string;
  role: User['role'];
  department_id?: string | null;
  process_id?: string | null;
  plant_id?: string | null;
  designation?: string | null;
  phone?: string | null;
  maintenance_division?: string | null;
};

export type OrgUserUpdatePayload = {
  full_name?: string;
  role?: User['role'];
  department_id?: string | null;
  process_id?: string | null;
  plant_id?: string | null;
  designation?: string | null;
  phone?: string | null;
  is_active?: boolean;
  password?: string;
  maintenance_division?: string | null;
};

/** GET /organisations/{orgId}/users */
export async function fetchOrgUsers(orgId: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(`/organisations/${orgId}/users`);
  return data;
}

/** POST /organisations/{orgId}/users */
export async function createOrgUser(orgId: string, payload: OrgUserPayload): Promise<User> {
  const { data } = await apiClient.post<User>(`/organisations/${orgId}/users`, payload);
  return data;
}

/** PATCH /organisations/{orgId}/users/{userId} */
export async function updateOrgUser(
  orgId: string,
  userId: string,
  payload: OrgUserUpdatePayload
): Promise<User> {
  const { data } = await apiClient.patch<User>(
    `/organisations/${orgId}/users/${userId}`,
    payload
  );
  return data;
}
