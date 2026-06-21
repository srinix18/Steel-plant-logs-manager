import type {
  LadleTempValue,
  ProductionLogCellValue,
  ProductionLogColumnDef,
  ProductionLogRow,
  ProductionLogSectionData,
  SteelGrade,
  TemplateSection,
} from '../../types';
import { Button } from '../ui/Button';
import { MouldTubeCell, emptyMouldTube } from './MouldTubeCell';
import { StrandPairCell, emptyStrandPair } from './StrandPairCell';
import { TimeRangeCell, computeTotalMinutes, emptyTimeRange } from './TimeRangeCell';
import { formatDurationMinutes } from '../../utils/formulaEngine';
import { COMPACT_TABLE_XS } from '../reports/compactTableClasses';
import { ZoneStrandCell, emptyZoneStrand } from './ZoneStrandCell';

function cellHasValue(val: ProductionLogCellValue): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'string') return val.length > 0;
  if (typeof val === 'object') {
    return Object.values(val as object).some((v) => {
      if (v === null || v === '') return false;
      if (typeof v === 'object' && v !== null) return cellHasValue(v as ProductionLogCellValue);
      return true;
    });
  }
  return true;
}

function rowHasData(row: ProductionLogRow, columns: ProductionLogColumnDef[]): boolean {
  return columns.some((col) => cellHasValue(row.values[col.key] ?? null));
}

export function getProductionLogConfig(section: TemplateSection) {
  const columns = (section.config.columns as ProductionLogColumnDef[] | undefined) ?? [];
  const defaultEmptyRows = (section.config.default_empty_rows as number | undefined) ?? 5;
  return { columns, defaultEmptyRows };
}

function emptyLadleTemp(fields: ProductionLogColumnDef['fields']): LadleTempValue {
  const result = { before_purging: null, after_purging: null } as LadleTempValue;
  if (fields) {
    for (const f of fields) {
      if (f.key === 'before_purging' || f.key === 'after_purging') {
        result[f.key] = null;
      }
    }
  }
  return result;
}

function emptyCellValue(col: ProductionLogColumnDef): ProductionLogCellValue {
  switch (col.type) {
    case 'object':
      return emptyLadleTemp(col.fields);
    case 'time_range':
      return emptyTimeRange();
    case 'strand_pair':
      return emptyStrandPair();
    case 'zone_strand':
      return emptyZoneStrand();
    case 'mould_tube':
      return emptyMouldTube();
    default:
      return null;
  }
}

function emptyRow(columns: ProductionLogColumnDef[]): ProductionLogRow {
  const values: Record<string, ProductionLogCellValue> = {};
  for (const col of columns) {
    values[col.key] = emptyCellValue(col);
  }
  return { values };
}

export function buildEmptyProductionLog(columns: ProductionLogColumnDef[], rowCount = 5): ProductionLogSectionData {
  return { rows: Array.from({ length: rowCount }, () => emptyRow(columns)) };
}

export function parseProductionLog(
  raw: unknown,
  columns: ProductionLogColumnDef[],
  defaultEmptyRows: number,
): ProductionLogSectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as ProductionLogSectionData).rows)) {
    const parsed = raw as ProductionLogSectionData;
    if (parsed.rows.length > 0) {
      return {
        rows: parsed.rows.map((row) => {
          const values: Record<string, ProductionLogCellValue> = {};
          for (const col of columns) {
            values[col.key] = row.values?.[col.key] ?? emptyCellValue(col);
          }
          return { values };
        }),
      };
    }
  }
  return buildEmptyProductionLog(columns, defaultEmptyRows);
}

function columnColSpan(col: ProductionLogColumnDef): number {
  switch (col.type) {
    case 'object':
      return col.fields?.length ?? 1;
    case 'time_range':
      return 3;
    case 'strand_pair':
      return 2;
    case 'zone_strand':
      return 4;
    case 'mould_tube':
      return 4;
    default:
      return 1;
  }
}

function subHeaders(col: ProductionLogColumnDef): string[] {
  switch (col.type) {
    case 'object':
      return (col.fields ?? []).map((f) => f.label);
    case 'time_range':
      return col.key === 'sen_preheating' ? ['Start', 'Finish', 'Total'] : ['Start', 'End', 'Total'];
    case 'strand_pair':
      return ['ST 1', 'ST 2'];
    case 'zone_strand':
      return ['Z1 · ST1', 'Z1 · ST2', 'Z2 · ST1', 'Z2 · ST2'];
    case 'mould_tube':
      return ['S1 No', 'S1 Life', 'S2 No', 'S2 Life'];
    default:
      return [col.label];
  }
}

interface HeaderGroup {
  mergeKey: string | null;
  name: string;
  columns: ProductionLogColumnDef[];
  colSpan: number;
}

