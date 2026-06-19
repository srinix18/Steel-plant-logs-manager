import { useEffect, useState, type FormEvent } from 'react';
import {
  createOrganisation,
  deleteOrganisation,
  fetchOrganisations,
  updateOrganisation,
} from '../../api/organisations';
import { getErrorMessage } from '../../api/client';
import type { Organisation } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';

export function OrganisationManagement() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Organisation | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    fetchOrganisations().then(setOrganisations).catch((e) => setError(getErrorMessage(e)));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setOpen(true);
  };

  const openEdit = (org: Organisation) => {
    setEditing(org);
    setName(org.name);
    setDescription(org.description || '');
    setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateOrganisation(editing.id, { name, description });
      } else {
        await createOrganisation({ name, description });
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this organisation? Departments must be removed first.')) return;
    try {
      await deleteOrganisation(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Organisation Management</h1>
        <Button onClick={openCreate}>Add Organisation</Button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <Card>
        <Table
          data={organisations}
          columns={[
            { key: 'name', header: 'Name', render: (o) => o.name },
            { key: 'desc', header: 'Description', render: (o) => o.description || '—' },
            {
              key: 'actions',
              header: 'Actions',
              render: (o) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(o)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(o.id)}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title={editing ? 'Edit Organisation' : 'Create Organisation'} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
