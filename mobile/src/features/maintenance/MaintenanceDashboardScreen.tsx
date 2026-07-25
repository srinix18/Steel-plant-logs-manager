import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchPlants } from '@/src/api/lookups';
import {
  evaluatePmTriggers,
  fetchMaintenanceAnalytics,
  fetchMaintenanceIntelligence,
  type MaintenanceAnalytics,
  type MaintenanceIntelligence,
} from '@/src/api/maintenancePm';
import { useAuth } from '@/src/auth/AuthContext';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type KpiTone = 'neutral' | 'danger' | 'warn' | 'success' | 'brand';

function KpiCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: KpiTone;
}) {
  return (
    <View
      style={[
        styles.kpi,
        tone === 'danger' && styles.kpiDanger,
        tone === 'warn' && styles.kpiWarn,
        tone === 'success' && styles.kpiSuccess,
        tone === 'brand' && styles.kpiBrand,
      ]}
    >
      <Text
        style={[
          styles.kpiValue,
          tone === 'danger' && styles.kpiValueDanger,
          tone === 'warn' && styles.kpiValueWarn,
          tone === 'success' && styles.kpiValueSuccess,
          tone === 'brand' && styles.kpiValueBrand,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function WoBarChart({ analytics }: { analytics: MaintenanceAnalytics }) {
  const rows = [
    { name: 'Open', count: analytics.open_work_orders, color: colors.brand },
    { name: 'Overdue', count: analytics.overdue_work_orders, color: colors.danger },
    { name: 'Completed', count: analytics.completed_work_orders, color: colors.success },
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card style={styles.chartCard}>
      <Text style={styles.chartTitle}>Work order status breakdown</Text>
      {rows.map((row) => (
        <View key={row.name} style={styles.barRow}>
          <Text style={styles.barLabel}>{row.name}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${(row.count / max) * 100}%`, backgroundColor: row.color },
              ]}
            />
          </View>
          <Text style={styles.barCount}>{row.count}</Text>
        </View>
      ))}
    </Card>
  );
}

function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

function fmtNum(n: number | null | undefined, digits = 0, suffix = ''): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}${suffix}`;
}

/**
 * P3-MAINT-DASH — PM Analytics (port of web MaintenanceDashboardPage).
 */
export function MaintenanceDashboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [intel, setIntel] = useState<MaintenanceIntelligence | null>(null);
  const [analytics, setAnalytics] = useState<MaintenanceAnalytics | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const pid =
          (user?.plant_id && plants.find((p) => p.id === user.plant_id)?.id) || plants[0]?.id || null;
        setPlantId(pid);
        if (!pid) {
          setIntel(null);
          setAnalytics(null);
          setError('No plant available for maintenance dashboard.');
          return;
        }
        const [a, i] = await Promise.all([
          fetchMaintenanceAnalytics({ plant_id: pid }),
          fetchMaintenanceIntelligence(pid),
        ]);
        setAnalytics(a);
        setIntel(i);
      } catch (e) {
        setError(getErrorMessage(e));
        setIntel(null);
        setAnalytics(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.plant_id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const runEvaluate = async (force: boolean) => {
    if (!plantId) return;
    setEvaluating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await evaluatePmTriggers({ plantId, force });
      setMessage(
        `Evaluated ${result.triggers_evaluated} trigger(s) · ${result.work_orders_generated} new work order(s) · ${result.notifications_sent} notification(s)`
      );
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setEvaluating(false);
    }
  };

  if (loading && !intel && !analytics) {
    return <LoadingView message="Loading maintenance dashboard…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Maintenance</Text>
      <Text style={styles.sub}>PM compliance, reliability KPIs, and work order status.</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={evaluating ? 'Running…' : 'Run PM evaluate'}
          size="lg"
          style={styles.actionBtn}
          disabled={evaluating || !plantId}
          onPress={() => void runEvaluate(false)}
        />
        <Button
          title="Force evaluate"
          variant="secondary"
          size="lg"
          style={styles.actionBtn}
          disabled={evaluating || !plantId}
          onPress={() => void runEvaluate(true)}
        />
        <Button
          title="Work orders"
          variant="secondary"
          size="lg"
          style={styles.actionBtn}
          onPress={() => router.push('/(app)/maintenance/work-orders' as Href)}
        />
      </View>

      {intel ? (
        <>
          <Text style={styles.section}>Intelligence</Text>
          <View style={styles.kpiGrid}>
            <KpiCard label="Assets Running" value={intel.assets_running} />
            <KpiCard label="Under PM" value={intel.under_pm} />
            <KpiCard label="Breakdown" value={intel.breakdown} tone="danger" />
            <KpiCard label="Waiting Parts" value={intel.waiting_parts} />
            <KpiCard label="Waiting Shutdown" value={intel.waiting_shutdown} />
            <KpiCard label="Completed Today" value={intel.completed_today} tone="success" />
            <KpiCard label="Upcoming PM" value={intel.upcoming_pm} tone="warn" />
            <KpiCard label="PM Compliance" value={fmtPct(intel.pm_compliance_pct)} tone="brand" />
            <KpiCard label="MTBF (h)" value={fmtNum(intel.mtbf_hours, 0)} />
            <KpiCard label="MTTR (h)" value={fmtNum(intel.mttr_hours, 1)} />
            <KpiCard label="Downtime (h)" value={fmtNum(intel.downtime_hours, 1)} tone="warn" />
          </View>
        </>
      ) : null}

      {analytics ? (
        <>
          <Text style={styles.section}>Analytics</Text>
          <View style={styles.kpiGrid}>
            <KpiCard
              label="PM Compliance"
              value={fmtPct(analytics.pm_compliance_pct, 1)}
              tone="brand"
            />
            <KpiCard label="MTBF (h)" value={fmtNum(analytics.mtbf_hours, 1)} />
            <KpiCard label="MTTR (h)" value={fmtNum(analytics.mttr_hours, 1)} />
            <KpiCard
              label="Downtime (min)"
              value={analytics.total_downtime_min.toLocaleString()}
              tone="warn"
            />
            <KpiCard label="Open WOs" value={analytics.open_work_orders} />
            <KpiCard label="Overdue" value={analytics.overdue_work_orders} tone="danger" />
            <KpiCard
              label="Completed"
              value={analytics.completed_work_orders}
              tone="success"
            />
          </View>
          <WoBarChart analytics={analytics} />
        </>
      ) : null}

      {!intel && !analytics && !error ? (
        <EmptyState title="No data" description="Maintenance dashboard is empty for this plant." />
      ) : null}

      {plantId ? <Text style={styles.plantHint}>Plant scope loaded.</Text> : null}
    </Screen>
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
  messageBox: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: colors.brandSoft,
  },
  messageText: { ...typography.caption, color: colors.brandDark, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionBtn: { flexGrow: 1, minWidth: '45%' },
  section: { ...typography.section, color: colors.text, marginBottom: spacing.sm },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpi: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    minHeight: 88,
    justifyContent: 'center',
  },
  kpiDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  kpiWarn: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  kpiSuccess: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  kpiBrand: { borderColor: '#BFDBFE', backgroundColor: colors.brandSoft },
  kpiValue: { ...typography.title, color: colors.text, marginBottom: 4 },
  kpiValueDanger: { color: colors.danger },
  kpiValueWarn: { color: '#B45309' },
  kpiValueSuccess: { color: colors.success },
  kpiValueBrand: { color: colors.brandDark },
  kpiLabel: { ...typography.caption, color: colors.textMuted, lineHeight: 16 },
  chartCard: { marginBottom: spacing.lg, gap: spacing.md },
  chartTitle: { ...typography.section, color: colors.text, fontSize: 15 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 78, ...typography.caption, color: colors.textMuted },
  barTrack: {
    flex: 1,
    height: 14,
    borderRadius: radius.button,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.button, minWidth: 2 },
  barCount: {
    width: 36,
    textAlign: 'right',
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  plantHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
});
