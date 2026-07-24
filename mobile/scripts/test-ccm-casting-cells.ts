/**
 * Unit: CCM casting column editors / empty row shapes (P2-SMS-CCM).
 */
import assert from 'node:assert/strict';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import {
  buildEmptyProductionLog,
  buildEmptyProductionRow,
  computeTotalMinutes,
  emptyMouldTube,
  emptyTimeRange,
  emptyZoneStrand,
} from '../src/features/run-host/section-data/index.ts';
import type { ProductionLogColumnDef } from '../src/features/run-host/section-data/types.ts';
import { isCcmCastTemplate } from '../src/utils/heatWorkflowUi.ts';
import { formatDurationMinutes } from '../src/utils/formulaEngine.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

assert.equal(isCcmCastTemplate(['shift_header', 'casting_entries']), true);
assert.equal(isCcmCastTemplate(['heat_info', 'charge_mix']), false);

const columns: ProductionLogColumnDef[] = [
  { key: 'heat_no', label: 'Heat', type: 'text' },
  { key: 'start_pouring', label: 'Start Pouring', type: 'datetime' },
  { key: 'purging_time', label: 'Purging', type: 'time_range' },
  {
    key: 'cast_start',
    label: 'Cast Start',
    type: 'strand_pair',
    subtype: 'datetime',
  },
  {
    key: 'cast_end',
    label: 'Cast End',
    type: 'strand_pair',
    subtype: 'datetime',
  },
  { key: 'water_flow_secondary', label: 'Secondary', type: 'zone_strand' },
  { key: 'mould_tube', label: 'Mould', type: 'mould_tube' },
];

const row = buildEmptyProductionRow(columns);
assert.deepEqual(row.values.purging_time, emptyTimeRange());
assert.deepEqual(row.values.mould_tube, emptyMouldTube());
assert.deepEqual(row.values.water_flow_secondary, emptyZoneStrand());
assert.equal(row.values.start_pouring, null);

const log = buildEmptyProductionLog(columns, 5);
assert.equal(log.rows.length, 5);

const start = '2026-07-24T10:00:00.000Z';
const end = '2026-07-24T11:30:00.000Z';
assert.equal(computeTotalMinutes(start, end), 90);
assert.equal(formatDurationMinutes(90), '1h 30m');

const section: TemplateSection = {
  id: 'ce',
  key: 'casting_entries',
  title: 'Casting',
  sort_order: 1,
  section_type: 'production_log_table',
  config: { columns, default_empty_rows: 5 },
  fields: [],
};
const header: TemplateSection = {
  id: 'sh',
  key: 'shift_header',
  title: 'Shift',
  sort_order: 0,
  section_type: 'fields',
  config: {},
  fields: [],
};
const steps = buildCardSteps([header, section], {
  productionRowCount: { casting_entries: 5 },
});
assert.ok(steps.some((s) => s.kind === 'production_list'));
assert.equal(steps.filter((s) => s.kind === 'production_row').length, 5);

console.log('ccm-casting-cells: OK');
