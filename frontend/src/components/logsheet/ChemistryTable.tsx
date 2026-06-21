import type { ChemistryRow, ChemistrySectionData, GradeElement } from '../../types';
import { Button } from '../ui/Button';
import { COMPACT_TABLE } from '../reports/compactTableClasses';

interface ChemistryTableProps {
  elements: GradeElement[];
  data: ChemistrySectionData;
  maxSamples: number;
  onChange: (data: ChemistrySectionData) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function buildEmptyChemistry(elements: GradeElement[]): ChemistrySectionData {
  return {
    rows: elements.map((el) => ({
      element: el.element,
      min: el.min_value,
      max: el.max_value,
      samples: [],
    })),
  };
}

export function parseChemistryData(raw: unknown, elements: GradeElement[]): ChemistrySectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as ChemistrySectionData).rows)) {
    const parsed = raw as ChemistrySectionData;
    if (parsed.rows.length > 0) return parsed;
  }
  return buildEmptyChemistry(elements);
}

export function ChemistryTable({ elements, data, maxSamples, onChange, readOnly, compact }: ChemistryTableProps) {
  const rows = data.rows.length > 0 ? data.rows : buildEmptyChemistry(elements).rows;
  const effectiveMax = compact ? Math.min(maxSamples, 5) : maxSamples;
  const sampleCount = Math.min(
    rows.reduce((max, row) => Math.max(max, row.samples.length), 0),
    effectiveMax,
  );
  const tableClass = compact ? COMPACT_TABLE : 'min-w-full border border-slate-300 text-sm';
  const sampleLabels = compact
    ? ['1st SAMPLE', '2nd SAMPLE', '3rd SAMPLE', '4th SAMPLE', '5th SAMPLE']
    : null;

  const updateRow = (index: number, patch: Partial<ChemistryRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ rows: next });
  };

  const updateSample = (rowIndex: number, sampleIndex: number, value: string) => {
    const row = rows[rowIndex];
    const samples = [...row.samples];
    while (samples.length <= sampleIndex) samples.push(null);
    samples[sampleIndex] = value === '' ? null : Number(value);
    updateRow(rowIndex, { samples });
  };

  const addSample = () => {
    if (sampleCount >= maxSamples) return;
    onChange({
      rows: rows.map((row) => ({ ...row, samples: [...row.samples, null] })),
    });
  };

  const removeSample = (sampleIndex: number) => {
    onChange({
      rows: rows.map((row) => ({
        ...row,
        samples: row.samples.filter((_, i) => i !== sampleIndex),
      })),
    });
  };

  if (elements.length === 0) {
    return <p className="text-sm text-slate-500">No grade specification loaded for chemistry limits.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead className={compact ? undefined : 'bg-slate-100'}>
            <tr>
              <th className={compact ? '' : 'border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700'}>
                {compact ? '' : 'Element'}
              </th>
              {!compact && (
                <>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">Min</th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">Max</th>
                </>
              )}
              {Array.from({ length: sampleCount }, (_, i) => (
                <th
                  key={i}
                  className={
                    compact ? 'text-center' : 'border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700'
                  }
                >
                  <div className="flex items-center justify-center gap-1">
                    {sampleLabels ? sampleLabels[i] : `Sample ${i + 1}`}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeSample(i)}
                        className="text-xs text-red-500 hover:text-red-700"
                        title="Remove sample column"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.element} className={compact ? undefined : 'hover:bg-slate-50'}>
                <td className={compact ? 'font-semibold' : 'border border-slate-300 px-3 py-2 font-medium text-slate-800'}>
                  {row.element}
                </td>
                {!compact && (
                  <>
                    <td className="border border-slate-300 px-3 py-2 text-center text-slate-600">{row.min}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-slate-600">{row.max}</td>
                  </>
                )}
                {Array.from({ length: sampleCount }, (_, sampleIndex) => (
                  <td
                    key={sampleIndex}
                    className={compact ? 'text-center' : 'border border-slate-300 px-2 py-1'}
                  >
                    {readOnly ? (
                      <span className="block px-1 py-1 text-center text-slate-700">
                        {row.samples[sampleIndex] ?? '—'}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        value={row.samples[sampleIndex] ?? ''}
                        onChange={(e) => updateSample(rowIndex, sampleIndex, e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-center text-sm"
                        placeholder="—"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && sampleCount < effectiveMax && (
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={addSample}>
          + Add sample column
        </Button>
      )}
    </div>
  );
}
