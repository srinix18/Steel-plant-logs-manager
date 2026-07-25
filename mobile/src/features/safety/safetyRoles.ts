import type { UserRole } from '@/src/types/user';
import { MAINTENANCE_ROLES, SUPERVISOR_ROLES, WORKER_ROLES } from '@/src/auth/roles';

/** Web App.tsx safety routes: SUPERVISOR ∪ MAINTENANCE ∪ WORKER. */
export const SAFETY_MODULE_ROLES: UserRole[] = [
  ...SUPERVISOR_ROLES,
  ...MAINTENANCE_ROLES,
  ...WORKER_ROLES,
];
