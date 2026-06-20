import type { ZoneStrandValue } from '../../types';
import { emptyStrandPair } from './StrandPairCell';

export function emptyZoneStrand(): ZoneStrandValue {
  return {
    zone_1: emptyStrandPair(),
    zone_2: emptyStrandPair(),
  };
}

interface ZoneStrandCellProps {
  value: ZoneStrandValue;
  onChange: (value: ZoneStrandValue) => void;
  subtype: 'number' | 'datetime' | 'text';
  readOnly?: boolean;
}

export function ZoneStrandCell({ value, onChange, subtype, readOnly }: ZoneStrandCellProps) {
  const zones: Array<'zone_1' | 'zone_2'> = ['zone_1', 'zone_2'];
  const strands: Array<'strand_1' | 'strand_2'> = ['strand_1', 'strand_2'];

  const update = (zone: 'zone_1' | 'zone_2', strand: 'strand_1' | 'strand_2', raw: string) => {
    let parsed: string | number | null = raw;
    if (subtype === 'number') {
      parsed = raw === '' ? null : Number(raw);
    }
    onChange({
      ...value,
      [zone]: { ...value[zone], [strand]: parsed },
    });
  };

  if (readOnly) {
    return (
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {zones.flatMap((zone) =>
          strands.map((strand) => (
            <span key={`${zone}-${strand}`} className="text-center">
              {value[zone][strand] ?? '—'}
            </span>
          )),
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1">
      {zones.flatMap((zone) =>
        strands.map((strand) => (
          <input
            key={`${zone}-${strand}`}
            type={subtype === 'number' ? 'number' : 'text'}
            step={subtype === 'number' ? 'any' : undefined}
            title={`${zone} ${strand}`}
            value={value[zone][strand] ?? ''}
            onChange={(e) => update(zone, strand, e.target.value)}
            className="w-[3.5rem] rounded border border-slate-200 px-1 py-0.5 text-center text-[10px]"
          />
        )),
      )}
    </div>
  );
}
