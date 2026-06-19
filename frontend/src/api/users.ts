import { apiClient } from './client';
import type { User, UserRole } from '../types';

export interface UserCreatePayload {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  department_id?: string | null;
  is_active?: boolean;
}

export async function fetchUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users');
  return data;
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const { data } = await apiClient.post<User>('/users', payload);
  return data;
}

export async function updateUser(id: string, payload: Partial<UserCreatePayload>): Promise<User> {
  const { data } = await apiClient.put<User>(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
