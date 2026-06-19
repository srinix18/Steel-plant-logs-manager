import { apiClient } from './client';
import type { CorrectiveAction, DashboardMetrics, Observation } from '../types';

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const { data } = await apiClient.get<DashboardMetrics>('/dashboard');
  return data;
}

export async function createObservation(payload: {
  plant_id: string;
  run_id?: string;
  category: string;
  description: string;
  severity: string;
}): Promise<Observation> {
  const { data } = await apiClient.post<Observation>('/observations', payload);
  return data;
}

export async function fetchObservations(plantId?: string): Promise<Observation[]> {
  const { data } = await apiClient.get<Observation[]>('/observations', { params: { plant_id: plantId } });
  return data;
}

export async function fetchOpenActions(plantId?: string): Promise<CorrectiveAction[]> {
  const { data } = await apiClient.get<CorrectiveAction[]>('/dashboards/actions/open', { params: { plant_id: plantId } });
  return data;
}

export async function ingestEvents(events: Record<string, unknown>[]) {
  const { data } = await apiClient.post('/integrations/events', events);
  return data;
}
