import type { TemplateSection } from '@/src/types/processRun';

const DIFF_PATTERN = /^\s*(\w+)\s*-\s*(\w+)\s*$/;

function parseIso(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDurationMinutes(minutes: number): string {
  const total = Math.round(Math.abs(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function fieldTypeMap(sections: TemplateSection[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const section of sections) {
    for (const f of section.fields) {
      map[f.name] = f.field_type;
    }
  }
  return map;
}

function evaluateSubtraction(
  left: string,
  right: string,
  leftType: string,
  rightType: string
): string | null {
  if (leftType === 'datetime' || rightType === 'datetime' || leftType === 'calculated') {
    const leftDate = parseIso(left);
    const rightDate = parseIso(right);
    if (!leftDate || !rightDate) return null;
    const minutes = (leftDate.getTime() - rightDate.getTime()) / 60000;
    if (minutes < 0) return null;
    return formatDurationMinutes(minutes);
  }
  const lv = left === '' ? NaN : Number(left);
  const rv = right === '' ? NaN : Number(right);
  if (Number.isNaN(lv) || Number.isNaN(rv)) return null;
  const result = lv - rv;
  if (result < 0) return null;
  return Number.isInteger(result) ? String(result) : String(Math.round(result * 100) / 100);
}

export function evaluateFormula(
  formula: string,
  fieldValues: Record<string, string>,
  fieldTypes: Record<string, string>
): string | null {
  const match = DIFF_PATTERN.exec(formula);
  if (!match) return null;
  return evaluateSubtraction(
    fieldValues[match[1]] ?? '',
    fieldValues[match[2]] ?? '',
    fieldTypes[match[1]] ?? 'text',
    fieldTypes[match[2]] ?? 'text'
  );
}

export function getCalculatedFieldSpecs(
  sections: TemplateSection[]
): Array<{ name: string; formula: string }> {
  const specs: Array<{ name: string; formula: string }> = [];
  for (const section of sections) {
    for (const f of section.fields) {
      if (f.field_type === 'calculated' && f.formula) {
        specs.push({ name: f.name, formula: f.formula });
      }
    }
  }
  return specs;
}

export function evaluateCalculatedFields(
  sections: TemplateSection[],
  fieldValues: Record<string, string>
): Record<string, string> {
  const types = fieldTypeMap(sections);
  const specs = getCalculatedFieldSpecs(sections);
  const merged = { ...fieldValues };
  const updates: Record<string, string> = {};
  for (const { name, formula } of specs) {
    const value = evaluateFormula(formula, merged, types);
    if (value !== null) {
      updates[name] = value;
      merged[name] = value;
    }
  }
  return updates;
}

export function mergeCalculatedIntoFields(
  sections: TemplateSection[],
  fieldValues: Record<string, string>
): Record<string, string> {
  return { ...fieldValues, ...evaluateCalculatedFields(sections, fieldValues) };
}
