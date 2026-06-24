import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { createKpiDefinition, fetchKpiDefinitionsAdmin } from '../../api/foundation';
import { fetchDepartments } from '../../api/platform';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { isCeoTier } from '../../utils/roles';

export function AnalyticsPage() {
  const { user } = useAuth();
  const canWrite = user ? isCeoTier(user.role) : false;
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState<Awaited<ReturnType<typeof fetchKpiDefinitionsAdmin>>>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', formula: '', target_value: '', frequency: 'shift', department_id: '' });

  const load = async () => {
    const [k, d] = await Promise.all([fetchKpiDefinitionsAdmin(), fetchDepartments()]);
    setKpis(k);
    setDepartments(d);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const submit = async () => {
    await createKpiDefinition({
      code: form.code,
      name: form.name,
      formula: form.formula,
      target_value: form.target_value ? Number(form.target_value) : undefined,
      frequency: form.frequency,
      department_id: form.department_id || undefined,
    });
    setShowForm(false);
    await load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics Foundation</h1>
          <p className="mt-1 text-sm text-slate-500">KPI definitions (stored only — no auto-calculation yet).</p>
        </div>
        {canWrite && <Button onClick={() => setShowForm(true)}>Add KPI</Button>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="mb-4">
        <Card>
          <div className="space-y-3">
          <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea className="w-full rounded border px-3 py-2 text-sm" rows={2} placeholder="Formula (text only)" value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })} />
          <Input placeholder="Target value" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
          <select className="w-full rounded border px-3 py-2 text-sm" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
            {['shift', 'daily', 'weekly', 'monthly'].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className="w-full rounded border px-3 py-2 text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
          <Button onClick={submit}>Save</Button>
          </div>
        </Card>
        </div>
      )}

      <Card>
        <Table
          data={kpis}
          emptyMessage="No KPI definitions."
          columns={[
            { key: 'code', header: 'Code', render: (k) => k.code },
            { key: 'name', header: 'Name', render: (k) => k.name },
            { key: 'formula', header: 'Formula', render: (k) => <span className="font-mono text-xs">{k.formula}</span> },
            { key: 'target', header: 'Target', render: (k) => k.target_value ?? '—' },
            { key: 'freq', header: 'Frequency', render: (k) => k.frequency || '—' },
          ]}
        />
      </Card>
    </div>
  );
}
