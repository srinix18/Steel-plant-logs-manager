import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments } from '@/src/api/lookups';
import { fetchOee, type OEETrendPoint } from '@/src/api/oee';
import {
  fetchDepartmentPulse,
  formatOeePct,
  pulseStatusTone,
  type DepartmentPulse,
} from '@/src/api/pulse';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
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

function DeptSpecificCards({ pulse }: { pulse: DepartmentPulse }) {
  const code = pulse.department_code.toUpperCase();
  const m = pulse.metrics;

  if (code === 'IAF' || code === 'SMS') {
    return (
      <View style={styles.kpiGrid}>
        <Kpi
          label="Current Heat"
          value={String((m.current_heat as string) ?? pulse.current_run_label ?? '—')}
        />
        <Kpi label="Today's Heats" value={pulse.production?.toFixed(0) ?? '—'} unit="t" />
        <Kpi label="Current Operators" value="—" />
      </View>
    );
  }
  if (code === 'ROLLING') {
    return (
      <View style={styles.kpiGrid}>
        <Kpi
          label="Current Mill"
          value={String((m.current_mill as string) ?? pulse.current_run_label ?? '—')}
        />
        <Kpi label="Current Speed" value="12.5" unit="m/min" />
        <Kpi label="Current Product" value="—" />
      </View>
    );
  }
  if (code === 'WIRE') {
    return (
      <View style={styles.kpiGrid}>
        <Kpi label="Drawing Speed" value="180" unit="m/min" />
        <Kpi label="Current Coil" value={pulse.current_run_label ?? '—'} />
        <Kpi label="Output" value={pulse.production?.toFixed(1) ?? '—'} unit="t" />
      </View>
    );
  }
  return null;
}

/**
 * P5-PULSE-DEPT — department pulse (port of DepartmentPulsePage).
 */
export function DepartmentPulseScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ dept?: string }>();
  const paramDept = typeof params.dept === 'string' ? params.dept : params.dept?.[0];

  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([]);
  const [deptId, setDeptId] = useState('');
  const [pulse, setPulse] = useState<DepartmentPulse | null>(null);
  const [daily, setDaily] = useState<OEETrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments()
      .then((d) => {
        setDepartments(d.map((x) => ({ id: x.id, code: x.code, name: x.name })));
        const initial = paramDept || user?.department_id || d[0]?.id || '';
        setDeptId(initial);
        if (!initial) setLoading(false);
      })
      .catch((e) => {
        setError(getErrorMessage(e));
        setLoading(false);
      });
  }, [paramDept, user?.department_id]);

  const load = useCallback(
    async (soft = false) => {
      if (!deptId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [p, oee] = await Promise.all([
          fetchDepartmentPulse(deptId),
          fetchOee('department', deptId).catch(() => null),
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
    [deptId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(
    () => departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
    [departments]
  );

  const onDeptChange = (id: string | null) => {
    if (!id) return;
    setDeptId(id);
    router.setParams({ dept: id });
  };

  if (loading && !pulse) {
    return <LoadingView message="Loading department pulse…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={styles.title}>Department Pulse</Text>
          <Text style={styles.sub}>{pulse?.department_name ?? 'Operational dashboard'}</Text>
        </View>
        {pulse ? <Badge label={pulse.status} tone={pulseStatusTone(pulse.status)} /> : null}
      </View>

      {departments.length > 1 ? (
        <View style={styles.picker}>
          <SelectSheet
            label="Department"
            options={options}
            value={deptId || null}
            onChange={onDeptChange}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {pulse ? (
        <>
          <DeptSpecificCards pulse={pulse} />

          <View style={styles.kpiGrid}>
            <Kpi label="Production" value={(pulse.production ?? 0).toFixed(1)} unit="t" />
            <Kpi label="OEE" value={formatOeePct(pulse.oee)} />
            <Kpi label="Downtime" value={(pulse.downtime_minutes ?? 0).toFixed(0)} unit="min" />
            <Kpi label="Power" value={(pulse.power_kwh ?? 0).toFixed(0)} unit="kWh" />
            <Kpi label="Open Issues" value={String(pulse.open_issues)} />
            <Kpi label="Maint. Alerts" value={String(pulse.maintenance_alerts)} />
            <Kpi
              label="Health Score"
              value={pulse.health_score != null ? pulse.health_score.toFixed(0) : '—'}
              unit="%"
            />
            <Kpi
              label="Attendance"
              value={pulse.attendance_pct != null ? `${pulse.attendance_pct}%` : '—'}
            />
          </View>

          <Text style={styles.section}>Shift Progress</Text>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.meta}>Target</Text>
              <Text style={styles.val}>{pulse.production_target ?? '—'} t</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.meta}>Actual</Text>
              <Text style={styles.val}>{pulse.actual_production?.toFixed(1) ?? '—'} t</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.meta}>Shift completion</Text>
              <Text style={styles.valBold}>
                {pulse.shift_completion_pct != null
                  ? `${pulse.shift_completion_pct.toFixed(0)}%`
                  : '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.meta}>Department cost today</Text>
              <Text style={styles.val}>
                ₹{(pulse.department_cost ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <ProgressBar progress={(pulse.shift_completion_pct ?? 0) / 100} />
          </Card>

          <Text style={styles.section}>OEE</Text>
          <Card style={styles.card}>
            <OeeBreakdown {...pulse.oee_detail} />
          </Card>

          <Text style={styles.section}>Active Runs</Text>
          <Card style={styles.card}>
            {pulse.active_runs.length === 0 ? (
              <EmptyState title="No active runs." />
            ) : (
              pulse.active_runs.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => router.push(`/(app)/heat/${r.id}` as Href)}
                  style={styles.runRow}
                >
                  <Text style={styles.runLink}>{r.run_number}</Text>
                  <Text style={styles.meta}>{r.state}</Text>
                </Pressable>
              ))
            )}
          </Card>

          <Text style={styles.section}>OEE Trend (7 days)</Text>
          <Card style={styles.card}>
            <OeeTrendBars data={daily} />
          </Card>
        </>
      ) : !error ? (
        <EmptyState title="Select a department." />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  picker: { marginTop: spacing.md },
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
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  meta: { ...typography.caption, color: colors.textMuted },
  val: { ...typography.body, color: colors.text },
  valBold: { ...typography.body, color: colors.text, fontWeight: '700' },
  runRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  runLink: { ...typography.body, color: colors.brandDark, fontWeight: '600' },
});
