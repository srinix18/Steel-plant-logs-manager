/**
 * Unit: IAF heat workflow UI helpers (P2-SMS-IAF).
 */
import assert from 'node:assert/strict';

import {
  firstStepIndexForSection,
  iafDesiredStateForStep,
  iafManualTransitionsForStep,
  isBbarDailyTemplate,
  isGrindDailyTemplate,
  isIafHeatTemplate,
  pickIafPhaseTransition,
  stateTabKey,
  transitionTabKey,
  transitionsForTab,
  workflowStepIndex,
  workflowStepsForUi,
} from '../src/utils/heatWorkflowUi.ts';
import type { WorkflowTransition } from '../src/types/processRun.ts';

assert.equal(isIafHeatTemplate(['heat_info', 'charge_mix']), true);
assert.equal(isIafHeatTemplate(['heat_info', 'blow_process']), false);
assert.equal(isBbarDailyTemplate(['register_header', 'production_register']), true);
assert.equal(isBbarDailyTemplate(['register_header']), false);
assert.equal(isGrindDailyTemplate(['register_header']), true);
assert.equal(isGrindDailyTemplate(['register_header', 'production_register']), false);

assert.equal(stateTabKey('waiting_for_sample'), 'chemistry');
assert.equal(stateTabKey('ready_to_tap'), 'ferro_alloys');
assert.equal(stateTabKey('completed'), 'remarks_signoff');

assert.equal(
  transitionTabKey({
    from_state: 'in_progress',
    to_state: 'waiting_for_sample',
    label: 'Power on',
    allowed_roles: [],
  }),
  'timing_equipment'
);

const transitions: WorkflowTransition[] = [
  {
    from_state: 'refining',
    to_state: 'refining',
    label: 'Add sample',
    allowed_roles: [],
  },
  {
    from_state: 'refining',
    to_state: 'ready_to_tap',
    label: 'Ready',
    allowed_roles: [],
  },
];

assert.deepEqual(
  transitionsForTab(transitions, 'chemistry').map((t) => t.to_state),
  ['refining']
);
assert.deepEqual(
  transitionsForTab(transitions, 'ferro_alloys').map((t) => t.to_state),
  ['ready_to_tap']
);

assert.equal(
  iafDesiredStateForStep({ id: 'timing_equipment:power', sectionKey: 'timing_equipment' }),
  'in_progress'
);
assert.equal(
  iafDesiredStateForStep({ id: 'timing_equipment:tap', sectionKey: 'timing_equipment' }),
  'ready_to_tap'
);
assert.equal(iafDesiredStateForStep({ id: 'chemistry:list', sectionKey: 'chemistry' }), 'refining');

const avail: WorkflowTransition[] = [
  {
    from_state: 'in_progress',
    to_state: 'waiting_for_sample',
    label: 'Power On',
    allowed_roles: [],
  },
  {
    from_state: 'waiting_for_sample',
    to_state: 'refining',
    label: 'Record Sample',
    allowed_roles: [],
  },
  {
    from_state: 'ready_to_tap',
    to_state: 'completed',
    label: 'Tap Completed',
    allowed_roles: [],
  },
  {
    from_state: 'ready_to_tap',
    to_state: 'refining',
    label: 'Back to Refining',
    allowed_roles: [],
  },
];

assert.equal(pickIafPhaseTransition(avail, 'in_progress', 'refining')?.to_state, 'waiting_for_sample');
assert.equal(pickIafPhaseTransition(avail, 'ready_to_tap', 'refining')?.to_state, 'refining');
assert.equal(pickIafPhaseTransition(avail, 'ready_to_tap', 'ready_to_tap'), null);
assert.equal(pickIafPhaseTransition(avail, 'ready_to_tap', 'completed'), null);

assert.deepEqual(
  iafManualTransitionsForStep(avail, {
    id: 'electrical_power:fields',
    sectionKey: 'electrical_power',
  }).map((t) => t.to_state),
  ['completed']
);
assert.deepEqual(
  iafManualTransitionsForStep(avail, {
    id: 'timing_equipment:tap',
    sectionKey: 'timing_equipment',
  }),
  []
);
assert.deepEqual(
  iafManualTransitionsForStep(avail, { id: 'chemistry:list', sectionKey: 'chemistry' }),
  []
);

const steps = workflowStepsForUi('refining');
assert.equal(steps.find((s) => s.key === 'refining')?.isCurrent, true);
assert.equal(steps.find((s) => s.key === 'created')?.isComplete, true);
assert.ok(workflowStepIndex('closed') > workflowStepIndex('created'));

const cardSteps = [
  { sectionKey: 'heat_info', kind: 'fields' },
  { sectionKey: 'chemistry', kind: 'chemistry_list' },
  { sectionKey: 'chemistry', kind: 'chemistry_sample' },
];
assert.equal(firstStepIndexForSection(cardSteps, 'chemistry'), 1);

console.log('heat-workflow-ui: OK');
