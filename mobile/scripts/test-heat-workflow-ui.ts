/**
 * Unit: IAF heat workflow UI helpers (P2-SMS-IAF).
 */
import assert from 'node:assert/strict';

import {
  firstStepIndexForSection,
  isBbarDailyTemplate,
  isGrindDailyTemplate,
  isIafHeatTemplate,
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
