import type { SectionRenderContext, SteelGrade, TemplateField, TemplateSection, TemplateSummary, TemplateVersionSummary, ProcessRunDetail, User } from '../../types';
import { resolveUserDisplay } from '../../utils/userLookup';

export type SectionDataMap = Record<string, unknown>;

export interface LogSheetReportProps {
  run: ProcessRunDetail;
  sections: TemplateSection[];
  fieldValues: Record<string, string>;
  sectionDataMap: SectionDataMap;
  renderCtx: SectionRenderContext;
  templateMeta: TemplateSummary | null;
  versionMeta: TemplateVersionSummary | null;
  gradeLabel: string;
}

export function findSection(sections: TemplateSection[], key: string): TemplateSection | undefined {
  return sections.find((s) => s.key === key);
}

export function sectionFields(sections: TemplateSection[], key: string): TemplateField[] {
  return findSection(sections, key)?.fields ?? [];
}

export function fieldVal(fieldValues: Record<string, string>, key: string): string {
  return fieldValues[key] ?? '';
}

export function formatReportDateTime(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function formatReportDate(value: string): string {
  if (!value) return '—';
  if (value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export function formatFieldValue(
  field: TemplateField,
  value: string,
  ctx: {
    steelGrades?: SteelGrade[];
    gradeLabel?: string;
    plantUsers?: User[];
    currentUser?: User | null;
  },
): string {
  if (!value) return '—';
  switch (field.field_type) {
    case 'datetime':
      return formatReportDateTime(value);
    case 'date':
      return formatReportDate(value);
    case 'grade_ref':
      return ctx.steelGrades?.find((g) => g.id === value)?.code ?? ctx.gradeLabel ?? value;
    case 'user_ref':
      return resolveUserDisplay(value, ctx.plantUsers, ctx.currentUser);
    case 'calculated': {
      const num = Number(value);
      if (Number.isFinite(num) && num < 0) return '—';
      return value;
    }
    default:
      return value;
  }
}

export function formatDocDate(versionMeta: TemplateVersionSummary | null): string {
  if (!versionMeta?.effective_from) return '—';
  return formatReportDate(versionMeta.effective_from);
}
