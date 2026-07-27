import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_MAPPING_WRITE_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { CostMappingBuilderScreen } from '@/src/features/finance/CostMappingBuilderScreen';

/** P5-FIN-MAP — write roles match drawer visibility. */
export default function CostMappingsRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, FINANCE_MAPPING_WRITE_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <CostMappingBuilderScreen />;
}
