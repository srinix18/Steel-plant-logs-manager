import type { TemplateSection } from '@/src/types/processRun';

export type CardStepKind =
  | 'fields'
  | 'chemistry_list'
  | 'chemistry_sample'
  | 'material_list'
  | 'material_row'
  | 'static_material'
  | 'matrix_row'
  | 'target_chemistry'
  | 'sample_chemistry_list'
  | 'sample_chemistry_row'
  | 'production_list'
  | 'production_row'
  | 'delay_list'
  | 'delay_row'
  | 'hourly_list'
  | 'hourly_hour';

export type CardStep = {
  id: string;
  kind: CardStepKind;
  sectionKey: string;
  sectionTitle: string;
  /** Human label for progress UI */
  label: string;
  /** Index into rows/samples/hours when applicable */
  itemIndex?: number;
  /** Hour key for hourly matrix */
  hourKey?: string;
  /** Sample index for chemistry */
  sampleIndex?: number;
};

export type BuildCardStepsOptions = {
  chemistrySampleCount?: Record<string, number>;
  materialRowCount?: Record<string, number>;
  productionRowCount?: Record<string, number>;
  delayRowCount?: Record<string, number>;
  matrixRowCount?: Record<string, number>;
  sampleChemRowCount?: Record<string, number>;
  hourlyHours?: Record<string, string[]>;
};

const ROW_SECTION_TYPES = new Set(['production_log_table', 'production_register_table']);

/**
 * Expand template sections into chronological phone card steps.
 * Row/sample/hour sections become list + item cards.
 * Ported from `frontend/src/components/run-wizard/buildCardSteps.ts` (P2-ENGINE-02).
 */
export function buildCardSteps(
  sections: TemplateSection[],
  options?: BuildCardStepsOptions
): CardStep[] {
  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const steps: CardStep[] = [];

  for (const section of sorted) {
    const st = section.section_type;

    if (st === 'fields') {
      steps.push({
        id: `${section.key}:fields`,
        kind: 'fields',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: section.title,
      });
      continue;
    }

    if (st === 'table' && section.key === 'chemistry') {
      const count = options?.chemistrySampleCount?.[section.key] ?? 1;
      steps.push({
        id: `${section.key}:list`,
        kind: 'chemistry_list',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: `${section.title} — samples`,
      });
      for (let i = 0; i < Math.max(count, 1); i++) {
        steps.push({
          id: `${section.key}:sample:${i}`,
          kind: 'chemistry_sample',
          sectionKey: section.key,
          sectionTitle: section.title,
          label: `${section.title} — sample ${i + 1}`,
          sampleIndex: i,
        });
      }
      continue;
    }

    if (st === 'repeatable_group') {
      const count = options?.materialRowCount?.[section.key] ?? 0;
      steps.push({
        id: `${section.key}:list`,
        kind: 'material_list',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: section.title,
      });
      for (let i = 0; i < count; i++) {
        steps.push({
          id: `${section.key}:row:${i}`,
          kind: 'material_row',
          sectionKey: section.key,
          sectionTitle: section.title,
          label: `${section.title} — row ${i + 1}`,
          itemIndex: i,
        });
      }
      continue;
    }

    if (st === 'static_material_table') {
      steps.push({
        id: `${section.key}:static`,
        kind: 'static_material',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: section.title,
      });
      continue;
    }

    if (st === 'matrix_table') {
      const rowLabels = (section.config.rows as string[] | undefined) ?? [];
      const count = Math.max(
        options?.matrixRowCount?.[section.key] ?? 0,
        rowLabels.length,
        1
      );
      for (let i = 0; i < count; i++) {
        const rowName = rowLabels[i] ?? `blow ${i + 1}`;
        steps.push({
          id: `${section.key}:row:${i}`,
          kind: 'matrix_row',
          sectionKey: section.key,
          sectionTitle: section.title,
          label: `${section.title} — ${rowName}`,
          itemIndex: i,
        });
      }
      continue;
    }

    if (st === 'target_chemistry') {
      steps.push({
        id: `${section.key}:target`,
        kind: 'target_chemistry',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: section.title,
      });
      continue;
    }

    if (st === 'sample_chemistry_matrix') {
      const sampleRows = (section.config.sample_rows as string[] | undefined) ?? [];
      const count = options?.sampleChemRowCount?.[section.key] ?? sampleRows.length;
      steps.push({
        id: `${section.key}:list`,
        kind: 'sample_chemistry_list',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: `${section.title} — samples`,
      });
      for (let i = 0; i < Math.max(count, sampleRows.length, 1); i++) {
        const name = sampleRows[i] ?? `Sample ${i + 1}`;
        steps.push({
          id: `${section.key}:row:${i}`,
          kind: 'sample_chemistry_row',
          sectionKey: section.key,
          sectionTitle: section.title,
          label: `${section.title} — ${name}`,
          itemIndex: i,
        });
      }
      continue;
    }

    if (ROW_SECTION_TYPES.has(st)) {
      const count = options?.productionRowCount?.[section.key] ?? 0;
      steps.push({
        id: `${section.key}:list`,
        kind: 'production_list',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: section.title,
      });
      for (let i = 0; i < Math.max(count, 1); i++) {
        steps.push({
          id: `${section.key}:row:${i}`,
          kind: 'production_row',
          sectionKey: section.key,
          sectionTitle: section.title,
          label: `${section.title} — row ${i + 1}`,
          itemIndex: i,
        });
      }
      continue;
    }

    if (st === 'delay_register_table') {
      const count = options?.delayRowCount?.[section.key] ?? 0;
      steps.push({
        id: `${section.key}:list`,
        kind: 'delay_list',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: section.title,
      });
      for (let i = 0; i < Math.max(count, 1); i++) {
        steps.push({
          id: `${section.key}:row:${i}`,
          kind: 'delay_row',
          sectionKey: section.key,
          sectionTitle: section.title,
          label: `${section.title} — delay ${i + 1}`,
          itemIndex: i,
        });
      }
      continue;
    }

    if (st === 'hourly_production_matrix') {
      const hours =
        options?.hourlyHours?.[section.key] ??
        ((section.config.hours as string[] | undefined) ?? []);
      steps.push({
        id: `${section.key}:list`,
        kind: 'hourly_list',
        sectionKey: section.key,
        sectionTitle: section.title,
        label: `${section.title} — hours`,
      });
      for (const hour of hours) {
        steps.push({
          id: `${section.key}:hour:${hour}`,
          kind: 'hourly_hour',
          sectionKey: section.key,
          sectionTitle: section.title,
          label: `${section.title} — ${hour}`,
          hourKey: hour,
        });
      }
      continue;
    }

    // Fallback: unknown section types as a single card (adapters in P2-ENGINE-03)
    steps.push({
      id: `${section.key}:fallback`,
      kind: 'fields',
      sectionKey: section.key,
      sectionTitle: section.title,
      label: section.title,
    });
  }

  return steps;
}
