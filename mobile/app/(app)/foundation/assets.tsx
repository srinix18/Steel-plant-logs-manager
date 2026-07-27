import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { HOD_TIER_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { FoundationAssetsScreen } from '@/src/features/foundation/FoundationAssetsScreen';

/** P5-FND-ASSETS — HOD-tier / platform admin asset registry. */
export default function FoundationAssetsRoute() {
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

  return <FoundationAssetsScreen />;
}
