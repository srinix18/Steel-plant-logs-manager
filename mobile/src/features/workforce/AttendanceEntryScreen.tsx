import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments, fetchPlants } from '@/src/api/lookups';
import {
  fetchAttendance,
  fetchContractorAttendance,
  fetchContractors,
  fetchWorkforceShifts,
  parseAttendanceDateIso,
  saveAttendanceBulk,
  saveContractorAttendance,
  toAttendanceDateIso,
  type AttendanceRecord,
  type AttendanceStatus,
  type Contractor,
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
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'leave', 'half_day'];

/**
 * P4-WF-ATT — Attendance entry (port of AttendanceEntryPage).
 */
export function AttendanceEntryScreen() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => toAttendanceDateIso(new Date()));
  const [departmentId, setDepartmentId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<WorkforceShift[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorId, setContractorId] = useState('');
  const [workersPresent, setWorkersPresent] = useState('0');
  const [workersAbsent, setWorkersAbsent] = useState('0');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingEmp, setSavingEmp] = useState(false);
  const [savingCon, setSavingCon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, plants] = await Promise.all([fetchDepartments(), fetchPlants()]);
      setDepartments(depts);
      const defaultDept = user?.department_id ?? depts[0]?.id ?? '';
      setDepartmentId(defaultDept);
      const plantId = plants[0]?.id;
      const shiftList = plantId ? await fetchWorkforceShifts(plantId) : await fetchWorkforceShifts();
      setShifts(shiftList);
      if (shiftList[0]) setShiftId(shiftList[0].id);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user?.department_id]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (!departmentId) {
      setContractors([]);
      setContractorId('');
      return;
    }
    fetchContractors(departmentId)
      .then((c) => {
        setContractors(c);
        setContractorId(c[0]?.id ?? '');
        setWorkersPresent('0');
        setWorkersAbsent('0');
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [departmentId]);

  const loadAttendance = useCallback(
    async (soft = false) => {
      if (!departmentId || !shiftId) return;
      if (soft) setRefreshing(true);
      setError(null);
      try {
        const [recs, rows] = await Promise.all([
          fetchAttendance(date, departmentId, shiftId),
          fetchContractorAttendance(date, departmentId, shiftId).catch(() => []),
        ]);
        setRecords(recs);
        const row = contractorId
          ? rows.find((r) => r.contractor_id === contractorId)
          : rows[0];
        if (row) {
          if (!contractorId) setContractorId(row.contractor_id);
          setWorkersPresent(String(row.workers_present));
          setWorkersAbsent(String(row.workers_absent));
        } else {
          setWorkersPresent('0');
          setWorkersAbsent('0');
        }
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setRefreshing(false);
      }
    },
    [date, departmentId, shiftId, contractorId]
  );

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  );
  const shiftOptions = useMemo(
    () => shifts.map((s) => ({ value: s.id, label: `Shift ${s.code}` })),
    [shifts]
  );
  const contractorOptions = useMemo(
    () => contractors.map((c) => ({ value: c.id, label: c.name })),
    [contractors]
  );

  const setStatus = (userId: string, status: AttendanceStatus) => {
    setRecords((prev) => prev.map((r) => (r.user_id === userId ? { ...r, status } : r)));
  };

  const setRemarks = (userId: string, remarks: string) => {
    setRecords((prev) => prev.map((r) => (r.user_id === userId ? { ...r, remarks } : r)));
  };

  const saveEmployeeAttendance = async () => {
    setSavingEmp(true);
    setError(null);
    setSaved(null);
    try {
      await saveAttendanceBulk({
        attendance_date: date,
        department_id: departmentId,
        shift_id: shiftId,
        entries: records.map((r) => ({
          user_id: r.user_id,
          status: r.status,
          remarks: r.remarks ?? undefined,
        })),
      });
      setSaved('Employee attendance saved.');
      await loadAttendance(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingEmp(false);
    }
  };

  const saveContractor = async () => {
    if (!contractorId) return;
    setSavingCon(true);
    setError(null);
    setSaved(null);
    try {
      await saveContractorAttendance({
        attendance_date: date,
        contractor_id: contractorId,
        department_id: departmentId,
        shift_id: shiftId,
        workers_present: Number(workersPresent) || 0,
        workers_absent: Number(workersAbsent) || 0,
      });
      setSaved('Contractor attendance saved.');
      await loadAttendance(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingCon(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading attendance…" />;
  }

  const dept = departments.find((d) => d.id === departmentId);
  const shift = shifts.find((s) => s.id === shiftId);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void loadAttendance(true)}>
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.sub}>Mark daily employee and contractor attendance.</Text>

      <DateTimeField
        label="Date"
        mode="date"
        value={parseAttendanceDateIso(date)}
        onChange={(d) => setDate(toAttendanceDateIso(d))}
      />
      <SelectSheet
        label="Department"
        options={deptOptions}
        value={departmentId || null}
        onChange={setDepartmentId}
      />
      <SelectSheet
        label="Shift"
        options={shiftOptions}
        value={shiftId || null}
        onChange={setShiftId}
        placeholder="Select shift"
      />

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {saved ? <Text style={styles.saved}>{saved}</Text> : null}

      {departmentId && shiftId ? (
        <>
          <Text style={styles.section}>
            {dept?.name ?? 'Dept'} — Shift {shift?.code ?? '—'}
          </Text>
          {records.length === 0 ? (
            <EmptyState
              title="No employees assigned"
              description="No employees assigned to this shift for the filters above."
            />
          ) : (
            records.map((r) => (
              <Card key={r.user_id} style={styles.card}>
                <Text style={styles.name}>{r.user_name ?? r.user_id}</Text>
                <View style={styles.statusGrid}>
                  {STATUSES.map((s) => {
                    const active = r.status === s;
                    return (
                      <Pressable
                        key={s}
                        style={[styles.statusChip, active && styles.statusChipActive]}
                        onPress={() => setStatus(r.user_id, s)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[styles.statusText, active && styles.statusTextActive]}
                        >
                          {s.replace(/_/g, ' ')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextField
                  label="Remarks"
                  value={r.remarks ?? ''}
                  onChangeText={(t) => setRemarks(r.user_id, t)}
                />
              </Card>
            ))
          )}
          <Button
            title={savingEmp ? 'Saving…' : 'Save employee attendance'}
            size="lg"
            fullWidth
            disabled={savingEmp || records.length === 0}
            onPress={() => void saveEmployeeAttendance()}
            style={styles.saveBtn}
          />

          <Text style={styles.section}>Contractor attendance</Text>
          {contractors.length === 0 ? (
            <EmptyState
              title="No contractors"
              description="No contractors linked to this department. Add contract workers under Contractors."
            />
          ) : (
            <Card style={styles.card}>
              <SelectSheet
                label="Contractor"
                options={contractorOptions}
                value={contractorId || null}
                onChange={setContractorId}
              />
              <TextField
                label="Workers present"
                value={workersPresent}
                onChangeText={setWorkersPresent}
                keyboardType="number-pad"
              />
              <TextField
                label="Workers absent"
                value={workersAbsent}
                onChangeText={setWorkersAbsent}
                keyboardType="number-pad"
              />
              <Button
                title={savingCon ? 'Saving…' : 'Save contractor attendance'}
                variant="secondary"
                size="lg"
                disabled={savingCon || !contractorId}
                onPress={() => void saveContractor()}
              />
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Select filters"
          description="Choose department and shift to load attendance."
        />
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
  saved: {
    ...typography.caption,
    color: colors.success,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: { marginBottom: spacing.sm },
  name: { ...typography.body, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  statusChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  statusText: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  statusTextActive: { color: colors.brandDark },
  saveBtn: { marginBottom: spacing.md },
});
