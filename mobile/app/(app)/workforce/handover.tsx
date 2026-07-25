import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { HANDOVER_WRITE_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { ShiftHandoverScreen } from '@/src/features/workforce/ShiftHandoverScreen';

/** P4-WF-HAND — Shift handover notes. */
export default function HandoverRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingView message="Loading…" />;
  if (!user) return <Redirect href="/login" />;
  if (!hasRole(user.role, HANDOVER_WRITE_ROLES)) return <Redirect href={getRoleHomeHref(user.role)} />;
  return <ShiftHandoverScreen />;
}
