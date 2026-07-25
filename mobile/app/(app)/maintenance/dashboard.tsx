import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { MAINTENANCE_PM_VIEW_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { MaintenanceDashboardScreen } from '@/src/features/maintenance/MaintenanceDashboardScreen';

/**
 * P3-MAINT-DASH — PM Analytics.
 * Roles: MAINTENANCE_PM_VIEW_ROLES (managers, HOD, maintenance).
 */
export default function MaintenanceDashboardRoute() {
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

  return <MaintenanceDashboardScreen />;
}
