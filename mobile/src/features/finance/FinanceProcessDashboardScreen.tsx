import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchProcessCostDetail,
  formatCurrency,
  type ProcessCostDetail,
} from '@/src/api/finance';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = { processId: string };

/**
 * P5-FIN-DASH — process cost drill with links to cost-sheet.
 */
export function FinanceProcessDashboardScreen({ processId }: Props) {
  const [detail, setDetail] = useState<ProcessCostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (!processId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setDetail(await fetchProcessCostDetail(processId));
      } catch (e) {
        setError(getErrorMessage(e));
        setDetail(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [processId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !refreshing) {
    return <LoadingView message="Loading process…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Pressable onPress={() => router.push('/(app)/finance/dashboard' as Href)}>
        <Text style={styles.back}>← Plant Summary</Text>
      </Pressable>
      {error ? <ErrorBanner message={error} /> : null}
      {!detail ? (
        <EmptyState title="Process not found" />
      ) : (
        <>
          <Text style={styles.title}>
            {detail.process_code} — {detail.process_name}
          </Text>
          <View style={styles.metrics}>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Total Cost</Text>
              <Text style={styles.metricValue}>{formatCurrency(detail.total_cost)}</Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Average Cost</Text>
              <Text style={styles.metricValue}>{formatCurrency(detail.average_cost)}</Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Highest Cost Run</Text>
              <Text style={styles.metricValue}>{formatCurrency(detail.highest_cost)}</Text>
              {detail.highest_cost_run_id ? (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/(app)/finance/runs/${detail.highest_cost_run_id}/cost-sheet` as Href
                    )
                  }
                >
                  <Text style={styles.link}>{detail.highest_cost_run_number}</Text>
                </Pressable>
              ) : null}
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Lowest Cost Run</Text>
              <Text style={styles.metricValue}>{formatCurrency(detail.lowest_cost)}</Text>
              {detail.lowest_cost_run_id ? (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/(app)/finance/runs/${detail.lowest_cost_run_id}/cost-sheet` as Href
                    )
                  }
                >
                  <Text style={styles.link}>{detail.lowest_cost_run_number}</Text>
                </Pressable>
              ) : null}
            </Card>
          </View>
          <Text style={styles.hint}>{detail.run_count} runs with cost calculations</Text>
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
  metrics: { gap: spacing.sm },
  metric: { gap: 2 },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  metricValue: { ...typography.title, color: colors.text, fontSize: 22 },
  link: { ...typography.caption, color: colors.brand, marginTop: spacing.xs },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
