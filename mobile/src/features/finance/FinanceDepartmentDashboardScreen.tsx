import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import {
  COST_CATEGORY_LABELS,
  fetchDepartmentCostDetail,
  formatCurrency,
  type DepartmentCostDetail,
} from '@/src/api/finance';
import { fetchProcesses } from '@/src/api/lookups';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import type { Process } from '@/src/types/platform';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = { departmentId: string };

/**
 * P5-FIN-DASH — department cost drill.
 */
export function FinanceDepartmentDashboardScreen({ departmentId }: Props) {
  const [detail, setDetail] = useState<DepartmentCostDetail | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (!departmentId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [d, p] = await Promise.all([
          fetchDepartmentCostDetail(departmentId),
          fetchProcesses(departmentId),
        ]);
        setDetail(d);
        setProcesses(p);
      } catch (e) {
        setError(getErrorMessage(e));
        setDetail(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [departmentId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !refreshing) {
    return <LoadingView message="Loading department…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Pressable onPress={() => router.push('/(app)/finance/dashboard' as Href)}>
        <Text style={styles.back}>← Plant Summary</Text>
      </Pressable>
      {error ? <ErrorBanner message={error} /> : null}
      {!detail ? (
        <EmptyState title="Department not found" />
      ) : (
        <>
          <Text style={styles.title}>
            {detail.department_code} — {detail.department_name}
          </Text>
          <View style={styles.metrics}>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Total Cost</Text>
              <Text style={styles.metricValue}>{formatCurrency(detail.total_cost)}</Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Cost Per Run</Text>
              <Text style={styles.metricValue}>{formatCurrency(detail.cost_per_run)}</Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Cost Per Ton</Text>
              <Text style={styles.metricValue}>
                {detail.cost_per_ton != null ? formatCurrency(detail.cost_per_ton) : '—'}
              </Text>
            </Card>
          </View>

          <Text style={styles.section}>Cost Breakdown</Text>
          {detail.breakdown.length === 0 ? (
            <EmptyState title="No breakdown." />
          ) : (
            <View style={styles.list}>
              {detail.breakdown.map((r) => (
                <Card key={r.category} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {COST_CATEGORY_LABELS[r.category] || r.category}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatCurrency(r.amount)} · {r.percentage}%
                  </Text>
                </Card>
              ))}
            </View>
          )}

          <Text style={styles.section}>Processes</Text>
          {processes.length === 0 ? (
            <EmptyState title="No processes." />
          ) : (
            <View style={styles.list}>
              {processes.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    router.push(`/(app)/finance/dashboard/processes/${p.id}` as Href)
                  }
                >
                  <Card style={styles.row}>
                    <Text style={styles.rowTitle}>
                      {p.code} — {p.name}
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    ...typography.caption,
    color: colors.brand,
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  metrics: { gap: spacing.sm, marginBottom: spacing.md },
  metric: { gap: 2 },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  metricValue: { ...typography.title, color: colors.text, fontSize: 22 },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.sm },
  row: { gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textMuted },
});
