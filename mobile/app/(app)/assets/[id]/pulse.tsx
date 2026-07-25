import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/src/auth/AuthContext';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { AssetPulseScreen } from '@/src/features/pulse/AssetPulseScreen';

/** P5-PULSE-ASSET — any authenticated user (matches web). */
export default function AssetPulseRoute() {
  const { user, loading } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (loading) {
    return <LoadingView message="Loading…" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!id) {
    return <Redirect href="/" />;
  }

  return <AssetPulseScreen />;
}
