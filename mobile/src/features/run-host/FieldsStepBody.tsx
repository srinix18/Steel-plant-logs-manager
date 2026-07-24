import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import type { SteelGrade } from '@/src/features/run-host/section-data/types';
import type { PlantAsset } from '@/src/types/platform';
import type { TemplateField } from '@/src/types/processRun';
import type { User } from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

export type FieldLookupContext = {
  steelGrades?: SteelGrade[];
  plantUsers?: User[];
  assets?: PlantAsset[];
  assetGroupsByCode?: Record<string, string>;
  currentUserId?: string | null;
};

type Props = {
  fields: TemplateField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  lookups?: FieldLookupContext;
};

function parseDateValue(raw: string, mode: 'date' | 'time' | 'datetime'): Date | null {
  if (!raw) return null;
  if (mode === 'date') {
    const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (mode === 'time') {
    const m = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateValue(value: Date, mode: 'date' | 'time' | 'datetime'): string {
  if (mode === 'date') {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (mode === 'time') {
    const h = String(value.getHours()).padStart(2, '0');
    const m = String(value.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return value.toISOString();
}

function assetLifeLabel(asset: PlantAsset): string {
  const counters = asset.life_counters ?? {};
  const life =
    counters.heat_count ?? counters.heats ?? counters.days ?? counters.shifts ?? null;
  if (life == null || life === '') return `${asset.asset_no} — ${asset.name}`;
  return `${asset.asset_no} — ${asset.name} (Life ${String(life)})`;
}

function FieldEditor({
  field,
  value,
  onChange,
  disabled,
  lookups,
}: {
  field: TemplateField;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  lookups?: FieldLookupContext;
}) {
  const label = field.required ? `${field.label} *` : field.label;
  const type = field.field_type;

  if (type === 'calculated') {
    return <TextField label={label} value={value} editable={false} />;
  }

  if (type === 'grade_ref') {
    const options = (lookups?.steelGrades ?? []).map((g) => ({
      label: g.description ? `${g.code} — ${g.description}` : g.code,
      value: g.id,
    }));
    return (
      <SelectSheet
        label={label}
        options={options}
        value={value || null}
        onChange={onChange}
        disabled={disabled}
        placeholder="Select grade…"
      />
    );
  }

  if (type === 'user_ref') {
    const options = (lookups?.plantUsers ?? []).map((u) => ({
      label: u.employee_uid ? `${u.full_name} (${u.employee_uid})` : u.full_name,
      value: u.id,
    }));
    const effective = value || lookups?.currentUserId || null;
    return (
      <SelectSheet
        label={label}
        options={options}
        value={effective}
        onChange={onChange}
        disabled={disabled}
        placeholder="Select…"
      />
    );
  }

  if (type === 'asset_ref') {
    const groupCode = String(field.config.asset_group ?? '');
    const groupId = groupCode
      ? lookups?.assetGroupsByCode?.[groupCode]
      : undefined;
    const assets = (lookups?.assets ?? []).filter((a) =>
      groupId ? a.group_id === groupId : true
    );
    const options = assets.map((a) => ({
      label: assetLifeLabel(a),
      value: a.id,
    }));
    return (
      <SelectSheet
        label={label}
        options={options}
        value={value || null}
        onChange={onChange}
        disabled={disabled}
        placeholder={groupCode ? `Select ${groupCode}…` : 'Select asset…'}
      />
    );
  }

  if (type === 'dropdown') {
    const options = ((field.config.options as string[] | undefined) ?? []).map((opt) => ({
      label: opt,
      value: opt,
    }));
    return (
      <SelectSheet
        label={label}
        options={options}
        value={value || null}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  if (type === 'date' || type === 'time' || type === 'datetime') {
    const mode = type;
    const showNow = type === 'datetime' || field.config.quick_action === 'now';
    return (
      <View style={styles.datetimeRow}>
        <View style={styles.flex}>
          <DateTimeField
            label={label}
            mode={mode}
            value={parseDateValue(value, mode)}
            onChange={(d) => onChange(formatDateValue(d, mode))}
            disabled={disabled}
          />
        </View>
        {showNow && !disabled ? (
          <Button
            title="Now"
            variant="secondary"
            size="sm"
            onPress={() => onChange(formatDateValue(new Date(), mode))}
            style={styles.nowBtn}
          />
        ) : null}
      </View>
    );
  }

  if (type === 'number' || type === 'integer') {
    return (
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        keyboardType={type === 'integer' ? 'number-pad' : 'decimal-pad'}
        editable={!disabled}
      />
    );
  }

  if (type === 'textarea') {
    return (
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={4}
        style={styles.multiline}
        editable={!disabled}
      />
    );
  }

  if (type === 'signature') {
    return (
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="Type full name"
        autoCapitalize="words"
        editable={!disabled}
      />
    );
  }

  const hint = type === 'material_ref' ? `Stored as ${type} id` : null;

  return (
    <View>
      <TextField label={label} value={value} onChangeText={onChange} editable={!disabled} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function FieldsStepBody({ fields, values, onChange, disabled, lookups }: Props) {
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <View style={styles.wrap}>
      {sorted.map((f) => (
        <FieldEditor
          key={f.id || f.name}
          field={f}
          value={values[f.name] ?? ''}
          onChange={(v) => onChange(f.name, v)}
          disabled={disabled}
          lookups={lookups}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  datetimeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1 },
  nowBtn: { marginBottom: 2 },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
