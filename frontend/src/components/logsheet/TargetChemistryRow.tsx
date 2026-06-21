import type { GradeElement, TargetChemistrySectionData } from '../../types';
import { COMPACT_TABLE_XS } from '../reports/compactTableClasses';

export function buildTargetChemistry(elements: GradeElement[]): TargetChemistrySectionData {
  const targets: Record<string, number | null> = {};
  elements.forEach((el) => {
    targets[el.element] = null;
  });
  return { targets };
}

export function parseTargetChemistry(raw: unknown, elements: GradeElement[]): TargetChemistrySectionData {
  if (raw && typeof raw === 'object' && 'targets' in raw) {
    return raw as TargetChemistrySectionData;
  }
  return buildTargetChemistry(elements);
}

interface TargetChemistryRowProps {
  elements: GradeElement[];
  elementCodes?: string[];
  data: TargetChemistrySectionData;
  onChange: (data: TargetChemistrySectionData) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function TargetChemistryRow({
  elements,
  elementCodes,
  data,
  onChange,
  readOnly,
  compact,
}: TargetChemistryRowProps) {
  const tableClass = compact ? COMPACT_TABLE_XS : 'min-w-full border border-slate-300 text-sm';
  const codes = elementCodes ?? elements.map((e) => e.element);
  const specByElement = Object.fromEntries(elements.map((e) => [e.element, e]));

  const update = (element: string, value: string) => {
    onChange({
      targets: {
        ...data.targets,
        [element]: value === '' ? null : Number(value),
      },
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead className={compact ? undefined : 'bg-slate-100'}>
          <tr>
            <th className={compact ? 'whitespace-nowrap' : 'border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700'}>
              {compact ? 'Req. Chem.' : 'Req. Chem.'}
            </th>
            {codes.map((el) => (
              <th
                key={el}
                className={
                  compact ? 'text-center' : 'border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700'
                }
              >
                {el}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!compact && (
            <tr className="bg-slate-50">
              <td className="border border-slate-300 px-3 py-2 text-xs text-slate-500">Spec (min–max)</td>
              {codes.map((el) => {
                const spec = specByElement[el];
                return (
                  <td key={el} className="border border-slate-300 px-2 py-1 text-center text-xs text-slate-500">
                    {spec ? `${spec.min_value}–${spec.max_value}` : '—'}
                  </td>
                );
              })}
            </tr>
          )}
          <tr>
            <td className={compact ? 'font-semibold' : 'border border-slate-300 px-3 py-2 font-medium text-slate-800'}>
              {compact ? 'Target' : 'Target'}
            </td>
            {codes.map((el) => (
              <td key={el} className="border border-slate-300 px-1 py-1">
                {readOnly ? (
                  <span className="block px-1 py-1 text-center text-slate-700">{data.targets[el] ?? '—'}</span>
                ) : (
                  <input
                    type="number"
                    step="any"
                    value={data.targets[el] ?? ''}
                    onChange={(e) => update(el, e.target.value)}
                    className="w-full rounded border border-slate-200 px-1 py-1 text-center text-sm"
                    placeholder="—"
                  />
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
