import { useEffect, useMemo, useState } from 'react';
import {
  createOrgUser,
  fetchDepartments,
  fetchOrgUsers,
  fetchPlants,
  fetchProcesses,
  updateOrgUser,
} from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { OrgUserPayload, Process, User, UserRole } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

const ASSIGNABLE_ROLES: UserRole[] = ['hod', 'supervisor', 'worker'];

export function EmployeesPage() {
  const { user } = useAuth();
  const orgId = user?.organisation_id ?? '';
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [plants, setPlants] = useState<Awaited<ReturnType<typeof fetchPlants>>>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const [form, setForm] = useState<OrgUserPayload>({
    email: '',
    password: '',
    full_name: '',
    role: 'worker',
    department_id: '',
    process_id: '',
    plant_id: '',
    designation: '',
  });

  const load = async () => {
    if (!orgId) return;
    const [emps, depts, plts] = await Promise.all([
      fetchOrgUsers(orgId),
      fetchDepartments(),
      fetchPlants(),
    ]);
    setEmployees(emps);
    setDepartments(depts);
    setPlants(plts);
    const deptId = depts[0]?.id;
    if (deptId) {
      const procs = await fetchProcesses(deptId);
      setProcesses(procs);
    }
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [orgId]);

  const plantId = useMemo(() => plants.find((p) => p.organisation_id === orgId)?.id ?? plants[0]?.id, [plants, orgId]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      email: '',
      password: '',
      full_name: '',
      role: 'worker',
      department_id: departments[0]?.id ?? '',
      process_id: '',
      plant_id: plantId ?? '',
      designation: '',
    });
    setShowModal(true);
  };

  const openEdit = (emp: User) => {
    setEditing(emp);
    setForm({
      email: emp.email,
      password: '',
      full_name: emp.full_name,
      role: emp.role,
      department_id: emp.department_id ?? '',
      process_id: emp.process_id ?? '',
      plant_id: emp.plant_id ?? plantId ?? '',
      designation: emp.designation ?? '',
    });
    setShowModal(true);
  };

  const onDeptChange = async (deptId: string) => {
    setForm((f) => ({ ...f, department_id: deptId, process_id: '' }));
    if (deptId) {
      const procs = await fetchProcesses(deptId);
      setProcesses(procs);
    }
  };

  const save = async () => {
    try {
      setError('');
      if (!orgId) return;
      if (editing) {
        await updateOrgUser(orgId, editing.id, {
          full_name: form.full_name,
          role: form.role,
          department_id: form.department_id || null,
          process_id: form.role === 'supervisor' ? form.process_id || null : null,
          plant_id: form.plant_id || null,
          designation: form.designation || null,
          password: form.password || undefined,
        });
      } else {
        await createOrgUser(orgId, {
          ...form,
          department_id: form.department_id || null,
          process_id: form.role === 'supervisor' ? form.process_id || null : null,
          plant_id: form.plant_id || null,
        });
      }
      setShowModal(false);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const processName = (id?: string | null) => processes.find((p) => p.id === id)?.code ?? '—';
  const deptName = (id?: string | null) => departments.find((d) => d.id === id)?.name ?? '—';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">Assign HoD, supervisor, or worker roles in your organisation.</p>
        </div>
        <Button onClick={openCreate}>Add employee</Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={employees}
          emptyMessage="No employees yet."
          columns={[
            { key: 'name', header: 'Name', render: (u) => u.full_name },
            { key: 'email', header: 'Email', render: (u) => u.email },
            {
              key: 'role',
              header: 'Role',
              render: (u) => <span className="capitalize">{u.role.replace(/_/g, ' ')}</span>,
            },
            { key: 'dept', header: 'Department', render: (u) => deptName(u.department_id) },
            {
              key: 'process',
              header: 'Process',
              render: (u) => (u.role === 'supervisor' ? processName(u.process_id) : '—'),
            },
            {
              key: 'actions',
              header: '',
              render: (u) =>
                u.role !== 'super_admin' && u.role !== 'ceo' ? (
                  <Button variant="secondary" onClick={() => openEdit(u)}>
                    Edit
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit employee' : 'Add employee'}</h2>
            <div className="space-y-3">
              {!editing && (
                <Input
                  label="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
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
              <Input
                label="Designation"
                value={form.designation ?? ''}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
