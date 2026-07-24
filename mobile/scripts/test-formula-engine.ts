/**
 * Unit: formulaEngine — process_time / tap_to_tap / power_total style diffs.
 */
import assert from 'node:assert/strict';

import {
  evaluateFormula,
  formatDurationMinutes,
  mergeCalculatedIntoFields,
} from '../src/utils/formulaEngine.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

function section(fields: TemplateSection['fields']): TemplateSection {
  return {
    id: 's1',
    key: 'timing',
    title: 'Timing',
    sort_order: 0,
    section_type: 'fields',
    config: {},
    fields,
  };
}

function field(
  name: string,
  field_type: string,
  formula?: string
): TemplateSection['fields'][number] {
  return {
    id: name,
    name,
    label: name,
    field_type,
    required: false,
    sort_order: 0,
    config: {},
    formula: formula ?? null,
  };
}

const powerOn = '2026-07-22T10:00:00.000Z';
const tapping = '2026-07-22T11:30:00.000Z';

assert.equal(formatDurationMinutes(90), '1h 30m');
assert.equal(formatDurationMinutes(45), '45m');

assert.equal(
  evaluateFormula(
    'tapping_time - power_on_time',
    { tapping_time: tapping, power_on_time: powerOn },
    { tapping_time: 'datetime', power_on_time: 'datetime' }
  ),
  '1h 30m'
);

assert.equal(
  evaluateFormula(
    'power_final - power_initial',
    { power_final: '1200', power_initial: '100' },
    { power_final: 'number', power_initial: 'number' }
  ),
  '1100'
);

const sections = [
  section([
    field('power_on_time', 'datetime'),
    field('tapping_time', 'datetime'),
    field('process_time', 'calculated', 'tapping_time - power_on_time'),
    field('power_initial', 'number'),
    field('power_final', 'number'),
    field('power_total', 'calculated', 'power_final - power_initial'),
  ]),
];

const merged = mergeCalculatedIntoFields(sections, {
  power_on_time: powerOn,
  tapping_time: tapping,
  power_initial: '50',
  power_final: '250',
});

assert.equal(merged.process_time, '1h 30m');
assert.equal(merged.power_total, '200');

console.log('formula-engine: OK');
