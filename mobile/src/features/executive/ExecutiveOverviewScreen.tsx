import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { fetchDashboardMetrics, type DashboardMetrics } from '@/src/api/admin';
import { getErrorMessage } from '@/src/api/client';
import {
  fetchMaintenanceIssues,
  fetchOpenMaintenanceCount,
  type MaintenanceIssue,
} from '@/src/api/maintenance';
import { fetchAllRuns } from '@/src/api/processRuns';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import type { ProcessRun } from '@/src/types/processRun';
import { colors, spacing, typography } from '@/src/theme/tokens';

const METRIC_CARDS: { key: keyof DashboardMetrics; label: string }[] = [
  { key: 'total_plants', label: 'Plants' },
  { key: 'active_runs', label: 'Active Runs' },
  { key: 'open_observations', label: 'Open Observations' },
  { key: 'open_corrective_actions', label: 'Open Actions' },
];

/**
 * P5-EXE-HOME — executive overview (port of ExecutiveOverviewPage).
 */
export function ExecutiveOverviewScreen() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [openMaintCount, setOpenMaintCount] = useState(0);
  const [openMaintIssues, setOpenMaintIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [m, r, maintCount, maintIssues] = await Promise.all([
        fetchDashboardMetrics(),
        fetchAllRuns(),
        fetchOpenMaintenanceCount(),
        fetchMaintenanceIssues({ status: 'open' }),
      ]);
      setMetrics(m);
      setRuns(r.slice(0, 10));
      setOpenMaintCount(maintCount);
      setOpenMaintIssues(maintIssues.slice(0, 8));
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

  if (loading && !refreshing) {
    return <LoadingView message="Loading executive overview…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Executive Overview</Text>
      <Text style={styles.subtitle}>
        Organisation-wide activity for {user?.full_name ?? 'you'}. All departments, processes, and
        live runs.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.metrics}>
        {METRIC_CARDS.map(({ key, label }) => (
          <Card key={key} style={styles.metric}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{metrics ? metrics[key] : '—'}</Text>
          </Card>
        ))}
        <Card style={styles.metric}>
          <Text style={styles.metricLabel}>Open maintenance issues</Text>
          <Text style={[styles.metricValue, styles.maintValue]}>{openMaintCount}</Text>
        </Card>
      </View>

      <Text style={styles.section}>Open maintenance issues</Text>
      {openMaintIssues.length === 0 ? (
        <EmptyState title="No open maintenance issues." />
      ) : (
        <View style={styles.list}>
          {openMaintIssues.map((issue) => (
            <Card key={issue.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{issue.title}</Text>
                <Badge label={issue.status.replace(/_/g, ' ')} tone="brand" />
              </View>
              <Text style={styles.rowMeta}>
                {issue.category} · raised by {issue.raised_by_user?.full_name ?? '—'}
              </Text>
              {issue.run_id ? (
                <Pressable
                  onPress={() => router.push(`/(app)/reports/${issue.run_id}` as Href)}
                  accessibilityRole="link"
                >
                  <Text style={styles.link}>View run</Text>
                </Pressable>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      <Text style={styles.section}>Recent activity</Text>
      {runs.length === 0 ? (
        <EmptyState title="No runs in your organisation yet." />
      ) : (
        <View style={styles.list}>
          {runs.map((run) => (
            <Pressable
              key={run.id}
              onPress={() => router.push(`/(app)/reports/${run.id}` as Href)}
            >
              <Card style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{run.run_number}</Text>
                  <Badge label={run.current_state.replace(/_/g, ' ')} tone="brand" />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  metric: { width: '47%', flexGrow: 1, minWidth: 140 },
  metricLabel: { ...typography.caption, color: colors.textMuted },
  metricValue: { ...typography.title, color: colors.brand, marginTop: spacing.xs },
  maintValue: { color: '#D97706' },
  section: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  row: { gap: spacing.xs },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
  rowMeta: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.caption, color: colors.brand, fontWeight: '600', marginTop: spacing.xs },
});
