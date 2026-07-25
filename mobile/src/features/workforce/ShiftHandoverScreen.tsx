import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments, fetchPlants } from '@/src/api/lookups';
import {
  createHandoverNote,
  fetchHandoverNotes,
  fetchWorkforceShifts,
  parseAttendanceDateIso,
  toAttendanceDateIso,
  type ShiftHandoverNote,
  type WorkforceShift,
} from '@/src/api/workforce';
import { useAuth } from '@/src/auth/AuthContext';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import type { Department } from '@/src/types/platform';
import { colors, spacing, typography } from '@/src/theme/tokens';

/** P4-WF-HAND — Shift-to-shift handover notes. */
export function ShiftHandoverScreen() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => toAttendanceDateIso(new Date()));
  const [departmentId, setDepartmentId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<WorkforceShift[]>([]);
  const [notes, setNotes] = useState<ShiftHandoverNote[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const loadNotes = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    setError(null);
    try {
      setNotes(await fetchHandoverNotes({
        note_date: date,
        department_id: departmentId || undefined,
        shift_id: shiftId || undefined,
      }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [date, departmentId, shiftId]);

  useEffect(() => {
    const boot = async () => {
      try {
        const [depts, plants] = await Promise.all([fetchDepartments(), fetchPlants()]);
        setDepartments(depts);
        setDepartmentId(user?.department_id ?? depts[0]?.id ?? '');
        const list = plants[0] ? await fetchWorkforceShifts(plants[0].id) : await fetchWorkforceShifts();
        setShifts(list);
        setShiftId(list[0]?.id ?? '');
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [user?.department_id]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const submit = async () => {
    if (!departmentId || !shiftId || !note.trim()) {
      setError('Date, department, shift, and a handover note are required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      await createHandoverNote({ note_date: date, department_id: departmentId, shift_id: shiftId, note: note.trim() });
      setNote('');
      setSaved('Handover note submitted.');
      await loadNotes(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const deptOptions = useMemo(() => departments.map((d) => ({ value: d.id, label: d.name })), [departments]);
  const shiftOptions = useMemo(() => shifts.map((s) => ({ value: s.id, label: `Shift ${s.code}` })), [shifts]);
  if (loading) return <LoadingView message="Loading handover notes…" />;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void loadNotes(true)}>
      <Text style={styles.title}>Shift Handover Notes</Text>
      <Text style={styles.sub}>Record equipment status, pending jobs, and safety items for the next crew.</Text>
      {error ? <View style={styles.banner}><ErrorBanner message={error} /></View> : null}
      {saved ? <Text style={styles.saved}>{saved}</Text> : null}
      <Card style={styles.card}>
        <DateTimeField label="Date" mode="date" value={parseAttendanceDateIso(date)} onChange={(d) => setDate(toAttendanceDateIso(d))} />
        <SelectSheet label="Department" options={deptOptions} value={departmentId || null} onChange={setDepartmentId} />
        <SelectSheet label="Shift" options={shiftOptions} value={shiftId || null} onChange={setShiftId} placeholder="Select shift" />
        <TextField label="Handover note" value={note} onChangeText={setNote} multiline placeholder="Equipment status, pending jobs, safety items…" />
        <Button title={saving ? 'Submitting…' : 'Submit note'} fullWidth disabled={saving} onPress={() => void submit()} />
      </Card>
      <Text style={styles.section}>Filtered history</Text>
      {notes.length === 0 ? <EmptyState title="No handover notes" description="No handover notes match these filters." /> : notes.map((item) => (
        <Card key={item.id} style={styles.card}>
          <Text style={styles.when}>{item.note_date} · Shift {item.shift_code ?? '—'}</Text>
          <Text style={styles.meta}>{item.department_code ?? 'Department'} · {item.author_name ?? 'Unknown author'}</Text>
          <Text style={styles.note}>{item.note}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  banner: { marginBottom: spacing.sm },
  saved: { ...typography.caption, color: colors.success, marginBottom: spacing.sm, fontWeight: '600' },
  section: { ...typography.section, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  when: { ...typography.body, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  note: { ...typography.body, color: colors.text, marginTop: spacing.sm, lineHeight: 21 },
});
