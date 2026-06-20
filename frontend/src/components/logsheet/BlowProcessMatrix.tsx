import type { BlowProcessSectionData, MatrixColumnDef, TemplateSection } from '../../types';

export function getBlowProcessConfig(section: TemplateSection) {
  const rows = (section.config.rows as string[] | undefined) ?? [];
  const columns = (section.config.columns as MatrixColumnDef[] | undefined) ?? [];
  return { rows, columns };
}

export function buildBlowProcessSection(rowLabels: string[]): BlowProcessSectionData {
  return {
    rows: rowLabels.map((blow_no) => ({ blow_no, values: {} })),
  };
}

export function parseBlowProcessSection(raw: unknown, rowLabels: string[]): BlowProcessSectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as BlowProcessSectionData).rows)) {
    const parsed = raw as BlowProcessSectionData;
    const byBlow = Object.fromEntries(parsed.rows.map((r) => [r.blow_no, r]));
    return {
      rows: rowLabels.map((blow_no) => byBlow[blow_no] ?? { blow_no, values: {} }),
    };
  }
  return buildBlowProcessSection(rowLabels);
}

interface BlowProcessMatrixProps {
  rowLabels: string[];
  columns: MatrixColumnDef[];
  data: BlowProcessSectionData;
  onChange: (data: BlowProcessSectionData) => void;
  readOnly?: boolean;
}

export function BlowProcessMatrix({ rowLabels, columns, data, onChange, readOnly }: BlowProcessMatrixProps) {
  const rows = data.rows.length > 0 ? data.rows : buildBlowProcessSection(rowLabels).rows;

  const groups = [...new Set(columns.map((c) => c.group))];

  const updateCell = (rowIndex: number, key: string, value: string) => {
    onChange({
      rows: rows.map((row, i) => {
        if (i !== rowIndex) return row;
        const col = columns.find((c) => c.key === key);
        let parsed: string | number | null = value;
        if (col?.type === 'number') {
          parsed = value === '' ? null : Number(value);
        }
        return { ...row, values: { ...row.values, [key]: parsed } };
      }),
    });
  };

  const cellValue = (rowIndex: number, key: string, type: string) => {
    const val = rows[rowIndex]?.values[key];
    if (type === 'datetime' && typeof val === 'string') {
      return val.slice(0, 16);
    }
    return val ?? '';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-slate-300 text-xs">
        <thead className="bg-slate-100">
          <tr>
            <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">
              Blow No.
            </th>
            {groups.map((group) => {
              const cols = columns.filter((c) => c.group === group);
              return (
                <th key={group} colSpan={cols.length} className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-700">
                  {group}
                </th>
              );
            })}
          </tr>
          <tr>
            {groups.flatMap((group) =>
              columns
                .filter((c) => c.group === group)
                .map((col) => (
                  <th key={col.key} className="border border-slate-300 px-2 py-1 text-center font-medium text-slate-600">
                    {col.label}
                  </th>
                )),
            )}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((blowNo, rowIndex) => (
            <tr key={blowNo} className="hover:bg-slate-50">
              <td className="border border-slate-300 px-2 py-1 font-medium text-slate-800 whitespace-nowrap">{blowNo}</td>
              {columns.map((col) => (
                <td key={col.key} className="border border-slate-300 px-1 py-0.5">
                  {readOnly ? (
                    <span className="block px-1 py-1 text-center text-slate-700">
                      {String(rows[rowIndex]?.values[col.key] ?? '—')}
                    </span>
                  ) : (
                    <input
                      type={col.type === 'datetime' ? 'datetime-local' : col.type === 'number' ? 'number' : 'text'}
                      step={col.type === 'number' ? 'any' : undefined}
                      value={cellValue(rowIndex, col.key, col.type) as string}
                      onChange={(e) => {
                        const v =
                          col.type === 'datetime' && e.target.value
                            ? new Date(e.target.value).toISOString()
                            : e.target.value;
                        updateCell(rowIndex, col.key, v);
                      }}
                      className="w-full min-w-[4.5rem] rounded border border-slate-200 px-1 py-1 text-center"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
