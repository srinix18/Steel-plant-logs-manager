/**
 * Unit: Next from chemistry / material lists skips detail cards.
 */
import assert from 'node:assert/strict';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import { nextCardStepIndex } from '../src/features/run-host/nextCardStepIndex.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

const sections: TemplateSection[] = [
  {
    id: 'chemistry',
    key: 'chemistry',
    title: 'Chemical Composition',
    sort_order: 0,
    section_type: 'table',
    config: { max_samples: 8 },
    fields: [],
  },
  {
    id: 'ferro',
    key: 'ferro_alloys',
    title: 'Ferro Alloys',
    sort_order: 1,
    section_type: 'repeatable_group',
    config: {},
    fields: [],
  },
  {
    id: 'scrap',
    key: 'charge_mix',
    title: 'Scrap / Charge Mix',
    sort_order: 2,
    section_type: 'repeatable_group',
    config: {},
    fields: [],
  },
];

const steps = buildCardSteps(sections, {
  chemistrySampleCount: { chemistry: 2 },
  materialRowCount: { ferro_alloys: 2, charge_mix: 1 },
});

assert.equal(steps[0].kind, 'chemistry_list');
assert.equal(steps[1].kind, 'chemistry_sample');
assert.equal(steps[2].kind, 'chemistry_sample');
assert.equal(steps[3].kind, 'material_list');
assert.equal(steps[3].sectionKey, 'ferro_alloys');
assert.equal(steps[4].kind, 'material_row');
assert.equal(steps[5].kind, 'material_row');
assert.equal(steps[6].kind, 'material_list');
assert.equal(steps[6].sectionKey, 'charge_mix');
assert.equal(steps[7].kind, 'material_row');

// Next from chemistry list skips samples → ferro list
assert.equal(nextCardStepIndex(steps, 0), 3);
// Next from ferro list skips ferro rows → scrap list
assert.equal(nextCardStepIndex(steps, 3), 6);
// Next from scrap list skips scrap row → stays (end)
assert.equal(nextCardStepIndex(steps, 6), 6);
// Next from ferro row → next ferro row
assert.equal(nextCardStepIndex(steps, 4), 5);
// Next from last ferro row → scrap list
assert.equal(nextCardStepIndex(steps, 5), 6);

console.log('test-next-card-step: OK');
