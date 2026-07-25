import { apiClient } from '@/src/api/client';

export type CoilStatus = 'registered' | 'in_furnace' | 'completed' | 'consumed';

export type CoilRecord = {
  id: string;
  plant_id: string;
  department_id?: string;
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
};

export type CoilLookup = {
  id: string;
  coil_no: string;
  status: CoilStatus;
  work_order_no?: string | null;
  grade_id?: string | null;
  heat_no?: string | null;
  size_mm?: number | null;
  weight_kg?: number | null;
};

export { coilOptionLabel, pickableCoils } from '@/src/utils/coilPickers';

/** Coils pickable for a run — furnace output (default) or drawing (`purpose=drawing`). */
export async function fetchCoils(opts: {
  plantId: string;
  runId: string;
  purpose?: 'drawing';
}): Promise<CoilRecord[]> {
  const params = new URLSearchParams({
    plant_id: opts.plantId,
    run_id: opts.runId,
  });
  if (opts.purpose) params.set('purpose', opts.purpose);
  const { data } = await apiClient.get<CoilRecord[]>(`/coils?${params.toString()}`);
  return data;
}

export async function lookupCoil(plantId: string, coilNo: string): Promise<CoilLookup[]> {
  const params = new URLSearchParams({
    plant_id: plantId,
    coil_no: coilNo,
  });
  const { data } = await apiClient.get<CoilLookup[]>(`/coils/lookup?${params.toString()}`);
  return data;
}
