import assert from 'node:assert/strict';

import { buildCardSteps } from '../src/features/run-host/buildCardSteps.ts';
import { countCardStepOptions } from '../src/features/run-host/countCardStepOptions.ts';
import type { TemplateSection } from '../src/types/processRun.ts';

/** Minimal IAF F/PRD/02 section skeleton (matches seed_moi order). */
function iafSections(): TemplateSection[] {
  const base = (
    partial: Partial<TemplateSection> &
      Pick<TemplateSection, 'key' | 'title' | 'sort_order' | 'section_type'>
  ): TemplateSection => ({
    id: partial.key,
    config: {},
    fields: [],
    ...partial,
  });

  return [
    base({ key: 'heat_info', title: 'Heat Information', sort_order: 0, section_type: 'fields' }),
    base({ key: 'timing_equipment', title: 'Timing & Equipment', sort_order: 1, section_type: 'fields' }),
    base({
      key: 'chemistry',
      title: 'Chemical Composition',
      sort_order: 2,
      section_type: 'table',
      config: { max_samples: 8 },
    }),
    base({
      key: 'ferro_alloys',
      title: 'Ferro Alloy Additions',
      sort_order: 3,
      section_type: 'repeatable_group',
    }),
    base({ key: 'charge_mix', title: 'Charge Mix', sort_order: 4, section_type: 'repeatable_group' }),
    base({ key: 'electrical_power', title: 'Electrical & Power', sort_order: 5, section_type: 'fields' }),
    base({ key: 'furnace_status', title: 'Furnace Status', sort_order: 6, section_type: 'fields' }),
    base({ key: 'remarks_signoff', title: 'Remarks & Sign-off', sort_order: 7, section_type: 'fields' }),
  ];
}

// --- empty chemistry: list + ≥1 sample ---
{
  const sections = iafSections();
  const options = countCardStepOptions(sections, {});
  const steps = buildCardSteps(sections, options);

  const chem = steps.filter((s) => s.sectionKey === 'chemistry');
  assert.equal(chem.length, 2, 'empty chemistry → list + 1 sample');
  assert.equal(chem[0].kind, 'chemistry_list');
  assert.equal(chem[1].kind, 'chemistry_sample');
  assert.equal(chem[1].sampleIndex, 0);
  assert.ok(chem.length >= 2, 'list + ≥1 sample');

  // 5 fields sections + chemistry(2) + 2 material lists + tap card = 10
  assert.equal(steps.length, 10, `IAF empty chemistry step count, got ${steps.length}`);
  assert.equal(steps.find((s) => s.id === 'timing_equipment:power')?.label, 'Power on & equipment');
  assert.equal(steps.find((s) => s.id === 'timing_equipment:tap')?.label, 'Tapping');
  assert.deepEqual(
    steps.map((s) => `${s.sectionKey}:${s.kind}:${s.id.split(':').pop()}`),
    [
      'heat_info:fields:fields',
      'timing_equipment:fields:power',
      'chemistry:chemistry_list:list',
      'chemistry:chemistry_sample:0',
      'ferro_alloys:material_list:list',
      'charge_mix:material_list:list',
      'timing_equipment:fields:tap',
      'electrical_power:fields:fields',
      'furnace_status:fields:fields',
      'remarks_signoff:fields:fields',
    ]
  );
}

// --- chemistry with 3 samples expands ---
{
  const sections = iafSections();
  const steps = buildCardSteps(sections, { chemistrySampleCount: { chemistry: 3 } });
  const chem = steps.filter((s) => s.sectionKey === 'chemistry');
  assert.equal(chem.length, 4); // list + 3 samples
  assert.equal(chem.filter((s) => s.kind === 'chemistry_sample').length, 3);
}

// --- material rows expand ---
{
  const sections = iafSections();
  const steps = buildCardSteps(sections, {
    materialRowCount: { ferro_alloys: 2, charge_mix: 0 },
  });
  const ferro = steps.filter((s) => s.sectionKey === 'ferro_alloys');
  assert.equal(ferro.length, 3); // list + 2 rows
  assert.equal(ferro[1].kind, 'material_row');
  assert.equal(ferro[1].itemIndex, 0);
}

// --- sort_order respected ---
{
  const steps = buildCardSteps([
    {
      id: 'b',
      key: 'b',
      title: 'B',
      sort_order: 2,
      section_type: 'fields',
      config: {},
      fields: [],
    },
    {
      id: 'a',
      key: 'a',
      title: 'A',
      sort_order: 1,
      section_type: 'fields',
      config: {},
      fields: [],
    },
  ]);
  assert.deepEqual(
    steps.map((s) => s.sectionKey),
    ['a', 'b']
  );
}

// --- countCardStepOptions from empty chemistry payload ---
{
  const options = countCardStepOptions(iafSections(), { chemistry: { rows: [] } });
  assert.equal(options.chemistrySampleCount?.chemistry, 1);
  assert.equal(options.materialRowCount?.ferro_alloys, 0);
}

console.log('buildCardSteps: ok (IAF empty chemistry + tap card, total 10)');
