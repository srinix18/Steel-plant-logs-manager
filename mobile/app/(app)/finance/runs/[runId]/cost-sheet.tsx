import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { FINANCE_VIEW_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { RunCostSheetScreen } from '@/src/features/finance/RunCostSheetScreen';

/** P5-FIN-SHEET — run cost sheet; compute gated FINANCE_MASTERS_WRITE_ROLES. */
export default function RunCostSheetRoute() {
  const { user, loading } = useAuth();
  const { runId } = useLocalSearchParams<{ runId: string }>();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, FINANCE_VIEW_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }
  if (!runId || Array.isArray(runId)) {
    return <Redirect href="/(app)/finance/dashboard" />;
  }

  return <RunCostSheetScreen runId={runId} />;
}
