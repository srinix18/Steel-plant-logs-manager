import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { SafetyDashboardScreen } from '@/src/features/safety/SafetyDashboardScreen';
import { SAFETY_MODULE_ROLES } from '@/src/features/safety/safetyRoles';

/** P3-SAFE-DASH — Safety Dashboard. */
export default function SafetyDashboardRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, SAFETY_MODULE_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <SafetyDashboardScreen />;
}
