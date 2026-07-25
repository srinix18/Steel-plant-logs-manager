import type { UserRole } from '../types/user';
import {
  CEO_ROLES,
  FINANCE_MAPPING_WRITE_ROLES,
  FINANCE_MASTERS_WRITE_ROLES,
  FINANCE_VIEW_ROLES,
  HANDOVER_WRITE_ROLES,
  hasRole,
  HOD_ROLES,
  HOD_TIER_ROLES,
  HR_ROLES,
  MAINTENANCE_MANAGER_ROLES,
  MAINTENANCE_PM_VIEW_ROLES,
  MAINTENANCE_ROLES,
  SHIFT_FLOOR_ROLES,
  SUPERVISOR_ONLY_ROLES,
  SUPERVISOR_ROLES,
  WORKER_ROLES,
  WORKFORCE_ADMIN_ROLES,
  WORKFORCE_HR_ROLES,
} from '../auth/roles';

export type DrawerSection = { type: 'section'; label: string };
export type DrawerLink = {
  type: 'link';
  label: string;
  /** Expo Router href under (app) */
  href: string;
  nextChunk: string;
};
export type DrawerNavEntry = DrawerSection | DrawerLink;

function link(label: string, href: string, nextChunk: string): DrawerLink {
  return { type: 'link', label, href, nextChunk };
}

function section(label: string): DrawerSection {
  return { type: 'section', label };
}

/**
 * Mirrors `frontend/src/components/layout/Sidebar.tsx` visibility.
 * Always starts with Profile + Messages.
 */
