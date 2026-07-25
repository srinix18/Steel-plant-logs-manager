import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { RunReportScreen } from '@/src/features/reports/RunReportScreen';

/** P2-REPORTS — `/(app)/reports/[runId]` */
export default function ReportRoute() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const navigation = useNavigation();
  const id = Array.isArray(runId) ? runId[0] : runId;

  useEffect(() => {
    navigation.setOptions({
      title: 'Report',
      drawerItemStyle: { display: 'none' },
    });
  }, [navigation]);

  if (!id) return null;
  return <RunReportScreen runId={id} />;
}
