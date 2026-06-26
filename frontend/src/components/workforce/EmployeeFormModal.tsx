import { useEffect, useState } from 'react';
import { fetchDepartments, fetchPlants, fetchProcesses, fetchPlantUsers } from '../../api/platform';
import type { IssueCategory } from '../../api/maintenance';
import { fetchMaintenanceCategories } from '../../api/maintenance';
import type {
  EmploymentStatus,
  EmploymentType,
  Process,
  User,
  UserRole,
  WorkforceEmployeePayload,
  WorkforceEmployeeUpdatePayload,
} from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const ASSIGNABLE_ROLES: UserRole[] = ['hr', 'hod', 'supervisor', 'worker', 'maintenance'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['permanent', 'contract', 'temporary'];

const EMPLOYMENT_STATUSES: EmploymentStatus[] = ['active', 'on_leave', 'resigned', 'terminated'];

const DEFAULT_CATEGORIES: { value: IssueCategory; label: string }[] = [
  { value: 'quality', label: 'Quality' },
  { value: 'safety', label: 'Safety' },
  { value: 'energy', label: 'Energy' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'process', label: 'Process' },
];

export type EmployeeFormState = WorkforceEmployeePayload & { password: string };

type Props = {
  editing: User | null;
  orgId: string;
  initialDepartmentId?: string;
  onCancel: () => void;
  onSave: (payload: WorkforceEmployeePayload | WorkforceEmployeeUpdatePayload, isEdit: boolean) => Promise<void>;
};

export function EmployeeFormModal({ editing, orgId, initialDepartmentId, onCancel, onSave }: Props) {
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [plants, setPlants] = useState<Awaited<ReturnType<typeof fetchPlants>>>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<EmployeeFormState>({
    email: '',
    password: '',
    full_name: '',
    role: 'worker',
    department_id: initialDepartmentId ?? '',
    process_id: '',
    plant_id: '',
    designation: '',
    phone: '',
    maintenance_division: 'equipment',
    employment_status: 'active',
    employment_type: 'permanent',
    manager_id: '',
    date_of_joining: '',
  });

  useEffect(() => {
    fetchDepartments().then(setDepartments);
    fetchPlants().then(setPlants);
    fetchMaintenanceCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const plantId = plants.find((p) => p.organisation_id === orgId)?.id ?? plants[0]?.id;
    if (plantId) fetchPlantUsers(plantId).then(setManagers).catch(() => []);
  }, [orgId, plants]);

  useEffect(() => {
    const plantId = plants.find((p) => p.organisation_id === orgId)?.id ?? plants[0]?.id ?? '';
    if (editing) {
      setForm({
        email: editing.email,
        password: '',
        full_name: editing.full_name,
        role: editing.role,
        department_id: editing.department_id ?? '',
        process_id: editing.process_id ?? '',
        plant_id: editing.plant_id ?? plantId,
        designation: editing.designation ?? '',
        phone: editing.phone ?? '',
        maintenance_division: (editing.maintenance_division as IssueCategory) ?? 'equipment',
        employment_status: editing.employment_status ?? 'active',
        employment_type: editing.employment_type ?? 'permanent',
        manager_id: editing.manager_id ?? '',
        date_of_joining: editing.date_of_joining ?? '',
      });
      if (editing.department_id) {
        fetchProcesses(editing.department_id).then(setProcesses);
      }
    } else {
      setForm((f) => ({
        ...f,
        plant_id: plantId,
        department_id: initialDepartmentId ?? departments[0]?.id ?? '',
      }));
      const deptId = initialDepartmentId ?? departments[0]?.id;
      if (deptId) fetchProcesses(deptId).then(setProcesses);
    }
  }, [editing, orgId, plants, departments, initialDepartmentId]);

  const onDeptChange = async (deptId: string) => {
    setForm((f) => ({ ...f, department_id: deptId, process_id: '' }));
    if (deptId) {
      const procs = await fetchProcesses(deptId);
      setProcesses(procs);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await onSave(
          {
            full_name: form.full_name,
            role: form.role,
            department_id: form.department_id || null,
            process_id: form.role === 'supervisor' ? form.process_id || null : null,
            maintenance_division: form.role === 'maintenance' ? form.maintenance_division || null : null,
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
            ...form,
            department_id: form.department_id || null,
            process_id: form.role === 'supervisor' ? form.process_id || null : null,
            maintenance_division: form.role === 'maintenance' ? form.maintenance_division || null : null,
            plant_id: form.plant_id || null,
            employment_type: form.employment_type,
            manager_id: form.manager_id || null,
            date_of_joining: form.date_of_joining || null,
          },
          false
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit employee' : 'Add employee'}</h2>
        <div className="space-y-3">
          {!editing && (
            <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          )}
          <Input
            label="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          {!editing && (
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
          {editing && (
            <Input
              label="New password (optional)"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
          <label className="block text-sm">
            <span className="text-slate-600">Role</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Department</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.department_id ?? ''}
              onChange={(e) => onDeptChange(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          {form.role === 'supervisor' && (
            <label className="block text-sm">
              <span className="text-slate-600">Process / log sheet</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.process_id ?? ''}
                onChange={(e) => setForm({ ...form, process_id: e.target.value })}
              >
                <option value="">Select process</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.role === 'maintenance' && (
            <label className="block text-sm">
              <span className="text-slate-600">Maintenance category</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.maintenance_division ?? 'equipment'}
                onChange={(e) =>
                  setForm({ ...form, maintenance_division: e.target.value as IssueCategory })
                }
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Input
            label="Designation"
            value={form.designation ?? ''}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
          />
          <Input
            label="Mobile"
            value={form.phone ?? ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Joining date"
            type="date"
            value={form.date_of_joining ?? ''}
            onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
          />
          <label className="block text-sm">
            <span className="text-slate-600">Employment type</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.employment_type ?? 'permanent'}
              onChange={(e) =>
                setForm({ ...form, employment_type: e.target.value as EmploymentType })
              }
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Reporting manager</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.manager_id ?? ''}
              onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
            >
              <option value="">None</option>
              {managers
                .filter((m) => m.id !== editing?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Employment status</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.employment_status ?? 'active'}
              onChange={(e) =>
                setForm({ ...form, employment_status: e.target.value as EmploymentStatus })
              }
            >
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
