/**
 * Unit: WDRAW detection, dual inlet_coil_ref columns, seed dropdown options (P2-WIRE-WDRAW).
 */
import assert from 'node:assert/strict';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import { pickableCoils } from '../src/utils/coilPickers.ts';
import {
  isWdrawShiftTemplate,
  isWireDivisionTemplate,
} from '../src/utils/heatWorkflowUi.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

/** Seed F/PRD/07 options — must match seed_wire_drawing.py */
const CONDITION_OPTIONS = ['Normal', 'Rusty', 'Damaged', 'Wet', 'Surface Defect'];
const LUBRICANT_OPTIONS = ['Soap', 'Drawing Powder', 'Oil'];

assert.equal(isWdrawShiftTemplate(['input_material', 'output_material']), true);
assert.equal(isWireDivisionTemplate(['input_material', 'output_material']), true);

const inputCols = [
  { key: 'work_order_no', label: 'WO', type: 'text' },
  { key: 'grade_id', label: 'Grade', type: 'grade_ref' },
  { key: 'heat_no', label: 'Heat', type: 'heat_ref' },
  { key: 'inlet_size_mm', label: 'Inlet', type: 'number' },
  { key: 'inlet_coil_ref', label: 'Inlet Coil', type: 'coil_ref' },
  {
    key: 'condition',
    label: 'Condition',
    type: 'dropdown',
    options: CONDITION_OPTIONS,
  },
];

const outputCols = [
  { key: 'inlet_coil_ref', label: 'Inlet Coil', type: 'coil_ref' },
  { key: 'outlet_size_mm', label: 'Outlet', type: 'number' },
  {
    key: 'lubricant',
    label: 'Lubricant',
    type: 'dropdown',
    options: LUBRICANT_OPTIONS,
  },
  { key: 'finish_coil_no', label: 'Finish', type: 'text' },
  { key: 'weight_kg', label: 'Weight', type: 'number' },
  { key: 'remark', label: 'Remark', type: 'textarea' },
];

assert.deepEqual(
  inputCols.find((c) => c.key === 'condition')?.options,
  CONDITION_OPTIONS
);
assert.deepEqual(
  outputCols.find((c) => c.key === 'lubricant')?.options,
  LUBRICANT_OPTIONS
);
assert.equal(inputCols.filter((c) => c.type === 'coil_ref').length, 1);
assert.equal(outputCols.filter((c) => c.type === 'coil_ref').length, 1);
assert.equal(inputCols.find((c) => c.type === 'coil_ref')?.key, 'inlet_coil_ref');
assert.equal(outputCols.find((c) => c.type === 'coil_ref')?.key, 'inlet_coil_ref');

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
    key: 'input_material',
    title: 'Input',
    sort_order: 1,
    section_type: 'production_register_table',
    config: {
      columns: inputCols,
      default_empty_rows: 2,
      coil_picker_purpose: 'drawing',
    },
    fields: [],
  },
  {
    id: 'o',
    key: 'output_material',
    title: 'Output',
    sort_order: 2,
    section_type: 'production_register_table',
    config: {
      columns: outputCols,
      default_empty_rows: 2,
      coil_picker_purpose: 'drawing',
    },
    fields: [],
  },
];

assert.equal(sections[1].config.coil_picker_purpose, 'drawing');
assert.equal(sections[2].config.coil_picker_purpose, 'drawing');

const steps = buildCardSteps(sections, {
  productionRowCount: { input_material: 2, output_material: 2 },
});
assert.ok(steps.some((s) => s.sectionKey === 'input_material' && s.kind === 'production_list'));
assert.equal(
  steps.filter((s) => s.sectionKey === 'input_material' && s.kind === 'production_row').length,
  2
);
assert.equal(
  steps.filter((s) => s.sectionKey === 'output_material' && s.kind === 'production_row').length,
  2
);

assert.deepEqual(
  pickableCoils(
    [
      { id: '1', coil_no: 'A', status: 'completed' },
      { id: '2', coil_no: 'B', status: 'registered' },
    ],
    'drawing'
  ).map((c) => c.coil_no),
  ['A']
);

console.log('wdraw-drawing: OK');
