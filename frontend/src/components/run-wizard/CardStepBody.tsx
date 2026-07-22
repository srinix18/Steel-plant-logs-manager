import { FieldsSection } from '../logsheet/FieldsSection';
import { RemarkThread } from '../logsheet/RemarkThread';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type {
  BlowProcessSectionData,
  ChemistrySectionData,
  MaterialSectionData,
  ProductionLogColumnDef,
  ProductionLogSectionData,
  SampleChemistrySectionData,
  SectionRenderContext,
  StaticMaterialSectionData,
  TargetChemistrySectionData,
  TemplateSection,
} from '../../types';
import type { DelayRegisterSectionData } from '../logsheet/DelayRegisterTable';
import type { HourlyMatrixSectionData } from '../logsheet/HourlyProductionMatrix';
import {
  buildEmptyChemistry,
} from '../logsheet/ChemistryTable';
import { emptyMaterialSection } from '../logsheet/MaterialRowsTable';
import {
  buildStaticMaterialSection,
  getStaticMaterialConfig,
} from '../logsheet/StaticMaterialTable';
import {
  buildBlowProcessSection,
  getBlowProcessConfig,
} from '../logsheet/BlowProcessMatrix';
import { buildTargetChemistry } from '../logsheet/TargetChemistryRow';
import {
  buildSampleChemistry,
} from '../logsheet/SampleChemistryMatrix';
import {
  buildEmptyProductionLog,
  getProductionLogConfig,
} from '../logsheet/ConcastProductionTable';
import {
  buildEmptyDelayRegister,
  getDelayRegisterConfig,
} from '../logsheet/DelayRegisterTable';
import {
  buildEmptyHourlyMatrix,
  getHourlyMatrixConfig,
} from '../logsheet/HourlyProductionMatrix';
import type { CardStep } from './buildCardSteps';
import type { SectionDataMap } from '../logsheet/SectionRenderer';

interface Props {
  step: CardStep;
  section: TemplateSection;
  sectionData: SectionDataMap;
  onSectionDataChange: (key: string, data: unknown) => void;
  ctx: SectionRenderContext;
  onJumpToStep?: (stepId: string) => void;
}

function cellToString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (typeof val === 'object') return JSON.stringify(val);
  return '';
}

function parseCellInput(raw: string, type: string): string | number | null {
  if (raw === '') return null;
  if (type === 'number' || type === 'integer' || type === 'calculated') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}

