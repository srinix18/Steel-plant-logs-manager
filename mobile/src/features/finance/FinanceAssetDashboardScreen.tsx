import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchAssetCostDetail,
  formatCurrency,
  type AssetCostDetail,
} from '@/src/api/finance';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = { assetId: string };

/**
 * P5-FIN-DASH — asset cost detail.
 */
export function FinanceAssetDashboardScreen({ assetId }: Props) {
  const [detail, setDetail] = useState<AssetCostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (!assetId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setDetail(await fetchAssetCostDetail(assetId));
      } catch (e) {
        setError(getErrorMessage(e));
        setDetail(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [assetId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !refreshing) {
    return <LoadingView message="Loading asset…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Pressable onPress={() => router.push('/(app)/finance/dashboard' as Href)}>
        <Text style={styles.back}>← Plant Summary</Text>
      </Pressable>
      {error ? <ErrorBanner message={error} /> : null}
      {!detail ? (
        <EmptyState title="Asset cost not found" />
      ) : (
        <>
          <Text style={styles.title}>
            {detail.asset_no} — {detail.asset_name}
          </Text>
          <View style={styles.metrics}>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Production</Text>
              <Text style={styles.metricValue}>
                {detail.total_production_kg.toLocaleString()} kg
              </Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Power Cost</Text>
              <Text style={styles.metricValue}>{formatCurrency(detail.power_cost)}</Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Maintenance Cost</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(detail.maintenance_cost)}
              </Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Total Cost</Text>
              <Text style={styles.metricValue}>{formatCurrency(detail.total_cost)}</Text>
            </Card>
            <Card style={styles.metric}>
              <Text style={styles.metricLabel}>Cost Per Ton</Text>
              <Text style={styles.metricValue}>
                {detail.cost_per_ton != null ? formatCurrency(detail.cost_per_ton) : '—'}
              </Text>
            </Card>
          </View>
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
});
