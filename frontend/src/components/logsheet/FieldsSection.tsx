import type { SectionRenderContext, TemplateField, TemplateSection } from '../../types';
import { resolveUserDisplay } from '../../utils/userLookup';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface FieldsSectionProps extends SectionRenderContext {
  section: TemplateSection;
  readOnly?: boolean;
  showSave?: boolean;
  saving?: boolean;
  onSave?: () => void;
}

function renderField(
  f: TemplateField,
  ctx: SectionRenderContext,
  readOnly?: boolean,
) {
  const value = ctx.fieldValues[f.name] || '';

  if (f.field_type === 'datetime') {
    return (
      <div className="flex gap-2">
        <Input
          label={f.label}
          type="datetime-local"
          value={value.slice(0, 16)}
          onChange={(e) => ctx.onFieldChange(f.name, new Date(e.target.value).toISOString())}
          disabled={readOnly}
        />
        {!readOnly && ctx.onFieldNow && (
          <Button type="button" variant="secondary" className="mt-6" onClick={() => ctx.onFieldNow!(f.name)}>
            Now
          </Button>
        )}
      </div>
    );
  }

  if (f.field_type === 'date') {
    return (
      <Input
        label={f.label}
        type="date"
        value={value.slice(0, 10)}
        onChange={(e) => ctx.onFieldChange(f.name, e.target.value)}
        required={f.required}
        disabled={readOnly}
      />
    );
  }

  if (f.field_type === 'number') {
    return (
      <Input
        label={f.label}
        type="number"
        value={value}
        onChange={(e) => ctx.onFieldChange(f.name, e.target.value)}
        required={f.required}
        disabled={readOnly}
      />
    );
  }

  if (f.field_type === 'dropdown') {
    const options = (f.config.options as string[] | undefined) ?? [];
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">
          {f.label}
          {f.required && <span className="text-red-500"> *</span>}
        </span>
        <select
          value={value}
          onChange={(e) => ctx.onFieldChange(f.name, e.target.value)}
          disabled={readOnly}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (f.field_type === 'grade_ref') {
    const grades = ctx.steelGrades ?? [];
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">
          {f.label}
          {f.required && <span className="text-red-500"> *</span>}
        </span>
        <select
          value={value}
          onChange={(e) => ctx.onFieldChange(f.name, e.target.value)}
          disabled={readOnly}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select grade…</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} — {g.description}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (f.field_type === 'user_ref') {
    const users = ctx.plantUsers ?? [];
    if (readOnly) {
      return (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">{f.label}</span>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            {resolveUserDisplay(value, users, ctx.currentUser)}
          </div>
        </label>
      );
    }
    const defaultValue = value || ctx.currentUserId || '';
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">
          {f.label}
          {f.required && <span className="text-red-500"> *</span>}
        </span>
        <select
          value={defaultValue}
          onChange={(e) => ctx.onFieldChange(f.name, e.target.value)}
          disabled={readOnly}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
              {u.employee_uid ? ` (${u.employee_uid})` : ''}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (f.field_type === 'textarea') {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">{f.label}</span>
        <textarea
          value={value}
          onChange={(e) => ctx.onFieldChange(f.name, e.target.value)}
          disabled={readOnly}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
    );
  }

  if (f.field_type === 'signature') {
    return (
      <Input
        label={f.label}
        value={value}
        onChange={(e) => ctx.onFieldChange(f.name, e.target.value)}
        placeholder={readOnly ? undefined : 'Sign name'}
        required={f.required}
        disabled={readOnly}
      />
    );
  }

  if (f.field_type === 'calculated') {
    const num = Number(value);
    const display = Number.isFinite(num) && num < 0 ? '—' : value || '—';
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">{f.label}</span>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
          {display}
        </div>
      </label>
    );
  }

  return (
    <Input
      label={f.label}
      value={value}
      onChange={(e) => ctx.onFieldChange(f.name, e.target.value)}
      required={f.required}
      disabled={readOnly}
    />
  );
}

export function FieldsSection({
  section,
  readOnly,
  showSave,
  saving,
  onSave,
  ...ctx
}: FieldsSectionProps) {
  return (
    <div className="space-y-4">
      {section.fields.map((f) => (
        <div key={f.name}>{renderField(f, ctx, readOnly)}</div>
      ))}
      {showSave && onSave && !readOnly && (
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Section'}
        </Button>
      )}
    </div>
  );
}
