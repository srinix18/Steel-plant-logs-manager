import type { MouldTubeValue } from '../../types';

export function emptyMouldTube(): MouldTubeValue {
  return {
    strand_1: { no: '', life: null },
    strand_2: { no: '', life: null },
  };
}

interface MouldTubeCellProps {
  value: MouldTubeValue;
  onChange: (value: MouldTubeValue) => void;
  readOnly?: boolean;
}

export function MouldTubeCell({ value, onChange, readOnly }: MouldTubeCellProps) {
  const strands: Array<'strand_1' | 'strand_2'> = ['strand_1', 'strand_2'];

  const update = (strand: 'strand_1' | 'strand_2', field: 'no' | 'life', raw: string) => {
    const parsed = field === 'life' ? (raw === '' ? null : Number(raw)) : raw;
    onChange({
      ...value,
      [strand]: { ...value[strand], [field]: parsed },
    });
  };

  if (readOnly) {
    return (
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        {strands.flatMap((strand) => [
          <span key={`${strand}-no`}>{value[strand].no || '—'}</span>,
          <span key={`${strand}-life`}>{value[strand].life ?? '—'}</span>,
        ])}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1">
      {strands.flatMap((strand) => [
        <input
          key={`${strand}-no`}
          type="text"
          title={`S${strand === 'strand_1' ? '1' : '2'} No`}
          placeholder="No"
          value={value[strand].no}
          onChange={(e) => update(strand, 'no', e.target.value)}
          className="w-[3rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
        />,
        <input
          key={`${strand}-life`}
          type="number"
          title={`S${strand === 'strand_1' ? '1' : '2'} Life`}
          placeholder="Life"
          value={value[strand].life ?? ''}
          onChange={(e) => update(strand, 'life', e.target.value)}
          className="w-[3rem] rounded border border-slate-200 px-1 py-0.5 text-[10px]"
        />,
      ])}
    </div>
  );
}
