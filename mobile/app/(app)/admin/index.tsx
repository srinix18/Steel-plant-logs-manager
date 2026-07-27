import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { PLATFORM_ADMIN_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { AdminHomeScreen } from '@/src/features/admin/AdminHomeScreen';

/** P5-ADM-HOME — platform admin overview. */
export default function AdminHomeRoute() {
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

  return <AdminHomeScreen />;
}
