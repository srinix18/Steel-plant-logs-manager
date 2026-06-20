import type { TimeRangeValue } from '../../types';

export function emptyTimeRange(): TimeRangeValue {
  return { start: null, end: null, total_minutes: null };
}

export function computeTotalMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 60000);
}

interface TimeRangeCellProps {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  readOnly?: boolean;
  endLabel?: string;
}

export function TimeRangeCell({ value, onChange, readOnly, endLabel = 'End' }: TimeRangeCellProps) {
  const total = value.total_minutes ?? computeTotalMinutes(value.start, value.end);

  const updateStart = (raw: string) => {
    const start = raw ? new Date(raw).toISOString() : null;
    const totalMinutes = computeTotalMinutes(start, value.end);
    onChange({ start, end: value.end, total_minutes: totalMinutes });
  };

  const updateEnd = (raw: string) => {
    const end = raw ? new Date(raw).toISOString() : null;
    const totalMinutes = computeTotalMinutes(value.start, end);
    onChange({ start: value.start, end, total_minutes: totalMinutes });
  };

  if (readOnly) {
    return (
      <div className="flex gap-1 text-[10px]">
        <span className="min-w-[5rem]">{value.start ? new Date(value.start).toLocaleString() : '—'}</span>
        <span className="min-w-[5rem]">{value.end ? new Date(value.end).toLocaleString() : '—'}</span>
        <span className="min-w-[2.5rem] text-center">{total ?? '—'}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <input
        type="datetime-local"
        title="Start"
        value={value.start?.slice(0, 16) ?? ''}
        onChange={(e) => updateStart(e.target.value)}
        className="w-[7.5rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
      />
      <input
        type="datetime-local"
        title={endLabel}
        value={value.end?.slice(0, 16) ?? ''}
        onChange={(e) => updateEnd(e.target.value)}
        className="w-[7.5rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
      />
      <span className="flex min-w-[2.5rem] items-center justify-center rounded bg-slate-50 px-1 text-[10px] text-slate-600">
        {total ?? '—'}
      </span>
    </div>
  );
}
