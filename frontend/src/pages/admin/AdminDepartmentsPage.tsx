import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDepartments, fetchOrganisations, fetchPlants, fetchProcesses } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import type { Department, Organisation, Plant, Process } from '../../types';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [orgFilter, setOrgFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchDepartments(), fetchOrganisations(), fetchPlants(), fetchProcesses()])
      .then(([depts, orgs, plts, procs]) => {
        setDepartments(depts);
        setOrganisations(orgs);
        setPlants(plts);
        setProcesses(procs);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const filtered = useMemo(
    () => (orgFilter ? departments.filter((d) => d.organisation_id === orgFilter) : departments),
    [departments, orgFilter],
  );

  const orgName = (id: string) => organisations.find((o) => o.id === id)?.name ?? '—';
  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '—';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="mt-1 text-sm text-slate-500">Every department across all organisations.</p>
        </div>
        <label className="text-sm text-slate-600">
          Filter by organisation{' '}
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All organisations</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={filtered}
          emptyMessage="No departments found."
          columns={[
            { key: 'name', header: 'Department', render: (d) => d.name },
            { key: 'code', header: 'Code', render: (d) => d.code },
            { key: 'org', header: 'Organisation', render: (d) => orgName(d.organisation_id) },
            { key: 'plant', header: 'Plant', render: (d) => plantName(d.plant_id) },
            {
              key: 'processes',
              header: 'Processes',
              render: (d) => {
                const procs = processes.filter((p) => p.department_id === d.id);
                return procs.length ? procs.map((p) => `${p.code} (${p.name})`).join(' · ') : '—';
              },
            },
            {
              key: 'sheet',
              header: 'Log sheet',
              render: (d) => {
                const eaf = processes.find((p) => p.department_id === d.id && p.code === 'EAF');
                if (!eaf) return '—';
                return (
                  <Link to="/admin/sheets?doc=F/PRD/02" className="text-brand-600 hover:underline">
                    Furnace Log F/PRD/02
                  </Link>
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
