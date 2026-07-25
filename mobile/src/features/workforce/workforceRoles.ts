import {
  WORKFORCE_ADMIN_ROLES,
  WORKFORCE_HR_ROLES,
  CEO_ROLES,
  HOD_ROLES,
  HR_ROLES,
  SUPERVISOR_ONLY_ROLES,
} from '@/src/auth/roles';
import type { UserRole } from '@/src/types/user';

/**
 * Matches drawer `showWorkforceDashboard` (HR / HOD / supervisor / CEO).
 * Used by P4-WF-DASH route gate.
 */
export const WORKFORCE_DASHBOARD_ROLES: UserRole[] = [
  ...HR_ROLES,
  ...HOD_ROLES,
  ...SUPERVISOR_ONLY_ROLES,
  ...CEO_ROLES,
];

/** Matches drawer Employees link — platform admin + HR + HOD. */
export { WORKFORCE_ADMIN_ROLES };

/** Matches drawer Contractors / Assignments / Attendance — platform admin + HR. */
export { WORKFORCE_HR_ROLES };

/** Matches drawer Self-service (worker / member). */
export { WORKER_ROLES } from '@/src/auth/roles';
