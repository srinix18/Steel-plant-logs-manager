import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import { fetchPlants } from '@/src/api/lookups';
import {
  fetchPlantPulse,
  fetchPulseAlerts,
  fetchPulseFeed,
  formatOeePct,
  pulseStatusTone,
  refreshPulse,
  type DepartmentPulseCard,
  type PlantPulse,
  type PulseAlert,
  type PulseEvent,
} from '@/src/api/pulse';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { OeeBreakdown } from '@/src/features/pulse/OeeBreakdown';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const AUTO_MS = 30_000;

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

function DeptCard({ dept }: { dept: DepartmentPulseCard }) {
  return (
    <Pressable
      onPress={() =>
        router.push(`/(app)/pulse/department?dept=${encodeURIComponent(dept.department_id)}`)
      }
      style={({ pressed }) => [styles.deptCard, pressed && styles.deptPressed]}
    >
      <View style={styles.deptTop}>
        <View style={styles.grow}>
          <Text style={styles.deptName}>{dept.department_name}</Text>
          <Text style={styles.meta}>{dept.department_code}</Text>
        </View>
        <Badge label={dept.status} tone={pulseStatusTone(dept.status)} />
      </View>
      <View style={styles.deptGrid}>
        <Text style={styles.meta}>Shift {dept.current_shift_code ?? '—'}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          Run {dept.current_run_label ?? '—'}
        </Text>
        <Text style={styles.meta}>
          Prod {dept.production != null ? `${dept.production.toFixed(1)} t` : '—'}
        </Text>
        <Text style={styles.meta}>OEE {formatOeePct(dept.oee)}</Text>
        <Text style={styles.meta}>
          Power {dept.power_kwh != null ? `${dept.power_kwh.toFixed(0)} kWh` : '—'}
        </Text>
        <Text style={styles.meta}>
          Health {dept.health_score != null ? `${dept.health_score.toFixed(0)}%` : '—'}
        </Text>
      </View>
      {dept.open_issues > 0 || dept.maintenance_alerts > 0 ? (
        <Text style={styles.warn}>
          {dept.open_issues} issue(s) · {dept.maintenance_alerts} maint alert(s)
        </Text>
      ) : null}
    </Pressable>
  );
}

function eventLabel(e: PulseEvent): string {
  const label = e.payload?.label;
  if (typeof label === 'string' && label) return label;
  return e.event_type.replace(/_/g, ' ');
}

/**
 * P5-PULSE-PLANT — plant operational snapshot (port of PlantPulsePage).
 */
