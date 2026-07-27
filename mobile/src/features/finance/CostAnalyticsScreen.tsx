import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  COST_CATEGORY_LABELS,
  fetchCostTrends,
  fetchTopCostDrivers,
  formatCurrency,
  type CostTrendGroupBy,
  type CostTrendPoint,
  type TopCostDriver,
} from '@/src/api/finance';
import { fetchPlants } from '@/src/api/lookups';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { Screen } from '@/src/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const GROUP_OPTIONS: { id: CostTrendGroupBy; label: string }[] = [
  { id: 'day', label: 'By Day' },
  { id: 'department', label: 'By Department' },
  { id: 'process', label: 'By Process' },
  { id: 'asset', label: 'By Asset' },
];

/**
 * P5-FIN-AN — cost analytics (port of CostAnalyticsPage; list/bars instead of recharts).
 */
export function CostAnalyticsScreen() {
  const [plantId, setPlantId] = useState('');
  const [groupBy, setGroupBy] = useState<CostTrendGroupBy>('day');
  const [drivers, setDrivers] = useState<TopCostDriver[]>([]);
  const [trends, setTrends] = useState<CostTrendPoint[]>([]);
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
          setDrivers([]);
          setTrends([]);
          return;
        }
        const [d, t] = await Promise.all([
          fetchTopCostDrivers(pid),
          fetchCostTrends(pid, groupBy),
        ]);
        setDrivers(d);
        setTrends(t);
      } catch (e) {
        setError(getErrorMessage(e));
        setDrivers([]);
        setTrends([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [groupBy, plantId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const maxTrendCost = useMemo(
    () => Math.max(0, ...trends.map((t) => t.total_cost)),
    [trends]
  );

  if (loading && !refreshing) {
    return <LoadingView message="Loading analytics…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Cost Analytics</Text>
      <Text style={styles.subtitle}>Top drivers and cost trends</Text>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.groupRow}>
        {GROUP_OPTIONS.map((g) => {
          const active = groupBy === g.id;
          return (
            <Pressable
              key={g.id}
              onPress={() => setGroupBy(g.id)}
              style={[styles.groupChip, active && styles.groupChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Top Cost Drivers</Text>
      {drivers.length === 0 ? (
        <EmptyState title="No cost data." />
      ) : (
        <View style={styles.list}>
          {drivers.map((d) => (
            <Card key={d.category} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>
                  {COST_CATEGORY_LABELS[d.category] || d.category}
                </Text>
                <Text style={styles.rowPct}>{d.percentage}%</Text>
              </View>
              <Text style={styles.rowMeta}>{formatCurrency(d.amount)}</Text>
              <ProgressBar progress={(d.percentage || 0) / 100} />
            </Card>
          ))}
        </View>
      )}

      <Text style={styles.section}>Cost Trends</Text>
      {trends.length === 0 ? (
        <EmptyState title="No trend data." description="Try another group-by or compute costs first." />
      ) : (
        <View style={styles.list}>
          {trends.map((t, idx) => (
            <Card key={`${t.label}-${idx}`} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {t.label}
                </Text>
                <Text style={styles.rowMeta}>{t.run_count} runs</Text>
              </View>
              <Text style={styles.rowAmount}>{formatCurrency(t.total_cost)}</Text>
              <ProgressBar
                progress={maxTrendCost > 0 ? t.total_cost / maxTrendCost : 0}
              />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  groupChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  groupChipActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  groupChipText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  groupChipTextActive: { color: colors.brand },
  section: { ...typography.section, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  row: { gap: spacing.xs },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
  rowPct: { ...typography.caption, color: colors.brand, fontWeight: '700' },
  rowMeta: { ...typography.caption, color: colors.textMuted },
  rowAmount: { ...typography.body, color: colors.text, fontWeight: '600' },
});
