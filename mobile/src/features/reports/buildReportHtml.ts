import type { TemplateField, TemplateSection } from '@/src/types/processRun';
import type { SteelGrade } from '@/src/features/run-host/section-data/types';
import type { User } from '@/src/types/user';
import { formatReportDate, formatReportDateTime } from '@/src/features/reports/reportMeta';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatField(
  field: TemplateField,
  value: string,
  grades: SteelGrade[],
  users: User[]
): string {
  if (!value) return '—';
  switch (field.field_type) {
    case 'datetime':
      return formatReportDateTime(value);
    case 'date':
      return formatReportDate(value);
    case 'grade_ref':
      return grades.find((g) => g.id === value)?.code ?? value;
    case 'user_ref': {
      const u = users.find((x) => x.id === value);
      return u ? u.full_name : value;
    }
    default:
      return value;
  }
}

function summarizeSectionData(data: unknown): string {
  if (data == null) return '';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export function buildReportHtml(opts: {
  runNumber: string;
  runState: string;
  runType: string;
  docNo?: string | null;
  templateName?: string | null;
  sections: TemplateSection[];
  fieldValues: Record<string, string>;
  sectionDataMap: Record<string, unknown>;
  steelGrades: SteelGrade[];
  plantUsers: User[];
}): string {
  const fieldBlocks = opts.sections
    .filter((s) => s.section_type === 'fields' && s.fields.length)
    .map((s) => {
      const rows = s.fields
        .map((f) => {
          const raw = opts.fieldValues[f.name] ?? '';
          const display = formatField(f, raw, opts.steelGrades, opts.plantUsers);
          return `<tr><th>${escapeHtml(f.label)}</th><td>${escapeHtml(display)}</td></tr>`;
        })
        .join('');
      return `<section><h2>${escapeHtml(s.title)}</h2><table>${rows}</table></section>`;
    })
    .join('\n');

  const dataBlocks = opts.sections
    .filter((s) => s.section_type !== 'fields')
    .map((s) => {
      const raw = opts.sectionDataMap[s.key];
      const body = escapeHtml(summarizeSectionData(raw));
      return `<section><h2>${escapeHtml(s.title)}</h2><pre>${body || '—'}</pre></section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.runNumber)} — MOI Report</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #0f172a; }
  h1 { font-size: 1.35rem; margin: 0 0 4px; }
  .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 24px; }
  section { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
  h2 { font-size: 1.05rem; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  th { width: 40%; color: #475569; font-weight: 600; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 0.8rem; background: #f8fafc; padding: 12px; border-radius: 8px; }
</style>
</head>
<body>
  <h1>${escapeHtml(opts.runNumber)}</h1>
  <p class="meta">
    ${escapeHtml(opts.templateName ?? 'Log sheet')}
    ${opts.docNo ? ` · ${escapeHtml(opts.docNo)}` : ''}
    · ${escapeHtml(opts.runType)} · ${escapeHtml(opts.runState.replace(/_/g, ' '))}
  </p>
  ${fieldBlocks}
  ${dataBlocks}
</body>
</html>`;
}
