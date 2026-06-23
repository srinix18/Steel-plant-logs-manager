import { useEffect, useState } from 'react';
import type {
  CoilRefValue,
  FurnaceZonesValue,
  HeatRefValue,
  LadleTempValue,
  ProductionLogCellValue,
  ProductionLogColumnDef,
  ProductionLogRow,
  ProductionLogSectionData,
  SteelGrade,
  TemplateSection,
} from '../../types';
import { lookupHeatNo, type HeatLookup } from '../../api/rollingMill';
import { fetchCoils, type CoilRecord } from '../../api/coils';
import { fetchCustomers, type Customer } from '../../api/customers';
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

function evalProductionFormula(
  formula: string,
  values: Record<string, ProductionLogCellValue>,
): number | null {
  const trimmed = formula.trim();
  if (trimmed.includes('*')) {
    const parts = trimmed.split('*').map((p) => p.trim());
    if (parts.length === 2) {
      const left = values[parts[0]];
      const right = values[parts[1]];
      if (typeof left === 'number' && typeof right === 'number') {
        return left * right;
      }
    }
  }
  return null;
}

function applyCalculatedColumns(
  columns: ProductionLogColumnDef[],
  values: Record<string, ProductionLogCellValue>,
): Record<string, ProductionLogCellValue> {
  const next = { ...values };
  for (const col of columns) {
    if (col.type === 'calculated' && col.formula) {
      next[col.key] = evalProductionFormula(col.formula, next);
    }
  }
  return next;
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
    case 'furnace_zones':
      return { heat_zone_1: null, heat_zone_2: null, soak_zone_1: null, soak_zone_2: null };
    case 'heat_ref':
      return { run_id: '', heat_no: '' };
    case 'coil_ref':
      return { coil_id: '', coil_no: '' };
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
    case 'furnace_zones':
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
    case 'furnace_zones':
      return ['HZ 1', 'HZ 2', 'SZ 1', 'SZ 2'];
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

export interface ConcastProductionTableProps {
  columns: ProductionLogColumnDef[];
  data: ProductionLogSectionData;
  grades: SteelGrade[];
  onChange: (data: ProductionLogSectionData) => void;
  readOnly?: boolean;
  compact?: boolean;
  filterEmptyRows?: boolean;
  plantId?: string;
  runId?: string;
  coilPurpose?: 'drawing';
}

export function ConcastProductionTable({
  columns,
  data,
  grades,
  onChange,
  readOnly,
  compact,
  filterEmptyRows,
  plantId,
  runId,
  coilPurpose,
}: ConcastProductionTableProps) {
  const allRows = data.rows.length > 0 ? data.rows : buildEmptyProductionLog(columns).rows;
  const rows = filterEmptyRows ? allRows.filter((row) => rowHasData(row, columns)) : allRows;
  const cellText = compact ? 'text-[7px]' : 'text-[10px]';
  const tableClass = compact ? COMPACT_TABLE_XS : 'min-w-full border border-slate-300 text-xs';
  const hasCoilRef = columns.some((c) => c.type === 'coil_ref');
  const hasCustomerRef = columns.some((c) => c.type === 'customer_ref');
  const [coils, setCoils] = useState<CoilRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    if (!hasCoilRef || !plantId || !runId || readOnly) return;
    fetchCoils({ plantId, runId, purpose: coilPurpose })
      .then(setCoils)
      .catch(() => setCoils([]));
  }, [hasCoilRef, plantId, runId, readOnly, coilPurpose]);

  useEffect(() => {
    if (!hasCustomerRef || !plantId) return;
    fetchCustomers(plantId)
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [hasCustomerRef, plantId]);

  const updateCell = (rowIndex: number, key: string, value: ProductionLogCellValue) => {
    onChange({
      rows: rows.map((row, i) => {
        if (i !== rowIndex) return row;
        const values = applyCalculatedColumns(columns, { ...row.values, [key]: value });
        return { values };
      }),
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

    if (col.type === 'furnace_zones') {
      const zoneVal = (val as FurnaceZonesValue) ?? {
        heat_zone_1: null,
        heat_zone_2: null,
        soak_zone_1: null,
        soak_zone_2: null,
      };
      const keys: (keyof FurnaceZonesValue)[] = ['heat_zone_1', 'heat_zone_2', 'soak_zone_1', 'soak_zone_2'];
      if (readOnly) {
        return (
          <div className={`flex gap-1 ${cellText}`}>
            {keys.map((k) => (
              <span key={k} className="min-w-[3rem] text-center">
                {zoneVal[k] ?? '—'}
              </span>
            ))}
          </div>
        );
      }
      return (
        <div className="flex gap-1">
          {keys.map((k) => (
            <input
              key={k}
              type="number"
              value={zoneVal[k] ?? ''}
              onChange={(e) => {
                const next = { ...zoneVal };
                next[k] = e.target.value === '' ? null : Number(e.target.value);
                updateCell(rowIndex, col.key, next);
              }}
              className="w-[3.5rem] rounded border border-slate-200 px-1 py-0.5 text-center text-[10px]"
            />
          ))}
        </div>
      );
    }

    if (col.type === 'heat_ref') {
      const heatVal = (val as HeatRefValue) ?? { run_id: '', heat_no: '' };
      if (readOnly) {
        return <span className={cellText}>{heatVal.heat_no || '—'}</span>;
      }
      return (
        <HeatRefInput
          value={heatVal}
          onChange={(v) => updateCell(rowIndex, col.key, v)}
          grades={grades}
          onGradePick={(gradeId) => {
            if (gradeId) updateCell(rowIndex, 'grade_id', gradeId);
          }}
        />
      );
    }

    if (col.type === 'coil_ref') {
      const coilVal = (val as CoilRefValue) ?? { coil_id: '', coil_no: '' };
      if (readOnly) {
        return <span className={cellText}>{coilVal.coil_no || '—'}</span>;
      }
      return (
        <CoilRefInput
          value={coilVal}
          coils={coils}
          coilPurpose={coilPurpose}
          onChange={(v) => updateCell(rowIndex, col.key, v)}
          onOpen={
            plantId && runId
              ? () => {
                  fetchCoils({ plantId, runId, purpose: coilPurpose })
                    .then(setCoils)
                    .catch(() => setCoils([]));
                }
              : undefined
          }
        />
      );
    }

    if (col.type === 'dropdown') {
      const options = col.options ?? [];
      if (readOnly) {
        return <span className={cellText}>{String(val ?? '—')}</span>;
      }
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
          className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px]"
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
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

    if (col.type === 'customer_ref') {
      if (readOnly) {
        const customer = customers.find((c) => c.id === val);
        return <span className={cellText}>{customer?.name ?? String(val ?? '—')}</span>;
      }
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value || null)}
          className="w-full min-w-[5rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
        >
          <option value="">—</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      );
    }

    if (col.type === 'calculated') {
      const computed =
        val !== null && val !== undefined && val !== ''
          ? val
          : evalProductionFormula(col.formula ?? '', rows[rowIndex]?.values ?? {});
      const display =
        typeof computed === 'number' && !Number.isNaN(computed) ? String(computed) : '—';
      return <span className={cellText}>{display}</span>;
    }

    if (col.type === 'textarea') {
      if (readOnly) {
        return <span className={cellText}>{String(val ?? '—')}</span>;
      }
      return (
        <textarea
          value={String(val ?? '')}
          onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
          rows={2}
          className="w-full min-w-[6rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
        />
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
          Add row
        </Button>
      )}
    </div>
  );
}

