import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_VIEW_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { CostAnalyticsScreen } from '@/src/features/finance/CostAnalyticsScreen';

/** P5-FIN-AN — cost analytics for finance viewers. */
export default function CostAnalyticsRoute() {
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

  return <CostAnalyticsScreen />;
}
