import type { WorkflowTransition } from '@/src/types/processRun';

/** IAF F/PRD/02 — maps workflow transitions to the log sheet tab where the action belongs. */
const IAF_TRANSITION_TAB: Record<string, string> = {
  'created->in_progress': 'heat_info',
  'in_progress->waiting_for_sample': 'timing_equipment',
  'waiting_for_sample->refining': 'chemistry',
  'refining->refining': 'chemistry',
  'refining->ready_to_tap': 'ferro_alloys',
  'ready_to_tap->completed': 'timing_equipment',
  'completed->approved': 'remarks_signoff',
  'approved->closed': 'remarks_signoff',
  'in_progress->aborted': 'heat_info',
};

/** Recommended tab to open for each heat lifecycle state. */
const IAF_STATE_TAB: Record<string, string> = {
  created: 'heat_info',
  in_progress: 'timing_equipment',
  waiting_for_sample: 'chemistry',
  refining: 'chemistry',
  ready_to_tap: 'ferro_alloys',
  completed: 'remarks_signoff',
  approved: 'remarks_signoff',
  closed: 'remarks_signoff',
  aborted: 'heat_info',
};

const IAF_STEP_ORDER = [
  'created',
  'in_progress',
  'waiting_for_sample',
  'refining',
  'ready_to_tap',
  'completed',
  'approved',
  'closed',
] as const;

const IAF_STEP_LABELS: Record<string, string> = {
  created: 'Start',
  in_progress: 'Power on',
  waiting_for_sample: 'Sample',
  refining: 'Refining',
  ready_to_tap: 'Ready to tap',
  completed: 'Tapped',
  approved: 'Approved',
  closed: 'Closed',
  aborted: 'Aborted',
};

const IAF_ACTION_HINTS: Record<string, string> = {
  'created->in_progress': 'Confirm heat information is saved, then start the heat.',
  'in_progress->waiting_for_sample': 'Record power-on time, then power on the furnace.',
  'waiting_for_sample->refining': 'Enter sample chemistry, then record the sample.',
  'refining->refining': 'Add another chemistry sample if needed.',
  'refining->ready_to_tap': 'Complete ferro alloy additions, then mark ready to tap.',
  'ready_to_tap->completed': 'Record tapping time and power readings, then complete the tap.',
  'completed->approved': 'Complete sign-off, then approve the heat.',
  'approved->closed': 'Close the heat record when review is complete.',
  'in_progress->aborted': 'Abort this heat if it cannot continue.',
};

export function isIafHeatTemplate(sectionKeys: string[]): boolean {
  return sectionKeys.includes('heat_info') && sectionKeys.includes('charge_mix');
}

/** AOD F/PRD/03 — detection via blow + alloy sections (no charge_mix). */
export function isAodLadleTemplate(sectionKeys: string[]): boolean {
  return sectionKeys.includes('blow_process') && sectionKeys.includes('alloy_additions');
}

/** CCM F/PRD/04 — casting_entries production log. */
export function isCcmCastTemplate(sectionKeys: string[]): boolean {
  return sectionKeys.includes('casting_entries') && sectionKeys.includes('shift_header');
}

/** RMILL F/PRD/05 — delay + batches + hourly matrix. */
export function isRmillShiftTemplate(sectionKeys: string[]): boolean {
  return (
    sectionKeys.includes('delay_register') &&
    sectionKeys.includes('production_batches') &&
    sectionKeys.includes('hourly_matrix')
  );
}

/** WFURN F/PRD/06 — input coils + furnace output. */
export function isWfurnShiftTemplate(sectionKeys: string[]): boolean {
  return sectionKeys.includes('input_coils') && sectionKeys.includes('furnace_output');
}

/** WDRAW F/PRD/07 — input/output material with coil refs. */
export function isWdrawShiftTemplate(sectionKeys: string[]): boolean {
  return sectionKeys.includes('input_material') && sectionKeys.includes('output_material');
}

/** Any wire template that needs coil pickers / every-card workflow CTAs. */
export function isWireDivisionTemplate(sectionKeys: string[]): boolean {
  return isWfurnShiftTemplate(sectionKeys) || isWdrawShiftTemplate(sectionKeys);
}

/** BBAR F51 — daily production register (no shift). */
export function isBbarDailyTemplate(sectionKeys: string[]): boolean {
  return sectionKeys.includes('register_header') && sectionKeys.includes('production_register');
}

/**
 * GRIND F/PRD/08 — forge daily register.
 * Today: register_header only. Future jobs tables keep register_header without BBAR's production_register.
 */
export function isGrindDailyTemplate(sectionKeys: string[]): boolean {
  return sectionKeys.includes('register_header') && !sectionKeys.includes('production_register');
}

export function transitionTabKey(transition: WorkflowTransition): string | null {
  const key = `${transition.from_state}->${transition.to_state}`;
  return IAF_TRANSITION_TAB[key] ?? null;
}

export function stateTabKey(state: string): string | null {
  return IAF_STATE_TAB[state] ?? null;
}

export function transitionHint(transition: WorkflowTransition): string | undefined {
  return IAF_ACTION_HINTS[`${transition.from_state}->${transition.to_state}`];
}

export function workflowStepIndex(state: string): number {
  const idx = IAF_STEP_ORDER.indexOf(state as (typeof IAF_STEP_ORDER)[number]);
  return idx >= 0 ? idx : 0;
}

export function workflowStepsForUi(currentState: string) {
  return IAF_STEP_ORDER.map((key) => ({
    key,
    label: IAF_STEP_LABELS[key] ?? key.replace(/_/g, ' '),
    isCurrent: key === currentState,
    isComplete: workflowStepIndex(currentState) > workflowStepIndex(key),
  }));
}

export function transitionsForTab(
  transitions: WorkflowTransition[],
  sectionKey: string
): WorkflowTransition[] {
  return transitions.filter((t) => transitionTabKey(t) === sectionKey);
}

/** First card-step index for a template section key (list card preferred). */
export function firstStepIndexForSection(
  steps: { sectionKey: string; kind: string }[],
  sectionKey: string
): number {
  const listIdx = steps.findIndex(
    (s) => s.sectionKey === sectionKey && s.kind.endsWith('_list')
  );
  if (listIdx >= 0) return listIdx;
  return steps.findIndex((s) => s.sectionKey === sectionKey);
}