export function CardStepBody({
  step,
  section,
  sectionData,
  onSectionDataChange,
  ctx,
  onJumpToStep,
}: Props) {
  if (step.kind === 'fields') {
    const hasRemarksField = section.fields.some((f) => f.name === 'remarks');
    const fields =
      ctx.runId && hasRemarksField
        ? section.fields.filter((f) => f.name !== 'remarks')
        : section.fields;
    return (
      <div className="space-y-4">
        {ctx.runId && hasRemarksField && (
          <RemarkThread runId={ctx.runId} runState={ctx.runState ?? ''} />
        )}
        <FieldsSection section={{ ...section, fields }} {...ctx} showSave={false} />
      </div>
    );
  }

  if (step.kind === 'chemistry_list' || step.kind === 'chemistry_sample') {
    const data =
      (sectionData[section.key] as ChemistrySectionData) ??
      buildEmptyChemistry(ctx.gradeElements);
    const rows = data.rows.length > 0 ? data.rows : buildEmptyChemistry(ctx.gradeElements).rows;
    const sampleCount = rows.reduce((m, r) => Math.max(m, r.samples.length), 0);
    const maxSamples = (section.config.max_samples as number | undefined) ?? 8;

    if (step.kind === 'chemistry_list') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Enter chemistry one sample at a time. Tap a sample to edit, or add another.
          </p>
          {Array.from({ length: Math.max(sampleCount, 1) }).map((_, i) => (
            <button
              key={i}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm"
              onClick={() => onJumpToStep?.(`${section.key}:sample:${i}`)}
            >
              <span className="font-medium text-slate-800">Sample {i + 1}</span>
              <span className="text-sm text-brand-600">Edit →</span>
            </button>
          ))}
          {sampleCount < maxSamples && (
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                onSectionDataChange(section.key, {
                  rows: rows.map((row) => ({ ...row, samples: [...row.samples, null] })),
                });
              }}
            >
              Add sample
            </Button>
          )}
        </div>
      );
    }

    const si = step.sampleIndex ?? 0;
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-700">Sample {si + 1}</p>
        {rows.map((row, ri) => (
          <Input
            key={row.element}
            label={`${row.element}${row.min != null || row.max != null ? ` (${row.min ?? '—'}–${row.max ?? '—'})` : ''}`}
            type="number"
            inputMode="decimal"
            value={row.samples[si] ?? ''}
            onChange={(e) => {
              const samples = [...row.samples];
              while (samples.length <= si) samples.push(null);
              samples[si] = e.target.value === '' ? null : Number(e.target.value);
              const next = rows.map((r, i) => (i === ri ? { ...r, samples } : r));
              onSectionDataChange(section.key, { rows: next });
            }}
          />
        ))}
      </div>
    );
  }

  if (step.kind === 'material_list' || step.kind === 'material_row') {
    const materials =
      section.key === 'charge_mix' ? ctx.scrapMaterials : ctx.alloyMaterials;
    const data =
      (sectionData[section.key] as MaterialSectionData) ?? emptyMaterialSection();

    if (step.kind === 'material_list') {
      return (
        <div className="space-y-3">
          {data.rows.length === 0 && (
            <p className="text-sm text-slate-500">No rows yet. Add a material entry.</p>
          )}
          {data.rows.map((row, i) => {
            const name =
              materials.find((m) => m.code === row.material)?.name ?? (row.material || 'Material');
            return (
              <button
                key={i}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm"
                onClick={() => onJumpToStep?.(`${section.key}:row:${i}`)}
              >
                <span>
                  <span className="font-medium text-slate-800">{name}</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {row.quantity_kg != null ? `${row.quantity_kg} kg` : 'Qty not set'}
                  </span>
                </span>
                <span className="text-sm text-brand-600">Edit →</span>
              </button>
            );
          })}
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => {
              onSectionDataChange(section.key, {
                rows: [
                  ...data.rows,
                  { material: materials[0]?.code ?? '', quantity_kg: null },
                ],
              });
            }}
          >
            Add row
          </Button>
        </div>
      );
    }

    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <p className="text-sm text-slate-500">Row not found. Go back and add a row.</p>;

    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Material
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
            value={row.material}
            onChange={(e) => {
              const rows = data.rows.map((r, i) =>
                i === idx ? { ...r, material: e.target.value } : r,
              );
              onSectionDataChange(section.key, { rows });
            }}
          >
            <option value="">Select…</option>
            {materials.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name} ({m.code})
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Quantity (kg)"
          type="number"
          inputMode="decimal"
          value={row.quantity_kg ?? ''}
          onChange={(e) => {
            const rows = data.rows.map((r, i) =>
              i === idx
                ? { ...r, quantity_kg: e.target.value === '' ? null : Number(e.target.value) }
                : r,
            );
            onSectionDataChange(section.key, { rows });
          }}
        />
        <Button
          variant="danger"
          size="lg"
          className="w-full"
          onClick={() => {
            onSectionDataChange(section.key, {
              rows: data.rows.filter((_, i) => i !== idx),
            });
            onJumpToStep?.(`${section.key}:list`);
          }}
        >
          Remove row
        </Button>
      </div>
    );
  }

  if (step.kind === 'static_material') {
    const config = getStaticMaterialConfig(section);
    const data =
      (sectionData[section.key] as StaticMaterialSectionData) ??
      buildStaticMaterialSection(config);
    return (
      <div className="space-y-4">
        {data.rows.map((row, idx) => (
          <Input
            key={row.material || config[idx]?.code || idx}
            label={config.find((c) => c.code === row.material)?.label ?? row.material}
            type="number"
            inputMode="decimal"
            value={row.quantity_kg ?? ''}
            onChange={(e) => {
              const rows = data.rows.map((r, i) =>
                i === idx
                  ? { ...r, quantity_kg: e.target.value === '' ? null : Number(e.target.value) }
                  : r,
              );
              onSectionDataChange(section.key, { rows });
            }}
          />
        ))}
      </div>
    );
  }

  if (step.kind === 'matrix_row') {
    const { rows: labels, columns } = getBlowProcessConfig(section);
    const data =
      (sectionData[section.key] as BlowProcessSectionData) ??
      buildBlowProcessSection(labels);
    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <p className="text-sm text-slate-500">Blow row missing.</p>;
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-800">Blow {row.blow_no || idx + 1}</p>
        {columns.map((col) => (
          <Input
            key={col.key}
            label={col.label}
            type={col.type === 'number' || col.type === 'integer' ? 'number' : 'text'}
            inputMode={col.type === 'number' || col.type === 'integer' ? 'decimal' : undefined}
            value={row.values[col.key] ?? ''}
            onChange={(e) => {
              const nextRows = data.rows.map((r, i) =>
                i === idx
                  ? {
                      ...r,
                      values: {
                        ...r.values,
                        [col.key]: parseCellInput(e.target.value, col.type),
                      },
                    }
                  : r,
              );
              onSectionDataChange(section.key, { rows: nextRows });
            }}
          />
        ))}
      </div>
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
      <div className="space-y-4">
        {codes.map((el) => (
          <Input
            key={el}
            label={el}
            type="number"
            inputMode="decimal"
            value={data.targets[el] ?? ''}
            onChange={(e) => {
              onSectionDataChange(section.key, {
                targets: {
                  ...data.targets,
                  [el]: e.target.value === '' ? null : Number(e.target.value),
                },
              });
            }}
          />
        ))}
      </div>
    );
  }

  if (step.kind === 'sample_chemistry_list' || step.kind === 'sample_chemistry_row') {
    const sampleRows = (section.config.sample_rows as string[] | undefined) ?? [];
    const elements = (section.config.elements as string[] | undefined) ?? [];
    const includeTemperature = Boolean(section.config.include_temperature);
    const data =
      (sectionData[section.key] as SampleChemistrySectionData) ??
      buildSampleChemistry(sampleRows, elements);

    if (step.kind === 'sample_chemistry_list') {
      return (
        <div className="space-y-3">
          {data.rows.map((row, i) => (
            <button
              key={row.sample || i}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm"
              onClick={() => onJumpToStep?.(`${section.key}:row:${i}`)}
            >
              <span className="font-medium text-slate-800">{row.sample || `Sample ${i + 1}`}</span>
              <span className="text-sm text-brand-600">Edit →</span>
            </button>
          ))}
        </div>
      );
    }

    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <p className="text-sm text-slate-500">Sample missing.</p>;
    return (
      <div className="space-y-4">
        <p className="font-semibold text-slate-800">{row.sample}</p>
        {includeTemperature && (
          <Input
            label="Temperature"
            type="number"
            inputMode="decimal"
            value={row.temperature ?? ''}
            onChange={(e) => {
              const rows = data.rows.map((r, i) =>
                i === idx
                  ? {
                      ...r,
                      temperature: e.target.value === '' ? null : Number(e.target.value),
                    }
                  : r,
              );
              onSectionDataChange(section.key, { rows });
            }}
          />
        )}
        {elements.map((el) => (
          <Input
            key={el}
            label={el}
            type="number"
            inputMode="decimal"
            value={row.elements[el] ?? ''}
            onChange={(e) => {
              const rows = data.rows.map((r, i) =>
                i === idx
                  ? {
                      ...r,
                      elements: {
                        ...r.elements,
                        [el]: e.target.value === '' ? null : Number(e.target.value),
                      },
                    }
                  : r,
              );
              onSectionDataChange(section.key, { rows });
            }}
          />
        ))}
      </div>
    );
  }

  if (step.kind === 'production_list' || step.kind === 'production_row') {
    const { columns, defaultEmptyRows } = getProductionLogConfig(section);
    const data =
      (sectionData[section.key] as ProductionLogSectionData) ??
      buildEmptyProductionLog(columns, defaultEmptyRows);

    if (step.kind === 'production_list') {
      return (
        <div className="space-y-3">
          {data.rows.map((_, i) => (
            <button
              key={i}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm"
              onClick={() => onJumpToStep?.(`${section.key}:row:${i}`)}
            >
              <span className="font-medium text-slate-800">Row {i + 1}</span>
              <span className="text-sm text-brand-600">Edit →</span>
            </button>
          ))}
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => {
              const empty: Record<string, null> = {};
              for (const c of columns) empty[c.key] = null;
              onSectionDataChange(section.key, {
                rows: [...data.rows, { values: empty }],
              });
            }}
          >
            Add row
          </Button>
        </div>
      );
    }

    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <p className="text-sm text-slate-500">Row missing.</p>;
    return (
      <ProductionRowFields
        columns={columns}
        values={row.values}
        onChange={(values) => {
          const rows = data.rows.map((r, i) => (i === idx ? { ...r, values } : r));
          onSectionDataChange(section.key, { rows });
        }}
        steelGrades={ctx.steelGrades}
      />
    );
  }

  if (step.kind === 'delay_list' || step.kind === 'delay_row') {
    const { defaultEmptyRows } = getDelayRegisterConfig(section);
    const data =
      (sectionData[section.key] as DelayRegisterSectionData) ??
      buildEmptyDelayRegister(defaultEmptyRows);

    if (step.kind === 'delay_list') {
      return (
        <div className="space-y-3">
          {data.rows.map((row, i) => (
            <button
              key={row.id || i}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm"
              onClick={() => onJumpToStep?.(`${section.key}:row:${i}`)}
            >
              <span>
                <span className="font-medium text-slate-800">Delay {i + 1}</span>
                <span className="mt-0.5 block text-sm text-slate-500">
                  {row.time_from || '—'} – {row.time_to || '—'}
                  {row.time_lost_minutes != null ? ` · ${row.time_lost_minutes} min` : ''}
                </span>
              </span>
              <span className="text-sm text-brand-600">Edit →</span>
            </button>
          ))}
        </div>
      );
    }

    const idx = step.itemIndex ?? 0;
    const row = data.rows[idx];
    if (!row) return <p className="text-sm text-slate-500">Delay row missing.</p>;
    return (
      <div className="space-y-4">
        <Input
          label="From (HH:MM)"
          type="time"
          value={row.time_from}
          onChange={(e) => {
            const rows = data.rows.map((r, i) =>
              i === idx ? { ...r, time_from: e.target.value } : r,
            );
            onSectionDataChange(section.key, { rows });
          }}
        />
        <Input
          label="To (HH:MM)"
          type="time"
          value={row.time_to}
          onChange={(e) => {
            const rows = data.rows.map((r, i) =>
              i === idx ? { ...r, time_to: e.target.value } : r,
            );
            onSectionDataChange(section.key, { rows });
          }}
        />
        <Input
          label="Reason"
          value={row.reason}
          onChange={(e) => {
            const rows = data.rows.map((r, i) =>
              i === idx ? { ...r, reason: e.target.value } : r,
            );
            onSectionDataChange(section.key, { rows });
          }}
        />
        <Input
          label="Action taken"
          value={row.action_taken}
          onChange={(e) => {
            const rows = data.rows.map((r, i) =>
              i === idx ? { ...r, action_taken: e.target.value } : r,
            );
            onSectionDataChange(section.key, { rows });
          }}
        />
      </div>
    );
  }

  if (step.kind === 'hourly_list' || step.kind === 'hourly_hour') {
    const { hours, rows: metrics } = getHourlyMatrixConfig(section);
    const data =
      (sectionData[section.key] as HourlyMatrixSectionData) ??
      buildEmptyHourlyMatrix(hours, metrics);

    if (step.kind === 'hourly_list') {
      return (
        <div className="space-y-3">
          {hours.map((h) => (
            <button
              key={h}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm"
              onClick={() => onJumpToStep?.(`${section.key}:hour:${h}`)}
            >
              <span className="font-medium text-slate-800">{h}</span>
              <span className="text-sm text-brand-600">Edit →</span>
            </button>
          ))}
        </div>
      );
    }

    const hour = step.hourKey ?? hours[0];
    const hourData = data.hours[hour] ?? {};
    return (
      <div className="space-y-4">
        <p className="font-semibold text-slate-800">Hour {hour}</p>
        {metrics.map((m) => (
          <Input
            key={m.key}
            label={m.label}
            type={m.type === 'integer' || m.type === 'number' ? 'number' : 'text'}
            inputMode={m.type === 'integer' || m.type === 'number' ? 'decimal' : undefined}
            value={hourData[m.key] ?? ''}
            onChange={(e) => {
              const value =
                m.type === 'integer' || m.type === 'number'
                  ? e.target.value === ''
                    ? null
                    : Number(e.target.value)
                  : e.target.value;
              onSectionDataChange(section.key, {
                hours: {
                  ...data.hours,
                  [hour]: { ...hourData, [m.key]: value },
                },
              });
            }}
          />
        ))}
      </div>
    );
  }

  return <p className="text-sm text-slate-500">Unsupported card step.</p>;
}

