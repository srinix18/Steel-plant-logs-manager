import type { CoilRecord } from '@/src/api/coils';

/** Coils shown in furnace picker vs drawing picker (web CoilRefInput parity). */
export function pickableCoils<T extends { status: string }>(
  coils: T[],
  purpose?: 'drawing'
): T[] {
  if (purpose === 'drawing') {
    return coils.filter((c) => c.status === 'completed');
  }
  return coils.filter((c) => c.status !== 'completed' && c.status !== 'consumed');
}

export function coilOptionLabel(c: {
  coil_no: string;
  size_mm?: number | null;
  heat_no?: string | null;
  status: string;
}): string {
  const bits = [c.coil_no];
  if (c.size_mm != null) bits.push(`${c.size_mm} mm`);
  if (c.heat_no) bits.push(`Heat ${c.heat_no}`);
  bits.push(c.status.replace(/_/g, ' '));
  return bits.join(' · ');
}
