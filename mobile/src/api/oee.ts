import { apiClient } from '@/src/api/client';
import type { OEEMetrics } from '@/src/api/pulse';

export type OEETrendPoint = {
  period_start: string;
  period_end: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
};

export type OEEResponse = {
  scope_type: string;
  scope_id: string;
  current: OEEMetrics;
  hourly: OEETrendPoint[];
  daily: OEETrendPoint[];
  weekly: OEETrendPoint[];
  monthly: OEETrendPoint[];
};

/** GET /oee/{scopeType}/{scopeId} */
export async function fetchOee(scopeType: string, scopeId: string): Promise<OEEResponse> {
  const { data } = await apiClient.get<OEEResponse>(`/oee/${scopeType}/${scopeId}`);
  return data;
}
