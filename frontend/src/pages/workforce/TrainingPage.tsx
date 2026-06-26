import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchWorkforceEmployees } from '../../api/workforce';
import { createTrainingRecord, fetchTrainingRecords } from '../../api/workforceOps';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

export function TrainingPage() {
  const [error, setError] = useState('');
  const [records, setRecords] = useState<Awaited<ReturnType<typeof fetchTrainingRecords>>>([]);
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof fetchWorkforceEmployees>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    user_id: '',
    name: '',
    certification: '',
    issue_date: '',
    expiry_date: '',
  });

  const load = async () => {
    const [recs, emps] = await Promise.all([
      fetchTrainingRecords({ expiring_soon: false }),
      fetchWorkforceEmployees(),
    ]);
    setRecords(recs);
    setEmployees(emps);
    if (emps[0] && !form.user_id) setForm((f) => ({ ...f, user_id: emps[0].id }));
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const handleSave = async () => {
    try {
      setError('');
      await createTrainingRecord({
        user_id: form.user_id,
        name: form.name,
        certification: form.certification || undefined,
        issue_date: form.issue_date || undefined,
        expiry_date: form.expiry_date || undefined,
      });
      setShowForm(false);
      setRecords(await fetchTrainingRecords());
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const isExpiringSoon = (date?: string | null) => {
    if (!date) return false;
    const exp = new Date(date);
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    return exp <= soon && exp >= new Date();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Training & Certifications</h1>
          <p className="mt-1 text-sm text-slate-500">Track employee training records and certification expiry.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>Add record</Button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={records}
          emptyMessage="No training records."
          columns={[
            { key: 'employee', header: 'Employee', render: (r) => r.user_name ?? r.user_id },
            { key: 'name', header: 'Training', render: (r) => r.name },
            { key: 'cert', header: 'Certification', render: (r) => r.certification ?? '—' },
            { key: 'issue', header: 'Issued', render: (r) => r.issue_date ?? '—' },
            {
              key: 'expiry',
              header: 'Expires',
              render: (r) =>
                r.expiry_date ? (
                  <span className={isExpiringSoon(r.expiry_date) ? 'font-medium text-amber-600' : ''}>
                    {r.expiry_date}
                    {isExpiringSoon(r.expiry_date) && (
                      <span className="ml-2"><Badge color="purple">Soon</Badge></span>
                    )}
                  </span>
                ) : (
                  '—'
                ),
            },
            { key: 'status', header: 'Status', render: (r) => r.status },
          ]}
        />
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <h2 className="mb-4 text-lg font-semibold">Add training record</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600">Employee</span>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </label>
              <Input label="Training name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Certification" value={form.certification} onChange={(e) => setForm({ ...form, certification: e.target.value })} />
              <Input label="Issue date" type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
              <Input label="Expiry date" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
