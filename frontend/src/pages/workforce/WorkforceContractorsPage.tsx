import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchDepartments } from '../../api/platform';
import {
  createContractWorker,
  createContractor,
  fetchContractWorkers,
  fetchContractors,
  updateContractor,
} from '../../api/workforce';
import type { Contractor, ContractWorker } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

export function WorkforceContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [workers, setWorkers] = useState<ContractWorker[]>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'contractors' | 'workers'>('contractors');
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [contractorForm, setContractorForm] = useState({
    code: '',
    name: '',
    contact_person: '',
    phone: '',
  });
  const [workerForm, setWorkerForm] = useState({
    contractor_id: '',
    full_name: '',
    department_id: '',
    phone: '',
  });

  const load = async () => {
    const [c, w, d] = await Promise.all([
      fetchContractors(),
      fetchContractWorkers(),
      fetchDepartments(),
    ]);
    setContractors(c);
    setWorkers(w);
    setDepartments(d);
    if (!workerForm.contractor_id && c[0]) {
      setWorkerForm((f) => ({ ...f, contractor_id: c[0].id }));
    }
    if (!workerForm.department_id && d[0]) {
      setWorkerForm((f) => ({ ...f, department_id: d[0].id }));
    }
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, []);

  const saveContractor = async () => {
    try {
      setError('');
      await createContractor(contractorForm);
      setShowContractorModal(false);
      setContractorForm({ code: '', name: '', contact_person: '', phone: '' });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const saveWorker = async () => {
    try {
      setError('');
      await createContractWorker(workerForm);
      setShowWorkerModal(false);
      setWorkerForm((f) => ({ ...f, full_name: '', phone: '' }));
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contractors</h1>
          <p className="mt-1 text-sm text-slate-500">Contractor companies and contract workers.</p>
        </div>
        <div className="flex gap-2">
          {tab === 'contractors' ? (
            <Button onClick={() => setShowContractorModal(true)}>Add contractor</Button>
          ) : (
            <Button onClick={() => setShowWorkerModal(true)}>Add contract worker</Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Button variant={tab === 'contractors' ? 'primary' : 'secondary'} onClick={() => setTab('contractors')}>
          Contractors
        </Button>
        <Button variant={tab === 'workers' ? 'primary' : 'secondary'} onClick={() => setTab('workers')}>
          Contract workers
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {tab === 'contractors' ? (
        <Card>
          <Table
            data={contractors}
            emptyMessage="No contractors yet."
            columns={[
              { key: 'code', header: 'Code', render: (c) => c.code },
              { key: 'name', header: 'Name', render: (c) => c.name },
              { key: 'contact', header: 'Contact', render: (c) => c.contact_person ?? '—' },
              { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—' },
              {
                key: 'active',
                header: 'Active',
                render: (c) => (
                  <button
                    type="button"
                    className="text-sm text-brand-600"
                    onClick={() =>
                      updateContractor(c.id, { is_active: !c.is_active }).then(load).catch((e) =>
                        setError(getErrorMessage(e))
                      )
                    }
                  >
                    {c.is_active ? 'Yes' : 'No'}
                  </button>
                ),
              },
            ]}
          />
        </Card>
      ) : (
        <Card>
          <Table
            data={workers}
            emptyMessage="No contract workers yet."
            columns={[
              { key: 'name', header: 'Name', render: (w) => w.full_name },
              { key: 'contractor', header: 'Contractor', render: (w) => w.contractor_name ?? '—' },
              { key: 'dept', header: 'Department', render: (w) => w.department_code ?? '—' },
              { key: 'phone', header: 'Phone', render: (w) => w.phone ?? '—' },
            ]}
          />
        </Card>
      )}

      {showContractorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Add contractor</h2>
            <div className="space-y-3">
              <Input label="Code" value={contractorForm.code} onChange={(e) => setContractorForm({ ...contractorForm, code: e.target.value })} />
              <Input label="Name" value={contractorForm.name} onChange={(e) => setContractorForm({ ...contractorForm, name: e.target.value })} />
              <Input label="Contact person" value={contractorForm.contact_person} onChange={(e) => setContractorForm({ ...contractorForm, contact_person: e.target.value })} />
              <Input label="Phone" value={contractorForm.phone} onChange={(e) => setContractorForm({ ...contractorForm, phone: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowContractorModal(false)}>Cancel</Button>
              <Button onClick={saveContractor}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {showWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Add contract worker</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600">Contractor</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={workerForm.contractor_id}
                  onChange={(e) => setWorkerForm({ ...workerForm, contractor_id: e.target.value })}
                >
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <Input label="Worker name" value={workerForm.full_name} onChange={(e) => setWorkerForm({ ...workerForm, full_name: e.target.value })} />
              <label className="block text-sm">
                <span className="text-slate-600">Department</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={workerForm.department_id}
                  onChange={(e) => setWorkerForm({ ...workerForm, department_id: e.target.value })}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <Input label="Phone" value={workerForm.phone} onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowWorkerModal(false)}>Cancel</Button>
              <Button onClick={saveWorker}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
