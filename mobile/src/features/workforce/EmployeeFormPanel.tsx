import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchDepartments,
  fetchPlantUsers,
  fetchPlants,
  fetchProcesses,
} from '@/src/api/lookups';
import {
  DEFAULT_ISSUE_CATEGORIES,
  fetchMaintenanceCategories,
  type IssueCategory,
  type MaintenanceCategory,
} from '@/src/api/maintenance';
import {
  parseAttendanceDateIso,
  toAttendanceDateIso,
  type WorkforceEmployeePayload,
  type WorkforceEmployeeUpdatePayload,
} from '@/src/api/workforce';
import { Button } from '@/src/components/ui/Button';
import { DateTimeField } from '@/src/components/ui/DateTimeField';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import type { Department, Process } from '@/src/types/platform';
import type {
  EmploymentStatus,
  EmploymentType,
  User,
  UserRole,
} from '@/src/types/user';
import { colors, spacing, typography } from '@/src/theme/tokens';

const ASSIGNABLE_ROLES: UserRole[] = ['hr', 'hod', 'supervisor', 'worker', 'maintenance'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['permanent', 'contract', 'temporary'];
const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  'active',
  'on_leave',
  'resigned',
  'terminated',
];

export type EmployeeFormState = {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  department_id: string;
  process_id: string;
  plant_id: string;
  designation: string;
  phone: string;
  maintenance_division: string;
  employment_status: EmploymentStatus;
  employment_type: EmploymentType;
  manager_id: string;
  date_of_joining: string;
};

type Props = {
  editing: User | null;
  orgId: string;
  onCancel: () => void;
  onSave: (
    payload: WorkforceEmployeePayload | WorkforceEmployeeUpdatePayload,
    isEdit: boolean
  ) => Promise<void>;
};

function emptyForm(plantId = '', departmentId = ''): EmployeeFormState {
  return {
    email: '',
    password: '',
    full_name: '',
    role: 'worker',
    department_id: departmentId,
    process_id: '',
    plant_id: plantId,
    designation: '',
    phone: '',
    maintenance_division: 'equipment',
    employment_status: 'active',
    employment_type: 'permanent',
    manager_id: '',
    date_of_joining: '',
  };
}

/**
 * P4-WF-EMP — employee create/edit form (port of EmployeeFormModal).
 */
