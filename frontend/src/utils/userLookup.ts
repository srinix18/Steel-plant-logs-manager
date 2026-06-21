import type { TemplateSection, User } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function collectUserRefIds(sections: TemplateSection[], fieldValues: Record<string, string>): string[] {
  const ids = new Set<string>();
  for (const section of sections) {
    for (const field of section.fields ?? []) {
      if (field.field_type === 'user_ref') {
        const v = fieldValues[field.name];
        if (v && isUuid(v)) ids.add(v);
      }
    }
  }
  return [...ids];
}

export function mergeUsers(...lists: (User[] | undefined)[]): User[] {
  const map = new Map<string, User>();
  for (const list of lists) {
    for (const u of list ?? []) {
      map.set(u.id, u);
    }
  }
  return [...map.values()];
}

export function formatUserLabel(user: User): string {
  return `${user.full_name}${user.employee_uid ? ` (${user.employee_uid})` : ''}`;
}

export function resolveUserDisplay(
  userId: string,
  users: User[] | undefined,
  fallback?: User | null,
): string {
  if (!userId) return '—';
  const match = users?.find((u) => u.id === userId);
  if (match) return formatUserLabel(match);
  if (fallback && fallback.id === userId) return formatUserLabel(fallback);
  if (isUuid(userId)) return '—';
  return userId;
}
