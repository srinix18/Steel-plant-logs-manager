import type { BlowProcessSectionData } from '@/src/features/run-host/section-data/types';

/** Sum blow consumption columns into gas_consumption field values (web HeatWorkspace parity). */
export function gasFieldsFromBlow(data: BlowProcessSectionData): {
  o2_nm3: string;
  n2_nm3: string;
  ar_nm3: string;
} {
  let o2 = 0;
  let n2 = 0;
  let ar = 0;
  for (const row of data.rows) {
    o2 += Number(row.values.consumption_o2) || 0;
    n2 += Number(row.values.consumption_n2) || 0;
    ar += Number(row.values.consumption_ar) || 0;
  }
  return {
    o2_nm3: String(o2),
    n2_nm3: String(n2),
    ar_nm3: String(ar),
  };
}
