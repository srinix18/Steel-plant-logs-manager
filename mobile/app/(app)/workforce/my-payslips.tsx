import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { MyPayslipsScreen } from '@/src/features/workforce/MyPayslipsScreen';
import { WORKER_ROLES } from '@/src/features/workforce/workforceRoles';

/** P4-WF-MY-PAY — worker payslip list + HTML view. */
export default function MyPayslipsRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, WORKER_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <MyPayslipsScreen />;
}
