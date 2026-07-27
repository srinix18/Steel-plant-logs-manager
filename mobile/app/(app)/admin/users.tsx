import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { PLATFORM_ADMIN_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { AdminUsersScreen } from '@/src/features/admin/AdminUsersScreen';

/** P5-ADM-USERS — list-only; create/edit in P5-EXE-EMP. */
export default function AdminUsersRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, PLATFORM_ADMIN_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <AdminUsersScreen />;
}