export function EmployeeFormPanel({ editing, orgId, onCancel, onSave }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [categories, setCategories] =
    useState<MaintenanceCategory[]>(DEFAULT_ISSUE_CATEGORIES);
  const [form, setForm] = useState<EmployeeFormState>(emptyForm());

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, plants, cats] = await Promise.all([
        fetchDepartments(),
        fetchPlants(),
        fetchMaintenanceCategories().catch(() => DEFAULT_ISSUE_CATEGORIES),
      ]);
      setDepartments(depts);
      setCategories(cats.length ? cats : DEFAULT_ISSUE_CATEGORIES);

      const plantId =
        plants.find((p) => p.organisation_id === orgId)?.id ?? plants[0]?.id ?? '';
      let managersList: User[] = [];
      if (plantId) {
        managersList = await fetchPlantUsers(plantId).catch(() => []);
      }
      setManagers(managersList);

      if (editing) {
        const deptId = editing.department_id ?? '';
        setForm({
          email: editing.email,
          password: '',
          full_name: editing.full_name,
          role: editing.role,
          department_id: deptId,
          process_id: editing.process_id ?? '',
          plant_id: editing.plant_id ?? plantId,
          designation: editing.designation ?? '',
          phone: editing.phone ?? '',
          maintenance_division:
            (editing.maintenance_division as IssueCategory) ?? 'equipment',
          employment_status: editing.employment_status ?? 'active',
          employment_type: editing.employment_type ?? 'permanent',
          manager_id: editing.manager_id ?? '',
          date_of_joining: editing.date_of_joining ?? '',
        });
        if (deptId) setProcesses(await fetchProcesses(deptId).catch(() => []));
        else setProcesses([]);
      } else {
        const deptId = depts[0]?.id ?? '';
        setForm(emptyForm(plantId, deptId));
        if (deptId) setProcesses(await fetchProcesses(deptId).catch(() => []));
        else setProcesses([]);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [editing, orgId]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const onDeptChange = async (deptId: string) => {
    setForm((f) => ({ ...f, department_id: deptId, process_id: '' }));
    if (deptId) {
      setProcesses(await fetchProcesses(deptId).catch(() => []));
    } else {
      setProcesses([]);
    }
  };

  const roleOptions = useMemo(
    () => ASSIGNABLE_ROLES.map((r) => ({ value: r, label: r.replace(/_/g, ' ') })),
    []
  );
  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  );
  const processOptions = useMemo(
    () => [
      { value: '', label: 'Select process' },
      ...processes.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    ],
    [processes]
  );
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.value, label: c.label })),
    [categories]
  );
  const typeOptions = useMemo(
    () => EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })),
    []
  );
  const statusOptions = useMemo(
    () => EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
    []
  );
  const managerOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...managers
        .filter((m) => m.id !== editing?.id)
        .map((m) => ({ value: m.id, label: m.full_name })),
    ],
    [managers, editing?.id]
  );

  const handleSave = async () => {
    setError(null);
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!editing) {
      if (!form.email.trim()) {
        setError('Email is required.');
        return;
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    } else if (form.password && form.password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await onSave(
          {
            full_name: form.full_name.trim(),
            role: form.role,
            department_id: form.department_id || null,
            process_id: form.role === 'supervisor' ? form.process_id || null : null,
            maintenance_division:
              form.role === 'maintenance' ? form.maintenance_division || null : null,
            plant_id: form.plant_id || null,
            designation: form.designation || null,
            phone: form.phone || null,
            password: form.password || undefined,
            employment_status: form.employment_status,
            employment_type: form.employment_type,
            manager_id: form.manager_id || null,
            date_of_joining: form.date_of_joining || null,
          },
          true
        );
      } else {
        await onSave(
          {
            email: form.email.trim(),
            password: form.password,
            full_name: form.full_name.trim(),
            role: form.role,
            department_id: form.department_id || null,
            process_id: form.role === 'supervisor' ? form.process_id || null : null,
            maintenance_division:
              form.role === 'maintenance' ? form.maintenance_division || null : null,
            plant_id: form.plant_id || null,
            designation: form.designation || null,
            phone: form.phone || null,
            employment_status: form.employment_status,
            employment_type: form.employment_type,
            manager_id: form.manager_id || null,
            date_of_joining: form.date_of_joining || null,
          },
          false
        );
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingView message="Loading form…" />;
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>{editing ? 'Edit employee' : 'Add employee'}</Text>
      <Text style={styles.sub}>
        {editing
          ? 'Update profile fields. Leave password blank to keep the current one.'
          : 'Create a permanent employee linked to log sheet pickers.'}
      </Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

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

      {!editing ? (
        <TextField
          label="Password"
          value={form.password}
          onChangeText={(password) => setForm((f) => ({ ...f, password }))}
          secureTextEntry
          passwordToggle
        />
      ) : (
        <TextField
          label="New password (optional)"
          value={form.password}
          onChangeText={(password) => setForm((f) => ({ ...f, password }))}
          secureTextEntry
          passwordToggle
        />
      )}

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
        onChange={(id) => void onDeptChange(id)}
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
          value={(form.maintenance_division || 'equipment') as IssueCategory}
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
      <TextField
        label="Mobile"
        value={form.phone}
        onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
        keyboardType="phone-pad"
      />

      <DateTimeField
        label="Joining date"
        mode="date"
        value={form.date_of_joining ? parseAttendanceDateIso(form.date_of_joining) : null}
        onChange={(d) =>
          setForm((f) => ({ ...f, date_of_joining: toAttendanceDateIso(d) }))
        }
      />

      <SelectSheet
        label="Employment type"
        options={typeOptions}
        value={form.employment_type}
        onChange={(employment_type) => setForm((f) => ({ ...f, employment_type }))}
      />

      <SelectSheet
        label="Reporting manager"
        options={managerOptions}
        value={form.manager_id}
        onChange={(manager_id) => setForm((f) => ({ ...f, manager_id }))}
      />

      <SelectSheet
        label="Employment status"
        options={statusOptions}
        value={form.employment_status}
        onChange={(employment_status) => setForm((f) => ({ ...f, employment_status }))}
      />

      <View style={styles.actions}>
        <Button
          title="Cancel"
          variant="secondary"
          size="lg"
          style={styles.actionBtn}
          onPress={onCancel}
        />
        <Button
          title={saving ? 'Saving…' : 'Save'}
          size="lg"
          style={styles.actionBtn}
          disabled={saving}
          onPress={() => void handleSave()}
        />
      </View>
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionBtn: { flexGrow: 1, flexBasis: '40%' },
});
