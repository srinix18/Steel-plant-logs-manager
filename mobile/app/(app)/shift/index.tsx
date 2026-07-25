import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { SHIFT_FLOOR_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { ShiftLauncherScreen } from '@/src/features/shift/ShiftLauncherScreen';

/** P3-OPS-SHIFT — Shift Dashboard (SHIFT_FLOOR_ROLES only). */
export default function ShiftScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, SHIFT_FLOOR_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <ShiftLauncherScreen />;
}
