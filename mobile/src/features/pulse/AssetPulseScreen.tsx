import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import { fetchOee, type OEETrendPoint } from '@/src/api/oee';
import {
  fetchAssetPulse,
  formatOeePct,
  pulseStatusTone,
  type AssetPulse,
} from '@/src/api/pulse';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { OeeBreakdown } from '@/src/features/pulse/OeeBreakdown';
import { OeeTrendBars } from '@/src/features/pulse/OeeTrendBars';
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
 * P5-PULSE-ASSET — asset pulse (port of AssetPulsePage).
 */
export function AssetPulseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const assetId = typeof id === 'string' ? id : id?.[0];

  const [pulse, setPulse] = useState<AssetPulse | null>(null);
  const [daily, setDaily] = useState<OEETrendPoint[]>([]);
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
        const [p, oee] = await Promise.all([
          fetchAssetPulse(assetId),
          fetchOee('asset', assetId).catch(() => null),
        ]);
        setPulse(p);
        setDaily(oee?.daily ?? []);
      } catch (e) {
        setError(getErrorMessage(e));
        setPulse(null);
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

  if (!assetId) {
    return (
      <Screen>
        <EmptyState title="Invalid asset." description="Missing asset id in route." />
      </Screen>
    );
  }

  if (loading && !pulse) {
    return <LoadingView message="Loading asset pulse…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={styles.title}>{pulse?.asset_name ?? 'Asset Pulse'}</Text>
          <Text style={styles.sub}>
            {pulse?.asset_no ?? '—'} · {pulse?.department_name ?? '—'}
          </Text>
        </View>
        {pulse ? <Badge label={pulse.status} tone={pulseStatusTone(pulse.status)} /> : null}
      </View>

      <View style={styles.actions}>
        <Button
          title="Open Workspace"
          onPress={() => router.push(`/(app)/assets/${assetId}/workspace` as Href)}
        />
      </View>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {pulse ? (
        <>
          <View style={styles.kpiGrid}>
            <Kpi
              label="Health"
              value={pulse.health_score != null ? pulse.health_score.toFixed(0) : '—'}
              unit="%"
            />
            <Kpi label="OEE" value={formatOeePct(pulse.oee.oee)} />
            <Kpi label="Operator" value={pulse.current_operator ?? '—'} />
            <Kpi label="Current Run" value={pulse.current_run_label ?? '—'} />
          </View>

          <Text style={styles.section}>Live Parameters</Text>
          <Card style={styles.card}>
            {pulse.live_parameters.length === 0 ? (
              <Text style={styles.meta}>No live parameters configured.</Text>
            ) : (
              <View style={styles.paramGrid}>
                {pulse.live_parameters.map((p) => (
                  <View key={p.param_key} style={styles.param}>
                    <Text style={styles.meta}>{p.label ?? p.param_key}</Text>
                    <Text style={styles.paramVal}>
                      {p.value_text ?? p.value ?? '—'}
                      {p.unit && !p.value_text ? (
                        <Text style={styles.meta}> {p.unit}</Text>
                      ) : null}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Text style={styles.section}>OEE</Text>
          <Card style={styles.card}>
            <OeeBreakdown {...pulse.oee} />
            <View style={styles.trend}>
              <OeeTrendBars data={daily} title="Daily trend" />
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  actions: { marginTop: spacing.md },
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
  card: { marginBottom: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted },
  paramGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  param: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: radius.input,
    padding: spacing.md,
  },
  paramVal: { ...typography.section, color: colors.text, marginTop: 4 },
  trend: { marginTop: spacing.md },
});
