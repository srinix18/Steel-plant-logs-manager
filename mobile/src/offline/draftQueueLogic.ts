import type { DraftSaveItem, ProcessRunPatchPayload } from '@/src/offline/types';

export function mergeFieldValues(
  existing: { field_key: string; value: unknown }[] | undefined,
  incoming: { field_key: string; value: unknown }[] | undefined
): { field_key: string; value: unknown }[] | undefined {
  if (!existing?.length && !incoming?.length) return undefined;
  const map = new Map<string, unknown>();
  for (const f of existing ?? []) map.set(f.field_key, f.value);
  for (const f of incoming ?? []) map.set(f.field_key, f.value);
  return [...map.entries()].map(([field_key, value]) => ({ field_key, value }));
}

export function mergeSectionData(
  existing: { section_key: string; data: unknown }[] | undefined,
  incoming: { section_key: string; data: unknown }[] | undefined
): { section_key: string; data: unknown }[] | undefined {
  if (!existing?.length && !incoming?.length) return undefined;
  const map = new Map<string, unknown>();
  for (const s of existing ?? []) map.set(s.section_key, s.data);
  for (const s of incoming ?? []) map.set(s.section_key, s.data);
  return [...map.entries()].map(([section_key, data]) => ({ section_key, data }));
}

export function mergePayloads(
  a: ProcessRunPatchPayload,
  b: ProcessRunPatchPayload
): ProcessRunPatchPayload {
  return {
    field_values: mergeFieldValues(a.field_values, b.field_values),
    section_data: mergeSectionData(a.section_data, b.section_data),
    grade_id: b.grade_id ?? a.grade_id,
  };
}

/** One queued draft per run — latest patch merges into the existing item. */
export function upsertDraft(
  queue: DraftSaveItem[],
  runId: string,
  payload: ProcessRunPatchPayload,
  lastError?: string,
  nowIso: string = new Date().toISOString(),
  idFactory: () => string = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
): DraftSaveItem[] {
  const idx = queue.findIndex((d) => d.runId === runId);
  if (idx < 0) {
    return [
      ...queue,
      {
        id: idFactory(),
        runId,
        payload,
        createdAt: nowIso,
        lastError,
      },
    ];
  }
  const prev = queue[idx];
  const next: DraftSaveItem = {
    ...prev,
    payload: mergePayloads(prev.payload, payload),
    lastError: lastError ?? prev.lastError,
  };
  const copy = [...queue];
  copy[idx] = next;
  return copy;
}

export function removeDraft(queue: DraftSaveItem[], runId: string): DraftSaveItem[] {
  return queue.filter((d) => d.runId !== runId);
}

export function draftCount(queue: DraftSaveItem[]): number {
  return queue.length;
}
