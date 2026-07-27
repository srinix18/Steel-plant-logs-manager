import { Redirect } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { FoundationDocumentsScreen } from '@/src/features/foundation/FoundationDocumentsScreen';

/** P5-FND-DOCS — any authenticated user; upload gated in screen (HOD/HR). */
export default function FoundationDocumentsRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }

  return <FoundationDocumentsScreen />;
}
