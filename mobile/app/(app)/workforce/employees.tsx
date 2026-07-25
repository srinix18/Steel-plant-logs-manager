import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { WorkforceEmployeesScreen } from '@/src/features/workforce/WorkforceEmployeesScreen';
import { WORKFORCE_ADMIN_ROLES } from '@/src/features/workforce/workforceRoles';

/** P4-WF-EMP — Employees list + create/edit. */
export default function WorkforceEmployeesRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, WORKFORCE_ADMIN_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <WorkforceEmployeesScreen />;
}
