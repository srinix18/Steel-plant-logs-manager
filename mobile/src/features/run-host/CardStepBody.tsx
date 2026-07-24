import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/src/components/ui/Button';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { FieldsStepBody } from '@/src/features/run-host/FieldsStepBody';
import type { FieldLookupContext } from '@/src/features/run-host/FieldsStepBody';
import { RemarksPanel } from '@/src/features/run-host/RemarksPanel';
import { ProductionCellEditor } from '@/src/features/run-host/editors/ComplexCells';
import type { CardStep } from '@/src/features/run-host/buildCardSteps';
import {
  buildBlowProcessSection,
  buildEmptyChemistry,
  buildEmptyDelayRegister,
  buildEmptyHourlyMatrix,
  buildEmptyProductionLog,
  buildEmptyProductionRow,
  buildSampleChemistry,
  buildStaticMaterialSection,
  buildTargetChemistry,
  computeTotalMinutes,
  delayMinutesBetween,
  emptyMaterialSection,
  getBlowProcessConfig,
  getDelayRegisterConfig,
  getHourlyMatrixConfig,
  getProductionLogConfig,
  getStaticMaterialConfig,
} from '@/src/features/run-host/section-data';
import type {
  BlowProcessSectionData,
  ChemistrySectionData,
  DelayRegisterSectionData,
  GradeElement,
  HourlyMatrixSectionData,
  MaterialCatalogItem,
  MaterialSectionData,
  MatrixColumnDef,
  ProductionLogSectionData,
  SampleChemistrySectionData,
  SectionDataMap,
  StaticMaterialSectionData,
  SteelGrade,
  StrandPairValue,
  TargetChemistrySectionData,
} from '@/src/features/run-host/section-data/types';
import type { TemplateSection } from '@/src/types/processRun';
import { colors, spacing, touch, typography } from '@/src/theme/tokens';

export type CardStepContext = {
  runId: string;
  runState: string;
  gradeElements: GradeElement[];
  steelGrades: SteelGrade[];
  alloyMaterials: MaterialCatalogItem[];
  scrapMaterials: MaterialCatalogItem[];
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  fieldLookups?: FieldLookupContext;
  remarksRefreshKey: number;
  disabled?: boolean;
};

type Props = {
  step: CardStep;
  section: TemplateSection;
  sectionData: SectionDataMap;
  onSectionDataChange: (key: string, data: unknown) => void;
  ctx: CardStepContext;
  onJumpToStep?: (stepId: string) => void;
};

function JumpRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.jump, pressed && styles.jumpPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.jumpText}>
        <Text style={styles.jumpTitle}>{title}</Text>
        {subtitle ? <Text style={styles.jumpSub}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.jumpCta}>Edit</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.brand} />
    </Pressable>
  );
}

function parseCellInput(raw: string, type: string): string | number | null {
  if (raw === '') return null;
  if (type === 'number' || type === 'integer') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}

