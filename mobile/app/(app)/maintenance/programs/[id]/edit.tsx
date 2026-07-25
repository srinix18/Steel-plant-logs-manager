import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { MAINTENANCE_MANAGER_ROLES, hasRole } from '@/src/auth/roles';
import { getRoleHomeHref } from '@/src/auth/roleHome';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { MaintenanceProgramWizardScreen } from '@/src/features/maintenance/MaintenanceProgramWizardScreen';

/** P3-MAINT-PM-WIZ — Edit PM program. */
export default function ProgramWizardEditRoute() {
  const { user, loading } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const programId = typeof params.id === 'string' ? params.id : params.id?.[0];

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!hasRole(user.role, MAINTENANCE_MANAGER_ROLES)) {
    return <Redirect href={getRoleHomeHref(user.role)} />;
  }

  return <MaintenanceProgramWizardScreen programId={programId} />;
}
