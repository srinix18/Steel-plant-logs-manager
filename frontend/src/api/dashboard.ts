import { apiClient } from './client';
import type { DashboardMetrics } from '../types';

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const { data } = await apiClient.get<DashboardMetrics>('/dashboard');
  return data;
}
