import type { TemplateField } from '../../types';
import { Input } from '../ui/Input';

interface DynamicFormRendererProps {
  fields: TemplateField[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
}

export function DynamicFormRenderer({ fields, values, onChange }: DynamicFormRendererProps) {
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      {sorted.map((field) => (
        <div key={field.id}>
          {field.field_type === 'textarea' ? (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={field.placeholder || ''}
                value={(values[field.id] as string) ?? ''}
                onChange={(e) => onChange(field.id, e.target.value)}
                rows={4}
                required={field.required}
              />
            </div>
          ) : field.field_type === 'boolean' ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(values[field.id])}
                onChange={(e) => onChange(field.id, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>
          ) : field.field_type === 'dropdown' ? (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={(values[field.id] as string) ?? ''}
                onChange={(e) => onChange(field.id, e.target.value)}
                required={field.required}
              >
                <option value="">Select...</option>
                {(field.validation?.options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ) : (
            <Input
              label={`${field.label}${field.required ? ' *' : ''}`}
              type={
                field.field_type === 'number'
                  ? 'number'
                  : field.field_type === 'email'
                    ? 'email'
                    : field.field_type === 'date'
                      ? 'date'
                      : 'text'
              }
              placeholder={field.placeholder || ''}
              value={(values[field.id] as string | number) ?? ''}
              onChange={(e) =>
                onChange(
                  field.id,
                  field.field_type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                )
              }
              required={field.required}
              min={field.validation?.min_value}
              max={field.validation?.max_value}
              minLength={field.validation?.min_length}
              maxLength={field.validation?.max_length}
            />
          )}
        </div>
      ))}
    </div>
  );
}
