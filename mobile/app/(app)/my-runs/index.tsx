import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchMyRuns } from '@/src/api/processRuns';
import { Badge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { ListRow } from '@/src/components/ui/ListRow';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import type { ProcessRun } from '@/src/types/processRun';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * Thin launcher into P2-ENGINE-01 run host.
 * Full My Runs UX lands in P3-OPS-MYRUNS.
 */
export default function MyRunsScreen() {
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setRuns(await fetchMyRuns());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && runs.length === 0) {
    return <LoadingView message="Loading your runs…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>My Runs</Text>
      <Text style={styles.sub}>Open a run to use the mobile log-sheet host (P2-ENGINE-01).</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Start a heat from Shift Dashboard (P2-ENGINE-04) or open a run id via deep link."
        />
      ) : (
        runs.map((run) => (
          <ListRow
            key={run.id}
            title={run.run_number}
            subtitle={run.current_state.replace(/_/g, ' ')}
            onPress={() => router.push(`/(app)/heat/${run.id}` as Href)}
            right={<Badge label={run.run_type} tone="neutral" />}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  banner: { marginBottom: spacing.sm },
});
