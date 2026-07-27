import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_VIEW_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { CostCalculationsScreen } from '@/src/features/finance/CostCalculationsScreen';

/** P5-FIN-CALC — view roles; write gated inside with FINANCE_MASTERS_WRITE_ROLES. */
export default function CostCalculationsRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, FINANCE_VIEW_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <CostCalculationsScreen />;
}