function buildHeaderGroups(columns: ProductionLogColumnDef[]): HeaderGroup[] {
  const groups: HeaderGroup[] = [];
  for (const col of columns) {
    const span = columnColSpan(col);
    const mergeKey = col.group ?? null;
    const last = groups[groups.length - 1];
    if (mergeKey && last?.mergeKey === mergeKey) {
      last.columns.push(col);
      last.colSpan += span;
    } else {
      groups.push({
        mergeKey,
        name: mergeKey ?? col.label,
        columns: [col],
        colSpan: span,
      });
    }
  }
  for (const group of groups) {
    if (group.columns.length === 1) {
      group.name = group.columns[0].label;
    }
  }
  return groups;
}

function strandCastDuration(
  start: string | number | null | undefined,
  end: string | number | null | undefined,
): string | null {
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const minutes = computeTotalMinutes(start, end);
  return minutes != null ? formatDurationMinutes(minutes) : null;
}

interface ConcastProductionTableProps {
  columns: ProductionLogColumnDef[];
  data: ProductionLogSectionData;
  grades: SteelGrade[];
  onChange: (data: ProductionLogSectionData) => void;
  readOnly?: boolean;
  compact?: boolean;
  filterEmptyRows?: boolean;
}

export function ConcastProductionTable({
  columns,
  data,
  grades,
  onChange,
  readOnly,
  compact,
  filterEmptyRows,
}: ConcastProductionTableProps) {
  const allRows = data.rows.length > 0 ? data.rows : buildEmptyProductionLog(columns).rows;
  const rows = filterEmptyRows ? allRows.filter((row) => rowHasData(row, columns)) : allRows;
  const cellText = compact ? 'text-[7px]' : 'text-[10px]';
  const tableClass = compact ? COMPACT_TABLE_XS : 'min-w-full border border-slate-300 text-xs';

  const updateCell = (rowIndex: number, key: string, value: ProductionLogCellValue) => {
    onChange({
      rows: rows.map((row, i) => (i === rowIndex ? { values: { ...row.values, [key]: value } } : row)),
    });
  };

  const updateScalar = (rowIndex: number, col: ProductionLogColumnDef, raw: string) => {
    let parsed: ProductionLogCellValue = raw;
    if (col.type === 'number' || col.type === 'integer') {
      parsed = raw === '' ? null : Number(raw);
    } else if (col.type === 'datetime') {
      parsed = raw ? new Date(raw).toISOString() : null;
    }
    updateCell(rowIndex, col.key, parsed);
  };

  const addRow = () => {
    onChange({ rows: [...rows, emptyRow(columns)] });
  };

  const removeRow = (rowIndex: number) => {
    if (rows.length <= 1) return;
    onChange({ rows: rows.filter((_, i) => i !== rowIndex) });
  };

  const renderCell = (rowIndex: number, col: ProductionLogColumnDef) => {
    const val = rows[rowIndex]?.values[col.key];

    if (col.type === 'object' && col.fields) {
      const objVal = (val as LadleTempValue) ?? emptyLadleTemp(col.fields);
      if (readOnly) {
        return (
          <div className={`flex gap-1 ${cellText}`}>
            {col.fields.map((f) => (
              <span key={f.key} className="min-w-[3.5rem] text-center">
                {String(objVal[f.key as keyof LadleTempValue] ?? '—')}
              </span>
            ))}
          </div>
        );
      }
      return (
        <div className="flex gap-1">
          {col.fields.map((f) => (
            <input
              key={f.key}
              type={f.type === 'number' ? 'number' : 'text'}
              title={f.label}
              value={objVal[f.key as keyof LadleTempValue] ?? ''}
              onChange={(e) => {
                const next = { ...objVal };
                const parsed =
                  f.type === 'number'
                    ? e.target.value === ''
                      ? null
                      : Number(e.target.value)
                    : e.target.value;
                (next as Record<string, string | number | null>)[f.key] = parsed;
                updateCell(rowIndex, col.key, next);
              }}
              className="w-[4rem] rounded border border-slate-200 px-1 py-0.5 text-center text-[10px]"
            />
          ))}
        </div>
      );
    }

    if (col.type === 'time_range') {
      return (
        <TimeRangeCell
          value={(val as ReturnType<typeof emptyTimeRange>) ?? emptyTimeRange()}
          onChange={(v) => updateCell(rowIndex, col.key, v)}
          readOnly={readOnly}
          endLabel={col.key === 'sen_preheating' ? 'Finish' : 'End'}
        />
      );
    }

    if (col.type === 'strand_pair') {
      const pairVal = (val as ReturnType<typeof emptyStrandPair>) ?? emptyStrandPair();
      const showCastDuration = col.key === 'cast_end' && col.subtype === 'datetime';
      const castStart = showCastDuration
        ? ((rows[rowIndex]?.values.cast_start as ReturnType<typeof emptyStrandPair>) ?? emptyStrandPair())
        : null;
      const d1 = castStart ? strandCastDuration(castStart.strand_1, pairVal.strand_1) : null;
      const d2 = castStart ? strandCastDuration(castStart.strand_2, pairVal.strand_2) : null;

      return (
        <div>
          <StrandPairCell
            value={pairVal}
            onChange={(v) => updateCell(rowIndex, col.key, v)}
            subtype={(col.subtype as 'number' | 'datetime' | 'text') ?? 'number'}
            readOnly={readOnly}
          />
          {showCastDuration && (d1 || d2) && (
            <div className="mt-0.5 flex gap-1 text-[9px] text-slate-500">
              <span className="w-[4.5rem] text-center">{d1 ?? ''}</span>
              <span className="w-[4.5rem] text-center">{d2 ?? ''}</span>
            </div>
          )}
        </div>
      );
    }

    if (col.type === 'zone_strand') {
      return (
        <ZoneStrandCell
          value={(val as ReturnType<typeof emptyZoneStrand>) ?? emptyZoneStrand()}
          onChange={(v) => updateCell(rowIndex, col.key, v)}
          subtype={(col.subtype as 'number' | 'datetime' | 'text') ?? 'number'}
          readOnly={readOnly}
        />
      );
    }

    if (col.type === 'mould_tube') {
      return (
        <MouldTubeCell
          value={(val as ReturnType<typeof emptyMouldTube>) ?? emptyMouldTube()}
          onChange={(v) => updateCell(rowIndex, col.key, v)}
          readOnly={readOnly}
        />
      );
    }

    if (col.type === 'grade_ref') {
      if (readOnly) {
        const grade = grades.find((g) => g.id === val);
        return <span className={cellText}>{grade?.code ?? String(val ?? '—')}</span>;
      }
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value || null)}
          className="w-full min-w-[4rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
        >
          <option value="">—</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code}
            </option>
          ))}
        </select>
      );
    }

    if (readOnly) {
      const display =
        col.type === 'datetime' && typeof val === 'string'
          ? new Date(val).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
          : String(val ?? '—');
      return <span className={cellText}>{display}</span>;
    }

    const inputType =
      col.type === 'datetime' ? 'datetime-local' : col.type === 'number' || col.type === 'integer' ? 'number' : 'text';

    const displayVal =
      col.type === 'datetime' && typeof val === 'string' ? val.slice(0, 16) : (val ?? '');

    return (
      <input
        type={inputType}
        step={col.type === 'number' ? 'any' : undefined}
        value={displayVal as string}
        onChange={(e) => updateScalar(rowIndex, col, e.target.value)}
        className="w-full min-w-[4rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
      />
    );
  };

  const headerGroups = buildHeaderGroups(columns);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead className={compact ? undefined : 'bg-slate-100'}>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-10 border border-slate-300 bg-slate-100 px-2 py-2 text-left font-semibold text-slate-700"
              >
                S. No.
              </th>
              {headerGroups.map((group) => (
                <th
                  key={group.columns.map((c) => c.key).join('-')}
                  colSpan={group.colSpan}
                  className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-700 whitespace-nowrap"
                >
                  {group.name}
                </th>
              ))}
              {!readOnly && (
                <th rowSpan={2} className="border border-slate-300 px-2 py-1 font-semibold text-slate-700">
                  Actions
                </th>
              )}
            </tr>
            <tr>
              {columns.flatMap((col) =>
                subHeaders(col).map((label, idx) => (
                  <th
                    key={`${col.key}-${idx}`}
                    className="border border-slate-300 px-1 py-1 text-center font-medium text-slate-600 whitespace-nowrap"
                  >
                    {label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && filterEmptyRows && (
              <tr>
                <td colSpan={columns.length + 1} className="py-2 text-center text-[8px] text-slate-500">
                  No casting entries recorded
                </td>
              </tr>
            )}
            {rows.map((_, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50">
                <td className="sticky left-0 z-10 border border-slate-300 bg-white px-2 py-1 font-medium text-slate-800">
                  {rowIndex + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    colSpan={columnColSpan(col)}
                    className="border border-slate-300 px-1 py-0.5 align-top"
                  >
                    {renderCell(rowIndex, col)}
                  </td>
                ))}
                {!readOnly && (
                  <td className="border border-slate-300 px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      className="text-[10px] text-red-600 hover:underline"
                      disabled={rows.length <= 1}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button type="button" variant="secondary" className="mt-3" onClick={addRow}>
          Add casting row
        </Button>
      )}
    </div>
  );
}
