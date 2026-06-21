import type { SampleChemistrySectionData } from '../../types';
import { COMPACT_TABLE_XS } from '../reports/compactTableClasses';

export function buildSampleChemistry(sampleRows: string[], elements: string[]): SampleChemistrySectionData {
  return {
    rows: sampleRows.map((sample) => ({
      sample,
      temperature: null,
      elements: Object.fromEntries(elements.map((el) => [el, null])),
    })),
  };
}

export function parseSampleChemistry(
  raw: unknown,
  sampleRows: string[],
  elements: string[],
): SampleChemistrySectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as SampleChemistrySectionData).rows)) {
    const parsed = raw as SampleChemistrySectionData;
    const bySample = Object.fromEntries(parsed.rows.map((r) => [r.sample, r]));
    return {
      rows: sampleRows.map(
        (sample) =>
          bySample[sample] ?? {
            sample,
            temperature: null,
            elements: Object.fromEntries(elements.map((el) => [el, null])),
          },
      ),
    };
  }
  return buildSampleChemistry(sampleRows, elements);
}

interface SampleChemistryMatrixProps {
  sampleRows: string[];
  elements: string[];
  includeTemperature: boolean;
  data: SampleChemistrySectionData;
  onChange: (data: SampleChemistrySectionData) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function SampleChemistryMatrix({
  sampleRows,
  elements,
  includeTemperature,
  data,
  onChange,
  readOnly,
  compact,
}: SampleChemistryMatrixProps) {
  const tableClass = compact ? COMPACT_TABLE_XS : 'min-w-full border border-slate-300 text-xs';
  const rows = data.rows.length > 0 ? data.rows : buildSampleChemistry(sampleRows, elements).rows;

  const updateTemp = (index: number, value: string) => {
    onChange({
      rows: rows.map((row, i) =>
        i === index ? { ...row, temperature: value === '' ? null : Number(value) } : row,
      ),
    });
  };

  const updateElement = (index: number, element: string, value: string) => {
    onChange({
      rows: rows.map((row, i) =>
        i === index
          ? { ...row, elements: { ...row.elements, [element]: value === '' ? null : Number(value) } }
          : row,
      ),
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead className={compact ? undefined : 'bg-slate-100'}>
          <tr>
            <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">Sample No.</th>
            {includeTemperature && (
              <th className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700">Temp. °C</th>
            )}
            {elements.map((el) => (
              <th key={el} className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700">
                {el}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sampleRows.map((sample, rowIndex) => {
            const row = rows[rowIndex];
            return (
              <tr key={sample} className="hover:bg-slate-50">
                <td className="border border-slate-300 px-2 py-1 font-medium text-slate-800 whitespace-nowrap">{sample}</td>
                {includeTemperature && (
                  <td className="border border-slate-300 px-1 py-0.5">
                    {readOnly ? (
                      <span className="block px-1 py-1 text-center">{row?.temperature ?? '—'}</span>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        value={row?.temperature ?? ''}
                        onChange={(e) => updateTemp(rowIndex, e.target.value)}
                        className="w-full min-w-[4rem] rounded border border-slate-200 px-1 py-1 text-center"
                      />
                    )}
                  </td>
                )}
                {elements.map((el) => (
                  <td key={el} className="border border-slate-300 px-1 py-0.5">
                    {readOnly ? (
                      <span className="block px-1 py-1 text-center">{row?.elements[el] ?? '—'}</span>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        value={row?.elements[el] ?? ''}
                        onChange={(e) => updateElement(rowIndex, el, e.target.value)}
                        className="w-full min-w-[3.5rem] rounded border border-slate-200 px-1 py-1 text-center"
                      />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