function parseIsoDate(raw: string | number | null | undefined): Date | null {
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function matrixColumnLabel(col: MatrixColumnDef): string {
  return col.group ? `${col.group}: ${col.label}` : col.label;
}

function BlowMatrixColumnField({
  col,
  value,
  disabled,
  onChange,
}: {
  col: MatrixColumnDef;
  value: string | number | null | undefined;
  disabled?: boolean;
  onChange: (next: string | number | null) => void;
}) {
  const label = matrixColumnLabel(col);
  if (col.type === 'datetime' || col.type === 'date' || col.type === 'time') {
    const mode = col.type === 'date' || col.type === 'time' ? col.type : 'datetime';
    return (
      <View style={styles.datetimeRow}>
        <View style={styles.flex}>
          <DateTimeField
            label={label}
            mode={mode}
            value={parseIsoDate(value)}
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

  return (
    <TextField
      label={label}
      value={value == null ? '' : String(value)}
      keyboardType={
        col.type === 'number' || col.type === 'integer' ? 'decimal-pad' : 'default'
      }
      editable={!disabled && col.key !== 'duration_minutes'}
      onChangeText={(t) => onChange(parseCellInput(t, col.type))}
    />
  );
}

export function CardStepBody({
  step,
  section,
  sectionData,
  onSectionDataChange,
  ctx,
  onJumpToStep,
}: Props) {
  const disabled = ctx.disabled;

  if (step.kind === 'fields') {
    const hasRemarks = section.fields.some((f) => f.name === 'remarks');
    const fields = hasRemarks
      ? section.fields.filter((f) => f.name !== 'remarks')
      : section.fields;
    return (
      <View style={styles.stack}>
        {hasRemarks ? (
          <RemarksPanel runId={ctx.runId} refreshKey={ctx.remarksRefreshKey} />
        ) : null}
        <FieldsStepBody
          fields={fields}
          values={ctx.fieldValues}
          onChange={ctx.onFieldChange}
          disabled={disabled}
          lookups={
            ctx.fieldLookups ?? {
              steelGrades: ctx.steelGrades,
            }
          }
        />
      </View>
    );
  }

  if (step.kind === 'chemistry_list' || step.kind === 'chemistry_sample') {
    const data =
      (sectionData[section.key] as ChemistrySectionData) ??
      buildEmptyChemistry(ctx.gradeElements);
    const rows =
      data.rows.length > 0 ? data.rows : buildEmptyChemistry(ctx.gradeElements).rows;
    const sampleCount = Math.max(
      1,
      rows.reduce((m, r) => Math.max(m, r.samples.length), 0)
    );
    const maxSamples = (section.config.max_samples as number | undefined) ?? 8;

    if (step.kind === 'chemistry_list') {
      return (
        <View style={styles.stack}>
          <Text style={styles.hint}>Enter chemistry one sample at a time.</Text>
          {Array.from({ length: sampleCount }).map((_, i) => (
            <JumpRow
              key={i}
              title={`Sample ${i + 1}`}
              onPress={() => onJumpToStep?.(`${section.key}:sample:${i}`)}
            />
          ))}
          {sampleCount < maxSamples ? (
            <Button
              title="Add sample"
              variant="secondary"
              size="lg"
              fullWidth
              disabled={disabled}
              onPress={() =>
                onSectionDataChange(section.key, {
                  rows: rows.map((row) => ({ ...row, samples: [...row.samples, null] })),
                })
              }
            />
          ) : null}
        </View>
      );
    }

    const si = step.sampleIndex ?? 0;
    return (
      <View style={styles.stack}>
        <Text style={styles.sectionLabel}>Sample {si + 1}</Text>
        {rows.length === 0 ? (
          <Text style={styles.hint}>No grade elements loaded for chemistry limits.</Text>
        ) : (
          rows.map((row, ri) => (
            <TextField
              key={row.element}
              label={`${row.element}${
                row.min != null || row.max != null
                  ? ` (${row.min ?? '—'}–${row.max ?? '—'})`
                  : ''
              }`}
              value={row.samples[si] == null ? '' : String(row.samples[si])}
              keyboardType="decimal-pad"
              editable={!disabled}
              onChangeText={(t) => {
                const samples = [...row.samples];
                while (samples.length <= si) samples.push(null);
                samples[si] = t === '' ? null : Number(t);
                onSectionDataChange(section.key, {
                  rows: rows.map((r, i) => (i === ri ? { ...r, samples } : r)),
                });
              }}
            />
          ))
        )}
      </View>
    );
  }

  if (step.kind === 'material_list' || step.kind === 'material_row') {
    const materials =
      section.key === 'charge_mix' ? ctx.scrapMaterials : ctx.alloyMaterials;
    const data =
      (sectionData[section.key] as MaterialSectionData) ?? emptyMaterialSection();

    if (step.kind === 'material_list') {
      return (
        <View style={styles.stack}>
          {data.rows.length === 0 ? (
            <Text style={styles.hint}>No rows yet. Add a material entry.</Text>
          ) : null}
          {data.rows.map((row, i) => {
            const name =
              materials.find((m) => m.code === row.material)?.name ??
              (row.material || 'Material');
            return (
              <JumpRow
                key={i}
                title={name}
                subtitle={
                  row.quantity_kg != null ? `${row.quantity_kg} kg` : 'Qty not set'
                }
                onPress={() => onJumpToStep?.(`${section.key}:row:${i}`)}
              />
            );
          })}
          <Button
            title="Add row"
            variant="secondary"
            size="lg"
            fullWidth
            disabled={disabled}
            onPress={() =>
              onSectionDataChange(section.key, {
                rows: [
                  ...data.rows,
                  { material: materials[0]?.code ?? '', quantity_kg: null },
                ],
              })
            }
          />
        </View>
      );
    }

    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) {
      return <Text style={styles.hint}>Row not found. Go back and add a row.</Text>;
    }
    return (
      <View style={styles.stack}>
        <SelectSheet
          label="Material"
          options={materials.map((m) => ({
            label: `${m.name} (${m.code})`,
            value: m.code,
          }))}
          value={row.material || null}
          onChange={(code) => {
            onSectionDataChange(section.key, {
              rows: data.rows.map((r, i) => (i === idx ? { ...r, material: code } : r)),
            });
          }}
          disabled={disabled}
        />
        {materials.length === 0 ? (
          <TextField
            label="Material code"
            value={row.material}
            onChangeText={(t) =>
              onSectionDataChange(section.key, {
                rows: data.rows.map((r, i) => (i === idx ? { ...r, material: t } : r)),
              })
            }
            editable={!disabled}
          />
        ) : null}
        <TextField
          label="Quantity (kg)"
          value={row.quantity_kg == null ? '' : String(row.quantity_kg)}
          keyboardType="decimal-pad"
          editable={!disabled}
          onChangeText={(t) =>
            onSectionDataChange(section.key, {
              rows: data.rows.map((r, i) =>
                i === idx
                  ? { ...r, quantity_kg: t === '' ? null : Number(t) }
                  : r
              ),
            })
          }
        />
        <Button
          title="Remove row"
          variant="danger"
          size="lg"
          fullWidth
          disabled={disabled}
          onPress={() => {
            onSectionDataChange(section.key, {
              rows: data.rows.filter((_, i) => i !== idx),
            });
            onJumpToStep?.(`${section.key}:list`);
          }}
        />
      </View>
    );
  }

  if (step.kind === 'static_material') {
    const config = getStaticMaterialConfig(section);
    const data =
      (sectionData[section.key] as StaticMaterialSectionData) ??
      buildStaticMaterialSection(config);
    return (
      <View style={styles.stack}>
        {data.rows.map((row, idx) => (
          <TextField
            key={row.material || config[idx]?.code || idx}
            label={config.find((c) => c.code === row.material)?.label ?? row.material}
            value={row.quantity_kg == null ? '' : String(row.quantity_kg)}
            keyboardType="decimal-pad"
            editable={!disabled}
            onChangeText={(t) =>
              onSectionDataChange(section.key, {
                rows: data.rows.map((r, i) =>
                  i === idx
                    ? { ...r, quantity_kg: t === '' ? null : Number(t) }
                    : r
                ),
              })
            }
          />
        ))}
      </View>
    );
  }

  if (step.kind === 'matrix_row') {
    const { rows: labels, columns } = getBlowProcessConfig(section);
    const data =
      (sectionData[section.key] as BlowProcessSectionData) ??
      buildBlowProcessSection(labels);
    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <Text style={styles.hint}>Blow row missing.</Text>;
    const hasTimeRange =
      columns.some((c) => c.key === 'time_from') && columns.some((c) => c.key === 'time_to');

    return (
      <View style={styles.stack}>
        <Text style={styles.sectionLabel}>{row.blow_no || `Blow ${idx + 1}`}</Text>
        <Text style={styles.hint}>{columns.length} columns — complete every field for this blow.</Text>
        {columns.map((col) => (
          <BlowMatrixColumnField
            key={col.key}
            col={col}
            value={row.values[col.key]}
            disabled={disabled}
            onChange={(nextVal) => {
              const nextRows = data.rows.map((r, i) => {
                if (i !== idx) return r;
                const nextValues = {
                  ...r.values,
                  [col.key]: nextVal,
                };
                if (hasTimeRange && (col.key === 'time_from' || col.key === 'time_to')) {
                  const from = String(nextValues.time_from ?? '');
                  const to = String(nextValues.time_to ?? '');
                  nextValues.duration_minutes = computeTotalMinutes(from || null, to || null);
                }
                return { ...r, values: nextValues };
              });
              onSectionDataChange(section.key, { rows: nextRows });
            }}
          />
        ))}
      </View>
    );
  }

  if (step.kind === 'target_chemistry') {
    const data =
      (sectionData[section.key] as TargetChemistrySectionData) ??
      buildTargetChemistry(ctx.gradeElements);
    const codes =
      (section.config.elements as string[] | undefined) ??
      ctx.gradeElements.map((e) => e.element);
    return (
      <View style={styles.stack}>
        {codes.map((el) => (
          <TextField
            key={el}
            label={el}
            value={data.targets[el] == null ? '' : String(data.targets[el])}
            keyboardType="decimal-pad"
            editable={!disabled}
            onChangeText={(t) =>
              onSectionDataChange(section.key, {
                targets: {
                  ...data.targets,
                  [el]: t === '' ? null : Number(t),
                },
              })
            }
          />
        ))}
      </View>
    );
  }

  if (step.kind === 'sample_chemistry_list' || step.kind === 'sample_chemistry_row') {
    const sampleRows = (section.config.sample_rows as string[] | undefined) ?? [];
    const elements = (section.config.elements as string[] | undefined) ?? [];
    const includeTemperature = Boolean(section.config.include_temperature);
    const data =
      (sectionData[section.key] as SampleChemistrySectionData) ??
      buildSampleChemistry(sampleRows.length ? sampleRows : ['Sample 1'], elements);

    if (step.kind === 'sample_chemistry_list') {
      return (
        <View style={styles.stack}>
          {data.rows.map((row, i) => (
            <JumpRow
              key={row.sample || i}
              title={row.sample || `Sample ${i + 1}`}
              onPress={() => onJumpToStep?.(`${section.key}:row:${i}`)}
            />
          ))}
        </View>
      );
    }

    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <Text style={styles.hint}>Sample missing.</Text>;
    return (
      <View style={styles.stack}>
        <Text style={styles.sectionLabel}>{row.sample}</Text>
        {includeTemperature ? (
          <TextField
            label="Temperature"
            value={row.temperature == null ? '' : String(row.temperature)}
            keyboardType="decimal-pad"
            editable={!disabled}
            onChangeText={(t) =>
              onSectionDataChange(section.key, {
                rows: data.rows.map((r, i) =>
                  i === idx
                    ? { ...r, temperature: t === '' ? null : Number(t) }
                    : r
                ),
              })
            }
          />
        ) : null}
        {elements.map((el) => (
          <TextField
            key={el}
            label={el}
            value={row.elements[el] == null ? '' : String(row.elements[el])}
            keyboardType="decimal-pad"
            editable={!disabled}
            onChangeText={(t) =>
              onSectionDataChange(section.key, {
                rows: data.rows.map((r, i) =>
                  i === idx
                    ? {
                        ...r,
                        elements: {
                          ...r.elements,
                          [el]: t === '' ? null : Number(t),
                        },
                      }
                    : r
                ),
              })
            }
          />
        ))}
      </View>
    );
  }

  if (step.kind === 'production_list' || step.kind === 'production_row') {
    const { columns, defaultEmptyRows } = getProductionLogConfig(section);
    const data =
      (sectionData[section.key] as ProductionLogSectionData) ??
      buildEmptyProductionLog(columns, defaultEmptyRows);

    if (step.kind === 'production_list') {
      return (
        <View style={styles.stack}>
          {data.rows.map((row, i) => {
            const heatNo = row.values.heat_no;
            const title =
              typeof heatNo === 'string' && heatNo.trim()
                ? `Heat ${heatNo.trim()}`
                : `Row ${i + 1}`;
            return (
              <JumpRow
                key={i}
                title={title}
                onPress={() => onJumpToStep?.(`${section.key}:row:${i}`)}
              />
            );
          })}
          <Button
            title="Add row"
            variant="secondary"
            size="lg"
            fullWidth
            disabled={disabled}
            onPress={() => {
              onSectionDataChange(section.key, {
                rows: [...data.rows, buildEmptyProductionRow(columns)],
              });
            }}
          />
        </View>
      );
    }

    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <Text style={styles.hint}>Row missing.</Text>;
    const gradeOptions = ctx.steelGrades.map((g) => ({
      label: g.description ? `${g.code} — ${g.description}` : g.code,
      value: g.id,
    }));
    const castStartPair =
      (row.values.cast_start as StrandPairValue | undefined) ?? null;

    return (
      <View style={styles.stack}>
        <Text style={styles.hint}>{columns.length} columns — scroll and fill this casting entry.</Text>
        {columns.map((col) => {
          if (col.type === 'dropdown' && col.options?.length) {
            return (
              <SelectSheet
                key={col.key}
                label={col.label}
                options={col.options.map((o) => ({ label: o, value: o }))}
                value={typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : null}
                onChange={(v) =>
                  onSectionDataChange(section.key, {
                    rows: data.rows.map((r, i) =>
                      i === idx ? { ...r, values: { ...r.values, [col.key]: v } } : r
                    ),
                  })
                }
                disabled={disabled}
              />
            );
          }
          if ((col.type === 'grade_ref' || col.key === 'grade_id') && gradeOptions.length) {
            return (
              <SelectSheet
                key={col.key}
                label={col.label}
                options={gradeOptions}
                value={typeof row.values[col.key] === 'string' ? (row.values[col.key] as string) : null}
                onChange={(v) =>
                  onSectionDataChange(section.key, {
                    rows: data.rows.map((r, i) =>
                      i === idx ? { ...r, values: { ...r.values, [col.key]: v } } : r
                    ),
                  })
                }
                disabled={disabled}
              />
            );
          }
          return (
            <ProductionCellEditor
              key={col.key}
              column={col}
              value={row.values[col.key] ?? null}
              disabled={disabled}
              gradeOptions={gradeOptions}
              castStartPair={
                col.key === 'cast_end' && col.subtype === 'datetime' ? castStartPair : null
              }
              onChange={(v) =>
                onSectionDataChange(section.key, {
                  rows: data.rows.map((r, i) =>
                    i === idx ? { ...r, values: { ...r.values, [col.key]: v } } : r
                  ),
                })
              }
            />
          );
        })}
      </View>
    );
  }

  if (step.kind === 'delay_list' || step.kind === 'delay_row') {
    const { defaultEmptyRows } = getDelayRegisterConfig(section);
    const data =
      (sectionData[section.key] as DelayRegisterSectionData) ??
      buildEmptyDelayRegister(defaultEmptyRows);

    if (step.kind === 'delay_list') {
      return (
        <View style={styles.stack}>
          {data.rows.map((row, i) => (
            <JumpRow
              key={row.id || i}
              title={`Delay ${i + 1}`}
              subtitle={`${row.time_from || '—'} – ${row.time_to || '—'}${
                row.time_lost_minutes != null ? ` · ${row.time_lost_minutes} min` : ''
              }`}
              onPress={() => onJumpToStep?.(`${section.key}:row:${i}`)}
            />
          ))}
          <Button
            title="Add delay"
            variant="secondary"
            size="lg"
            fullWidth
            disabled={disabled}
            onPress={() =>
              onSectionDataChange(section.key, {
                rows: [...data.rows, ...buildEmptyDelayRegister(1).rows],
              })
            }
          />
        </View>
      );
    }

    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <Text style={styles.hint}>Delay row missing.</Text>;

    const patch = (partial: Partial<typeof row>) => {
      onSectionDataChange(section.key, {
        rows: data.rows.map((r, i) => {
          if (i !== idx) return r;
          const next = { ...r, ...partial };
          if ('time_from' in partial || 'time_to' in partial) {
            next.time_lost_minutes = delayMinutesBetween(next.time_from, next.time_to);
          }
          return next;
        }),
      });
    };

    return (
      <View style={styles.stack}>
        <TextField
          label="From (HH:MM)"
          value={row.time_from}
          onChangeText={(t) => patch({ time_from: t })}
          editable={!disabled}
        />
        <TextField
          label="To (HH:MM)"
          value={row.time_to}
          onChangeText={(t) => patch({ time_to: t })}
          editable={!disabled}
        />
        <TextField
          label="Lost minutes"
          value={row.time_lost_minutes == null ? '' : String(row.time_lost_minutes)}
          editable={false}
        />
        <TextField
          label="Reason"
          value={row.reason}
          onChangeText={(t) => patch({ reason: t })}
          editable={!disabled}
        />
        <TextField
          label="Action taken"
          value={row.action_taken}
          onChangeText={(t) => patch({ action_taken: t })}
          editable={!disabled}
        />
      </View>
    );
  }

  if (step.kind === 'hourly_list' || step.kind === 'hourly_hour') {
    const { hours, rows: metrics } = getHourlyMatrixConfig(section);
    const data =
      (sectionData[section.key] as HourlyMatrixSectionData) ??
      buildEmptyHourlyMatrix(hours, metrics);

    if (step.kind === 'hourly_list') {
      return (
        <View style={styles.stack}>
          {hours.length === 0 ? (
            <Text style={styles.hint}>No hours configured on this template.</Text>
          ) : null}
          {hours.map((h) => (
            <JumpRow
              key={h}
              title={h}
              onPress={() => onJumpToStep?.(`${section.key}:hour:${h}`)}
            />
          ))}
        </View>
      );
    }

    const hour = step.hourKey ?? hours[0];
    const hourData = data.hours[hour] ?? {};
    return (
      <View style={styles.stack}>
        <Text style={styles.sectionLabel}>Hour {hour}</Text>
        {metrics.map((m) => (
          <TextField
            key={m.key}
            label={m.label}
            value={hourData[m.key] == null ? '' : String(hourData[m.key])}
            keyboardType={
              m.type === 'integer' || m.type === 'number' ? 'decimal-pad' : 'default'
            }
            editable={!disabled}
            onChangeText={(t) => {
              const value =
                m.type === 'integer' || m.type === 'number'
                  ? t === ''
                    ? null
                    : Number(t)
                  : t;
              onSectionDataChange(section.key, {
                hours: {
                  ...data.hours,
                  [hour]: { ...hourData, [m.key]: value },
                },
              });
            }}
          />
        ))}
      </View>
    );
  }

  return <Text style={styles.hint}>Unsupported card step ({step.kind}).</Text>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  sectionLabel: { ...typography.section, color: colors.text },
  datetimeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1 },
  nowBtn: { marginBottom: 2 },
  jump: {
    minHeight: touch.listRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  jumpPressed: { backgroundColor: colors.brandSoft },
  jumpText: { flex: 1, gap: 2 },
  jumpTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  jumpSub: { ...typography.caption, color: colors.textMuted },
  jumpCta: { ...typography.caption, color: colors.brand, fontWeight: '600' },
});
