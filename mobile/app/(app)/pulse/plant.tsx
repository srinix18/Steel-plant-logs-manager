import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { CEO_TIER_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { PlantPulseScreen } from '@/src/features/pulse/PlantPulseScreen';

/** P5-PULSE-PLANT — CEO-tier plant pulse. */
export default function PlantPulseRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, CEO_TIER_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <PlantPulseScreen />;
}
