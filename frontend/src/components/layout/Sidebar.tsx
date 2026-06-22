import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { fetchUnreadCount } from '../../api/messages';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import {
  hasRole,
  CEO_ROLES,
  HOD_ROLES,
  SUPERVISOR_ONLY_ROLES,
  WORKER_ROLES,
  MAINTENANCE_ROLES,
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

  const showShift =
    isWorker ||
    isSupervisorOnly ||
    (isHod && !isPlatformAdmin);

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

        {isMaintenance && (
          <>
            <p className={sectionClass}>Maintenance</p>
            <NavLink to="/maintenance" className={linkClass}>
              Issue queue
            </NavLink>
          </>
        )}

        {showShift && (
          <>
            {!isSupervisorOnly && !isWorker && <p className={sectionClass}>Shop floor</p>}
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
      </nav>

      <div className="border-t border-slate-200 p-4">
        <Button variant="secondary" className="w-full" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
