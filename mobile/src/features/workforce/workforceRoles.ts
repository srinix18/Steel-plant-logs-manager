import type { UserRole } from '@/src/types/user';
import {
  CEO_ROLES,
  HOD_ROLES,
  HR_ROLES,
  SUPERVISOR_ONLY_ROLES,
} from '@/src/auth/roles';

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
