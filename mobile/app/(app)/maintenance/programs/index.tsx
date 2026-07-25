import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { MAINTENANCE_MANAGER_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { MaintenanceProgramsScreen } from '@/src/features/maintenance/MaintenanceProgramsScreen';

/**
 * P3-MAINT-PM-LIST — PM Programs.
 * Roles: MAINTENANCE_MANAGER_ROLES (match web).
 */
export default function MaintenanceProgramsRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, MAINTENANCE_MANAGER_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <MaintenanceProgramsScreen />;
}
