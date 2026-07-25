import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { MAINTENANCE_MANAGER_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { MaintenanceProgramWizardScreen } from '@/src/features/maintenance/MaintenanceProgramWizardScreen';

/** P3-MAINT-PM-WIZ — Create PM program. */
export default function ProgramWizardNewRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, MAINTENANCE_MANAGER_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <MaintenanceProgramWizardScreen />;
}
