import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  createOrgUser,
  fetchOrgUsers,
  updateOrgUser,
  type OrgUserPayload,
} from '@/src/api/admin';
import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments, fetchPlants, fetchProcesses } from '@/src/api/lookups';
import {
  DEFAULT_ISSUE_CATEGORIES,
  fetchMaintenanceCategories,
  type IssueCategory,
  type MaintenanceCategory,
} from '@/src/api/maintenance';
import { useAuth } from '@/src/auth/AuthContext';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { VirtualList } from '@/src/components/ui/VirtualList';
import type { Department, Plant, Process } from '@/src/types/platform';
import type { User, UserRole } from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

const ASSIGNABLE_ROLES: UserRole[] = ['hr', 'hod', 'supervisor', 'worker', 'maintenance'];

type FormState = {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  department_id: string;
  process_id: string;
  plant_id: string;
  designation: string;
  maintenance_division: string;
};

function emptyForm(plantId = '', departmentId = ''): FormState {
  return {
    email: '',
    password: '',
    full_name: '',
    role: 'worker',
    department_id: departmentId,
    process_id: '',
    plant_id: plantId,
    designation: '',
    maintenance_division: 'equipment',
  };
}

/**
 * P5-EXE-EMP — org employees Add/Edit (port of EmployeesPage).
 */
