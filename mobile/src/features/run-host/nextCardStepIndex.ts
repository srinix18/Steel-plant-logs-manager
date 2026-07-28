import type { CardStep } from '@/src/features/run-host/buildCardSteps';

export const DETAIL_STEP_KINDS = new Set([
  'chemistry_sample',
  'sample_chemistry_row',
  'material_row',
  'production_row',
  'delay_row',
  'matrix_row',
  'hourly_hour',
]);

export const LIST_STEP_KINDS = new Set([
  'chemistry_list',
  'sample_chemistry_list',
  'material_list',
  'production_list',
  'delay_list',
  'hourly_list',
]);

/**
 * Next from a list card skips its detail cards (open details via the list rows).
 * Next from a detail card advances one step as usual.
 * Returns `from` when there is no further step to land on.
 */
export function nextCardStepIndex(steps: CardStep[], from: number): number {
  if (from < 0 || from >= steps.length) return from;
  const cur = steps[from];
  if (LIST_STEP_KINDS.has(cur.kind)) {
    let i = from + 1;
    while (
      i < steps.length &&
      steps[i].sectionKey === cur.sectionKey &&
      DETAIL_STEP_KINDS.has(steps[i].kind)
    ) {
      i += 1;
    }
    return i < steps.length ? i : from;
  }
  const next = from + 1;
  return next < steps.length ? next : from;
}