import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_VIEW_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { FinancePlantDashboardScreen } from '@/src/features/finance/FinancePlantDashboardScreen';

/** P5-FIN-DASH — plant cost summary. */
export default function FinanceDashboardRoute() {
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

  return <FinancePlantDashboardScreen />;
}
