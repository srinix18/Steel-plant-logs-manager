import { useEffect, useState } from 'react';
import {
  fetchDepartments,
  fetchOrganisations,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
} from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import type { Department, Organisation, Plant, Process, ProcessInstance } from '../../types';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function AdminOrganisationsPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchOrganisations(),
      fetchPlants(),
      fetchDepartments(),
      fetchProcesses(),
      fetchProcessInstances(),
    ])
      .then(([orgs, plts, depts, procs, insts]) => {
        setOrganisations(orgs);
        setPlants(plts);
        setDepartments(depts);
        setProcesses(procs);
        setInstances(insts);
        if (orgs[0]) setSelectedOrgId(orgs[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const selectedOrg = organisations.find((o) => o.id === selectedOrgId);
  const orgPlants = plants.filter((p) => p.organisation_id === selectedOrgId);
  const orgDepts = departments.filter((d) => d.organisation_id === selectedOrgId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Organisations</h1>
        <p className="mt-1 text-sm text-slate-500">All organisations, plants, and departments in the platform.</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="All organisations">
          <div className="space-y-2">
            {organisations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => setSelectedOrgId(org.id)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  selectedOrgId === org.id
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="font-medium text-slate-900">{org.name}</p>
                <p className="text-xs text-slate-500">{org.code}</p>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {selectedOrg && (
            <>
              <Card title={`${selectedOrg.name} — Plants`}>
                <Table
                  data={orgPlants}
                  emptyMessage="No plants in this organisation."
                  columns={[
                    { key: 'name', header: 'Plant', render: (p) => p.name },
                    { key: 'code', header: 'Code', render: (p) => p.code },
                    { key: 'timezone', header: 'Timezone', render: (p) => p.timezone },
                  ]}
                />
              </Card>

              <Card title={`${selectedOrg.name} — Departments`}>
                <Table
                  data={orgDepts}
                  emptyMessage="No departments in this organisation."
                  columns={[
                    { key: 'name', header: 'Department', render: (d) => d.name },
                    { key: 'code', header: 'Code', render: (d) => d.code },
                    {
                      key: 'plant',
                      header: 'Plant',
                      render: (d) => plants.find((p) => p.id === d.plant_id)?.name ?? '—',
                    },
                    {
                      key: 'processes',
                      header: 'Processes',
                      render: (d) => {
                        const procs = processes.filter((p) => p.department_id === d.id);
                        return procs.map((p) => p.code).join(', ') || '—';
                      },
                    },
                  ]}
                />
              </Card>

              <Card title="Equipment instances">
                <Table
                  data={instances.filter((i) => {
                    const proc = processes.find((p) => p.id === i.process_id);
                    return proc && orgDepts.some((d) => d.id === proc.department_id);
                  })}
                  emptyMessage="No process instances configured."
                  columns={[
                    { key: 'name', header: 'Instance', render: (i) => i.name },
                    {
                      key: 'process',
                      header: 'Process',
                      render: (i) => processes.find((p) => p.id === i.process_id)?.code ?? '—',
                    },
                    { key: 'status', header: 'Status', render: (i) => i.status },
                  ]}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
