import { apiClient } from '@/src/api/client';
import type { LoginResponse, User } from '@/src/types/user';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}
