import assert from 'node:assert/strict';

import {
  PROCESS_OPTIONS,
  buildCreateRunPayload,
  filterProcessOptions,
  showsGradeField,
  showsShiftField,
  startButtonLabel,
} from '../src/features/shift/processOptions.ts';

assert.deepEqual(
  PROCESS_OPTIONS.map((p) => p.code),
  ['IAF', 'AOD', 'CCM', 'RMILL', 'WFURN', 'WDRAW', 'BBAR', 'PEEL', 'GRIND']
);

const filtered = filterProcessOptions(['IAF', 'BBAR', 'RMILL', 'OTHER']);
assert.deepEqual(
  filtered.map((p) => p.code),
  ['IAF', 'RMILL', 'BBAR']
);

const iaf = PROCESS_OPTIONS.find((p) => p.code === 'IAF')!;
const bbar = PROCESS_OPTIONS.find((p) => p.code === 'BBAR')!;
const rmill = PROCESS_OPTIONS.find((p) => p.code === 'RMILL')!;

assert.equal(showsShiftField(iaf.runType), true);
assert.equal(showsGradeField('IAF', iaf.runType), true);
assert.equal(startButtonLabel('IAF', iaf.runType), 'Start Heat');
assert.deepEqual(
  buildCreateRunPayload({
    runType: iaf.runType,
    shiftId: 'shift-1',
    gradeId: 'grade-1',
    isDaily: false,
    showGrade: true,
  }),
  { run_type: 'heat', shift_id: 'shift-1', grade_id: 'grade-1' }
);

assert.equal(showsShiftField(bbar.runType), false);
assert.equal(showsGradeField('BBAR', bbar.runType), false);
assert.equal(startButtonLabel('BBAR', bbar.runType), 'Start Daily Register');
assert.deepEqual(
  buildCreateRunPayload({
    runType: bbar.runType,
    shiftId: 'shift-1',
    gradeId: 'grade-1',
    isDaily: true,
    showGrade: false,
  }),
  { run_type: 'daily' }
);

assert.equal(showsShiftField(rmill.runType), true);
assert.equal(showsGradeField('RMILL', rmill.runType), true);
assert.equal(startButtonLabel('RMILL', rmill.runType), 'Start Shift Report');
assert.deepEqual(
  buildCreateRunPayload({
    runType: rmill.runType,
    shiftId: 'shift-2',
    gradeId: 'grade-2',
    isDaily: false,
    showGrade: true,
  }),
  { run_type: 'shift', shift_id: 'shift-2', grade_id: 'grade-2' }
);

assert.equal(showsGradeField('CCM', 'cast'), false);
assert.equal(showsShiftField('cast'), true);
assert.equal(startButtonLabel('CCM', 'cast'), 'Start Shift Log');
assert.deepEqual(
  buildCreateRunPayload({
    runType: 'cast',
    shiftId: 'shift-ccm',
    gradeId: 'grade-should-omit',
    isDaily: false,
    showGrade: false,
  }),
  { run_type: 'cast', shift_id: 'shift-ccm' }
);
assert.equal(startButtonLabel('AOD', 'ladle_metallurgy'), 'Start AOD Run');

const peel = PROCESS_OPTIONS.find((p) => p.code === 'PEEL')!;
assert.equal(peel.notDigitized, true);
assert.equal(startButtonLabel('PEEL', peel.runType, true), 'View status');

console.log('processOptions: ok (IAF / CCM no-grade / BBAR daily / RMILL / PEEL blocked)');
