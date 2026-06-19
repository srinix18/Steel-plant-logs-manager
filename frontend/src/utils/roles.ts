import type { UserRole } from '../types';

const ADMIN_ROLES: UserRole[] = ['super_admin', 'org_admin', 'plant_admin', 'admin'];
const SUPERVISOR_ROLES: UserRole[] = [...ADMIN_ROLES, 'supervisor', 'department'];
const WORKER_ROLES: UserRole[] = ['worker', 'member'];

export function hasRole(userRole: UserRole, allowed: UserRole[]): boolean {
  if (allowed.includes(userRole)) return true;
  if (userRole === 'admin' && allowed.some((r) => ADMIN_ROLES.includes(r))) return true;
  if (userRole === 'department' && allowed.some((r) => SUPERVISOR_ROLES.includes(r))) return true;
  if (userRole === 'member' && allowed.some((r) => WORKER_ROLES.includes(r))) return true;
  return false;
}

export { ADMIN_ROLES, SUPERVISOR_ROLES, WORKER_ROLES };
