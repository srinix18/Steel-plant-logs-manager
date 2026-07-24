import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { RunHostScreen } from '@/src/features/run-host/RunHostScreen';

/**
 * P2-ENGINE-01 — Process run host.
 * Route: /(app)/heat/[runId]
 */
export default function HeatRunRoute() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const navigation = useNavigation();
  const id = Array.isArray(runId) ? runId[0] : runId;

  useEffect(() => {
    navigation.setOptions({
      title: 'Heat run',
      drawerItemStyle: { display: 'none' },
    });
  }, [navigation]);

  if (!id) {
    return null;
  }

  return <RunHostScreen runId={id} />;
}
