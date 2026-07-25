import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { MAINTENANCE_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { MaintenanceQueueScreen } from '@/src/features/maintenance/MaintenanceQueueScreen';

/**
 * P3-MAINT-QUEUE — Issue Queue.
 * Web: maintenance role only (managers may see nav but get redirected / 403).
 */
export default function MaintenanceQueueRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, MAINTENANCE_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <MaintenanceQueueScreen />;
}
