export interface HourlyMatrixRowDef {
  key: string;
  label: string;
  type: string;
}

export interface HourlyMatrixSectionData {
  hours: Record<string, Record<string, string | number | null>>;
}

function emptyHour(rowKeys: string[]): Record<string, string | number | null> {
  const hour: Record<string, string | number | null> = {};
  for (const rk of rowKeys) hour[rk] = null;
  return hour;
}

export function buildEmptyHourlyMatrix(
  hours: string[],
  rows: HourlyMatrixRowDef[],
): HourlyMatrixSectionData {
  const rowKeys = rows.map((r) => r.key);
  const data: Record<string, Record<string, string | number | null>> = {};
  for (const h of hours) {
    data[h] = emptyHour(rowKeys);
  }
  return { hours: data };
}

export function parseHourlyMatrix(
  raw: unknown,
  hours: string[],
  rows: HourlyMatrixRowDef[],
): HourlyMatrixSectionData {
  const empty = buildEmptyHourlyMatrix(hours, rows);
  if (!raw || typeof raw !== 'object' || !('hours' in raw)) return empty;
  const parsed = raw as HourlyMatrixSectionData;
  const merged = { ...empty.hours };
  for (const h of hours) {
    merged[h] = { ...empty.hours[h], ...(parsed.hours?.[h] ?? {}) };
  }
  return { hours: merged };
}

export function getHourlyMatrixConfig(section: { config: Record<string, unknown> }) {
  const hours = (section.config.hours as string[] | undefined) ?? [];
  const rows = (section.config.rows as HourlyMatrixRowDef[] | undefined) ?? [];
  return { hours, rows };
}

interface HourlyProductionMatrixProps {
  hours: string[];
  rows: HourlyMatrixRowDef[];
  data: HourlyMatrixSectionData;
  onChange: (data: HourlyMatrixSectionData) => void;
  readOnly?: boolean;
}

export function HourlyProductionMatrix({
  hours,
  rows,
  data,
  onChange,
  readOnly,
}: HourlyProductionMatrixProps) {
  const hourData = data.hours;

  const updateCell = (hour: string, rowKey: string, raw: string) => {
    const rowDef = rows.find((r) => r.key === rowKey);
    let value: string | number | null = raw;
    if (rowDef?.type === 'integer' || rowDef?.type === 'number') {
      value = raw === '' ? null : Number(raw);
    }
    onChange({
      hours: {
        ...hourData,
        [hour]: { ...hourData[hour], [rowKey]: value },
      },
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-slate-300 text-xs">
        <thead className="bg-slate-100">
          <tr>
            <th className="border border-slate-300 px-2 py-1 text-left">Metric</th>
            {hours.map((h) => (
              <th key={h} className="border border-slate-300 px-2 py-1 text-center">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="border border-slate-300 px-2 py-1 font-medium">{row.label}</td>
              {hours.map((h) => {
                const val = hourData[h]?.[row.key];
                if (readOnly) {
                  return (
                    <td key={h} className="border border-slate-300 px-2 py-1 text-center">
                      {val ?? '—'}
                    </td>
                  );
                }
                return (
                  <td key={h} className="border border-slate-300 px-1 py-1">
                    <input
                      type={row.type === 'text' ? 'text' : 'number'}
                      value={val ?? ''}
                      onChange={(e) => updateCell(h, row.key, e.target.value)}
                      className="w-full min-w-[3rem] rounded border border-slate-200 px-1 py-0.5 text-center"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
