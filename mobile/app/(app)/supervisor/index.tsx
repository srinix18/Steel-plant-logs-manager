import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { SUPERVISOR_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { SupervisorMonitorScreen } from '@/src/features/supervisor/SupervisorMonitorScreen';

/** P3-OPS-SUPER — Operations Activity (SUPERVISOR_ROLES). */
export default function SupervisorScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, SUPERVISOR_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <SupervisorMonitorScreen />;
}
