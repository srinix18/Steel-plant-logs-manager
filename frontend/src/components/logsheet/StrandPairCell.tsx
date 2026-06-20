import type { StrandPairValue } from '../../types';

export function emptyStrandPair(): StrandPairValue {
  return { strand_1: null, strand_2: null };
}

interface StrandPairCellProps {
  value: StrandPairValue;
  onChange: (value: StrandPairValue) => void;
  subtype: 'number' | 'datetime' | 'text';
  readOnly?: boolean;
}

export function StrandPairCell({ value, onChange, subtype, readOnly }: StrandPairCellProps) {
  const update = (strand: 'strand_1' | 'strand_2', raw: string) => {
    let parsed: string | number | null = raw;
    if (subtype === 'number') {
      parsed = raw === '' ? null : Number(raw);
    } else if (subtype === 'datetime') {
      parsed = raw ? new Date(raw).toISOString() : null;
    }
    onChange({ ...value, [strand]: parsed });
  };

  const display = (v: string | number | null) => {
    if (v === null || v === '') return '—';
    if (subtype === 'datetime' && typeof v === 'string') {
      return new Date(v).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    }
    return String(v);
  };

  if (readOnly) {
    return (
      <div className="flex gap-1 text-[10px]">
        <span className="min-w-[3rem] text-center">{display(value.strand_1)}</span>
        <span className="min-w-[3rem] text-center">{display(value.strand_2)}</span>
      </div>
    );
  }

  const inputType = subtype === 'datetime' ? 'datetime-local' : subtype === 'number' ? 'number' : 'text';

  const cellValue = (v: string | number | null) => {
    if (subtype === 'datetime' && typeof v === 'string') return v.slice(0, 16);
    return v ?? '';
  };

  return (
    <div className="flex gap-1">
      <input
        type={inputType}
        title="ST1"
        step={subtype === 'number' ? 'any' : undefined}
        value={cellValue(value.strand_1) as string}
        onChange={(e) => update('strand_1', e.target.value)}
        className="w-[4.5rem] rounded border border-slate-200 px-1 py-0.5 text-center text-[10px]"
      />
      <input
        type={inputType}
        title="ST2"
        step={subtype === 'number' ? 'any' : undefined}
        value={cellValue(value.strand_2) as string}
        onChange={(e) => update('strand_2', e.target.value)}
        className="w-[4.5rem] rounded border border-slate-200 px-1 py-0.5 text-center text-[10px]"
      />
    </div>
  );
}
