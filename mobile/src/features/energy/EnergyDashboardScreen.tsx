import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import { fetchEnergyPlant, type EnergyDashboard } from '@/src/api/energy';
import { fetchPlants } from '@/src/api/lookups';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>
        {value}
        {unit ? <Text style={styles.kpiUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

/**
 * P5-ENERGY — plant energy dashboard (port of EnergyDashboardPage).
 */
export function EnergyDashboardScreen() {
  const [plantId, setPlantId] = useState('');
  const [data, setData] = useState<EnergyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlants()
      .then((plants) => {
        if (plants[0]) setPlantId(plants[0].id);
        else {
          setLoading(false);
          setError('No plants available.');
        }
      })
      .catch((e) => {
        setLoading(false);
        setError(getErrorMessage(e));
      });
  }, []);

  const load = useCallback(
    async (soft = false) => {
      if (!plantId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await fetchEnergyPlant(plantId));
      } catch (e) {
        setError(getErrorMessage(e));
        setData(null);
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

  const topAssets = useMemo(
    () => [...(data?.assets ?? [])].sort((a, b) => b.kwh - a.kwh).slice(0, 8),
    [data?.assets]
  );

  const maxDeptKwh = useMemo(() => {
    const vals = (data?.departments ?? []).map((d) => d.kwh);
    return vals.length ? Math.max(...vals, 1) : 1;
  }, [data?.departments]);

  if (loading && !data) {
    return <LoadingView message="Loading energy…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Energy</Text>
      <Text style={styles.sub}>Plant, department, and asset consumption</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {data ? (
        <>
          <View style={styles.kpiGrid}>
            <Kpi label="Today" value={data.today_kwh.toFixed(0)} unit="kWh" />
            <Kpi label="This Week" value={data.week_kwh.toFixed(0)} unit="kWh" />
            <Kpi label="This Month" value={data.month_kwh.toFixed(0)} unit="kWh" />
            <Kpi
              label="Today's Cost"
              value={`₹${data.today_cost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            />
            <Kpi
              label="Peak Load"
              value={data.peak_load_kw != null ? data.peak_load_kw.toFixed(0) : '—'}
              unit="kW"
            />
            <Kpi
              label="Avg Load"
              value={data.avg_load_kw != null ? data.avg_load_kw.toFixed(0) : '—'}
              unit="kW"
            />
          </View>

          <Text style={styles.section}>Energy by Department</Text>
          <Card style={styles.card}>
            {(data.departments ?? []).length === 0 ? (
              <EmptyState title="No department energy data." />
            ) : (
              data.departments.map((d) => (
                <View key={d.department_id} style={styles.barRow}>
                  <Text style={styles.barCode}>{d.code}</Text>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.min(100, (d.kwh / maxDeptKwh) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barVal}>{d.kwh.toFixed(0)}</Text>
                </View>
              ))
            )}
          </Card>

          <Text style={styles.section}>Top Asset Consumers</Text>
          <Card style={styles.card}>
            {topAssets.length === 0 ? (
              <EmptyState title="No asset energy data." />
            ) : (
              topAssets.map((a) => (
                <Pressable
                  key={a.asset_id}
                  onPress={() =>
                    router.push(`/(app)/assets/${a.asset_id}/workspace` as Href)
                  }
                  style={({ pressed }) => [styles.assetRow, pressed && styles.pressed]}
                >
                  <Text style={styles.assetLink}>{a.name}</Text>
                  <Text style={styles.meta}>{a.kwh.toFixed(0)} kWh</Text>
                </Pressable>
              ))
            )}
          </Card>

          <Text style={styles.section}>Consumption History</Text>
          <Card style={styles.card}>
            {(data.history ?? []).length === 0 ? (
              <EmptyState title="No consumption history yet." />
            ) : (
              data.history.map((h, i) => (
                <View key={`${h.reading_at}-${i}`} style={styles.histRow}>
                  <View style={styles.grow}>
                    <Text style={styles.histWhen}>
                      {new Date(h.reading_at).toLocaleString()}
                    </Text>
                    {h.cost != null ? (
                      <Text style={styles.meta}>
                        ₹{h.cost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.histKwh}>{h.kwh.toFixed(0)} kWh</Text>
                </View>
              ))
            )}
          </Card>

          <View style={styles.footer}>
            <Button
              title="Plant Pulse"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/(app)/pulse/plant')}
            />
          </View>
        </>
      ) : !error ? (
        <EmptyState title="No energy data." description="Pull to refresh after plant resolves." />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  banner: { marginTop: spacing.md },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  kpi: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  kpiValue: { ...typography.section, color: colors.text },
  kpiUnit: { ...typography.caption, color: colors.textMuted, fontWeight: '400' },
  kpiLabel: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barCode: { ...typography.caption, color: colors.text, fontWeight: '700', width: 56 },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radius.button,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.button,
    backgroundColor: colors.success,
  },
  barVal: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    width: 48,
    textAlign: 'right',
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  pressed: { opacity: 0.75 },
  assetLink: { ...typography.body, color: colors.brandDark, fontWeight: '600', flex: 1 },
  meta: { ...typography.caption, color: colors.textMuted },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  grow: { flex: 1, minWidth: 0 },
  histWhen: { ...typography.body, color: colors.text },
  histKwh: { ...typography.body, color: colors.text, fontWeight: '600' },
  footer: { marginTop: spacing.lg, marginBottom: spacing.md },
});
