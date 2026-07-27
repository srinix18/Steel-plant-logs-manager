import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { CEO_TIER_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { ExecutiveOverviewScreen } from '@/src/features/executive/ExecutiveOverviewScreen';

/** P5-EXE-HOME — CEO-tier organisation overview. */
export default function ExecutiveHomeRoute() {
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

  return <ExecutiveOverviewScreen />;
}
