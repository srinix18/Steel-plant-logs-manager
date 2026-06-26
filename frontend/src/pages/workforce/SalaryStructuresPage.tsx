import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchPlantUsers, fetchPlants } from '../../api/platform';
import {
  createSalaryStructure,
  fetchSalaryStructures,
  formatCurrency,
} from '../../api/workforceOps';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

const emptyForm = () => ({
  user_id: '',
  basic: '25000',
  hra: '8000',
  allowances: '2000',
  pf: '1800',
  esi: '500',
  other_deductions: '200',
  effective_from: new Date().toISOString().slice(0, 10),
});

export function SalaryStructuresPage() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof fetchPlantUsers>>>([]);
  const [structures, setStructures] = useState<Awaited<ReturnType<typeof fetchSalaryStructures>>>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setStructures(await fetchSalaryStructures());
  };

  useEffect(() => {
    fetchPlants()
      .then((p) => {
        if (p[0]) fetchPlantUsers(p[0].id).then(setEmployees).catch(() => {});
      })
      .catch((e) => setError(getErrorMessage(e)));
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const handleCreate = async () => {
    if (!form.user_id) {
      setError('Select an employee');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createSalaryStructure({
        user_id: form.user_id,
        basic: Number(form.basic) || 0,
        hra: Number(form.hra) || 0,
        allowances: Number(form.allowances) || 0,
        pf: Number(form.pf) || 0,
        esi: Number(form.esi) || 0,
        other_deductions: Number(form.other_deductions) || 0,
        effective_from: form.effective_from,
      });
      setMessage('Salary structure saved.');
      setForm(emptyForm());
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const gross = (s: (typeof structures)[0]) => s.basic + s.hra + s.allowances;
  const deductions = (s: (typeof structures)[0]) => s.pf + s.esi + s.other_deductions;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salary Structures</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assign pay components before running monthly payroll.
          </p>
        </div>
        <Link to="/workforce/payroll">
          <Button variant="secondary">Go to Payroll</Button>
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {message && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Add salary structure</h2>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-slate-600">Employee</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              >
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.email})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Basic (₹)" type="number" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} />
              <Input label="HRA (₹)" type="number" value={form.hra} onChange={(e) => setForm({ ...form, hra: e.target.value })} />
              <Input label="Allowances (₹)" type="number" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} />
              <Input label="PF (₹)" type="number" value={form.pf} onChange={(e) => setForm({ ...form, pf: e.target.value })} />
              <Input label="ESI (₹)" type="number" value={form.esi} onChange={(e) => setForm({ ...form, esi: e.target.value })} />
              <Input label="Other deductions (₹)" type="number" value={form.other_deductions} onChange={(e) => setForm({ ...form, other_deductions: e.target.value })} />
            </div>
            <Input label="Effective from" type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving…' : 'Save structure'}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Current structures ({structures.length})</h2>
          <Table
            data={structures}
            emptyMessage="No salary structures yet."
            columns={[
              { key: 'name', header: 'Employee', render: (s) => s.user_name ?? s.user_id },
              { key: 'basic', header: 'Basic', render: (s) => formatCurrency(s.basic) },
              { key: 'gross', header: 'Monthly gross', render: (s) => formatCurrency(gross(s)) },
              { key: 'ded', header: 'Deductions', render: (s) => formatCurrency(deductions(s)) },
              { key: 'from', header: 'From', render: (s) => s.effective_from },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
