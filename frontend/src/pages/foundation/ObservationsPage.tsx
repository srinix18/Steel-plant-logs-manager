import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  createFoundationCorrectiveAction,
  createFoundationObservation,
  fetchFoundationCorrectiveActions,
  fetchFoundationObservations,
  updateFoundationCorrectiveAction,
} from '../../api/foundation';
import { fetchPlants, fetchPlantUsers } from '../../api/platform';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

export function ObservationsPage() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [observations, setObservations] = useState<Awaited<ReturnType<typeof fetchFoundationObservations>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'equipment',
    severity: 'medium',
    department_id: user?.department_id || '',
  });

  const load = async () => {
    const plants = await fetchPlants();
    const pid = plantId || plants[0]?.id || '';
    if (!plantId && pid) setPlantId(pid);
    setObservations(await fetchFoundationObservations({ plant_id: pid || undefined }));
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  const submit = async () => {
    await createFoundationObservation({
      plant_id: plantId,
      title: form.title,
      description: form.description,
      category: form.category,
      severity: form.severity,
      department_id: form.department_id || undefined,
    });
    setShowForm(false);
    setForm({ title: '', description: '', category: 'equipment', severity: 'medium', department_id: user?.department_id || '' });
    await load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Observations</h1>
          <p className="mt-1 text-sm text-slate-500">Operational issues and findings.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>New observation</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="mb-4">
        <Card>
          <div className="space-y-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="w-full rounded border px-3 py-2 text-sm" rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <select className="rounded border px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['quality', 'safety', 'energy', 'equipment', 'process'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="rounded border px-3 py-2 text-sm" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {['low', 'medium', 'high', 'critical'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={submit}>Save</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
          </div>
        </Card>
        </div>
      )}

      <Card>
        <Table
          data={observations}
          emptyMessage="No observations yet."
          columns={[
            { key: 'title', header: 'Title', render: (o) => o.title || o.description.slice(0, 40) },
            { key: 'category', header: 'Category', render: (o) => o.category },
            { key: 'severity', header: 'Severity', render: (o) => o.severity },
            { key: 'status', header: 'Status', render: (o) => o.status },
            { key: 'when', header: 'Observed', render: (o) => new Date(o.observed_at).toLocaleString() },
          ]}
        />
      </Card>
    </div>
  );
}

export function CorrectiveActionsPage() {
  const [error, setError] = useState('');
  const [actions, setActions] = useState<Awaited<ReturnType<typeof fetchFoundationCorrectiveActions>>>([]);
  const [observations, setObservations] = useState<Awaited<ReturnType<typeof fetchFoundationObservations>>>([]);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof fetchPlantUsers>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ observation_id: '', title: '', assigned_to: '', due_date: '' });

  const load = async () => {
    const plants = await fetchPlants();
    const pid = plants[0]?.id || '';
    const [a, o, u] = await Promise.all([
      fetchFoundationCorrectiveActions(),
      fetchFoundationObservations(),
      pid ? fetchPlantUsers(pid).catch(() => []) : Promise.resolve([]),
    ]);
    setActions(a);
    setObservations(o);
    setUsers(u);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const submit = async () => {
    await createFoundationCorrectiveAction(form.observation_id, {
      title: form.title,
      assigned_to: form.assigned_to,
      due_date: form.due_date || undefined,
    });
    setShowForm(false);
    await load();
  };

  const closeAction = async (id: string) => {
    await updateFoundationCorrectiveAction(id, { status: 'closed', closure_notes: 'Completed via foundation UI' });
    await load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Corrective Actions</h1>
          <p className="mt-1 text-sm text-slate-500">Track actions from observations.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>New action</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="mb-4">
        <Card>
          <div className="space-y-3">
          <select className="w-full rounded border px-3 py-2 text-sm" value={form.observation_id} onChange={(e) => setForm({ ...form, observation_id: e.target.value })}>
            <option value="">Select observation</option>
            {observations.map((o) => <option key={o.id} value={o.id}>{o.title || o.description.slice(0, 50)}</option>)}
          </select>
          <Input placeholder="Action title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="w-full rounded border px-3 py-2 text-sm" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
            <option value="">Assign to</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <div className="flex gap-2">
            <Button onClick={submit}>Save</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
          </div>
        </Card>
        </div>
      )}

      <Card>
        <Table
          data={actions}
          emptyMessage="No corrective actions."
          columns={[
            { key: 'title', header: 'Action', render: (a) => a.title },
            { key: 'obs', header: 'Observation', render: (a) => a.observation_title || '—' },
            { key: 'status', header: 'Status', render: (a) => a.status },
            { key: 'due', header: 'Due', render: (a) => a.due_date || '—' },
            {
              key: 'close',
              header: '',
              render: (a) =>
                a.status !== 'closed' ? (
                  <button type="button" className="text-sm text-brand-600" onClick={() => closeAction(a.id).catch((e) => setError(getErrorMessage(e)))}>
                    Close
                  </button>
                ) : null,
            },
          ]}
        />
      </Card>
    </div>
  );
}
