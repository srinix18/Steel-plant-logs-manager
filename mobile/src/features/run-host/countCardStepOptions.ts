import type { BuildCardStepsOptions } from '@/src/features/run-host/buildCardSteps';
import type { TemplateSection } from '@/src/types/processRun';

type SectionDataMap = Record<string, unknown>;

function asRows(data: unknown): unknown[] {
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { rows?: unknown }).rows;
  return Array.isArray(rows) ? rows : [];
}

/**
 * Derive `buildCardSteps` count options from loaded section payloads.
 * Mirrors web `MobileRunWizard` countOptions (P2-ENGINE-02).
 */
export function countCardStepOptions(
  sections: TemplateSection[],
  sectionData: SectionDataMap
): BuildCardStepsOptions {
  const chemistrySampleCount: Record<string, number> = {};
  const materialRowCount: Record<string, number> = {};
  const productionRowCount: Record<string, number> = {};
  const delayRowCount: Record<string, number> = {};
  const matrixRowCount: Record<string, number> = {};
  const sampleChemRowCount: Record<string, number> = {};
  const hourlyHours: Record<string, string[]> = {};

  for (const s of sections) {
    const data = sectionData[s.key];

    if (s.section_type === 'table' && s.key === 'chemistry') {
      const rows = asRows(data) as { samples?: unknown[] }[];
      chemistrySampleCount[s.key] = Math.max(
        1,
        rows.reduce((m, r) => Math.max(m, r.samples?.length ?? 0), 0)
      );
    }

    if (s.section_type === 'repeatable_group') {
      materialRowCount[s.key] = asRows(data).length;
    }

    if (s.section_type === 'production_log_table' || s.section_type === 'production_register_table') {
      productionRowCount[s.key] = Math.max(1, asRows(data).length || 1);
    }

    if (s.section_type === 'delay_register_table') {
      delayRowCount[s.key] = Math.max(1, asRows(data).length || 1);
    }

    if (s.section_type === 'matrix_table') {
      matrixRowCount[s.key] = Math.max(1, asRows(data).length || 1);
    }

    if (s.section_type === 'sample_chemistry_matrix') {
      const configRows = (s.config.sample_rows as string[] | undefined)?.length ?? 1;
      sampleChemRowCount[s.key] = Math.max(1, asRows(data).length || configRows);
    }

    if (s.section_type === 'hourly_production_matrix') {
      hourlyHours[s.key] = (s.config.hours as string[] | undefined) ?? [];
    }
  }

  return {
    chemistrySampleCount,
    materialRowCount,
    productionRowCount,
    delayRowCount,
    matrixRowCount,
    sampleChemRowCount,
    hourlyHours,
  };
}
