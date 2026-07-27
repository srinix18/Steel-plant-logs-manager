import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { PLATFORM_ADMIN_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { AdminActivityScreen } from '@/src/features/admin/AdminActivityScreen';

/** P5-ADM-ACT — platform activity feed. */
export default function AdminActivityRoute() {
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

  return <AdminActivityScreen />;
}
