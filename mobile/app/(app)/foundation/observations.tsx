import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { MAINTENANCE_ROLES, SUPERVISOR_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { FoundationObservationsScreen } from '@/src/features/foundation/FoundationObservationsScreen';

/** P5-FND-OBS — SUPERVISOR_ROLES ∪ MAINTENANCE_ROLES. */
export default function FoundationObservationsRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  const allowed =
    hasRole(user.role, SUPERVISOR_ROLES) || hasRole(user.role, MAINTENANCE_ROLES);
  if (!allowed) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <FoundationObservationsScreen />;
}
