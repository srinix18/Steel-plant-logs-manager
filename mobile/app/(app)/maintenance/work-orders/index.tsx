import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { MAINTENANCE_PM_VIEW_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { WorkOrdersScreen } from '@/src/features/maintenance/WorkOrdersScreen';

/**
 * P3-MAINT-WO-LIST — Work Orders queue.
 * Roles: MAINTENANCE_PM_VIEW_ROLES (same as web / dashboard).
 */
export default function WorkOrdersRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, MAINTENANCE_PM_VIEW_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <WorkOrdersScreen />;
}
