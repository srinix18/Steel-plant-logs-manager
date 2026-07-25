import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments } from '@/src/api/lookups';
import {
  createWorkforceEmployee,
  fetchWorkforceEmployees,
  updateWorkforceEmployee,
  type WorkforceEmployeePayload,
  type WorkforceEmployeeUpdatePayload,
} from '@/src/api/workforce';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { EmployeeFormPanel } from '@/src/features/workforce/EmployeeFormPanel';
import type { Department } from '@/src/types/platform';
import type { User } from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P4-WF-EMP — Employees list + add/edit (port of WorkforceEmployeesPage).
 */
export function WorkforceEmployeesScreen() {
  const { user } = useAuth();
  const orgId = user?.organisation_id ?? '';
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [emps, depts] = await Promise.all([
        fetchWorkforceEmployees(),
        fetchDepartments(),
      ]);
      setEmployees(emps);
      setDepartments(depts);
    } catch (e) {
      setError(getErrorMessage(e));
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deptName = (id?: string | null) =>
    departments.find((d) => d.id === id)?.name ?? '—';

  const handleSave = async (
    payload: WorkforceEmployeePayload | WorkforceEmployeeUpdatePayload,
    isEdit: boolean
  ) => {
    if (isEdit && editing) {
      await updateWorkforceEmployee(editing.id, payload as WorkforceEmployeeUpdatePayload);
    } else {
      await createWorkforceEmployee(payload as WorkforceEmployeePayload);
    }
    setShowForm(false);
    setEditing(null);
    await load(true);
  };

  if (showForm && orgId) {
    return (
      <EmployeeFormPanel
        editing={editing}
        orgId={orgId}
        onCancel={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    );
  }

  if (loading && employees.length === 0) {
    return <LoadingView message="Loading employees…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Employees</Text>
      <Text style={styles.sub}>
        Permanent employee master — linked to log sheet user pickers.
      </Text>

      <Button
        title="Add employee"
        size="lg"
        style={styles.addBtn}
        onPress={() => {
          setEditing(null);
          setShowForm(true);
        }}
      />

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {employees.length === 0 && !error ? (
        <EmptyState title="No employees yet." description="Tap Add employee to create one." />
      ) : (
        employees.map((u) => (
          <Card key={u.id} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.titles}>
                <Text style={styles.name}>{u.full_name}</Text>
                <Text style={styles.meta}>{u.employee_uid ?? u.email}</Text>
              </View>
              <Badge
                label={(u.employment_status ?? 'active').replace(/_/g, ' ')}
                tone={
                  (u.employment_status ?? 'active') === 'active' ? 'success' : 'neutral'
                }
              />
            </View>
            <Text style={styles.line}>Dept: {deptName(u.department_id)}</Text>
            <Text style={styles.line}>
              {u.designation ?? '—'} · {u.role.replace(/_/g, ' ')}
            </Text>
            <Button
              title="Edit"
              variant="secondary"
              size="sm"
              style={styles.editBtn}
              onPress={() => {
                setEditing(u);
                setShowForm(true);
              }}
            />
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
  line: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  editBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
});
