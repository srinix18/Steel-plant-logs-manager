import type { UserRole } from '../types';

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

/** @deprecated use PLATFORM_ADMIN_ROLES */
const ADMIN_ROLES: UserRole[] = PLATFORM_ADMIN_ROLES;

export function hasRole(userRole: UserRole, allowed: UserRole[]): boolean {
  if (allowed.includes(userRole)) return true;
  if (userRole === 'admin' && allowed.some((r) => PLATFORM_ADMIN_ROLES.includes(r))) return true;
  if (userRole === 'org_admin' && allowed.some((r) => CEO_ROLES.includes(r) || CEO_TIER_ROLES.includes(r))) return true;
  if (userRole === 'plant_admin' && allowed.some((r) => HOD_ROLES.includes(r) || HOD_TIER_ROLES.includes(r))) return true;
  if (userRole === 'department' && allowed.some((r) => SUPERVISOR_ONLY_ROLES.includes(r) || SUPERVISOR_ROLES.includes(r))) return true;
  if (userRole === 'member' && allowed.some((r) => WORKER_ROLES.includes(r))) return true;
  return false;
}

export function isPlatformAdmin(role: UserRole): boolean {
  return hasRole(role, PLATFORM_ADMIN_ROLES);
}

export function isCeoTier(role: UserRole): boolean {
  return hasRole(role, CEO_TIER_ROLES);
}

export function isHodTier(role: UserRole): boolean {
  return hasRole(role, HOD_TIER_ROLES);
}

export function isSupervisorTier(role: UserRole): boolean {
  return hasRole(role, SUPERVISOR_ROLES);
}

export function isMaintenance(role: UserRole): boolean {
  return hasRole(role, MAINTENANCE_ROLES);
}

export function isHr(role: UserRole): boolean {
  return hasRole(role, HR_ROLES);
}

export {
  ADMIN_ROLES,
  PLATFORM_ADMIN_ROLES,
  CEO_ROLES,
  HR_ROLES,
  CEO_TIER_ROLES,
  HOD_ROLES,
  HOD_TIER_ROLES,
  SUPERVISOR_ROLES,
  SUPERVISOR_ONLY_ROLES,
  WORKFORCE_ADMIN_ROLES,
  WORKER_ROLES,
  MAINTENANCE_ROLES,
};
