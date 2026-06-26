import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { fetchUnreadCount } from '../../api/messages';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import {
  hasRole,
  CEO_ROLES,
  HR_ROLES,
  HOD_ROLES,
  SUPERVISOR_ONLY_ROLES,
  WORKER_ROLES,
  MAINTENANCE_ROLES,
  MAINTENANCE_MANAGER_ROLES,
  MAINTENANCE_PM_VIEW_ROLES,
  WORKFORCE_HR_ROLES,
  HANDOVER_WRITE_ROLES,
  SHIFT_FLOOR_ROLES,
  WORKFORCE_ADMIN_ROLES,
  HOD_TIER_ROLES,
  SUPERVISOR_ROLES,
  FINANCE_VIEW_ROLES,
  FINANCE_MASTERS_WRITE_ROLES,
  FINANCE_MAPPING_WRITE_ROLES,
} from '../../utils/roles';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

const sectionClass = 'px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400';

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetchUnreadCount()
      .then(setUnread)
      .catch(() => setUnread(0));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const isPlatformAdmin = user.role === 'super_admin' || user.role === 'admin';
  const isCeo = hasRole(user.role, CEO_ROLES);
  const isHod = hasRole(user.role, HOD_ROLES) && !isCeo;
  const isSupervisorOnly = hasRole(user.role, SUPERVISOR_ONLY_ROLES);
  const isWorker = hasRole(user.role, WORKER_ROLES);
  const isMaintenance = hasRole(user.role, MAINTENANCE_ROLES);
  const showMaintenancePm = hasRole(user.role, MAINTENANCE_PM_VIEW_ROLES);
  const showMaintenancePrograms = hasRole(user.role, MAINTENANCE_MANAGER_ROLES);
  const isHr = hasRole(user.role, HR_ROLES);
  const showWorkforceEmployeeAdmin = hasRole(user.role, WORKFORCE_ADMIN_ROLES);
  const showWorkforceDashboard = isHr || isHod || isSupervisorOnly || isCeo;
  const showShiftAssignments = hasRole(user.role, WORKFORCE_HR_ROLES);
  const showAttendance = hasRole(user.role, WORKFORCE_HR_ROLES);
  const showHandover = hasRole(user.role, HANDOVER_WRITE_ROLES);

  const showShift = hasRole(user.role, SHIFT_FLOOR_ROLES);
  const showFoundationAssets = isPlatformAdmin || hasRole(user.role, HOD_TIER_ROLES);
  const showFoundationMasters = showFoundationAssets;
  const showFoundationOps = hasRole(user.role, SUPERVISOR_ROLES) || isMaintenance;
  const showFoundationAnalytics = isPlatformAdmin || isCeo;
  const showFoundationDocs = true;
  const showFoundationSection =
    showFoundationAssets || showFoundationOps || showFoundationAnalytics || showFoundationDocs;
  const showFinance = hasRole(user.role, FINANCE_VIEW_ROLES);
  const showFinanceMasters = hasRole(user.role, FINANCE_MASTERS_WRITE_ROLES);
  const showFinanceMapping = hasRole(user.role, FINANCE_MAPPING_WRITE_ROLES);

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-lg font-bold text-brand-700">MOI Platform</h1>
        <p className="mt-1 truncate text-xs text-slate-500">{user.full_name}</p>
        <p className="text-xs capitalize text-slate-400">{user.role.replace(/_/g, ' ')}</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <NavLink to="/profile" className={linkClass}>
          My Profile
        </NavLink>

        <NavLink to="/messages" className={linkClass}>
          Messages &amp; Alerts
          {unread > 0 && (
            <span className="ml-2 inline-flex rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
              {unread}
            </span>
          )}
        </NavLink>

        {isPlatformAdmin && (
          <>
            <p className={sectionClass}>Administration</p>
            <NavLink to="/admin" end className={linkClass}>
              Overview
            </NavLink>
            <NavLink to="/admin/organisations" className={linkClass}>
              Organisations
            </NavLink>
            <NavLink to="/admin/departments" className={linkClass}>
              Departments
            </NavLink>
            <NavLink to="/admin/sheets" className={linkClass}>
              Log Sheets
            </NavLink>
            <NavLink to="/admin/activity" className={linkClass}>
              Activity
            </NavLink>
            <NavLink to="/admin/users" className={linkClass}>
              Users
            </NavLink>
          </>
        )}

        {isCeo && !isPlatformAdmin && (
          <>
            <p className={sectionClass}>Executive</p>
            <NavLink to="/executive" end className={linkClass}>
              Overview
            </NavLink>
            <NavLink to="/executive/employees" className={linkClass}>
              Employees
            </NavLink>
          </>
        )}

        {isHod && (
          <>
            <p className={sectionClass}>Department</p>
            <NavLink to="/hod" className={linkClass}>
              Overview
            </NavLink>
          </>
        )}

        {isSupervisorOnly && (
          <>
            <p className={sectionClass}>Operations</p>
            <NavLink to="/supervisor" className={linkClass}>
              Operations Activity
            </NavLink>
          </>
        )}

        {(showMaintenancePm || isMaintenance) && (
          <>
            <p className={sectionClass}>Maintenance</p>
            {showMaintenancePm && (
              <NavLink to="/maintenance/dashboard" className={linkClass}>
                Dashboard
              </NavLink>
            )}
            {showMaintenancePrograms && (
              <NavLink to="/maintenance/programs" className={linkClass}>
                PM Programs
              </NavLink>
            )}
            {showMaintenancePm && (
              <NavLink to="/maintenance/work-orders" className={linkClass}>
                Work Orders
              </NavLink>
            )}
            <NavLink to="/maintenance" className={linkClass}>
              Issue Queue
            </NavLink>
          </>
        )}

        {showShift && (
          <>
            <p className={sectionClass}>Shop floor</p>
            <NavLink to="/shift" className={linkClass}>
              Shift Dashboard
            </NavLink>
            {(isWorker || isSupervisorOnly) && (
              <NavLink to="/my-runs" className={linkClass}>
                My Runs
              </NavLink>
            )}
          </>
        )}

        {showWorkforceDashboard && (
          <>
            <p className={sectionClass}>Workforce Operations</p>
            <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              Overview
            </p>
            <NavLink to="/workforce/dashboard" className={linkClass}>
              Workforce Dashboard
            </NavLink>
            {showWorkforceEmployeeAdmin && (
              <>
                <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                  People
                </p>
                <NavLink to="/workforce/employees" className={linkClass}>
                  Employees
                </NavLink>
                {showShiftAssignments && (
                  <NavLink to="/workforce/contractors" className={linkClass}>
                    Contractors
                  </NavLink>
                )}
              </>
            )}
            {showShiftAssignments && (
              <>
                <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                  Scheduling
                </p>
                <NavLink to="/workforce/shift-assignments" className={linkClass}>
                  Shift Assignments
                </NavLink>
                <NavLink to="/workforce/shift-planning" className={linkClass}>
                  Shift Planning
                </NavLink>
                {showAttendance && (
                  <NavLink to="/workforce/attendance" className={linkClass}>
                    Attendance
                  </NavLink>
                )}
                {showHandover && (
                  <NavLink to="/workforce/handover" className={linkClass}>
                    Shift Handover Notes
                  </NavLink>
                )}
              </>
            )}
            {showShiftAssignments && (
              <>
                <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                  HR Ops
                </p>
                <NavLink to="/workforce/leave" className={linkClass}>
                  Leave Requests
                </NavLink>
                <NavLink to="/workforce/skills" className={linkClass}>
                  Skill Matrix
                </NavLink>
                <NavLink to="/workforce/training" className={linkClass}>
                  Training
                </NavLink>
                <NavLink to="/workforce/payroll" className={linkClass}>
                  Payroll
                </NavLink>
                <NavLink to="/workforce/salary-structures" className={linkClass}>
                  Salary Structures
                </NavLink>
              </>
            )}
          </>
        )}

        {isWorker && (
          <>
            <p className={sectionClass}>Self-service</p>
            <NavLink to="/workforce/my-attendance" className={linkClass}>
              My Attendance
            </NavLink>
            <NavLink to="/workforce/my-leave" className={linkClass}>
              My Leave
            </NavLink>
            <NavLink to="/workforce/my-payslips" className={linkClass}>
              My Payslips
            </NavLink>
          </>
        )}

        {showFoundationSection && (
          <>
            <p className={sectionClass}>Plant Foundation</p>
            {showFoundationAssets && (
              <NavLink to="/foundation/assets" className={linkClass}>
                Assets
              </NavLink>
            )}
            {showFoundationMasters && (
              <NavLink to="/foundation/masters" className={linkClass}>
                Masters
              </NavLink>
            )}
            {showFoundationOps && (
              <>
                <NavLink to="/foundation/observations" className={linkClass}>
                  Observations
                </NavLink>
                <NavLink to="/foundation/corrective-actions" className={linkClass}>
                  Corrective Actions
                </NavLink>
              </>
            )}
            {showFoundationDocs && (
              <NavLink to="/foundation/documents" className={linkClass}>
                Documents
              </NavLink>
            )}
            {showFoundationAnalytics && (
              <NavLink to="/foundation/analytics" className={linkClass}>
                Analytics
              </NavLink>
            )}
          </>
        )}

        {showFinance && (
          <>
            <p className={sectionClass}>Finance</p>
            <NavLink to="/finance/dashboard" className={linkClass}>
              Cost Dashboard
            </NavLink>
            {showFinanceMasters && (
              <NavLink to="/finance/masters" className={linkClass}>
                Cost Masters
              </NavLink>
            )}
            {showFinanceMapping && (
              <NavLink to="/finance/mappings" className={linkClass}>
                Cost Mapping Builder
              </NavLink>
            )}
            {showFinanceMasters && (
              <NavLink to="/finance/calculations" className={linkClass}>
                Calculations
              </NavLink>
            )}
            <NavLink to="/finance/analytics" className={linkClass}>
              Cost Analytics
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <Button variant="secondary" className="w-full" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
