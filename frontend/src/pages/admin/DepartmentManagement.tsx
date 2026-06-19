import { useEffect, useState, type FormEvent } from 'react';
import { createDepartment, deleteDepartment, fetchDepartments, updateDepartment } from '../../api/departments';
import { fetchOrganisations } from '../../api/organisations';
import { getErrorMessage } from '../../api/client';
import type { Department, Organisation } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';

export function DepartmentManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [filterOrgId, setFilterOrgId] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [organisationId, setOrganisationId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const orgNameById = (id: string) => organisations.find((o) => o.id === id)?.name || '—';

  const loadDepartments = () => {
    fetchDepartments(filterOrgId || undefined)
      .then(setDepartments)
      .catch((e) => setError(getErrorMessage(e)));
  };

  const loadOrganisations = () => {
    fetchOrganisations().then(setOrganisations).catch(() => {});
  };

  useEffect(() => {
    loadOrganisations();
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [filterOrgId]);

  const openCreate = () => {
    setEditing(null);
    setOrganisationId(filterOrgId || organisations[0]?.id || '');
    setName('');
    setDescription('');
    setOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setOrganisationId(dept.organisation_id);
    setName(dept.name);
    setDescription(dept.description || '');
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateDepartment(editing.id, { organisation_id: organisationId, name, description });
      } else {
        await createDepartment({ organisation_id: organisationId, name, description });
      }
      setOpen(false);
      loadDepartments();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this department?')) return;
    try {
      await deleteDepartment(id);
      loadDepartments();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Department Management</h1>
        <Button onClick={openCreate} disabled={organisations.length === 0}>
          Add Department
        </Button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700">Filter by organisation</label>
        <select
          className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={filterOrgId}
          onChange={(e) => setFilterOrgId(e.target.value)}
        >
          <option value="">All organisations</option>
          {organisations.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      <Card>
        <Table
          data={departments}
          columns={[
            { key: 'org', header: 'Organisation', render: (d) => orgNameById(d.organisation_id) },
            { key: 'name', header: 'Name', render: (d) => d.name },
            { key: 'desc', header: 'Description', render: (d) => d.description || '—' },
            {
              key: 'actions',
              header: 'Actions',
              render: (d) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(d.id)}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title={editing ? 'Edit Department' : 'Create Department'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Organisation</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={organisationId}
              onChange={(e) => setOrganisationId(e.target.value)}
              required
            >
              <option value="">Select organisation</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
