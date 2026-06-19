import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { OrganisationManagement } from './pages/admin/OrganisationManagement';
import { DepartmentManagement } from './pages/admin/DepartmentManagement';
import { TemplateManagement } from './pages/admin/TemplateManagement';
import { DepartmentDashboard } from './pages/department/DepartmentDashboard';
import { MemberDashboard } from './pages/member/MemberDashboard';
import { RecordListPage } from './pages/records/RecordListPage';
import { CreateRecordPage } from './pages/records/CreateRecordPage';
import { NotFoundPage } from './pages/NotFoundPage';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'department') return <Navigate to="/department" replace />;
  return <Navigate to="/member" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<RoleRedirect />} />
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/organisations" element={<OrganisationManagement />} />
            <Route path="admin/departments" element={<DepartmentManagement />} />
            <Route path="admin/templates" element={<TemplateManagement />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['department']} />}>
            <Route path="department" element={<DepartmentDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['member']} />}>
            <Route path="member" element={<MemberDashboard />} />
          </Route>
          <Route path="records" element={<RecordListPage />} />
          <Route path="records/new" element={<CreateRecordPage />} />
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
