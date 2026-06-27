import { apiClient } from './client';
import type { OEEMetrics } from './pulse';

export interface OEETrendPoint {
  period_start: string;
  period_end: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface OEEResponse {
  scope_type: string;
  scope_id: string;
  current: OEEMetrics;
  hourly: OEETrendPoint[];
  daily: OEETrendPoint[];
  weekly: OEETrendPoint[];
  monthly: OEETrendPoint[];
}

export async function fetchOee(scopeType: string, scopeId: string) {
  const { data } = await apiClient.get<OEEResponse>(`/oee/${scopeType}/${scopeId}`);
  return data;
}
