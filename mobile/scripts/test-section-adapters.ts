import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import {
  buildEmptyChemistry,
  buildEmptyDelayRegister,
  buildEmptyHourlyMatrix,
  buildEmptyProductionLog,
  buildSampleChemistry,
  buildStaticMaterialSection,
  buildTargetChemistry,
  emptyMaterialSection,
  getBlowProcessConfig,
  initSectionDataMap,
  materialSectionToPayload,
  parseChemistryData,
  sectionDataToPayload,
  staticMaterialToPayload,
} from '../src/features/run-host/section-data/index.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function sec(
  partial: Partial<TemplateSection> &
    Pick<TemplateSection, 'key' | 'title' | 'sort_order' | 'section_type'>
): TemplateSection {
  return { id: partial.key, config: {}, fields: [], ...partial };
}

const fixtures: TemplateSection[] = [
  sec({ key: 'heat_info', title: 'Heat', sort_order: 0, section_type: 'fields' }),
  sec({
    key: 'chemistry',
    title: 'Chem',
    sort_order: 1,
    section_type: 'table',
    config: { max_samples: 8 },
  }),
  sec({ key: 'ferro_alloys', title: 'Alloys', sort_order: 2, section_type: 'repeatable_group' }),
  sec({
    key: 'static_mats',
    title: 'Static',
    sort_order: 3,
    section_type: 'static_material_table',
    config: { materials: [{ code: 'A', label: 'Alloy A' }] },
  }),
  sec({
    key: 'blow',
    title: 'Blow',
    sort_order: 4,
    section_type: 'matrix_table',
    config: {
      rows: ['1', '2'],
      columns: [{ key: 'o2', label: 'O2', type: 'number' }],
    },
  }),
  sec({
    key: 'targets',
    title: 'Targets',
    sort_order: 5,
    section_type: 'target_chemistry',
    config: { elements: ['C', 'Mn'] },
  }),
  sec({
    key: 'samples',
    title: 'Samples',
    sort_order: 6,
    section_type: 'sample_chemistry_matrix',
    config: { sample_rows: ['S1'], elements: ['C'], include_temperature: true },
  }),
  sec({
    key: 'prod',
    title: 'Prod',
    sort_order: 7,
    section_type: 'production_log_table',
    config: {
      default_empty_rows: 1,
      columns: [
        { key: 'heat', label: 'Heat', type: 'heat_ref' },
        { key: 'range', label: 'Range', type: 'time_range' },
        { key: 'strands', label: 'Strands', type: 'strand_pair', subtype: 'number' },
        { key: 'zones', label: 'Zones', type: 'zone_strand' },
        { key: 'mould', label: 'Mould', type: 'mould_tube' },
        { key: 'ladle', label: 'Ladle', type: 'ladle_temp' },
        { key: 'furnace', label: 'Furnace', type: 'furnace_zones' },
        { key: 'coil', label: 'Coil', type: 'coil_ref' },
        { key: 'qty', label: 'Qty', type: 'number' },
      ],
    },
  }),
  sec({
    key: 'delays',
    title: 'Delays',
    sort_order: 8,
    section_type: 'delay_register_table',
    config: { default_empty_rows: 1 },
  }),
  sec({
    key: 'hourly',
    title: 'Hourly',
    sort_order: 9,
    section_type: 'hourly_production_matrix',
    config: {
      hours: ['06-07'],
      rows: [{ key: 'tons', label: 'Tons', type: 'number' }],
    },
  }),
  sec({
    key: 'remarks_signoff',
    title: 'Remarks',
    sort_order: 10,
    section_type: 'fields',
    fields: [
      {
        id: '1',
        name: 'remarks',
        label: 'Remarks',
        field_type: 'textarea',
        required: false,
        sort_order: 0,
        config: {},
      },
    ],
  }),
];

const elements = [
  { element: 'C', min_value: 0.1, max_value: 0.2 },
  { element: 'Mn', min_value: null, max_value: null },
];

const map = initSectionDataMap(fixtures, elements, {});
assert.ok(map.chemistry);
assert.ok(map.ferro_alloys);
assert.ok(map.static_mats);
assert.ok(map.blow);
assert.ok(map.targets);
assert.ok(map.samples);
assert.ok(map.prod);
assert.ok(map.delays);
assert.ok(map.hourly);

const chem = parseChemistryData(undefined, elements);
assert.equal(chem.rows.length, 2);
assert.deepEqual(buildEmptyChemistry(elements).rows.map((r) => r.element), ['C', 'Mn']);

