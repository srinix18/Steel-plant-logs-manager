import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { SafetyScanScreen } from '@/src/features/safety/SafetyScanScreen';
import { SAFETY_MODULE_ROLES } from '@/src/features/safety/safetyRoles';

/** P3-SAFE-SCAN — Safety module roles. */
export default function SafetyScanRoute() {
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

  return <SafetyScanScreen />;
}
