import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchMyRuns } from '@/src/api/processRuns';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { VirtualList } from '@/src/components/ui/VirtualList';
import {
  formatMyRunStartedAt,
  isMyRunEditable,
} from '@/src/features/my-runs/editableStates';
import type { ProcessRun } from '@/src/types/processRun';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P3-OPS-MYRUNS — My Runs (port of web MyRunsPage).
 * FlatList virtualization (P6-PERF — IAF / heats spot-check).
 */
export function MyRunsScreen() {
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
    <VirtualList
      data={runs}
      keyExtractor={(run) => run.id}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      header={
        <>
          <Text style={styles.title}>My Runs</Text>
          <Text style={styles.sub}>
            Heats and logs you started. Edit continues the log sheet; Report opens the read-only
            view.
          </Text>
          {error ? (
            <View style={styles.banner}>
              <ErrorBanner message={error} />
            </View>
          ) : null}
        </>
      }
      empty={
        !error ? (
          <EmptyState
            title="No runs yet"
            description="You have not started any runs yet. Use Shift Dashboard to start a heat or daily register."
            actionLabel="Open Shift Dashboard"
            onAction={() => router.push('/(app)/shift' as Href)}
          />
        ) : null
      }
      renderItem={({ item: run }) => {
        const canEdit = isMyRunEditable(run.current_state);
        return (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.textCol}>
                <Text style={styles.runNo}>{run.run_number}</Text>
                <Text style={styles.meta}>
                  {run.run_type} · Started {formatMyRunStartedAt(run)}
                </Text>
              </View>
              <Badge
                label={run.current_state.replace(/_/g, ' ')}
                tone={canEdit ? 'brand' : 'neutral'}
              />
            </View>
            <View style={styles.actions}>
              {canEdit ? (
                <Button
                  title="Edit"
                  variant="secondary"
                  size="lg"
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(app)/heat/${run.id}` as Href)}
                />
              ) : null}
              <Button
                title="Report"
                size="lg"
                style={styles.actionBtn}
                onPress={() => router.push(`/(app)/reports/${run.id}` as Href)}
              />
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  banner: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  textCol: { flex: 1, minWidth: 0 },
  runNo: { ...typography.section, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1 },
});
