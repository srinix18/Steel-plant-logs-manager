/**
 * Unit: AOD blow → gas_consumption rollup (P2-SMS-AOD).
 */
import assert from 'node:assert/strict';

import { gasFieldsFromBlow } from '../src/utils/aodGasFromBlow.ts';
import { isAodLadleTemplate } from '../src/utils/heatWorkflowUi.ts';
import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

assert.equal(isAodLadleTemplate(['blow_process', 'alloy_additions']), true);
assert.equal(isAodLadleTemplate(['heat_info', 'charge_mix']), false);

const gas = gasFieldsFromBlow({
  rows: [
    {
      blow_no: 'De-Si',
      values: { consumption_o2: 10, consumption_n2: 2, consumption_ar: 1 },
    },
    {
      blow_no: '1',
      values: { consumption_o2: '5.5', consumption_n2: 0, consumption_ar: 3 },
    },
  ],
});
assert.equal(gas.o2_nm3, '15.5');
assert.equal(gas.n2_nm3, '2');
assert.equal(gas.ar_nm3, '4');

const blowSection: TemplateSection = {
  id: 'blow',
  key: 'blow_process',
  title: 'Blow Process',
  sort_order: 0,
  section_type: 'matrix_table',
  config: {
    rows: ['De-Si', '1', 'VCD'],
    columns: [
      { key: 'time_from', label: 'From', group: 'Time', type: 'datetime' },
      { key: 'consumption_o2', label: 'O2', group: 'Gas Consumption', type: 'number' },
    ],
  },
  fields: [],
};

const steps = buildCardSteps([blowSection], { matrixRowCount: { blow_process: 3 } });
assert.equal(steps.length, 3);
assert.equal(steps[0].label, 'Blow Process — De-Si');
assert.equal(steps[2].label, 'Blow Process — VCD');
assert.equal((blowSection.config.columns as { key: string }[]).length, 2);

console.log('aod-gas-blow: OK');