function CoilRefInput({
  value,
  coils,
  coilPurpose,
  onChange,
  onOpen,
}: {
  value: CoilRefValue;
  coils: CoilRecord[];
  coilPurpose?: 'drawing';
  onChange: (v: CoilRefValue) => void;
  onOpen?: () => void;
}) {
  const pickable =
    coilPurpose === 'drawing'
      ? coils.filter((c) => c.status === 'completed')
      : coils.filter((c) => c.status !== 'completed' && c.status !== 'consumed');
  return (
    <select
      value={value.coil_id || ''}
      onFocus={onOpen}
      onChange={(e) => {
        const picked = pickable.find((c) => c.id === e.target.value);
        onChange(
          picked
            ? { coil_id: picked.id, coil_no: picked.coil_no }
            : { coil_id: '', coil_no: '' },
        );
      }}
      className="w-full min-w-[5rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
    >
      <option value="">—</option>
      {pickable.map((c) => (
        <option key={c.id} value={c.id}>
          {c.coil_no}
        </option>
      ))}
    </select>
  );
}

function HeatRefInput({
  value,
  onChange,
  onGradePick,
}: {
  value: HeatRefValue;
  onChange: (v: HeatRefValue) => void;
  grades: SteelGrade[];
  onGradePick: (gradeId: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<HeatLookup[]>([]);

  const search = async (q: string) => {
    onChange({ ...value, heat_no: q, run_id: '' });
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const hits = await lookupHeatNo(q);
      setSuggestions(hits);
      if (hits[0]?.grade_id) onGradePick(hits[0].grade_id);
    } catch {
      setSuggestions([]);
    }
  };

  return (
    <div className="relative min-w-[6rem]">
      <input
        type="text"
        value={value.heat_no}
        onChange={(e) => search(e.target.value)}
        className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px]"
        placeholder="Heat no."
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-32 w-full overflow-auto rounded border border-slate-200 bg-white text-[10px] shadow">
          {suggestions.map((s) => (
            <li key={s.run_id}>
              <button
                type="button"
                className="block w-full px-2 py-1 text-left hover:bg-slate-50"
                onClick={() => {
                  onChange({ run_id: s.run_id, heat_no: s.heat_no });
                  if (s.grade_id) onGradePick(s.grade_id);
                  setSuggestions([]);
                }}
              >
                {s.heat_no}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
