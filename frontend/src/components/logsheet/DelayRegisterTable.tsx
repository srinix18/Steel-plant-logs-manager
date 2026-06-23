import { useEffect, useState } from 'react';
import { fetchDelayCodes, type DelayCode } from '../../api/rollingMill';
import type { User } from '../../types';
import { resolveUserDisplay } from '../../utils/userLookup';
import { Button } from '../ui/Button';

export interface DelayRegisterRow {
  id: string;
  time_from: string;
  time_to: string;
  time_lost_minutes: number | null;
  delay_code_id: string;
  reason: string;
  action_taken: string;
  assigned_to: string;
  status: string;
}

export interface DelayRegisterSectionData {
  rows: DelayRegisterRow[];
}

function newRowId(): string {
  return crypto.randomUUID();
}

function minutesBetween(from: string, to: string): number | null {
  if (!from || !to) return null;
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  if (Number.isNaN(fh) || Number.isNaN(th)) return null;
  let fromM = fh * 60 + fm;
  let toM = th * 60 + tm;
  if (toM < fromM) toM += 24 * 60;
  return toM - fromM;
}

function emptyRow(): DelayRegisterRow {
  return {
    id: newRowId(),
    time_from: '',
    time_to: '',
    time_lost_minutes: null,
    delay_code_id: '',
    reason: '',
    action_taken: '',
    assigned_to: '',
    status: 'open',
  };
}

export function buildEmptyDelayRegister(rowCount = 6): DelayRegisterSectionData {
  return { rows: Array.from({ length: rowCount }, () => emptyRow()) };
}

export function parseDelayRegister(raw: unknown, defaultRows = 6): DelayRegisterSectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as DelayRegisterSectionData).rows)) {
    const parsed = raw as DelayRegisterSectionData;
    if (parsed.rows.length > 0) {
      return {
        rows: parsed.rows.map((row) => ({
          ...emptyRow(),
          ...row,
          id: row.id || newRowId(),
        })),
      };
    }
  }
  return buildEmptyDelayRegister(defaultRows);
}

interface DelayRegisterTableProps {
  data: DelayRegisterSectionData;
  plantId?: string;
  plantUsers: User[];
  onChange: (data: DelayRegisterSectionData) => void;
  readOnly?: boolean;
}

export function DelayRegisterTable({
  data,
  plantId,
  plantUsers,
  onChange,
  readOnly,
}: DelayRegisterTableProps) {
  const [codes, setCodes] = useState<DelayCode[]>([]);
  const rows = data.rows.length > 0 ? data.rows : buildEmptyDelayRegister().rows;

  useEffect(() => {
    if (plantId) {
      fetchDelayCodes(plantId).then(setCodes).catch(() => setCodes([]));
    }
  }, [plantId]);

  const updateRow = (index: number, patch: Partial<DelayRegisterRow>) => {
    onChange({
      rows: rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if ('time_from' in patch || 'time_to' in patch) {
          next.time_lost_minutes = minutesBetween(next.time_from, next.time_to);
        }
        return next;
      }),
    });
  };

  const addRow = () => onChange({ rows: [...rows, emptyRow()] });
  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    onChange({ rows: rows.filter((_, i) => i !== index) });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-slate-300 text-xs">
        <thead className="bg-slate-100">
          <tr>
            <th className="border border-slate-300 px-2 py-1">#</th>
            <th className="border border-slate-300 px-2 py-1">From</th>
            <th className="border border-slate-300 px-2 py-1">To</th>
            <th className="border border-slate-300 px-2 py-1">Min Lost</th>
            <th className="border border-slate-300 px-2 py-1">Code</th>
            <th className="border border-slate-300 px-2 py-1">Reason</th>
            <th className="border border-slate-300 px-2 py-1">Action Taken</th>
            <th className="border border-slate-300 px-2 py-1">Assigned To</th>
            {!readOnly && <th className="border border-slate-300 px-2 py-1" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id}>
              <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
              <td className="border border-slate-300 px-1 py-1">
                <input
                  type="time"
                  value={row.time_from}
                  disabled={readOnly}
                  onChange={(e) => updateRow(idx, { time_from: e.target.value })}
                  className="w-full rounded border border-slate-200 px-1 py-0.5"
                />
              </td>
              <td className="border border-slate-300 px-1 py-1">
                <input
                  type="time"
                  value={row.time_to}
                  disabled={readOnly}
                  onChange={(e) => updateRow(idx, { time_to: e.target.value })}
                  className="w-full rounded border border-slate-200 px-1 py-0.5"
                />
              </td>
              <td className="border border-slate-300 px-2 py-1 text-center">
                {row.time_lost_minutes ?? '—'}
              </td>
              <td className="border border-slate-300 px-1 py-1">
                <select
                  value={row.delay_code_id}
                  disabled={readOnly}
                  onChange={(e) => updateRow(idx, { delay_code_id: e.target.value })}
                  className="w-full rounded border border-slate-200 px-1 py-0.5"
                >
                  <option value="">—</option>
                  {codes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.description}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border border-slate-300 px-1 py-1">
                <textarea
                  value={row.reason}
                  disabled={readOnly}
                  rows={2}
                  onChange={(e) => updateRow(idx, { reason: e.target.value })}
                  className="w-full min-w-[8rem] rounded border border-slate-200 px-1 py-0.5"
                />
              </td>
              <td className="border border-slate-300 px-1 py-1">
                <textarea
                  value={row.action_taken}
                  disabled={readOnly}
                  rows={2}
                  onChange={(e) => updateRow(idx, { action_taken: e.target.value })}
                  className="w-full min-w-[8rem] rounded border border-slate-200 px-1 py-0.5"
                />
              </td>
              <td className="border border-slate-300 px-1 py-1">
                {readOnly ? (
                  <span>{resolveUserDisplay(row.assigned_to, plantUsers)}</span>
                ) : (
                  <select
                    value={row.assigned_to}
                    onChange={(e) => updateRow(idx, { assigned_to: e.target.value })}
                    className="w-full rounded border border-slate-200 px-1 py-0.5"
                  >
                    <option value="">—</option>
                    {plantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              {!readOnly && (
                <td className="border border-slate-300 px-1 py-1">
                  <Button type="button" variant="secondary" className="text-xs" onClick={() => removeRow(idx)}>
                    Remove
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <Button type="button" variant="secondary" className="mt-2" onClick={addRow}>
          Add delay row
        </Button>
      )}
    </div>
  );
}

export function getDelayRegisterConfig(section: { config: Record<string, unknown> }) {
  return { defaultEmptyRows: (section.config.default_empty_rows as number | undefined) ?? 6 };
}