export function PlantPulseScreen() {
  const [plantId, setPlantId] = useState('');
  const [pulse, setPulse] = useState<PlantPulse | null>(null);
  const [feed, setFeed] = useState<PulseEvent[]>([]);
  const [alerts, setAlerts] = useState<PulseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postingRefresh, setPostingRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plantIdRef = useRef(plantId);
  plantIdRef.current = plantId;

  const load = useCallback(async (soft = false) => {
    const id = plantIdRef.current;
    if (!id) return;
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [p, f, a] = await Promise.all([
        fetchPlantPulse(id),
        fetchPulseFeed(id),
        fetchPulseAlerts(id),
      ]);
      setPulse(p);
      setFeed(f);
      setAlerts(a);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  useEffect(() => {
    if (!plantId) return;
    void load();
    const t = setInterval(() => {
      void load(true);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [plantId, load]);

  const onRefresh = async () => {
    if (!plantId) return;
    setPostingRefresh(true);
    setError(null);
    try {
      await refreshPulse(plantId);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPostingRefresh(false);
    }
  };

  if (loading && !pulse) {
    return <LoadingView message="Loading plant pulse…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={styles.title}>Plant Pulse</Text>
          <Text style={styles.sub}>
            Real-time operational snapshot — {pulse?.plant_name ?? '…'}
          </Text>
        </View>
        {pulse ? <Badge label={`Plant ${pulse.plant_status}`} tone={pulseStatusTone(pulse.plant_status)} /> : null}
      </View>

      <View style={styles.actions}>
        <Button
          title={postingRefresh ? 'Refreshing…' : 'Refresh'}
          variant="secondary"
          size="sm"
          disabled={postingRefresh || !plantId}
          onPress={() => void onRefresh()}
        />
        <Button
          title="Energy"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/(app)/energy')}
        />
        <Button
          title="Inventory"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/(app)/inventory-pulse')}
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
            <Kpi label="Overall OEE" value={formatOeePct(pulse.overall_oee)} />
            <Kpi
              label="Today's Production"
              value={(pulse.today_production ?? 0).toFixed(1)}
              unit="t"
            />
            <Kpi
              label="Today's Cost"
              value={`₹${(pulse.today_cost ?? 0).toLocaleString('en-IN', {
                maximumFractionDigits: 0,
              })}`}
            />
            <Kpi
              label="Power"
              value={(pulse.power_consumption_kwh ?? 0).toFixed(0)}
              unit="kWh"
            />
            <Kpi label="Downtime" value={(pulse.downtime_minutes ?? 0).toFixed(0)} unit="min" />
            <Kpi label="Active Alerts" value={String(pulse.active_alerts)} />
            <Kpi label="Pending Maint." value={String(pulse.pending_maintenance)} />
            <Kpi label="Current Shift" value={pulse.current_shift_code ?? '—'} />
            <Kpi
              label="Attendance"
              value={
                pulse.attendance_pct != null ? `${pulse.attendance_pct.toFixed(0)}%` : '—'
              }
            />
          </View>

          <Text style={styles.section}>Department Pulse</Text>
          {pulse.departments.length === 0 ? (
            <EmptyState title="No departments in pulse." />
          ) : (
            pulse.departments.map((d) => <DeptCard key={d.department_id} dept={d} />)
          )}

          <Text style={styles.section}>OEE Breakdown</Text>
          <Card style={styles.card}>
            <OeeBreakdown {...pulse.oee} />
          </Card>

          <Text style={styles.section}>Live Production Feed</Text>
          <Card style={styles.card}>
            {feed.length === 0 ? (
              <Text style={styles.meta}>No recent events.</Text>
            ) : (
              feed.map((e) => (
                <View key={e.id} style={styles.feedRow}>
                  <Text
                    style={[
                      styles.sev,
                      e.severity === 'critical' && styles.sevCrit,
                      e.severity === 'warning' && styles.sevWarn,
                    ]}
                  >
                    {e.severity.slice(0, 4).toUpperCase()}
                  </Text>
                  <View style={styles.grow}>
                    <Text style={styles.feedTitle}>{eventLabel(e)}</Text>
                    <Text style={styles.meta}>{new Date(e.occurred_at).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          <Text style={styles.section}>Critical Alerts</Text>
          <Card style={styles.card}>
            {alerts.length === 0 ? (
              <Text style={styles.ok}>No unresolved critical issues.</Text>
            ) : (
              alerts.map((a) => (
                <View key={a.id} style={styles.alertRow}>
                  <Text style={styles.feedTitle}>{a.title}</Text>
                  <Text style={styles.meta}>{a.message}</Text>
                  <Text style={styles.meta}>{new Date(a.occurred_at).toLocaleString()}</Text>
                </View>
              ))
            )}
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
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
  deptCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  deptPressed: { opacity: 0.85 },
  deptTop: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  deptName: { ...typography.body, fontWeight: '700', color: colors.text },
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, width: '48%' },
  warn: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  feedRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  sev: { ...typography.caption, fontWeight: '700', color: colors.textMuted, width: 36 },
  sevCrit: { color: colors.danger },
  sevWarn: { color: colors.brandDark },
  feedTitle: { ...typography.body, color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
  alertRow: { paddingVertical: spacing.sm, gap: 2 },
  ok: { ...typography.body, color: colors.success },
});
