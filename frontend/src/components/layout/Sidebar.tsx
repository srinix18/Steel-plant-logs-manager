import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { hasRole, ADMIN_ROLES, SUPERVISOR_ROLES, WORKER_ROLES } from '../../utils/roles';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

const sectionClass = 'px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400';

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user && hasRole(user.role, ADMIN_ROLES);
  const isSupervisor = user && hasRole(user.role, SUPERVISOR_ROLES);
  const canUseShift = user && hasRole(user.role, [...ADMIN_ROLES, ...SUPERVISOR_ROLES, ...WORKER_ROLES]);

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-lg font-bold text-brand-700">MOI Platform</h1>
        <p className="mt-1 truncate text-xs text-slate-500">{user?.full_name}</p>
        <p className="text-xs capitalize text-slate-400">{user?.role?.replace(/_/g, ' ')}</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {isAdmin && (
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

        {(isSupervisor || isAdmin) && (
          <>
            <p className={sectionClass}>Operations</p>
            {isSupervisor && (
              <NavLink to="/supervisor" className={linkClass}>
                Operations Monitor
              </NavLink>
            )}
            {canUseShift && (
              <NavLink to="/shift" className={linkClass}>
                Shift Dashboard
              </NavLink>
            )}
          </>
        )}

        {!isAdmin && !isSupervisor && canUseShift && (
          <NavLink to="/shift" className={linkClass}>
            Shift Dashboard
          </NavLink>
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