const mat = emptyMaterialSection();
mat.rows.push({ material: '', quantity_kg: null }, { material: 'FeSi', quantity_kg: 10 });
assert.equal(materialSectionToPayload(mat).rows.length, 1);

const staticSec = fixtures.find((s) => s.key === 'static_mats')!;
const staticData = buildStaticMaterialSection([
  { code: 'A', label: 'Alloy A' },
]);
staticData.rows[0].quantity_kg = 5;
const staticPayload = sectionDataToPayload(staticSec, staticData);
assert.ok(Array.isArray(staticPayload));
assert.equal((staticPayload as { material: string }[]).length, 1);
assert.deepEqual(staticMaterialToPayload(staticData), staticPayload);

const prod = buildEmptyProductionLog(
  (fixtures.find((s) => s.key === 'prod')!.config.columns as never[]) ?? [],
  1
);
assert.equal(prod.rows.length, 1);
const vals = prod.rows[0].values;
assert.ok(vals.range && typeof vals.range === 'object');
assert.ok(vals.strands && typeof vals.strands === 'object');
assert.ok(vals.zones && typeof vals.zones === 'object');
assert.ok(vals.mould && typeof vals.mould === 'object');
assert.ok(vals.ladle && typeof vals.ladle === 'object');
assert.ok(vals.furnace && typeof vals.furnace === 'object');
assert.ok(vals.heat && typeof vals.heat === 'object');
assert.ok(vals.coil && typeof vals.coil === 'object');

assert.equal(buildEmptyDelayRegister(2).rows.length, 2);
assert.ok(buildSampleChemistry(['S1'], ['C']).rows[0].elements.C === null);
assert.ok(buildTargetChemistry(elements).targets.C === null);
assert.ok(
  buildEmptyHourlyMatrix(['06-07'], [{ key: 'tons', label: 'Tons', type: 'number' }]).hours[
    '06-07'
  ].tons === null
);
assert.deepEqual(getBlowProcessConfig(fixtures.find((s) => s.key === 'blow')!).rows, ['1', '2']);

const steps = buildCardSteps(fixtures, {
  chemistrySampleCount: { chemistry: 1 },
  materialRowCount: { ferro_alloys: 0 },
  productionRowCount: { prod: 1 },
  delayRowCount: { delays: 1 },
  matrixRowCount: { blow: 2 },
  sampleChemRowCount: { samples: 1 },
  hourlyHours: { hourly: ['06-07'] },
});
const kinds = new Set(steps.map((s) => s.kind));
for (const required of [
  'fields',
  'chemistry_list',
  'chemistry_sample',
  'material_list',
  'static_material',
  'matrix_row',
  'target_chemistry',
  'sample_chemistry_list',
  'sample_chemistry_row',
  'production_list',
  'production_row',
  'delay_list',
  'delay_row',
  'hourly_list',
  'hourly_hour',
] as const) {
  assert.ok(kinds.has(required), `missing step kind ${required}`);
}

// Adapter source files exist (fixture "render" gate for RN)
const requiredFiles = [
  'src/features/run-host/CardStepBody.tsx',
  'src/features/run-host/editors/ComplexCells.tsx',
  'src/features/run-host/section-data/index.ts',
  'src/features/run-host/FieldsStepBody.tsx',
  'src/features/run-host/RemarksPanel.tsx',
];
for (const rel of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const cardBody = fs.readFileSync(path.join(root, 'src/features/run-host/CardStepBody.tsx'), 'utf8');
for (const kind of [
  'chemistry_list',
  'material_list',
  'static_material',
  'matrix_row',
  'target_chemistry',
  'sample_chemistry',
  'production_list',
  'delay_list',
  'hourly_list',
  'ProductionCellEditor',
  'RemarksPanel',
]) {
  assert.ok(cardBody.includes(kind), `CardStepBody missing ${kind}`);
}

const editors = fs.readFileSync(
  path.join(root, 'src/features/run-host/editors/ComplexCells.tsx'),
  'utf8'
);
for (const name of [
  'TimeRangeEditor',
  'StrandPairEditor',
  'ZoneStrandEditor',
  'MouldTubeEditor',
  'LadleTempEditor',
  'FurnaceZonesEditor',
  'HeatRefEditor',
  'CoilRefEditor',
  'ObjectFieldsEditor',
]) {
  assert.ok(editors.includes(`export function ${name}`), `missing editor ${name}`);
}

console.log(
  `section-adapters: ok (${fixtures.length} section fixtures, ${steps.length} card steps, C.1 editors)`
);
