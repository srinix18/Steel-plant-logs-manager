import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useEffect, useState } from 'react';

import { Button } from '@/src/components/ui/Button';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { type CoilRecord, coilOptionLabel, pickableCoils } from '@/src/api/coils';
import { lookupHeatNo, type HeatLookup } from '@/src/api/lookups';
import {
  computeTotalMinutes,
  emptyFurnaceZones,
  emptyLadleTemp,
  emptyMouldTube,
  emptyStrandPair,
  emptyTimeRange,
  emptyZoneStrand,
} from '@/src/features/run-host/section-data';
import type {
  CoilRefValue,
  FurnaceZonesValue,
  HeatRefValue,
  LadleTempValue,
  MouldTubeValue,
  ProductionLogCellValue,
  ProductionLogColumnDef,
  StrandPairValue,
  TimeRangeValue,
  ZoneStrandValue,
} from '@/src/features/run-host/section-data/types';
import { formatDurationMinutes } from '@/src/utils/formulaEngine';
import { colors, spacing, typography } from '@/src/theme/tokens';

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function strandCastDuration(
  start: string | number | null | undefined,
  end: string | number | null | undefined
): string | null {
  if (start == null || end == null || start === '' || end === '') return null;
  const minutes = computeTotalMinutes(String(start), String(end));
  if (minutes == null) return null;
  return formatDurationMinutes(minutes);
}

function DatetimeScalarField({
  label,
  value,
  onChange,
  disabled,
  mode = 'datetime',
}: {
  label: string;
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  mode?: 'date' | 'time' | 'datetime';
}) {
  return (
    <View style={styles.datetimeRow}>
      <View style={styles.flex}>
        <DateTimeField
          label={label}
          mode={mode}
          value={parseDate(value)}
          onChange={(d) => onChange(d.toISOString())}
          disabled={disabled}
        />
      </View>
      {!disabled && mode === 'datetime' ? (
        <Button
          title="Now"
          variant="secondary"
          size="sm"
          onPress={() => onChange(new Date().toISOString())}
          style={styles.nowBtn}
        />
      ) : null}
    </View>
  );
}

export function TimeRangeEditor({
  label,
  value,
  onChange,
  disabled,
  endLabel = 'End',
}: {
  label: string;
  value: TimeRangeValue;
  onChange: (v: TimeRangeValue) => void;
  disabled?: boolean;
  endLabel?: string;
}) {
  const v = value ?? emptyTimeRange();
  const total = v.total_minutes ?? computeTotalMinutes(v.start, v.end);
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      <DateTimeField
        label="Start"
        mode="datetime"
        value={parseDate(v.start)}
        onChange={(d) => {
          const start = d.toISOString();
          onChange({ start, end: v.end, total_minutes: computeTotalMinutes(start, v.end) });
        }}
        disabled={disabled}
      />
      <DateTimeField
        label={endLabel}
        mode="datetime"
        value={parseDate(v.end)}
        onChange={(d) => {
          const end = d.toISOString();
          onChange({ start: v.start, end, total_minutes: computeTotalMinutes(v.start, end) });
        }}
        disabled={disabled}
      />
      <TextField label="Total minutes" value={total == null ? '' : String(total)} editable={false} />
    </View>
  );
}

