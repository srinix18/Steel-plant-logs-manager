/**
 * Unit: GRIND F/PRD/08 detection + card steps absorb future sections (P2-FORGE-GRIND).
 */
import assert from 'node:assert/strict';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import {
  isBbarDailyTemplate,
  isGrindDailyTemplate,
} from '../src/utils/heatWorkflowUi.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

assert.equal(isGrindDailyTemplate(['register_header']), true);
assert.equal(isGrindDailyTemplate(['register_header', 'jobs']), true);
assert.equal(isGrindDailyTemplate(['register_header', 'production_register']), false);
assert.equal(isBbarDailyTemplate(['register_header', 'production_register']), true);
assert.equal(isGrindDailyTemplate(['heat_info', 'charge_mix']), false);

const header: TemplateSection = {
  id: 'h',
  key: 'register_header',
  title: 'Register Header',
  sort_order: 0,
  section_type: 'fields',
  config: {},
  fields: [
    {
      id: 'wc',
      name: 'work_centre',
      label: 'Work Centre',
      field_type: 'text',
      required: true,
      sort_order: 0,
      config: {},
      formula: null,
    },
    {
      id: 'd',
      name: 'date',
      label: 'Date',
      field_type: 'date',
      required: true,
      sort_order: 1,
      config: {},
      formula: null,
    },
  ],
};

const headerOnlySteps = buildCardSteps([header]);
assert.equal(headerOnlySteps.length, 1);
assert.equal(headerOnlySteps[0].kind, 'fields');
assert.equal(headerOnlySteps[0].sectionKey, 'register_header');

/** Future jobs table — engine must not hardcode header-only. */
const jobs: TemplateSection = {
  id: 'j',
  key: 'grinding_jobs',
  title: 'Jobs',
  sort_order: 1,
  section_type: 'production_register_table',
  config: {
    columns: [
      { key: 'heat_no', label: 'Heat', type: 'text' },
      { key: 'weight_kg', label: 'Weight', type: 'number' },
    ],
    default_empty_rows: 2,
  },
  fields: [],
};

const withJobs = buildCardSteps([header, jobs], {
  productionRowCount: { grinding_jobs: 2 },
});
assert.ok(withJobs.some((s) => s.kind === 'fields' && s.sectionKey === 'register_header'));
assert.ok(withJobs.some((s) => s.kind === 'production_list' && s.sectionKey === 'grinding_jobs'));
assert.ok(withJobs.some((s) => s.kind === 'production_row' && s.itemIndex === 0));
assert.ok(withJobs.length >= 4); // header + list + 2 rows

console.log('grind-register: OK');
