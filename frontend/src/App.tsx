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
import { ExecutiveOverviewPage } from './pages/executive/ExecutiveOverviewPage';
import { EmployeesPage } from './pages/executive/EmployeesPage';
import { HodDashboardPage } from './pages/hod/HodDashboardPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { ShiftDashboard } from './pages/operations/ShiftDashboard';
import { HeatWorkspace } from './pages/operations/HeatWorkspace';
import { SupervisorMonitor } from './pages/operations/SupervisorMonitor';
import { RunReportPage } from './pages/reports/RunReportPage';
import { MyRunsPage } from './pages/operations/MyRunsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { MaintenanceQueuePage } from './pages/maintenance/MaintenanceQueuePage';
import { WorkforceDashboardPage } from './pages/workforce/WorkforceDashboardPage';
import { WorkforceEmployeesPage } from './pages/workforce/WorkforceEmployeesPage';
import { WorkforceContractorsPage } from './pages/workforce/WorkforceContractorsPage';
import { ShiftAssignmentsPage } from './pages/workforce/ShiftAssignmentsPage';
import { AttendanceEntryPage } from './pages/workforce/AttendanceEntryPage';
import { ShiftHandoverPage } from './pages/workforce/ShiftHandoverPage';
import { MyAttendancePage } from './pages/workforce/MyAttendancePage';
import { AssetsPage } from './pages/foundation/AssetsPage';
import { MastersPage } from './pages/foundation/MastersPage';
import { ObservationsPage } from './pages/foundation/ObservationsPage';
import { CorrectiveActionsPage } from './pages/foundation/CorrectiveActionsPage';
import { DocumentsPage } from './pages/foundation/DocumentsPage';
import { AnalyticsPage } from './pages/foundation/AnalyticsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import {
  hasRole,
  PLATFORM_ADMIN_ROLES,
  CEO_TIER_ROLES,
  HOD_TIER_ROLES,
  WORKFORCE_ADMIN_ROLES,
  WORKFORCE_HR_ROLES,
  HANDOVER_WRITE_ROLES,
  SHIFT_FLOOR_ROLES,
  SUPERVISOR_ROLES,
  WORKER_ROLES,
  CEO_ROLES,
  HR_ROLES,
  HOD_ROLES,
  SUPERVISOR_ONLY_ROLES,
  MAINTENANCE_ROLES,
} from './utils/roles';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin' || user.role === 'admin') return <Navigate to="/admin" replace />;
  if (hasRole(user.role, CEO_ROLES)) return <Navigate to="/executive" replace />;
  if (hasRole(user.role, HR_ROLES)) return <Navigate to="/workforce/dashboard" replace />;
  if (hasRole(user.role, HOD_ROLES)) return <Navigate to="/hod" replace />;
  if (hasRole(user.role, MAINTENANCE_ROLES)) return <Navigate to="/maintenance" replace />;
  if (hasRole(user.role, SUPERVISOR_ONLY_ROLES)) return <Navigate to="/supervisor" replace />;
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

          <Route element={<ProtectedRoute allowedRoles={PLATFORM_ADMIN_ROLES} />}>
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/organisations" element={<AdminOrganisationsPage />} />
            <Route path="admin/departments" element={<AdminDepartmentsPage />} />
            <Route path="admin/sheets" element={<LogSheetPage />} />
            <Route path="admin/activity" element={<AdminActivityPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={CEO_TIER_ROLES} />}>
            <Route path="executive" element={<ExecutiveOverviewPage />} />
            <Route path="executive/employees" element={<EmployeesPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={HOD_TIER_ROLES} />}>
            <Route path="hod" element={<HodDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={SUPERVISOR_ROLES} />}>
            <Route path="supervisor" element={<SupervisorMonitor />} />
          </Route>

          <Route path="messages" element={<MessagesPage />} />

          <Route element={<ProtectedRoute allowedRoles={MAINTENANCE_ROLES} />}>
            <Route path="maintenance" element={<MaintenanceQueuePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={SHIFT_FLOOR_ROLES} />}>
            <Route path="shift" element={<ShiftDashboard />} />
          </Route>

          <Route path="heat/:runId" element={<HeatWorkspace />} />
          <Route path="reports/:runId" element={<RunReportPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="my-runs" element={<MyRunsPage />} />

          <Route element={<ProtectedRoute allowedRoles={[...WORKFORCE_ADMIN_ROLES, ...CEO_ROLES, ...SUPERVISOR_ONLY_ROLES]} />}>
            <Route path="workforce/dashboard" element={<WorkforceDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={WORKFORCE_ADMIN_ROLES} />}>
            <Route path="workforce" element={<Navigate to="/workforce/dashboard" replace />} />
            <Route path="workforce/employees" element={<WorkforceEmployeesPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={WORKFORCE_HR_ROLES} />}>
            <Route path="workforce/shift-assignments" element={<ShiftAssignmentsPage />} />
            <Route path="workforce/contractors" element={<WorkforceContractorsPage />} />
            <Route path="workforce/attendance" element={<AttendanceEntryPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={HANDOVER_WRITE_ROLES} />}>
            <Route path="workforce/handover" element={<ShiftHandoverPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={WORKER_ROLES} />}>
            <Route path="workforce/my-attendance" element={<MyAttendancePage />} />
          </Route>

          <Route path="foundation/documents" element={<DocumentsPage />} />

          <Route element={<ProtectedRoute allowedRoles={[...HOD_TIER_ROLES, ...PLATFORM_ADMIN_ROLES]} />}>
            <Route path="foundation/assets" element={<AssetsPage />} />
            <Route path="foundation/masters" element={<MastersPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES, ...MAINTENANCE_ROLES]} />}>
            <Route path="foundation/observations" element={<ObservationsPage />} />
            <Route path="foundation/corrective-actions" element={<CorrectiveActionsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[...CEO_TIER_ROLES, ...PLATFORM_ADMIN_ROLES]} />}>
            <Route path="foundation/analytics" element={<AnalyticsPage />} />
          </Route>

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