function ProductionRowFields({
  columns,
  values,
  onChange,
  steelGrades,
}: {
  columns: ProductionLogColumnDef[];
  values: ProductionLogSectionData['rows'][0]['values'];
  onChange: (values: ProductionLogSectionData['rows'][0]['values']) => void;
  steelGrades?: SectionRenderContext['steelGrades'];
}) {
  return (
    <div className="space-y-4">
      {columns.map((col) => {
        if (col.type === 'calculated') {
          return (
            <div key={col.key}>
              <p className="text-sm font-medium text-slate-700">{col.label}</p>
              <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base">
                {cellToString(values[col.key]) || '—'}
              </p>
            </div>
          );
        }
        if (col.type === 'grade_ref' || col.key === 'grade_id') {
          return (
            <label key={col.key} className="block text-sm font-medium text-slate-700">
              {col.label}
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
                value={typeof values[col.key] === 'string' ? (values[col.key] as string) : ''}
                onChange={(e) => onChange({ ...values, [col.key]: e.target.value || null })}
              >
                <option value="">Select…</option>
                {(steelGrades ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (col.type === 'dropdown' && col.options) {
          return (
            <label key={col.key} className="block text-sm font-medium text-slate-700">
              {col.label}
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
                value={cellToString(values[col.key])}
                onChange={(e) => onChange({ ...values, [col.key]: e.target.value || null })}
              >
                <option value="">Select…</option>
                {col.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        // Complex object types: edit as JSON-ish simple fields or string
        if (
          col.type === 'time_range' ||
          col.type === 'mould_tube' ||
          col.type === 'strand_pair' ||
          col.type === 'ladle_temp' ||
          col.type === 'furnace_zones' ||
          col.type === 'zone_strand' ||
          col.type === 'heat_ref' ||
          col.type === 'coil_ref' ||
          col.fields
        ) {
          return (
            <div key={col.key} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">{col.label}</p>
              {(col.fields ?? [{ key: 'value', label: 'Value', type: 'text' }]).map((f) => {
                const obj = (values[col.key] as Record<string, unknown> | null) ?? {};
                const nested = typeof obj === 'object' && obj !== null ? obj : {};
                const current = nested[f.key];
                return (
                  <Input
                    key={f.key}
                    label={f.label}
                    type={f.type === 'number' || f.type === 'integer' ? 'number' : 'text'}
                    value={cellToString(current)}
                    onChange={(e) => {
                      const nextObj = {
                        ...(typeof values[col.key] === 'object' && values[col.key]
                          ? (values[col.key] as object)
                          : {}),
                        [f.key]: parseCellInput(e.target.value, f.type),
                      };
                      onChange({ ...values, [col.key]: nextObj as never });
                    }}
                  />
                );
              })}
            </div>
          );
        }
        return (
          <Input
            key={col.key}
            label={col.label}
            type={col.type === 'number' || col.type === 'integer' ? 'number' : 'text'}
            inputMode={col.type === 'number' || col.type === 'integer' ? 'decimal' : undefined}
            value={cellToString(values[col.key])}
            onChange={(e) =>
              onChange({
                ...values,
                [col.key]: parseCellInput(e.target.value, col.type),
              })
            }
          />
        );
      })}
    </div>
  );
}
