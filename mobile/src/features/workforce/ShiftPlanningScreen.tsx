import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments } from '@/src/api/lookups';
import {
  fetchWorkforceEmployees,
  fetchWorkforceShifts,
  parseAttendanceDateIso,
  toAttendanceDateIso,
  type WorkforceShift,
} from '@/src/api/workforce';
import {
  createShiftRoster,
  fetchShiftRosters,
  publishShiftRoster,
  updateShiftRoster,
  type ShiftRoster,
} from '@/src/api/workforceOps';
import { Badge } from '@/src/components/ui/Badge';
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

type GridCell = Record<string, Record<string, string>>;

/** Monday of the week containing `d` (local calendar). */
export function weekStartIso(d = new Date()): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.getFullYear(), d.getMonth(), diff);
  return toAttendanceDateIso(start);
}

export function weekDates(startIso: string): string[] {
  const base = parseAttendanceDateIso(startIso);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    dates.push(toAttendanceDateIso(cur));
  }
  return dates;
}

function weekEndIso(startIso: string): string {
  const dates = weekDates(startIso);
  return dates[dates.length - 1]!;
}

function dayLabel(iso: string): string {
  return parseAttendanceDateIso(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * P4-WF-PLAN — Shift planning (port of ShiftPlanningPage; phone-capable, no desktop gate).
 * Person-first day rows for phone instead of a wide table.
 */
export function ShiftPlanningScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rosters, setRosters] = useState<ShiftRoster[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [shifts, setShifts] = useState<WorkforceShift[]>([]);
  const [periodStart, setPeriodStart] = useState(weekStartIso());
  const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
  const [grid, setGrid] = useState<GridCell>({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const dates = useMemo(() => weekDates(periodStart), [periodStart]);

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, shiftList] = await Promise.all([
        fetchDepartments(),
        fetchWorkforceShifts(),
      ]);
      setDepartments(depts);
      setShifts(shiftList);
      if (depts[0] && !departmentId) setDepartmentId(depts[0].id);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on mount
  }, []);

  const loadDept = useCallback(
    async (soft = false) => {
      if (!departmentId) return;
      if (soft) setRefreshing(true);
      setError(null);
      try {
        const [r, e] = await Promise.all([
          fetchShiftRosters(departmentId),
          fetchWorkforceEmployees(departmentId),
        ]);
        setRosters(r);
        setEmployees(e);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setRefreshing(false);
      }
    },
    [departmentId]
  );

  useEffect(() => {
    void loadDept();
  }, [loadDept]);

  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  );
  const shiftOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...shifts.map((s) => ({ value: s.id, label: s.code })),
    ],
    [shifts]
  );

  const startNewRoster = () => {
    setEditingRosterId(null);
    const empty: GridCell = {};
    for (const emp of employees) {
      empty[emp.id] = {};
      for (const dt of dates) {
        empty[emp.id][dt] = shifts[0]?.id ?? '';
      }
    }
    setGrid(empty);
    setExpandedUserId(employees[0]?.id ?? null);
  };

  const loadRosterToGrid = (rosterId: string) => {
    const roster = rosters.find((r) => r.id === rosterId);
    if (!roster) return;
    setEditingRosterId(rosterId);
    setPeriodStart(roster.period_start);
    const week = weekDates(roster.period_start);
    const next: GridCell = {};
    for (const emp of employees) {
      next[emp.id] = {};
      for (const dt of week) {
        next[emp.id][dt] = '';
      }
    }
    for (const entry of roster.entries) {
      if (!next[entry.user_id]) next[entry.user_id] = {};
      next[entry.user_id][entry.roster_date] = entry.shift_id;
    }
    setGrid(next);
    setExpandedUserId(employees[0]?.id ?? null);
  };

  const setCell = (userId: string, rosterDate: string, shiftId: string) => {
    setGrid((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [rosterDate]: shiftId },
    }));
  };

  const buildEntries = () => {
    const entries: { user_id: string; shift_id: string; roster_date: string }[] = [];
    for (const emp of employees) {
      for (const dt of dates) {
        const shiftId = grid[emp.id]?.[dt];
        if (shiftId) {
          entries.push({ user_id: emp.id, shift_id: shiftId, roster_date: dt });
        }
      }
    }
    return entries;
  };

  const saveRoster = async () => {
    if (!departmentId || shifts.length === 0) {
      setError('Department and at least one shift are required.');
      return;
    }
    if (employees.length === 0) {
      setError('No employees in this department.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entries = buildEntries();
      if (editingRosterId) {
        await updateShiftRoster(editingRosterId, {
          period_start: periodStart,
          period_end: weekEndIso(periodStart),
          entries,
        });
      } else {
        const roster = await createShiftRoster({
          department_id: departmentId,
          period_start: periodStart,
          period_end: weekEndIso(periodStart),
          period_type: 'weekly',
          entries,
        });
        setEditingRosterId(roster.id);
      }
      await loadDept(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async (rosterId: string) => {
    setPublishingId(rosterId);
    setError(null);
    try {
      await publishShiftRoster(rosterId);
      await loadDept(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPublishingId(null);
    }
  };

  if (loading && departments.length === 0) {
    return <LoadingView message="Loading shift planning…" />;
  }

  const hasGrid = Object.keys(grid).length > 0;
  const editingRoster = editingRosterId
    ? rosters.find((r) => r.id === editingRosterId)
    : null;
  const readOnly = editingRoster?.status === 'published';

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void loadDept(true)}>
      <Text style={styles.title}>Shift Planning</Text>
      <Text style={styles.sub}>
        Build a weekly roster: pick shifts per employee per day, then save and publish.
      </Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <SelectSheet
        label="Department"
        options={deptOptions}
        value={departmentId || null}
        onChange={(id) => {
          setDepartmentId(id);
          setGrid({});
          setEditingRosterId(null);
        }}
      />
      <DateTimeField
        label="Week start"
        mode="date"
        value={parseAttendanceDateIso(periodStart)}
        onChange={(d) => setPeriodStart(weekStartIso(d))}
      />

      <View style={styles.toolbar}>
        <Button
          title="New roster"
          variant="secondary"
          size="sm"
          onPress={startNewRoster}
          disabled={employees.length === 0}
        />
        <Button
          title={saving ? 'Saving…' : 'Save roster'}
          size="sm"
          onPress={() => void saveRoster()}
          disabled={saving || employees.length === 0 || !hasGrid || readOnly}
        />
      </View>

      {hasGrid ? (
        <>
          <Text style={styles.section}>
            Weekly grid {editingRosterId ? `(${editingRoster?.status ?? 'draft'})` : '(new)'}
          </Text>
          {employees.map((emp) => {
            const open = expandedUserId === emp.id;
            return (
              <Card key={emp.id} style={styles.card}>
                <Pressable
                  onPress={() => setExpandedUserId(open ? null : emp.id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.name}>{emp.full_name}</Text>
                  <Text style={styles.meta}>{open ? 'Hide days' : 'Show days'}</Text>
                </Pressable>
                {open
                  ? dates.map((dt) => (
                      <View key={dt} style={styles.dayRow}>
                        <Text style={styles.dayLabel}>{dayLabel(dt)}</Text>
                        <View style={styles.daySelect}>
                          <SelectSheet
                            options={shiftOptions}
                            value={grid[emp.id]?.[dt] ?? ''}
                            onChange={(shiftId) => setCell(emp.id, dt, shiftId)}
                            disabled={readOnly}
                            placeholder="—"
                          />
                        </View>
                      </View>
                    ))
                  : null}
              </Card>
            );
          })}
        </>
      ) : null}

      <Text style={styles.section}>Rosters</Text>
      {rosters.length === 0 ? (
        <EmptyState
          title="No rosters for this department"
          description="Tap New roster to start a weekly draft."
        />
      ) : (
        rosters.map((r) => (
          <Card key={r.id} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.titles}>
                <Text style={styles.name}>
                  {r.period_start} — {r.period_end}
                </Text>
                <Text style={styles.meta}>
                  {r.period_type} · {r.entries.length} entries
                </Text>
              </View>
              <Badge
                label={r.status}
                tone={r.status === 'published' ? 'success' : 'neutral'}
              />
            </View>
            <View style={styles.toolbar}>
              <Button
                title="Edit"
                variant="secondary"
                size="sm"
                onPress={() => loadRosterToGrid(r.id)}
              />
              {r.status === 'draft' ? (
                <Button
                  title={publishingId === r.id ? 'Publishing…' : 'Publish'}
                  size="sm"
                  disabled={publishingId === r.id}
                  onPress={() => void onPublish(r.id)}
                />
              ) : null}
            </View>
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
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
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
  dayRow: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  dayLabel: { ...typography.caption, fontWeight: '600', color: colors.text },
  daySelect: { marginTop: 2 },
});
