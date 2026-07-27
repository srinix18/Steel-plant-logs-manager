import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_VIEW_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { FinanceAssetDashboardScreen } from '@/src/features/finance/FinanceAssetDashboardScreen';

/** P5-FIN-DASH — asset cost detail. */
export default function FinanceAssetRoute() {
  const { user, loading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, FINANCE_VIEW_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }
  if (!id || Array.isArray(id)) {
    return <Redirect href="/(app)/finance/dashboard" />;
  }

  return <FinanceAssetDashboardScreen assetId={id} />;
}
