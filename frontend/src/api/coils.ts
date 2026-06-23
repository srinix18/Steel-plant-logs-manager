import { apiClient } from './client';

export type CoilStatus = 'registered' | 'in_furnace' | 'completed' | 'consumed';

export interface CoilRecord {
  id: string;
  plant_id: string;
  department_id: string;
  coil_no: string;
  work_order_no?: string | null;
  grade_id?: string | null;
  heat_run_id?: string | null;
  heat_no?: string | null;
  size_mm?: number | null;
  weight_kg?: number | null;
  status: CoilStatus;
  parent_coil_id?: string | null;
  source_run_id?: string | null;
  registered_by: string;
}

export interface CoilLookup {
  id: string;
  coil_no: string;
  status: CoilStatus;
  work_order_no?: string | null;
  grade_id?: string | null;
  heat_no?: string | null;
  size_mm?: number | null;
  weight_kg?: number | null;
  parent_coil_id?: string | null;
}

export async function fetchCoils(params: {
  plantId: string;
  runId: string;
  purpose?: 'drawing';
}): Promise<CoilRecord[]> {
  const { data } = await apiClient.get<CoilRecord[]>('/coils', {
    params: {
      plant_id: params.plantId,
      run_id: params.runId,
      ...(params.purpose ? { purpose: params.purpose } : {}),
    },
  });
  return data;
}

export async function lookupCoil(plantId: string, coilNo: string): Promise<CoilLookup[]> {
  const { data } = await apiClient.get<CoilLookup[]>('/coils/lookup', {
    params: { plant_id: plantId, coil_no: coilNo },
  });
  return data;
}
