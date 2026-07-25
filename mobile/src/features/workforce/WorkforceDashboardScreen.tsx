import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchWorkforceSummary,
  parseAttendanceDateIso,
  toAttendanceDateIso,
  type WorkforceDailySummary,
} from '@/src/api/workforce';
import {
  fetchWorkforceOpsSummary,
  formatCurrency,
  type WorkforceOpsSummary,
} from '@/src/api/workforceOps';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type KpiTone = 'neutral' | 'danger' | 'warn' | 'success' | 'brand';

function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
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
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * P4-WF-DASH — Workforce Dashboard (port of WorkforceDashboardPage).
 */
export function WorkforceDashboardScreen() {
  const [date, setDate] = useState(() => toAttendanceDateIso(new Date()));
  const [summary, setSummary] = useState<WorkforceDailySummary | null>(null);
  const [opsSummary, setOpsSummary] = useState<WorkforceOpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [s, ops] = await Promise.all([
          fetchWorkforceSummary(date),
          fetchWorkforceOpsSummary().catch(() => null),
        ]);
        setSummary(s);
        setOpsSummary(ops);
      } catch (e) {
        setSummary(null);
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !summary) {
    return <LoadingView message="Loading workforce summary…" />;
  }

  const payrollLabel =
    opsSummary?.latest_payroll_month && opsSummary?.latest_payroll_year
      ? `${opsSummary.latest_payroll_month}/${opsSummary.latest_payroll_year}`
      : '—';

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => void load(true)}
    >
      <Text style={styles.title}>Workforce Dashboard</Text>
      <Text style={styles.sub}>Plant-wide attendance visibility and daily summary.</Text>

      <DateTimeField
        label="Attendance date"
        mode="date"
        value={parseAttendanceDateIso(date)}
        onChange={(d) => setDate(toAttendanceDateIso(d))}
      />

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {opsSummary ? (
        <>
          <Text style={styles.section}>Ops</Text>
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Pending leave"
              value={opsSummary.pending_leave_requests}
              tone="warn"
            />
            <KpiCard
              label="Certs expiring soon"
              value={opsSummary.certifications_expiring_soon}
              tone="danger"
            />
            <KpiCard
              label="Latest payroll"
              value={payrollLabel}
              hint={opsSummary.latest_payroll_status ?? 'No runs'}
            />
            <KpiCard
              label="Payroll net (latest)"
              value={
                opsSummary.total_payroll_net != null
                  ? formatCurrency(opsSummary.total_payroll_net)
                  : '—'
              }
              tone="brand"
            />
          </View>
        </>
      ) : null}

      {summary ? (
        <>
          <Text style={styles.section}>Attendance</Text>
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Employees present"
              value={`${summary.employees_present} / ${summary.employees_expected}`}
              hint="Includes half_day at 0.5"
            />
            <KpiCard
              label="Employees absent"
              value={summary.employees_absent}
              tone="danger"
              hint="Expected − present (leave = 0)"
            />
            <KpiCard
              label="Contract workers present"
              value={summary.contract_workers_present}
              hint={
                summary.contract_workers_absent > 0
                  ? `${summary.contract_workers_absent} absent`
                  : undefined
              }
            />
            <KpiCard
              label="Shift notes"
              value={summary.shift_notes_submitted}
              hint={
                summary.pending_shift_notes > 0
                  ? `${summary.pending_shift_notes} pending`
                  : 'submitted'
              }
              tone={summary.pending_shift_notes > 0 ? 'warn' : 'neutral'}
            />
          </View>

          <Card style={styles.noteCard}>
            <Text style={styles.noteTitle}>Status weights (present / absent / leave / half_day)</Text>
            <Text style={styles.noteBody}>
              Daily totals use attendance status weights: present = 1, half_day = 0.5, leave and
              absent = 0. Pending leave requests are shown under Ops.
            </Text>
          </Card>

          {summary.departments_understaffed.length > 0 ? (
            <Card style={styles.understaffed}>
              <Text style={styles.understaffedTitle}>Departments understaffed</Text>
              {summary.departments_understaffed.map((d) => (
                <Text key={d} style={styles.understaffedItem}>
                  • {d}
                </Text>
              ))}
            </Card>
          ) : null}

          <Text style={styles.section}>Departments</Text>
          {summary.departments.length === 0 ? (
            <EmptyState
              title="No departments"
              description="No department attendance rows for this date."
            />
          ) : (
            summary.departments.map((d) => (
              <Card key={d.department_id} style={styles.deptCard}>
                <View style={styles.deptHeader}>
                  <View style={styles.deptTitles}>
                    <Text style={styles.deptName}>{d.department_name}</Text>
                    <Text style={styles.deptCode}>{d.department_code}</Text>
                  </View>
                  {d.understaffed_by > 0 ? (
                    <Badge label={`-${d.understaffed_by}`} tone="danger" />
                  ) : null}
                </View>
                <Text style={styles.deptPresent}>
                  Employees: {d.present} / {d.expected}
                </Text>
                {d.contract_workers_present > 0 || d.contract_workers_absent > 0 ? (
                  <Text style={styles.deptContract}>
                    Contractors: {d.contract_workers_present} present
                    {d.contract_workers_absent > 0
                      ? `, ${d.contract_workers_absent} absent`
                      : ''}
                  </Text>
                ) : null}
              </Card>
            ))
          )}
        </>
      ) : !error ? (
        <EmptyState
          title="No summary"
          description="Workforce summary is empty for this date."
        />
      ) : null}
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
  banner: { marginBottom: spacing.sm, marginTop: spacing.sm },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  kpiValue: { ...typography.title, color: colors.text, marginBottom: 4, fontSize: 20 },
  kpiValueDanger: { color: colors.danger },
  kpiValueWarn: { color: '#B45309' },
  kpiValueSuccess: { color: colors.success },
  kpiValueBrand: { color: colors.brandDark },
  kpiLabel: { ...typography.caption, color: colors.textMuted, lineHeight: 16 },
  kpiHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
  },
  noteCard: { marginBottom: spacing.md, gap: spacing.xs },
  noteTitle: { ...typography.caption, fontWeight: '700', color: colors.text },
  noteBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  understaffed: {
    marginBottom: spacing.md,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    gap: spacing.xs,
  },
  understaffedTitle: { ...typography.caption, fontWeight: '700', color: '#92400E' },
  understaffedItem: { ...typography.caption, color: '#78350F', lineHeight: 18 },
  deptCard: { marginBottom: spacing.sm, gap: spacing.xs },
  deptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  deptTitles: { flex: 1 },
  deptName: { ...typography.body, fontWeight: '700', color: colors.text },
  deptCode: { ...typography.caption, color: colors.textMuted },
  deptPresent: { ...typography.body, fontWeight: '700', color: colors.brandDark, marginTop: 4 },
  deptContract: { ...typography.caption, color: colors.textMuted },
});
