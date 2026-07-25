import { Redirect } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { LeaveRequestsScreen } from '@/src/features/workforce/LeaveRequestsScreen';
import { WORKFORCE_HR_ROLES } from '@/src/features/workforce/workforceRoles';

/** P4-WF-LEAVE — HR leave approvals. */
export default function LeaveRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingView message="Loading…" />;
  if (!user) return <Redirect href="/login" />;
  if (!hasRole(user.role, WORKFORCE_HR_ROLES)) return <Redirect href={getRoleHomeHref(user.role)} />;
  return <LeaveRequestsScreen />;
}
