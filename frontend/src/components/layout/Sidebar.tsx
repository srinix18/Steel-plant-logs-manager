import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-lg font-bold text-brand-700">Logbook</h1>
        <p className="mt-1 truncate text-xs text-slate-500">{user?.full_name}</p>
        <p className="text-xs capitalize text-slate-400">{user?.role}</p>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {user?.role === 'admin' && (
          <>
            <NavLink to="/admin" end className={linkClass}>Dashboard</NavLink>
            <NavLink to="/admin/users" className={linkClass}>Users</NavLink>
            <NavLink to="/admin/organisations" className={linkClass}>Organisations</NavLink>
            <NavLink to="/admin/departments" className={linkClass}>Departments</NavLink>
            <NavLink to="/admin/templates" className={linkClass}>Templates</NavLink>
          </>
        )}
        {user?.role === 'department' && (
          <NavLink to="/department" className={linkClass}>Dashboard</NavLink>
        )}
        {user?.role === 'member' && (
          <NavLink to="/member" className={linkClass}>Dashboard</NavLink>
        )}
        <NavLink to="/records" className={linkClass}>Records</NavLink>
        <NavLink to="/records/new" className={linkClass}>New Entry</NavLink>
      </nav>
      <div className="border-t border-slate-200 p-4">
        <Button variant="secondary" className="w-full" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
