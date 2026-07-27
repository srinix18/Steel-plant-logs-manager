import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import {
  COST_CATEGORY_LABELS,
  fetchPlantCostSummary,
  formatCurrency,
  type PlantCostSummary,
} from '@/src/api/finance';
import { fetchPlants } from '@/src/api/lookups';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </Card>
  );
}

/**
 * P5-FIN-DASH — plant cost summary (port of FinanceDashboardPage).
 */
export function FinancePlantDashboardScreen() {
  const [plantId, setPlantId] = useState('');
  const [summary, setSummary] = useState<PlantCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const pid = plantId || plants[0]?.id || '';
        if (!plantId && pid) setPlantId(pid);
        if (!pid) {
          setSummary(null);
          return;
        }
        setSummary(await fetchPlantCostSummary(pid));
      } catch (e) {
        setError(getErrorMessage(e));
        setSummary(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [plantId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !refreshing) {
    return <LoadingView message="Loading finance…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Finance — Plant Cost Summary</Text>
      <Text style={styles.subtitle}>Operational manufacturing cost visibility</Text>
      {error ? <ErrorBanner message={error} /> : null}

      {!summary ? (
        <EmptyState title="No cost summary" description="No plant or cost data yet." />
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric
              label="Total Cost Today"
              value={formatCurrency(summary.total_cost_today)}
              hint={`${summary.run_count_today} runs`}
            />
            <Metric
              label="Total Cost This Month"
              value={formatCurrency(summary.total_cost_month)}
              hint={`${summary.run_count_month} runs`}
            />
          </View>

          <Text style={styles.section}>Cost By Department</Text>
          {summary.by_department.length === 0 ? (
            <EmptyState title="No department costs yet." />
          ) : (
            <View style={styles.list}>
              {summary.by_department.map((r) => (
                <Pressable
                  key={r.department_id}
                  onPress={() =>
                    router.push(
                      `/(app)/finance/dashboard/departments/${r.department_id}` as Href
                    )
                  }
                >
                  <Card style={styles.row}>
                    <Text style={styles.rowTitle}>
                      {r.department_code} — {r.department_name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {formatCurrency(r.total_cost)} · {r.run_count} runs
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.section}>Cost By Category</Text>
          {summary.by_category.length === 0 ? (
            <EmptyState title="No category breakdown yet." />
          ) : (
            <View style={styles.list}>
              {summary.by_category.map((r) => (
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
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  metrics: { gap: spacing.sm, marginBottom: spacing.md },
  metric: { gap: 2 },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  metricValue: { ...typography.title, color: colors.text, fontSize: 24 },
  metricHint: { ...typography.caption, color: colors.textMuted },
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