export function buildDrawerNav(role: UserRole): DrawerNavEntry[] {
  const items: DrawerNavEntry[] = [
    link('My Profile', '/profile', 'P1-07'),
    link('Messages & Alerts', '/messages', 'P3-MSG-INBOX'),
  ];

  const isPlatformAdmin = role === 'super_admin' || role === 'admin';
  const isCeo = hasRole(role, CEO_ROLES);
  const isHod = hasRole(role, HOD_ROLES) && !isCeo;
  const isSupervisorOnly = hasRole(role, SUPERVISOR_ONLY_ROLES);
  const isWorker = hasRole(role, WORKER_ROLES);
  const isMaintenance = hasRole(role, MAINTENANCE_ROLES);
  const showMaintenancePm = hasRole(role, MAINTENANCE_PM_VIEW_ROLES);
  const showMaintenancePrograms = hasRole(role, MAINTENANCE_MANAGER_ROLES);
  const isHr = hasRole(role, HR_ROLES);
  const showWorkforceEmployeeAdmin = hasRole(role, WORKFORCE_ADMIN_ROLES);
  const showWorkforceDashboard = isHr || isHod || isSupervisorOnly || isCeo;
  const showShiftAssignments = hasRole(role, WORKFORCE_HR_ROLES);
  const showAttendance = hasRole(role, WORKFORCE_HR_ROLES);
  const showHandover = hasRole(role, HANDOVER_WRITE_ROLES);
  const showShift = hasRole(role, SHIFT_FLOOR_ROLES);
  const showFoundationAssets = isPlatformAdmin || hasRole(role, HOD_TIER_ROLES);
  const showFoundationMasters = showFoundationAssets;
  const showFoundationOps = hasRole(role, SUPERVISOR_ROLES) || isMaintenance;
  const showFoundationAnalytics = isPlatformAdmin || isCeo;
  const showFoundationDocs = true;
  const showFoundationSection =
    showFoundationAssets || showFoundationOps || showFoundationAnalytics || showFoundationDocs;
  const showFinance = hasRole(role, FINANCE_VIEW_ROLES);
  const showFinanceMasters = hasRole(role, FINANCE_MASTERS_WRITE_ROLES);
  const showFinanceMapping = hasRole(role, FINANCE_MAPPING_WRITE_ROLES);

  if (isPlatformAdmin) {
    items.push(
      section('Administration'),
      link('Overview', '/admin', 'P5-ADM-HOME'),
      link('Organisations', '/admin/organisations', 'P5-ADM-ORG'),
      link('Departments', '/admin/departments', 'P2-DEPT-SHELLS'),
      link('Log Sheets', '/admin/sheets', 'P5-ADM-SHEETS'),
      link('Activity', '/admin/activity', 'P5-ADM-ACT'),
      link('Users', '/admin/users', 'P5-ADM-USERS')
    );
  }

  if (isCeo && !isPlatformAdmin) {
    items.push(
      section('Pulse'),
      link('Plant Pulse', '/pulse/plant', 'P5-PULSE-PLANT'),
      link('Department Pulse', '/pulse/department', 'P5-PULSE-DEPT'),
      link('Energy', '/energy', 'P5-ENERGY'),
      link('Inventory Pulse', '/inventory-pulse', 'P5-INV'),
      link('Safety', '/safety/dashboard', 'P3-SAFE-DASH'),
      section('Executive'),
      link('Overview', '/executive', 'P5-EXE-HOME'),
      link('Employees', '/executive/employees', 'P5-EXE-EMP')
    );
  }

  if (isHod) {
    items.push(
      section('Pulse'),
      link('Department Pulse', '/pulse/department', 'P5-PULSE-DEPT'),
      link('Scan QR', '/safety/scan', 'P3-SAFE-SCAN'),
      section('Department'),
      link('Overview', '/hod', 'P3-OPS-HOD'),
      link('Departments', '/admin/departments', 'P2-DEPT-SHELLS')
    );
  }

  if (isSupervisorOnly) {
    items.push(
      section('Operations'),
      link('Operations Activity', '/supervisor', 'P3-OPS-SUPER')
    );
  }

  if (showMaintenancePm || isMaintenance) {
    items.push(section('Maintenance'));
    if (showMaintenancePm) {
      items.push(link('Dashboard', '/maintenance/dashboard', 'P3-MAINT-DASH'));
    }
    if (showMaintenancePrograms) {
      items.push(link('PM Programs', '/maintenance/programs', 'P3-MAINT-PM-LIST'));
    }
    if (showMaintenancePm) {
      items.push(link('Work Orders', '/maintenance/work-orders', 'P3-MAINT-WO-LIST'));
    }
    items.push(
      link('Issue Queue', '/maintenance', 'P3-MAINT-QUEUE'),
      link('Scan QR', '/safety/scan', 'P3-SAFE-SCAN')
    );
  }

  if (showShift) {
    items.push(section('Shop floor'), link('Shift Dashboard', '/shift', 'P3-OPS-SHIFT'));
    if (isWorker || isSupervisorOnly) {
      items.push(link('My Runs', '/my-runs', 'P3-OPS-MYRUNS'));
    }
    items.push(
      link('Peeling', '/peel', 'P2-BBD-PEEL'),
      link('Scan QR', '/safety/scan', 'P3-SAFE-SCAN')
    );
  }

  if (showWorkforceDashboard) {
    items.push(
      section('Workforce Operations'),
      link('Workforce Dashboard', '/workforce', 'P4-WF-DASH')
    );
    if (showWorkforceEmployeeAdmin) {
      items.push(link('Employees', '/workforce/employees', 'P4-WF-EMP'));
      if (showShiftAssignments) {
        items.push(link('Contractors', '/workforce/contractors', 'P4-WF-CON'));
      }
    }
    if (showShiftAssignments) {
      items.push(
        link('Shift Assignments', '/workforce/shift-assignments', 'P4-WF-ASSIGN'),
        link('Shift Planning', '/workforce/shift-planning', 'P4-WF-PLAN')
      );
      if (showAttendance) {
        items.push(link('Attendance', '/workforce/attendance', 'P4-WF-ATT'));
      }
      if (showHandover) {
        items.push(link('Shift Handover Notes', '/workforce/handover', 'P4-WF-HAND'));
      }
      items.push(
        link('Leave Requests', '/workforce/leave', 'P4-WF-LEAVE'),
        link('Skill Matrix', '/workforce/skills', 'P4-WF-SKILL'),
        link('Training', '/workforce/training', 'P4-WF-TRAIN'),
        link('Payroll', '/workforce/payroll', 'P4-WF-PAY'),
        link('Salary Structures', '/workforce/salary-structures', 'P4-WF-SAL')
      );
    }
  }

  if (isWorker) {
    items.push(
      section('Self-service'),
      link('My Attendance', '/workforce/my-attendance', 'P4-WF-MY-ATT'),
      link('My Leave', '/workforce/my-leave', 'P4-WF-MY-LEAVE'),
      link('My Payslips', '/workforce/my-payslips', 'P4-WF-MY-PAY')
    );
  }

  if (showFoundationSection) {
    items.push(section('Plant Foundation'));
    if (showFoundationAssets) {
      items.push(
        link('Departments', '/admin/departments', 'P2-DEPT-SHELLS'),
        link('Assets', '/foundation/assets', 'P5-FND-ASSETS')
      );
    }
    if (showFoundationMasters) {
      items.push(link('Masters', '/foundation/masters', 'P5-FND-MASTERS'));
    }
    if (showFoundationOps) {
      items.push(
        link('Observations', '/foundation/observations', 'P5-FND-OBS'),
        link('Corrective Actions', '/foundation/corrective-actions', 'P5-FND-CA')
      );
    }
    if (showFoundationDocs) {
      items.push(link('Documents', '/foundation/documents', 'P5-FND-DOCS'));
    }
    if (showFoundationAnalytics) {
      items.push(link('Analytics', '/foundation/analytics', 'P5-FND-AN'));
    }
  }

  if (showFinance) {
    items.push(
      section('Finance'),
      link('Cost Dashboard', '/finance/dashboard', 'P5-FIN-DASH')
    );
    if (showFinanceMasters) {
      items.push(link('Cost Masters', '/finance/masters', 'P5-FIN-MASTERS'));
    }
    if (showFinanceMapping) {
      items.push(link('Cost Mapping Builder', '/finance/mappings', 'P5-FIN-MAP'));
    }
    if (showFinanceMasters) {
      items.push(link('Calculations', '/finance/calculations', 'P5-FIN-CALC'));
    }
    items.push(link('Cost Analytics', '/finance/analytics', 'P5-FIN-AN'));
  }

  return items;
}

export function drawerLinkHrefs(role: UserRole): string[] {
  return buildDrawerNav(role)
    .filter((e): e is DrawerLink => e.type === 'link')
    .map((e) => e.href);
}

/** Unique placeholder screens needed for drawer links (+ role homes). */
export function allPlaceholderRoutes(): DrawerLink[] {
  const seen = new Set<string>();
  const out: DrawerLink[] = [];
  const roles: UserRole[] = [
    'super_admin',
    'admin',
    'ceo',
    'org_admin',
    'hr',
    'hod',
    'plant_admin',
    'supervisor',
    'department',
    'worker',
    'member',
    'maintenance',
    'maintenance_manager',
  ];
  for (const role of roles) {
    for (const entry of buildDrawerNav(role)) {
      if (entry.type !== 'link') continue;
      if (seen.has(entry.href)) continue;
      seen.add(entry.href);
      out.push(entry);
    }
  }
  return out;
}
