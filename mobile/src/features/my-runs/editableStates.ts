/** States where My Runs shows Edit → run host (web MyRunsPage parity). */
export const MY_RUN_EDITABLE_STATES = new Set([
  'created',
  'in_progress',
  'waiting_for_sample',
  'refining',
  'ready_to_tap',
]);

export function isMyRunEditable(state: string): boolean {
  return MY_RUN_EDITABLE_STATES.has(state);
}

/** Prefer started_at; fall back to created_at (web table uses created_at). */
export function formatMyRunStartedAt(run: {
  started_at?: string | null;
  created_at: string;
}): string {
  const raw = run.started_at || run.created_at;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}
