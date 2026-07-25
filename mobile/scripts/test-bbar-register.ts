/**
 * Unit: BBAR detection, production columns, total_weight calc, customer_ref (P2-BBD-BBAR).
 */
import assert from 'node:assert/strict';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import {
  applyCalculatedColumns,
  evalProductionFormula,
} from '../src/utils/formulaEngine.ts';
import { isBbarDailyTemplate } from '../src/utils/heatWorkflowUi.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

/** Seed F51 PR 39/005/01-13 — must match seed_bright_bar.py */
const PRODUCTION_REGISTER_COLUMNS = [
  { key: 'r_size_mm', label: 'R Size', type: 'number' },
  { key: 'grade_id', label: 'Grade', type: 'grade_ref' },
  { key: 'final_size_mm', label: 'Final Size', type: 'number' },
  { key: 'heat_no', label: 'H. No', type: 'heat_ref' },
  { key: 'coil_weight_kg', label: 'Coil Weight', type: 'number' },
  { key: 'coil_count', label: 'No of Coil', type: 'integer' },
  {
    key: 'total_weight_kg',
    label: 'Total Weight',
    type: 'calculated',
    formula: 'coil_weight_kg * coil_count',
  },
  { key: 'customer_id', label: 'Customer', type: 'customer_ref' },
];

assert.equal(
  isBbarDailyTemplate(['register_header', 'production_register', 'approvals']),
  true
);
assert.equal(isBbarDailyTemplate(['register_header']), false);
assert.equal(isBbarDailyTemplate(['input_material', 'output_material']), false);

assert.equal(
  evalProductionFormula('coil_weight_kg * coil_count', {
    coil_weight_kg: 25,
    coil_count: 2,
  }),
  50
);

const row = applyCalculatedColumns(PRODUCTION_REGISTER_COLUMNS, {
  r_size_mm: 20,
  coil_weight_kg: 12.5,
  coil_count: 4,
  customer_id: 'cust-uuid',
});
assert.equal(row.total_weight_kg, 50);
assert.equal(row.customer_id, 'cust-uuid');

assert.equal(
  PRODUCTION_REGISTER_COLUMNS.find((c) => c.key === 'customer_id')?.type,
  'customer_ref'
);
assert.equal(
  PRODUCTION_REGISTER_COLUMNS.find((c) => c.key === 'total_weight_kg')?.formula,
  'coil_weight_kg * coil_count'
);

const sections: TemplateSection[] = [
  {
    id: 'h',
    key: 'register_header',
    title: 'Header',
    sort_order: 0,
    section_type: 'fields',
    config: {},
    fields: [
      {
        id: 'date',
        name: 'date',
        label: 'Date',
        field_type: 'date',
        required: true,
        sort_order: 0,
        config: {},
        formula: null,
      },
    ],
  },
  {
    id: 'p',
    key: 'production_register',
    title: 'Production',
    sort_order: 1,
    section_type: 'production_register_table',
    config: {
      columns: PRODUCTION_REGISTER_COLUMNS,
      default_empty_rows: 10,
    },
    fields: [],
  },
  {
    id: 'a',
    key: 'approvals',
    title: 'Sign-offs',
    sort_order: 2,
    section_type: 'fields',
    config: {},
    fields: [],
  },
];

assert.equal(isBbarDailyTemplate(sections.map((s) => s.key)), true);

const steps = buildCardSteps(sections, {
  productionRowCount: { production_register: 10 },
});
assert.ok(steps.some((s) => s.kind === 'fields' && s.sectionKey === 'register_header'));
assert.ok(steps.some((s) => s.kind === 'production_list'));
assert.ok(steps.some((s) => s.kind === 'production_row' && s.itemIndex === 0));
assert.ok(steps.some((s) => s.kind === 'fields' && s.sectionKey === 'approvals'));

console.log('bbar-register: OK');
