import { apiClient } from '@/src/api/client';
import type { LoginResponse, User } from '@/src/types/user';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function getMe(opts?: { timeoutMs?: number }): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me', opts);
  return data;
}

export async function updateProfile(payload: {
  full_name?: string;
  phone?: string;
  designation?: string;
  date_of_joining?: string;
}): Promise<User> {
  const { data } = await apiClient.patch<User>('/auth/me', payload);
  return data;
}
