import AsyncStorage from '@react-native-async-storage/async-storage';

import { updateProcessRun } from '@/src/api/processRuns';
import {
  draftCount,
  removeDraft,
  upsertDraft,
} from '@/src/offline/draftQueueLogic';
import type { DraftSaveItem, ProcessRunPatchPayload } from '@/src/offline/types';

const STORAGE_KEY = 'moi.offline.draft_queue.v1';

type Listener = (queue: DraftSaveItem[]) => void;

let memory: DraftSaveItem[] | null = null;
const listeners = new Set<Listener>();

function emit() {
  if (!memory) return;
  for (const l of listeners) l(memory);
}

export function subscribeDraftQueue(listener: Listener): () => void {
  listeners.add(listener);
  if (memory) listener(memory);
  return () => listeners.delete(listener);
}

export async function loadDraftQueue(): Promise<DraftSaveItem[]> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memory = raw ? (JSON.parse(raw) as DraftSaveItem[]) : [];
    if (!Array.isArray(memory)) memory = [];
  } catch {
    memory = [];
  }
  emit();
  return memory;
}

async function persist(next: DraftSaveItem[]) {
  memory = next;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emit();
}

export async function enqueueDraftSave(
  runId: string,
  payload: ProcessRunPatchPayload,
  lastError?: string
): Promise<DraftSaveItem[]> {
  const current = await loadDraftQueue();
  const next = upsertDraft(current, runId, payload, lastError);
  await persist(next);
  return next;
}

export async function getPendingDraftCount(): Promise<number> {
  return draftCount(await loadDraftQueue());
}

export async function getDraftForRun(runId: string): Promise<DraftSaveItem | null> {
  const q = await loadDraftQueue();
  return q.find((d) => d.runId === runId) ?? null;
}

export type FlushResult = {
  flushed: number;
  failed: number;
  remaining: DraftSaveItem[];
};

/** Attempt to PATCH each queued draft. Successful runs are removed. */
export async function flushDraftQueue(): Promise<FlushResult> {
  const queue = await loadDraftQueue();
  if (queue.length === 0) {
    return { flushed: 0, failed: 0, remaining: [] };
  }
  let flushed = 0;
  let failed = 0;
  let remaining = [...queue];

  for (const item of queue) {
    try {
      await updateProcessRun(item.runId, item.payload);
      remaining = removeDraft(remaining, item.runId);
      flushed += 1;
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : 'Flush failed';
      remaining = remaining.map((d) =>
        d.runId === item.runId ? { ...d, lastError: msg } : d
      );
    }
  }

  await persist(remaining);
  return { flushed, failed, remaining };
}
