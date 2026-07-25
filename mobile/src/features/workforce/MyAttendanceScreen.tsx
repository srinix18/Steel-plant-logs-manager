import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchWorkforceMe,
  type AttendanceRecord,
  type ShiftAssignment,
  type WorkforceMeResponse,
} from '@/src/api/workforce';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

function statusTone(status: string): 'success' | 'danger' | 'neutral' | 'brand' {
  if (status === 'present') return 'success';
  if (status === 'absent') return 'danger';
  if (status === 'half_day') return 'brand';
  return 'neutral';
}

/**
 * P4-WF-MY-ATT — worker self attendance (port of MyAttendancePage).
 */
export function MyAttendanceScreen() {
  const [data, setData] = useState<WorkforceMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setData(await fetchWorkforceMe());
    } catch (e) {
      setError(getErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <LoadingView message="Loading your attendance…" />;
  }

  const assignment: ShiftAssignment | null | undefined = data?.shift_assignment;
  const rows: AttendanceRecord[] = data?.recent_attendance ?? [];

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>My Attendance</Text>
      <Text style={styles.sub}>Your shift assignment and attendance history.</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {assignment ? (
        <Card style={styles.card}>
          <Text style={styles.label}>Current shift assignment</Text>
          <Text style={styles.assignment}>
            {assignment.department_code ?? '—'} — Shift {assignment.shift_code ?? '—'}
          </Text>
          <Text style={styles.meta}>Effective from {assignment.effective_date}</Text>
        </Card>
      ) : !error ? (
        <Card style={styles.card}>
          <Text style={styles.label}>Current shift assignment</Text>
          <Text style={styles.meta}>No active shift assignment.</Text>
        </Card>
      ) : null}

      <Text style={styles.section}>Recent attendance</Text>
      {rows.length === 0 && !error ? (
        <EmptyState
          title="No attendance records yet."
          description="When your attendance is marked, it will show here."
        />
      ) : (
        rows.map((r, i) => (
          <Card
            key={r.id ?? `${r.attendance_date}-${r.user_id}-${i}`}
            style={styles.card}
          >
            <View style={styles.rowTop}>
              <Text style={styles.date}>{r.attendance_date}</Text>
              <Badge
                label={r.status.replace(/_/g, ' ')}
                tone={statusTone(r.status)}
              />
            </View>
            <Text style={styles.remarks}>Remarks: {r.remarks ?? '—'}</Text>
          </Card>
        ))
      )}
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
  card: { marginBottom: spacing.sm },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  assignment: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    fontSize: 17,
  },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  date: { ...typography.body, fontWeight: '700', color: colors.text },
  remarks: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
