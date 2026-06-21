import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminOrganisationsPage } from './pages/admin/AdminOrganisationsPage';
import { AdminDepartmentsPage } from './pages/admin/AdminDepartmentsPage';
import { LogSheetPage } from './pages/admin/LogSheetPage';
import { AdminActivityPage } from './pages/admin/AdminActivityPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { ShiftDashboard } from './pages/operations/ShiftDashboard';
import { HeatWorkspace } from './pages/operations/HeatWorkspace';
import { SupervisorMonitor } from './pages/operations/SupervisorMonitor';
import { RunReportPage } from './pages/reports/RunReportPage';
import { MyRunsPage } from './pages/operations/MyRunsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { hasRole, ADMIN_ROLES, SUPERVISOR_ROLES, WORKER_ROLES } from './utils/roles';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (hasRole(user.role, ADMIN_ROLES)) return <Navigate to="/admin" replace />;
  if (hasRole(user.role, SUPERVISOR_ROLES)) return <Navigate to="/supervisor" replace />;
  if (hasRole(user.role, WORKER_ROLES)) return <Navigate to="/shift" replace />;
  return <Navigate to="/shift" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<RoleRedirect />} />

          <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/organisations" element={<AdminOrganisationsPage />} />
            <Route path="admin/departments" element={<AdminDepartmentsPage />} />
            <Route path="admin/sheets" element={<LogSheetPage />} />
            <Route path="admin/activity" element={<AdminActivityPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES} />}>
            <Route path="supervisor" element={<SupervisorMonitor />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[...ADMIN_ROLES, ...SUPERVISOR_ROLES, ...WORKER_ROLES]} />}>
            <Route path="shift" element={<ShiftDashboard />} />
          </Route>

          <Route path="heat/:runId" element={<HeatWorkspace />} />
          <Route path="reports/:runId" element={<RunReportPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="my-runs" element={<MyRunsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