export function StrandPairEditor({
  label,
  value,
  onChange,
  subtype = 'number',
  disabled,
  castStartPair,
}: {
  label: string;
  value: StrandPairValue;
  onChange: (v: StrandPairValue) => void;
  subtype?: 'number' | 'datetime' | 'text';
  disabled?: boolean;
  /** When editing cast_end, pass cast_start to show per-strand duration. */
  castStartPair?: StrandPairValue | null;
}) {
  const v = value ?? emptyStrandPair();

  if (subtype === 'datetime') {
    const d1 = castStartPair ? strandCastDuration(castStartPair.strand_1, v.strand_1) : null;
    const d2 = castStartPair ? strandCastDuration(castStartPair.strand_2, v.strand_2) : null;
    return (
      <View style={styles.box}>
        <Text style={styles.boxTitle}>{label}</Text>
        <DatetimeScalarField
          label="Strand 1"
          value={v.strand_1 == null ? null : String(v.strand_1)}
          onChange={(iso) => onChange({ ...v, strand_1: iso })}
          disabled={disabled}
        />
        <DatetimeScalarField
          label="Strand 2"
          value={v.strand_2 == null ? null : String(v.strand_2)}
          onChange={(iso) => onChange({ ...v, strand_2: iso })}
          disabled={disabled}
        />
        {d1 || d2 ? (
          <Text style={styles.durationHint}>
            Duration · S1 {d1 ?? '—'} · S2 {d2 ?? '—'}
          </Text>
        ) : null}
      </View>
    );
  }

  const update = (key: 'strand_1' | 'strand_2', raw: string) => {
    let parsed: string | number | null = raw;
    if (subtype === 'number') parsed = raw === '' ? null : Number(raw);
    onChange({ ...v, [key]: parsed });
  };
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      <TextField
        label="Strand 1"
        value={v.strand_1 == null ? '' : String(v.strand_1)}
        onChangeText={(t) => update('strand_1', t)}
        keyboardType={subtype === 'number' ? 'decimal-pad' : 'default'}
        editable={!disabled}
      />
      <TextField
        label="Strand 2"
        value={v.strand_2 == null ? '' : String(v.strand_2)}
        onChangeText={(t) => update('strand_2', t)}
        keyboardType={subtype === 'number' ? 'decimal-pad' : 'default'}
        editable={!disabled}
      />
    </View>
  );
}
export function ZoneStrandEditor({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: ZoneStrandValue;
  onChange: (v: ZoneStrandValue) => void;
  disabled?: boolean;
}) {
  const v = value ?? emptyZoneStrand();
  const set = (zone: 'zone_1' | 'zone_2', strand: 'strand_1' | 'strand_2', raw: string) => {
    onChange({
      ...v,
      [zone]: { ...v[zone], [strand]: raw === '' ? null : Number(raw) },
    });
  };
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      {(
        [
          ['zone_1', 'strand_1', 'Z1 · ST1'],
          ['zone_1', 'strand_2', 'Z1 · ST2'],
          ['zone_2', 'strand_1', 'Z2 · ST1'],
          ['zone_2', 'strand_2', 'Z2 · ST2'],
        ] as const
      ).map(([zone, strand, lbl]) => (
        <TextField
          key={`${zone}-${strand}`}
          label={lbl}
          value={v[zone][strand] == null ? '' : String(v[zone][strand])}
          onChangeText={(t) => set(zone, strand, t)}
          keyboardType="decimal-pad"
          editable={!disabled}
        />
      ))}
    </View>
  );
}

