/** P2-DEPT-SHELLS — QUAL / MAINT / UTIL have no manufacturing log sheets. */

export const SHELL_DEPARTMENT_CODES = ['QUAL', 'MAINT', 'UTIL'] as const;

export type ShellDepartmentCode = (typeof SHELL_DEPARTMENT_CODES)[number];

export function isShellDepartmentCode(code: string | undefined | null): boolean {
  if (!code) return false;
  return (SHELL_DEPARTMENT_CODES as readonly string[]).includes(code.toUpperCase());
}

export function shellDepartmentMessage(code: string): string {
  const upper = code.toUpperCase();
  if (upper === 'MAINT') {
    return 'Maintenance has no shop-floor log sheet. Use the Maintenance module (issue queue, work orders, PM).';
  }
  if (upper === 'QUAL') {
    return 'Quality is a department shell — no digital log sheet yet. Browse only; use Foundation / observations when available.';
  }
  if (upper === 'UTIL') {
    return 'Utilities is a department shell — no digital log sheet yet. Browse only.';
  }
  return 'This department has no manufacturing log sheet on mobile.';
}

/** CTA when tapping a shell department in the browser. */
export function shellDepartmentHref(code: string): string | null {
  if (code.toUpperCase() === 'MAINT') return '/maintenance';
  return null;
}
