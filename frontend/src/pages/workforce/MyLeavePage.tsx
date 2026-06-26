import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import {
  createLeaveRequest,
  fetchLeaveTypes,
  fetchMyLeaveRequests,
} from '../../api/workforceOps';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

export function MyLeavePage() {
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchMyLeaveRequests>>>([]);
  const [types, setTypes] = useState<Awaited<ReturnType<typeof fetchLeaveTypes>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    leave_type_id: '',
    from_date: '',
    to_date: '',
    remarks: '',
  });

  const load = async () => {
    const [reqs, t] = await Promise.all([fetchMyLeaveRequests(), fetchLeaveTypes()]);
    setRequests(reqs);
    setTypes(t);
    if (t[0] && !form.leave_type_id) setForm((f) => ({ ...f, leave_type_id: t[0].id }));
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      setError('');
      await createLeaveRequest(form);
      setShowForm(false);
      setForm({ leave_type_id: types[0]?.id ?? '', from_date: '', to_date: '', remarks: '' });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Leave</h1>
          <p className="mt-1 text-sm text-slate-500">Apply for leave and track request status.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>Apply for leave</Button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={requests}
          emptyMessage="No leave requests yet."
          columns={[
            { key: 'type', header: 'Type', render: (r) => r.leave_type_name ?? '—' },
            { key: 'from', header: 'From', render: (r) => r.from_date },
            { key: 'to', header: 'To', render: (r) => r.to_date },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge color={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'purple' : 'gray'}>
                  {r.status}
                </Badge>
              ),
            },
            { key: 'remarks', header: 'Remarks', render: (r) => r.remarks ?? '—' },
          ]}
        />
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <h2 className="mb-4 text-lg font-semibold">Apply for leave</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600">Leave type</span>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form.leave_type_id}
                  onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <Input label="From date" type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} />
              <Input label="To date" type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} />
              <Input label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
