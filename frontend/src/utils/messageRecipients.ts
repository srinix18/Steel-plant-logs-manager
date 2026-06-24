import type { Department, User } from '../types';

export type RecipientToken =
  | { kind: 'user'; id: string; label: string }
  | { kind: 'all'; label: string }
  | { kind: 'dept'; id: string; code: string; label: string };

export type RecipientSuggestion =
  | { kind: 'user'; id: string; label: string; sublabel: string }
  | { kind: 'all'; label: string; sublabel: string }
  | { kind: 'dept'; id: string; code: string; label: string; sublabel: string };

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function matchesUser(user: User, query: string): boolean {
  const q = norm(query);
  if (!q || q.startsWith('@')) return false;
  return (
    user.full_name.toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q) ||
    (user.employee_uid?.toLowerCase().includes(q) ?? false) ||
    user.role.replace(/_/g, ' ').toLowerCase().includes(q)
  );
}

function matchesDept(dept: Department, term: string): boolean {
  const t = norm(term);
  if (!t) return true;
  return dept.code.toLowerCase().includes(t) || dept.name.toLowerCase().includes(t);
}

export function buildRecipientSuggestions(
  query: string,
  eligible: User[],
  departments: Department[],
  selected: RecipientToken[],
): RecipientSuggestion[] {
  const q = query.trim();
  if (!q) return [];

  const selectedUserIds = new Set(selected.filter((t) => t.kind === 'user').map((t) => t.id));
  const selectedDeptIds = new Set(selected.filter((t) => t.kind === 'dept').map((t) => t.id));
  const hasAll = selected.some((t) => t.kind === 'all');

  if (q.startsWith('@')) {
    const term = q.slice(1);
    const suggestions: RecipientSuggestion[] = [];

    if (!hasAll && (term === '' || 'all'.startsWith(norm(term)))) {
      suggestions.push({
        kind: 'all',
        label: '@all',
        sublabel: 'Everyone in the organisation',
      });
    }

    for (const dept of departments) {
      if (selectedDeptIds.has(dept.id)) continue;
      if (!matchesDept(dept, term)) continue;
      const count = eligible.filter((u) => u.department_id === dept.id).length;
      suggestions.push({
        kind: 'dept',
        id: dept.id,
        code: dept.code,
        label: `@${dept.code}`,
        sublabel: `${dept.name} · ${count} eligible`,
      });
    }

    return suggestions;
  }

  return eligible
    .filter((u) => !selectedUserIds.has(u.id) && matchesUser(u, q))
    .slice(0, 12)
    .map((u) => ({
      kind: 'user' as const,
      id: u.id,
      label: u.full_name,
      sublabel: `${u.email} · ${u.role.replace(/_/g, ' ')}`,
    }));
}

export function suggestionToToken(s: RecipientSuggestion): RecipientToken {
  if (s.kind === 'user') return { kind: 'user', id: s.id, label: s.label };
  if (s.kind === 'all') return { kind: 'all', label: s.label };
  return { kind: 'dept', id: s.id, code: s.code, label: s.label };
}

export function resolveRecipientIds(
  tokens: RecipientToken[],
  eligible: User[],
  canBroadcast: boolean,
): { recipientIds: string[]; isBroadcast: boolean } {
  if (tokens.some((t) => t.kind === 'all')) {
    if (canBroadcast) return { recipientIds: [], isBroadcast: true };
    return { recipientIds: eligible.map((u) => u.id), isBroadcast: false };
  }

  const ids = new Set<string>();
  for (const token of tokens) {
    if (token.kind === 'user') {
      ids.add(token.id);
    } else if (token.kind === 'dept') {
      eligible.filter((u) => u.department_id === token.id).forEach((u) => ids.add(u.id));
    }
  }
  return { recipientIds: [...ids], isBroadcast: false };
}

export function tokenKey(token: RecipientToken): string {
  if (token.kind === 'user') return `user:${token.id}`;
  if (token.kind === 'dept') return `dept:${token.id}`;
  return 'all';
}