export function MouldTubeEditor({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: MouldTubeValue;
  onChange: (v: MouldTubeValue) => void;
  disabled?: boolean;
}) {
  const v = value ?? emptyMouldTube();
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      {(['strand_1', 'strand_2'] as const).map((strand) => (
        <View key={strand} style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label={`${strand === 'strand_1' ? 'S1' : 'S2'} No`}
              value={v[strand].no}
              onChangeText={(t) => onChange({ ...v, [strand]: { ...v[strand], no: t } })}
              editable={!disabled}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Life"
              value={v[strand].life == null ? '' : String(v[strand].life)}
              onChangeText={(t) =>
                onChange({
                  ...v,
                  [strand]: { ...v[strand], life: t === '' ? null : Number(t) },
                })
              }
              keyboardType="number-pad"
              editable={!disabled}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function LadleTempEditor({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: LadleTempValue;
  onChange: (v: LadleTempValue) => void;
  disabled?: boolean;
}) {
  const v = value ?? emptyLadleTemp();
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      <TextField
        label="Before purging"
        value={v.before_purging == null ? '' : String(v.before_purging)}
        onChangeText={(t) =>
          onChange({ ...v, before_purging: t === '' ? null : Number(t) })
        }
        keyboardType="decimal-pad"
        editable={!disabled}
      />
      <TextField
        label="After purging"
        value={v.after_purging == null ? '' : String(v.after_purging)}
        onChangeText={(t) => onChange({ ...v, after_purging: t === '' ? null : Number(t) })}
        keyboardType="decimal-pad"
        editable={!disabled}
      />
    </View>
  );
}

export function FurnaceZonesEditor({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: FurnaceZonesValue;
  onChange: (v: FurnaceZonesValue) => void;
  disabled?: boolean;
}) {
  const v = value ?? emptyFurnaceZones();
  const keys = ['heat_zone_1', 'heat_zone_2', 'soak_zone_1', 'soak_zone_2'] as const;
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      {keys.map((k) => (
        <TextField
          key={k}
          label={k.replace(/_/g, ' ')}
          value={v[k] == null ? '' : String(v[k])}
          onChangeText={(t) => onChange({ ...v, [k]: t === '' ? null : Number(t) })}
          keyboardType="decimal-pad"
          editable={!disabled}
        />
      ))}
    </View>
  );
}

export function HeatRefEditor({
  label,
  value,
  onChange,
  onGradePick,
  disabled,
}: {
  label: string;
  value: HeatRefValue;
  onChange: (v: HeatRefValue) => void;
  onGradePick?: (gradeId: string) => void;
  disabled?: boolean;
}) {
  const v = value ?? { run_id: '', heat_no: '' };
  const [suggestions, setSuggestions] = useState<HeatLookup[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = v.heat_no.trim();
    if (disabled || q.length < 2 || v.run_id) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void lookupHeatNo(q)
        .then((hits) => {
          if (!cancelled) setSuggestions(hits);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [v.heat_no, v.run_id, disabled]);

  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      <TextField
        label="Heat no"
        value={v.heat_no}
        onChangeText={(t) => onChange({ heat_no: t, run_id: '' })}
        editable={!disabled}
        placeholder="Type ≥2 chars to search"
      />
      {searching ? <Text style={styles.durationHint}>Searching…</Text> : null}
      {suggestions.length > 0 ? (
        <View style={styles.suggestList}>
          {suggestions.map((s) => (
            <Pressable
              key={s.run_id}
              style={({ pressed }) => [styles.suggestRow, pressed && styles.suggestPressed]}
              onPress={() => {
                onChange({ run_id: s.run_id, heat_no: s.heat_no });
                if (s.grade_id) onGradePick?.(s.grade_id);
                setSuggestions([]);
              }}
            >
              <Text style={styles.suggestTitle}>{s.heat_no}</Text>
              <Text style={styles.durationHint}>
                {s.process_code ? `${s.process_code} · ` : ''}
                {s.run_number}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {v.run_id ? (
        <Text style={styles.durationHint} numberOfLines={1}>
          Linked run {v.run_id}
        </Text>
      ) : null}
    </View>
  );
}

export function CoilRefEditor({
  label,
  value,
  onChange,
  disabled,
  coils = [],
  coilPurpose,
}: {
  label: string;
  value: CoilRefValue;
  onChange: (v: CoilRefValue) => void;
  disabled?: boolean;
  coils?: CoilRecord[];
  coilPurpose?: 'drawing';
}) {
  const v = value ?? { coil_id: '', coil_no: '' };
  const pickable = pickableCoils(coils, coilPurpose);
  const options = pickable.map((c) => ({
    label: coilOptionLabel(c),
    value: c.id,
  }));

  if (options.length > 0 || v.coil_id) {
    return (
      <View style={styles.box}>
        <SelectSheet
          label={label}
          options={
            v.coil_id && !options.some((o) => o.value === v.coil_id)
              ? [{ label: v.coil_no || v.coil_id, value: v.coil_id }, ...options]
              : options
          }
          value={v.coil_id || null}
          onChange={(id) => {
            const picked = pickable.find((c) => c.id === id);
            onChange(
              picked
                ? { coil_id: picked.id, coil_no: picked.coil_no }
                : { coil_id: id, coil_no: v.coil_no }
            );
          }}
          disabled={disabled}
          placeholder={
            options.length
              ? 'Select coil…'
              : coilPurpose === 'drawing'
                ? 'No completed coils yet'
                : 'Save input coils first'
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      <Text style={styles.durationHint}>
        {coilPurpose === 'drawing'
          ? 'No completed coils available for drawing.'
          : 'No coils for this run yet — fill and save Input Coils, then return here.'}
      </Text>
      <TextField
        label="Coil no (fallback)"
        value={v.coil_no}
        onChangeText={(t) => onChange({ ...v, coil_no: t, coil_id: '' })}
        editable={!disabled}
      />
    </View>
  );
}

export function ObjectFieldsEditor({
  label,
  fields,
  value,
  onChange,
  disabled,
}: {
  label: string;
  fields: { key: string; label: string; type: string }[];
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const obj = value && typeof value === 'object' ? value : {};
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{label}</Text>
      {fields.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          value={obj[f.key] == null ? '' : String(obj[f.key])}
          onChangeText={(t) => {
            const next = { ...obj };
            if (f.type === 'number' || f.type === 'integer') {
              next[f.key] = t === '' ? null : Number(t);
            } else {
              next[f.key] = t;
            }
            onChange(next);
          }}
          keyboardType={
            f.type === 'number' || f.type === 'integer' ? 'decimal-pad' : 'default'
          }
          editable={!disabled}
        />
      ))}
    </View>
  );
}

/** Dispatch Part C.1 editors for production / register columns. */
export function ProductionCellEditor({
  column,
  value,
  onChange,
  disabled,
  gradeOptions,
  castStartPair,
  onHeatGradePick,
  coils,
  coilPurpose,
}: {
  column: ProductionLogColumnDef;
  value: ProductionLogCellValue;
  onChange: (v: ProductionLogCellValue) => void;
  disabled?: boolean;
  gradeOptions?: { label: string; value: string }[];
  /** For cast_end strand_pair — pair from cast_start for duration display. */
  castStartPair?: StrandPairValue | null;
  onHeatGradePick?: (gradeId: string) => void;
  coils?: CoilRecord[];
  coilPurpose?: 'drawing';
}) {
  const type = column.type;

  if (type === 'calculated') {
    return (
      <TextField
        label={column.label}
        value={value == null ? '' : String(value)}
        editable={false}
      />
    );
  }

  if (type === 'datetime' || type === 'date' || type === 'time') {
    const mode = type === 'date' || type === 'time' ? type : 'datetime';
    return (
      <DatetimeScalarField
        label={column.label}
        mode={mode}
        value={typeof value === 'string' ? value : value == null ? null : String(value)}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (type === 'time_range') {
    return (
      <TimeRangeEditor
        label={column.label}
        value={(value as TimeRangeValue) ?? emptyTimeRange()}
        onChange={onChange}
        disabled={disabled}
        endLabel={column.key === 'sen_preheating' ? 'Finish' : 'End'}
      />
    );
  }
  if (type === 'strand_pair') {
    return (
      <StrandPairEditor
        label={column.label}
        value={(value as StrandPairValue) ?? emptyStrandPair()}
        onChange={onChange}
        subtype={column.subtype ?? 'number'}
        disabled={disabled}
        castStartPair={castStartPair}
      />
    );
  }
  if (type === 'zone_strand') {
    return (
      <ZoneStrandEditor
        label={column.label}
        value={(value as ZoneStrandValue) ?? emptyZoneStrand()}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }
  if (type === 'mould_tube') {
    return (
      <MouldTubeEditor
        label={column.label}
        value={(value as MouldTubeValue) ?? emptyMouldTube()}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }
  if (type === 'ladle_temp' || (type === 'object' && !column.fields?.length)) {
    return (
      <LadleTempEditor
        label={column.label}
        value={(value as LadleTempValue) ?? emptyLadleTemp()}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }
  if (type === 'furnace_zones') {
    return (
      <FurnaceZonesEditor
        label={column.label}
        value={(value as FurnaceZonesValue) ?? emptyFurnaceZones()}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }
  if (type === 'heat_ref') {
    return (
      <HeatRefEditor
        label={column.label}
        value={(value as HeatRefValue) ?? { run_id: '', heat_no: '' }}
        onChange={onChange}
        onGradePick={onHeatGradePick}
        disabled={disabled}
      />
    );
  }
  if (type === 'coil_ref') {
    return (
      <CoilRefEditor
        label={column.label}
        value={(value as CoilRefValue) ?? { coil_id: '', coil_no: '' }}
        onChange={onChange}
        disabled={disabled}
        coils={coils}
        coilPurpose={coilPurpose}
      />
    );
  }
  if (type === 'object' && column.fields?.length) {
    return (
      <ObjectFieldsEditor
        label={column.label}
        fields={column.fields}
        value={(value as Record<string, unknown>) ?? {}}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  // Scalars — SelectSheet for dropdown/grade would need options; TextField fallback OK
  if ((type === 'grade_ref' || column.key === 'grade_id') && gradeOptions?.length) {
    // Handled by caller with SelectSheet when options present — fall through to text
  }

  return (
    <TextField
      label={column.label}
      value={value == null || typeof value === 'object' ? '' : String(value)}
      onChangeText={(t) => {
        if (type === 'number' || type === 'integer') {
          onChange(t === '' ? null : Number(t));
        } else {
          onChange(t || null);
        }
      }}
      keyboardType={type === 'number' || type === 'integer' ? 'decimal-pad' : 'default'}
      editable={!disabled && type !== 'calculated'}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  boxTitle: { ...typography.section, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  datetimeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  nowBtn: { marginBottom: 2 },
  durationHint: { ...typography.caption, color: colors.textMuted },
  suggestList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  suggestRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestPressed: { backgroundColor: colors.brandSoft },
  suggestTitle: { ...typography.body, fontWeight: '600', color: colors.text },
});
