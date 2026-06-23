import { apiClient } from './client';

export interface DelayCode {
  id: string;
  plant_id: string;
  code: string;
  description: string;
  category: 'equipment' | 'process';
  is_active: boolean;
}

export interface DelayEvent {
  id: string;
  run_id: string;
  plant_id: string;
  row_key: string;
  delay_code_id?: string | null;
  time_from?: string | null;
  time_to?: string | null;
  time_lost_minutes?: number | null;
  reason?: string | null;
  action_taken?: string | null;
  assigned_to?: string | null;
  status: 'open' | 'closed';
  observation_id?: string | null;
  delay_code?: DelayCode | null;
}

export interface HeatLookup {
  run_id: string;
  run_number: string;
  heat_no: string;
  grade_id?: string | null;
  process_code?: string | null;
}

export async function fetchDelayCodes(plantId: string): Promise<DelayCode[]> {
  const { data } = await apiClient.get<DelayCode[]>('/delay-codes', { params: { plant_id: plantId } });
  return data;
}

export async function fetchDelayEvents(params: {
  run_id?: string;
  plant_id?: string;
  status?: string;
}): Promise<DelayEvent[]> {
  const { data } = await apiClient.get<DelayEvent[]>('/delay-events', { params });
  return data;
}

export async function updateDelayEvent(
  eventId: string,
  payload: { assigned_to?: string; action_taken?: string; status?: 'open' | 'closed' },
): Promise<DelayEvent> {
  const { data } = await apiClient.patch<DelayEvent>(`/delay-events/${eventId}`, payload);
  return data;
}

export async function lookupHeatNo(heatNo: string): Promise<HeatLookup[]> {
  const { data } = await apiClient.get<HeatLookup[]>('/process-runs/heat-lookup', {
    params: { heat_no: heatNo },
  });
  return data;
}
