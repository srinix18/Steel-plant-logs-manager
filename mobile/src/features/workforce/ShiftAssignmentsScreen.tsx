import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments, fetchPlants } from '@/src/api/lookups';
import {
  createShiftAssignment,
  fetchShiftAssignments,
  fetchWorkforceEmployees,
  fetchWorkforceShifts,
  parseAttendanceDateIso,
  toAttendanceDateIso,
  type ShiftAssignment,
  type WorkforceShift,
} from '@/src/api/workforce';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import type { Department } from '@/src/types/platform';
import type { User } from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P4-WF-ASSIGN — Shift assignments (port of ShiftAssignmentsPage).
 */
export function ShiftAssignmentsScreen() {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<WorkforceShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: '',
    department_id: '',
    shift_id: '',
    effective_date: toAttendanceDateIso(new Date()),
  });

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [a, e, d, plants] = await Promise.all([
        fetchShiftAssignments(),
        fetchWorkforceEmployees(),
        fetchDepartments(),
        fetchPlants(),
      ]);
      setAssignments(a);
      setEmployees(e);
      setDepartments(d);
      const plantId = plants[0]?.id;
      setShifts(plantId ? await fetchWorkforceShifts(plantId) : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empOptions = useMemo(
    () =>
      employees.map((emp) => ({
        value: emp.id,
        label: `${emp.full_name} (${emp.employee_uid ?? emp.email})`,
      })),
    [employees]
  );
  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  );
  const shiftOptions = useMemo(
    () => shifts.map((s) => ({ value: s.id, label: `Shift ${s.code} — ${s.name}` })),
    [shifts]
  );

  const openAdd = () => {
    setForm({
      user_id: employees[0]?.id ?? '',
      department_id: departments[0]?.id ?? '',
      shift_id: shifts[0]?.id ?? '',
      effective_date: toAttendanceDateIso(new Date()),
    });
    setShowForm(true);
  };

  const save = async () => {
    setError(null);
    if (!form.user_id || !form.department_id || !form.shift_id || !form.effective_date) {
      setError('Employee, department, shift, and effective date are required.');
      return;
    }
    setSaving(true);
    try {
      await createShiftAssignment(form);
      setShowForm(false);
      await load(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (showForm) {
    return (
      <Screen scroll>
        <Text style={styles.title}>New shift assignment</Text>
        {error ? (
          <View style={styles.banner}>
            <ErrorBanner message={error} />
          </View>
        ) : null}
        <SelectSheet
          label="Employee"
          options={empOptions}
          value={form.user_id || null}
          onChange={(user_id) => setForm((f) => ({ ...f, user_id }))}
          placeholder="Select employee"
        />
        <SelectSheet
          label="Department"
          options={deptOptions}
          value={form.department_id || null}
          onChange={(department_id) => setForm((f) => ({ ...f, department_id }))}
          placeholder="Select department"
        />
        <SelectSheet
          label="Shift"
          options={shiftOptions}
          value={form.shift_id || null}
          onChange={(shift_id) => setForm((f) => ({ ...f, shift_id }))}
          placeholder="Select shift"
        />
        <DateTimeField
          label="Effective date"
          mode="date"
          value={parseAttendanceDateIso(form.effective_date)}
          onChange={(d) =>
            setForm((f) => ({ ...f, effective_date: toAttendanceDateIso(d) }))
          }
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
            title={saving ? 'Saving…' : 'Save'}
            size="lg"
            style={styles.actionBtn}
            disabled={saving}
            onPress={() => void save()}
          />
        </View>
      </Screen>
    );
  }

  if (loading && assignments.length === 0) {
    return <LoadingView message="Loading assignments…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Shift Assignments</Text>
      <Text style={styles.sub}>Assign employees to department shifts.</Text>
      <Button title="Add assignment" size="lg" style={styles.addBtn} onPress={openAdd} />
      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {assignments.length === 0 ? (
        <EmptyState title="No shift assignments yet." description="Add an assignment to begin." />
      ) : (
        assignments.map((a) => (
          <Card key={a.id} style={styles.card}>
            <Text style={styles.name}>{a.user_name ?? '—'}</Text>
            <Text style={styles.meta}>{a.employee_uid ?? '—'}</Text>
            <Text style={styles.line}>
              {a.department_code ?? '—'} · Shift {a.shift_code ?? '—'}
            </Text>
            <Text style={styles.line}>Effective: {a.effective_date}</Text>
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
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  line: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionBtn: { flexGrow: 1, flexBasis: '40%' },
});
