import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { PLATFORM_ADMIN_ROLES, hasRole } from '@/src/auth/roles';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { AdminDepartmentsScreen } from '@/src/features/admin/AdminDepartmentsScreen';
import { DeptBrowserScreen } from '@/src/features/org/DeptBrowserScreen';

/**
 * P5-ADM-DEPT — platform admins get cross-org AdminDepartmentsScreen.
 * HOD / foundation keep P2-DEPT-SHELLS DeptBrowserScreen on the same route.
 */
export default function AdminDepartmentsRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (hasRole(user.role, PLATFORM_ADMIN_ROLES)) {
    return <AdminDepartmentsScreen />;
  }
  return <DeptBrowserScreen />;
}
