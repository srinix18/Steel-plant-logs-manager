import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  createLeaveRequest,
  fetchLeaveTypes,
  fetchMyLeaveRequests,
  type LeaveRequest,
  type LeaveType,
} from '@/src/api/workforceOps';
import {
  parseAttendanceDateIso,
  toAttendanceDateIso,
} from '@/src/api/workforce';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { colors, spacing, typography } from '@/src/theme/tokens';

function statusTone(status: string): 'success' | 'danger' | 'neutral' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'neutral';
}

/**
 * P4-WF-MY-LEAVE — worker apply + track leave (port of MyLeavePage).
 */
export function MyLeaveScreen() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    leave_type_id: '',
    from_date: '',
    to_date: '',
    remarks: '',
  });

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [reqs, t] = await Promise.all([fetchMyLeaveRequests(), fetchLeaveTypes()]);
      setRequests(reqs);
      setTypes(t);
      setForm((f) => ({
        ...f,
        leave_type_id: f.leave_type_id || t[0]?.id || '',
      }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const typeOptions = useMemo(
    () => types.map((t) => ({ value: t.id, label: t.name })),
    [types]
  );

  const openForm = () => {
    setForm({
      leave_type_id: types[0]?.id ?? '',
      from_date: toAttendanceDateIso(new Date()),
      to_date: toAttendanceDateIso(new Date()),
      remarks: '',
    });
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.leave_type_id || !form.from_date || !form.to_date) {
      setError('Leave type, from date, and to date are required.');
      return;
    }
    if (form.to_date < form.from_date) {
      setError('To date must be on or after from date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createLeaveRequest({
        leave_type_id: form.leave_type_id,
        from_date: form.from_date,
        to_date: form.to_date,
        remarks: form.remarks.trim() || undefined,
      });
      setShowForm(false);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && requests.length === 0) {
    return <LoadingView message="Loading leave…" />;
  }

  if (showForm) {
    return (
      <Screen scroll>
        <Text style={styles.title}>Apply for leave</Text>
        {error ? (
          <View style={styles.banner}>
            <ErrorBanner message={error} />
          </View>
        ) : null}
        <SelectSheet
          label="Leave type"
          options={typeOptions}
          value={form.leave_type_id || null}
          onChange={(leave_type_id) => setForm((f) => ({ ...f, leave_type_id }))}
          placeholder="Select leave type"
        />
        <DateTimeField
          label="From date"
          mode="date"
          value={form.from_date ? parseAttendanceDateIso(form.from_date) : null}
          onChange={(d) => setForm((f) => ({ ...f, from_date: toAttendanceDateIso(d) }))}
        />
        <DateTimeField
          label="To date"
          mode="date"
          value={form.to_date ? parseAttendanceDateIso(form.to_date) : null}
          onChange={(d) => setForm((f) => ({ ...f, to_date: toAttendanceDateIso(d) }))}
        />
        <TextField
          label="Remarks"
          value={form.remarks}
          onChangeText={(remarks) => setForm((f) => ({ ...f, remarks }))}
          multiline
          numberOfLines={3}
        />
        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="secondary"
            size="lg"
            style={styles.actionBtn}
            onPress={() => setShowForm(false)}
          />
          <Button
            title={saving ? 'Submitting…' : 'Submit'}
            size="lg"
            style={styles.actionBtn}
            disabled={saving}
            onPress={() => void handleSubmit()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>My Leave</Text>
      <Text style={styles.sub}>Apply for leave and track request status.</Text>
      <Button title="Apply for leave" size="lg" style={styles.addBtn} onPress={openForm} />
      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {requests.length === 0 ? (
        <EmptyState title="No leave requests yet." description="Tap Apply for leave to submit one." />
      ) : (
        requests.map((r) => (
          <Card key={r.id} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.titles}>
                <Text style={styles.name}>{r.leave_type_name ?? 'Leave'}</Text>
                <Text style={styles.meta}>
                  {r.from_date} — {r.to_date}
                </Text>
              </View>
              <Badge label={r.status} tone={statusTone(r.status)} />
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
  addBtn: { marginBottom: spacing.md },
  banner: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titles: { flex: 1 },
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  remarks: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionBtn: { flexGrow: 1, flexBasis: '40%' },
});
