import type { UserRole } from '../types/user';

const PLATFORM_ADMIN_ROLES: UserRole[] = ['super_admin', 'admin'];
const CEO_ROLES: UserRole[] = ['ceo', 'org_admin'];
const HR_ROLES: UserRole[] = ['hr'];
const HOD_ROLES: UserRole[] = ['hod', 'plant_admin'];
const SUPERVISOR_ONLY_ROLES: UserRole[] = ['supervisor', 'department'];
const WORKER_ROLES: UserRole[] = ['worker', 'member'];
const MAINTENANCE_ROLES: UserRole[] = ['maintenance'];

const CEO_TIER_ROLES: UserRole[] = [...PLATFORM_ADMIN_ROLES, ...CEO_ROLES];
const HOD_TIER_ROLES: UserRole[] = [...CEO_TIER_ROLES, ...HOD_ROLES];
const SUPERVISOR_ROLES: UserRole[] = [...HOD_TIER_ROLES, ...SUPERVISOR_ONLY_ROLES];
const WORKFORCE_ADMIN_ROLES: UserRole[] = [...PLATFORM_ADMIN_ROLES, ...HR_ROLES, ...HOD_ROLES];
const WORKFORCE_HR_ROLES: UserRole[] = [...PLATFORM_ADMIN_ROLES, ...HR_ROLES];
const HANDOVER_WRITE_ROLES: UserRole[] = [...CEO_TIER_ROLES, ...HR_ROLES, ...SUPERVISOR_ONLY_ROLES];
const SHIFT_FLOOR_ROLES: UserRole[] = [...SUPERVISOR_ONLY_ROLES, ...WORKER_ROLES];
const FINANCE_VIEW_ROLES: UserRole[] = [...CEO_TIER_ROLES, ...HOD_ROLES, ...SUPERVISOR_ONLY_ROLES];
const FINANCE_MASTERS_WRITE_ROLES: UserRole[] = [...CEO_TIER_ROLES, 'plant_admin'];
const FINANCE_MAPPING_WRITE_ROLES: UserRole[] = [...CEO_TIER_ROLES, 'plant_admin', 'hod'];

const MAINTENANCE_MANAGER_ROLES: UserRole[] = [
  ...CEO_TIER_ROLES,
  'plant_admin',
  'maintenance_manager',
];
const MAINTENANCE_PM_VIEW_ROLES: UserRole[] = [
  ...MAINTENANCE_MANAGER_ROLES,
  ...HOD_ROLES,
  'maintenance',
];

export function hasRole(userRole: UserRole, allowed: UserRole[]): boolean {
  if (allowed.includes(userRole)) return true;
  if (userRole === 'admin' && allowed.some((r) => PLATFORM_ADMIN_ROLES.includes(r))) return true;
  if (
    userRole === 'org_admin' &&
    allowed.some((r) => CEO_ROLES.includes(r) || CEO_TIER_ROLES.includes(r))
  ) {
    return true;
  }
  if (
    userRole === 'plant_admin' &&
    allowed.some((r) => HOD_ROLES.includes(r))
  ) {
    return true;
  }
  if (
    userRole === 'department' &&
    allowed.some((r) => SUPERVISOR_ONLY_ROLES.includes(r) || SUPERVISOR_ROLES.includes(r))
  ) {
    return true;
  }
  if (userRole === 'member' && allowed.some((r) => WORKER_ROLES.includes(r))) return true;
  return false;
}

export {
  PLATFORM_ADMIN_ROLES,
  CEO_ROLES,
  HR_ROLES,
  CEO_TIER_ROLES,
  HOD_ROLES,
  HOD_TIER_ROLES,
  SUPERVISOR_ROLES,
  SUPERVISOR_ONLY_ROLES,
  WORKFORCE_ADMIN_ROLES,
  WORKFORCE_HR_ROLES,
  HANDOVER_WRITE_ROLES,
  SHIFT_FLOOR_ROLES,
  WORKER_ROLES,
  MAINTENANCE_ROLES,
  MAINTENANCE_MANAGER_ROLES,
  MAINTENANCE_PM_VIEW_ROLES,
  FINANCE_VIEW_ROLES,
  FINANCE_MASTERS_WRITE_ROLES,
  FINANCE_MAPPING_WRITE_ROLES,
};
