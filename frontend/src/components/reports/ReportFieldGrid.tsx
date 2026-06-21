import type { TemplateField } from '../../types';
import { formatFieldValue } from './reportFieldUtils';
import type { SectionRenderContext } from '../../types';

interface ReportFieldGridProps {
  fields: TemplateField[];
  fieldValues: Record<string, string>;
  ctx: SectionRenderContext;
  columns?: number;
  layout?: 'row' | 'stack';
  gradeLabel?: string;
}

export function ReportFieldGrid({
  fields,
  fieldValues,
  ctx,
  layout = 'row',
  gradeLabel,
}: ReportFieldGridProps) {
  if (fields.length === 0) return null;

  if (layout === 'stack') {
    return (
      <table className="report-table-compact w-full text-[8px]">
        <tbody>
          {fields.map((f) => (
            <tr key={f.name}>
              <td className="w-[40%] bg-neutral-100 font-semibold">{f.label}</td>
              <td>{formatFieldValue(f, fieldValues[f.name] ?? '', { steelGrades: ctx.steelGrades, gradeLabel, plantUsers: ctx.plantUsers, currentUser: ctx.currentUser })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="report-table-compact w-full text-[8px]">
      <thead>
        <tr>
          {fields.map((f) => (
            <th key={f.name} className="whitespace-nowrap">
              {f.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {fields.map((f) => (
            <td key={f.name} className="text-center">
              {formatFieldValue(f, fieldValues[f.name] ?? '', { steelGrades: ctx.steelGrades, gradeLabel, plantUsers: ctx.plantUsers, currentUser: ctx.currentUser })}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

interface ReportLabeledValueProps {
  label: string;
  value: string;
  className?: string;
}

export function ReportLabeledValue({ label, value, className = '' }: ReportLabeledValueProps) {
  return (
    <div className={className}>
      <span className="report-field-label">{label}</span>
      <div className="report-field-value">{value || '—'}</div>
    </div>
  );
}

interface ReportSignatureRowProps {
  items: { label: string; value: string }[];
}

export function ReportSignatureRow({ items }: ReportSignatureRowProps) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-[8px] font-semibold">{item.label}</p>
          <div className="report-signature-box">{item.value || ' '}</div>
        </div>
      ))}
    </div>
  );
}