export function ExecutiveEmployeesScreen() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState(user?.organisation_id ?? '');
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [categories, setCategories] = useState<MaintenanceCategory[]>(DEFAULT_ISSUE_CATEGORIES);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [depts, plts, cats] = await Promise.all([
          fetchDepartments(),
          fetchPlants(),
          fetchMaintenanceCategories().catch(() => DEFAULT_ISSUE_CATEGORIES),
        ]);
        setDepartments(depts);
        setPlants(plts);
        setCategories(cats.length ? cats : DEFAULT_ISSUE_CATEGORIES);

        const resolvedOrg =
          orgId ||
          user?.organisation_id ||
          plts.find((p) => p.organisation_id)?.organisation_id ||
          '';
        if (!orgId && resolvedOrg) setOrgId(resolvedOrg);
        if (!resolvedOrg) {
          setEmployees([]);
          return;
        }

        const emps = await fetchOrgUsers(resolvedOrg);
        setEmployees(emps);

        const deptId = depts[0]?.id;
        if (deptId) {
          setProcesses(await fetchProcesses(deptId));
        }
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId, user?.organisation_id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const plantId = useMemo(
    () => plants.find((p) => p.organisation_id === orgId)?.id ?? plants[0]?.id ?? '',
    [plants, orgId]
  );

  const roleOptions = ASSIGNABLE_ROLES.map((r) => ({
    value: r,
    label: r.replace(/_/g, ' '),
  }));
  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }));
  const processOptions = [
    { value: '', label: 'Select process' },
    ...processes.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
  ];
  const categoryOptions = categories.map((c) => ({ value: c.value, label: c.label }));

  const processName = (id?: string | null) => processes.find((p) => p.id === id)?.code ?? '—';
  const deptName = (id?: string | null) => departments.find((d) => d.id === id)?.name ?? '—';

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(plantId, departments[0]?.id ?? ''));
    setShowForm(true);
    setError(null);
  };

  const openEdit = async (emp: User) => {
    setEditing(emp);
    setForm({
      email: emp.email,
      password: '',
      full_name: emp.full_name,
      role: emp.role,
      department_id: emp.department_id ?? '',
      process_id: emp.process_id ?? '',
      plant_id: emp.plant_id ?? plantId,
      designation: emp.designation ?? '',
      maintenance_division: (emp.maintenance_division as IssueCategory) ?? 'equipment',
    });
    if (emp.department_id) {
      try {
        setProcesses(await fetchProcesses(emp.department_id));
      } catch {
        // keep existing process list
      }
    }
    setShowForm(true);
    setError(null);
  };

  const onDeptChange = async (deptId: string) => {
    setForm((f) => ({ ...f, department_id: deptId, process_id: '' }));
    if (deptId) {
      try {
        setProcesses(await fetchProcesses(deptId));
      } catch (e) {
        setError(getErrorMessage(e));
      }
    } else {
      setProcesses([]);
    }
  };

  const save = async () => {
    if (!orgId) {
      setError('Organisation is required.');
      return;
    }
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!editing) {
      if (!form.email.trim() || !form.password.trim()) {
        setError('Email and password are required.');
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateOrgUser(orgId, editing.id, {
          full_name: form.full_name.trim(),
          role: form.role,
          department_id: form.department_id || null,
          process_id: form.role === 'supervisor' ? form.process_id || null : null,
          maintenance_division:
            form.role === 'maintenance' ? form.maintenance_division || null : null,
          plant_id: form.plant_id || null,
          designation: form.designation.trim() || null,
          password: form.password.trim() || undefined,
        });
      } else {
        const payload: OrgUserPayload = {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          role: form.role,
          department_id: form.department_id || null,
          process_id: form.role === 'supervisor' ? form.process_id || null : null,
          maintenance_division:
            form.role === 'maintenance' ? form.maintenance_division || null : null,
          plant_id: form.plant_id || plantId || null,
          designation: form.designation.trim() || null,
        };
        await createOrgUser(orgId, payload);
      }
      setShowForm(false);
      setEditing(null);
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingView message="Loading employees…" />;
  }

  // Form uses Screen scroll; employee roster uses FlatList (P6-PERF).
  if (showForm) {
    return (
      <Screen scroll>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.title}>Employees</Text>
            <Text style={styles.subtitle}>
              Assign HoD, supervisor, worker, or maintenance crew in your organisation.
            </Text>
          </View>
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>{editing ? 'Edit employee' : 'Add employee'}</Text>
          {!editing ? (
            <TextField
              label="Email"
              value={form.email}
              onChangeText={(email) => setForm((f) => ({ ...f, email }))}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          ) : null}
          <TextField
            label="Full name"
            value={form.full_name}
            onChangeText={(full_name) => setForm((f) => ({ ...f, full_name }))}
          />
          <TextField
            label={editing ? 'New password (optional)' : 'Password'}
            value={form.password}
            onChangeText={(password) => setForm((f) => ({ ...f, password }))}
            secureTextEntry
            autoCapitalize="none"
          />
          <SelectSheet
            label="Role"
            options={roleOptions}
            value={form.role}
            onChange={(role) => setForm((f) => ({ ...f, role }))}
          />
          <SelectSheet
            label="Department"
            options={deptOptions}
            value={form.department_id || null}
            onChange={(v) => void onDeptChange(v)}
            placeholder="Select department"
          />
          {form.role === 'supervisor' ? (
            <SelectSheet
              label="Process / log sheet"
              options={processOptions}
              value={form.process_id}
              onChange={(process_id) => setForm((f) => ({ ...f, process_id }))}
            />
          ) : null}
          {form.role === 'maintenance' ? (
            <SelectSheet
              label="Maintenance category"
              options={categoryOptions}
              value={form.maintenance_division}
              onChange={(maintenance_division) =>
                setForm((f) => ({ ...f, maintenance_division }))
              }
            />
          ) : null}
          <TextField
            label="Designation"
            value={form.designation}
            onChangeText={(designation) => setForm((f) => ({ ...f, designation }))}
          />
          <View style={styles.formActions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setShowForm(false);
                setEditing(null);
                setError(null);
              }}
              style={styles.formBtn}
            />
            <Button
              title="Save"
              onPress={() => void save()}
              loading={saving}
              style={styles.formBtn}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <VirtualList
      data={employees}
      keyExtractor={(u) => u.id}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      header={
        <>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title}>Employees</Text>
              <Text style={styles.subtitle}>
                Assign HoD, supervisor, worker, or maintenance crew in your organisation.
              </Text>
            </View>
            <Button title="Add" onPress={openCreate} size="sm" />
          </View>
          {error ? <ErrorBanner message={error} /> : null}
        </>
      }
      empty={<EmptyState title="No employees yet." description="Tap Add to create one." />}
      renderItem={({ item: u }) => {
        const canEdit = u.role !== 'super_admin' && u.role !== 'ceo';
        const processOrCat =
          u.role === 'supervisor'
            ? processName(u.process_id)
            : u.role === 'maintenance'
              ? (u.maintenance_division ?? '—').replace(/^./, (c) => c.toUpperCase())
              : '—';
        return (
          <Card style={styles.row}>
            <Text style={styles.rowTitle}>{u.full_name}</Text>
            <Text style={styles.rowMeta}>{u.email}</Text>
            <Text style={styles.rowMeta}>Role: {u.role.replace(/_/g, ' ')}</Text>
            <Text style={styles.rowMeta}>Dept: {deptName(u.department_id)}</Text>
            <Text style={styles.rowMeta}>Process / category: {processOrCat}</Text>
            {canEdit ? (
              <Pressable onPress={() => void openEdit(u)} accessibilityRole="button">
                <Text style={styles.link}>Edit</Text>
              </Pressable>
            ) : null}
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  flex: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  formCard: { gap: spacing.sm, marginBottom: spacing.md },
  formTitle: { ...typography.section, color: colors.text },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  formBtn: { flex: 1 },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  row: { gap: spacing.xs, marginBottom: spacing.sm },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowMeta: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.caption, color: colors.brand, fontWeight: '600', marginTop: spacing.xs },
});
