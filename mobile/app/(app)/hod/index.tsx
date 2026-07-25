import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { HOD_TIER_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { SupervisorMonitorScreen } from '@/src/features/supervisor/SupervisorMonitorScreen';

/**
 * P3-OPS-HOD — Department Overview (wraps SupervisorMonitor; backend scopes to HoD dept).
 */
export default function HodScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, HOD_TIER_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return (
    <SupervisorMonitorScreen
      title="Department Overview"
      subtitle="All processes and operations activity in your department."
    />
  );
}
