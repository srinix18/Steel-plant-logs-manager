/**
 * Unit: WFURN detection + coil picker helpers (P2-WIRE-WFURN).
 */
import assert from 'node:assert/strict';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import { coilOptionLabel, pickableCoils } from '../src/utils/coilPickers.ts';
import {
  isWdrawShiftTemplate,
  isWfurnShiftTemplate,
  isWireDivisionTemplate,
} from '../src/utils/heatWorkflowUi.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

assert.equal(isWfurnShiftTemplate(['input_coils', 'furnace_output']), true);
assert.equal(isWfurnShiftTemplate(['input_material', 'output_material']), false);
assert.equal(isWdrawShiftTemplate(['input_material', 'output_material']), true);
assert.equal(isWireDivisionTemplate(['input_coils', 'furnace_output']), true);

const coils = [
  {
    id: '1',
    plant_id: 'p',
    coil_no: 'C-100',
    status: 'registered' as const,
    size_mm: 5.5,
    heat_no: 'H1',
  },
  {
    id: '2',
    plant_id: 'p',
    coil_no: 'C-200',
    status: 'completed' as const,
  },
  {
    id: '3',
    plant_id: 'p',
    coil_no: 'C-300',
    status: 'consumed' as const,
  },
];

assert.deepEqual(
  pickableCoils(coils).map((c) => c.coil_no),
  ['C-100']
);
assert.deepEqual(
  pickableCoils(coils, 'drawing').map((c) => c.coil_no),
  ['C-200']
);
assert.ok(coilOptionLabel(coils[0]).includes('C-100'));
assert.ok(coilOptionLabel(coils[0]).includes('5.5'));

const sections: TemplateSection[] = [
  {
    id: 's',
    key: 'shift_details',
    title: 'Shift',
    sort_order: 0,
    section_type: 'fields',
    config: {},
    fields: [],
  },
  {
    id: 'i',
    key: 'input_coils',
    title: 'Input',
    sort_order: 1,
    section_type: 'production_register_table',
    config: {
      default_empty_rows: 2,
      columns: [
        { key: 'coil_no', label: 'Coil', type: 'text' },
        { key: 'heat_no', label: 'Heat', type: 'heat_ref' },
      ],
    },
    fields: [],
  },
  {
    id: 'o',
    key: 'furnace_output',
    title: 'Output',
    sort_order: 2,
    section_type: 'production_register_table',
    config: {
      default_empty_rows: 2,
      columns: [{ key: 'coil_ref', label: 'Coil', type: 'coil_ref' }],
    },
    fields: [],
  },
];

const steps = buildCardSteps(sections, {
  productionRowCount: { input_coils: 2, furnace_output: 2 },
});
assert.ok(steps.some((s) => s.sectionKey === 'input_coils' && s.kind === 'production_list'));
assert.equal(
  steps.filter((s) => s.sectionKey === 'furnace_output' && s.kind === 'production_row').length,
  2
);

console.log('wfurn-coils: OK');
