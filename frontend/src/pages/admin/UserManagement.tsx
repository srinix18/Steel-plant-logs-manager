import { useEffect, useState, type FormEvent } from 'react';
import { createUser, deleteUser, fetchUsers, updateUser } from '../../api/users';
import { fetchDepartments } from '../../api/departments';
import { fetchOrganisations } from '../../api/organisations';
import { getErrorMessage } from '../../api/client';
import type { Department, Organisation, User, UserRole } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';

const emptyForm = {
  email: '',
  password: '',
  full_name: '',
  role: 'member' as UserRole,
  department_id: '',
};

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = () => {
    fetchUsers().then(setUsers).catch((e) => setError(getErrorMessage(e)));
    fetchDepartments().then(setDepartments).catch(() => {});
    fetchOrganisations().then(setOrganisations).catch(() => {});
  };

  const deptLabel = (dept: Department) => {
    const orgName = organisations.find((o) => o.id === dept.organisation_id)?.name;
    return orgName ? `${orgName} / ${dept.name}` : dept.name;
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      email: user.email,
      password: '',
      full_name: user.full_name,
      role: user.role,
      department_id: user.department_id || '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        department_id: form.department_id || null,
      };
      if (editing) {
        await updateUser(editing.id, payload.password ? payload : { ...payload, password: undefined });
      } else {
        await createUser(payload);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <Button onClick={openCreate}>Add User</Button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <Card>
        <Table
          data={users}
          columns={[
            { key: 'name', header: 'Name', render: (u) => u.full_name },
            { key: 'email', header: 'Email', render: (u) => u.email },
            { key: 'role', header: 'Role', render: (u) => <Badge color="blue">{u.role}</Badge> },
            {
              key: 'actions',
              header: 'Actions',
              render: (u) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(u.id)}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title={editing ? 'Edit User' : 'Create User'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label={editing ? 'Password (leave blank to keep)' : 'Password'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
          <div>
            <label className="block text-sm font-medium text-slate-700">Role</label>
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              <option value="admin">Admin</option>
              <option value="department">Department</option>
              <option value="member">Member</option>
            </select>
          </div>
          {form.role !== 'admin' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Department</label>
              <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} required>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
