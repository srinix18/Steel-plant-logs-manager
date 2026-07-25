/**
 * Unit: RMILL detection + delay/hourly card step counts (P2-ROLLING-RMILL).
 */
import assert from 'node:assert/strict';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import { isRmillShiftTemplate } from '../src/utils/heatWorkflowUi.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

assert.equal(
  isRmillShiftTemplate(['delay_register', 'production_batches', 'hourly_matrix']),
  true
);
assert.equal(isRmillShiftTemplate(['casting_entries', 'shift_header']), false);

const hours = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const sections: TemplateSection[] = [
  {
    id: '1',
    key: 'shift_details',
    title: 'Shift',
    sort_order: 0,
    section_type: 'fields',
    config: {},
    fields: [],
  },
  {
    id: '2',
    key: 'delay_register',
    title: 'Delay',
    sort_order: 1,
    section_type: 'delay_register_table',
    config: { default_empty_rows: 2 },
    fields: [],
  },
  {
    id: '3',
    key: 'production_batches',
    title: 'Batches',
    sort_order: 2,
    section_type: 'production_log_table',
    config: {
      default_empty_rows: 2,
      columns: [
        { key: 'heat_no', label: 'Heat', type: 'heat_ref' },
        { key: 'grade_id', label: 'Grade', type: 'grade_ref' },
      ],
    },
    fields: [],
  },
  {
    id: '4',
    key: 'hourly_matrix',
    title: 'Hourly',
    sort_order: 3,
    section_type: 'hourly_production_matrix',
    config: {
      hours,
      rows: [
        { key: 'delay_minutes', label: 'Delay', type: 'number' },
        { key: 'rolled', label: 'Rolled', type: 'number' },
      ],
    },
    fields: [],
  },
];

const steps = buildCardSteps(sections, {
  delayRowCount: { delay_register: 2 },
  productionRowCount: { production_batches: 2 },
  hourlyHours: { hourly_matrix: hours },
});

assert.ok(steps.some((s) => s.kind === 'delay_list'));
assert.equal(steps.filter((s) => s.kind === 'delay_row').length, 2);
assert.ok(steps.some((s) => s.kind === 'production_list'));
assert.equal(steps.filter((s) => s.kind === 'production_row').length, 2);
assert.ok(steps.some((s) => s.kind === 'hourly_list'));
assert.equal(steps.filter((s) => s.kind === 'hourly_hour').length, 12);
assert.equal(steps.find((s) => s.kind === 'hourly_hour' && s.hourKey === 'XII')?.label.includes('XII'), true);

console.log('rmill-card-steps: OK');
