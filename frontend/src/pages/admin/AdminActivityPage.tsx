import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchObservations, fetchOpenActions } from '../../api/operations';
import { fetchAllRuns } from '../../api/processRuns';
import { fetchDepartments, fetchOrganisations, fetchPlants, fetchProcessInstances, fetchProcesses } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import type { CorrectiveAction, Observation, ProcessRun } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function AdminActivityPage() {
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [instances, setInstances] = useState<Awaited<ReturnType<typeof fetchProcessInstances>>>([]);
  const [processes, setProcesses] = useState<Awaited<ReturnType<typeof fetchProcesses>>>([]);
  const [plants, setPlants] = useState<Awaited<ReturnType<typeof fetchPlants>>>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [organisations, setOrganisations] = useState<Awaited<ReturnType<typeof fetchOrganisations>>>([]);
  const [stateFilter, setStateFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchAllRuns(),
      fetchProcessInstances(),
      fetchProcesses(),
      fetchPlants(),
      fetchDepartments(),
      fetchOrganisations(),
    ])
      .then(async ([r, insts, procs, plts, depts, orgs]) => {
        setRuns(r);
        setInstances(insts);
        setProcesses(procs);
        setPlants(plts);
        setDepartments(depts);
        setOrganisations(orgs);
        if (plts[0]) {
          const pid = plts[0].id;
          fetchObservations(pid).then(setObservations).catch(() => {});
          fetchOpenActions(pid).then(setActions).catch(() => {});
        }
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const instanceName = (instanceId: string) => instances.find((i) => i.id === instanceId)?.name ?? '—';

  const runContext = (run: ProcessRun) => {
    const instance = instances.find((i) => i.id === run.process_instance_id);
    const process = instance ? processes.find((p) => p.id === instance.process_id) : undefined;
    const dept = process ? departments.find((d) => d.id === process.department_id) : undefined;
    const plant = dept ? plants.find((p) => p.id === dept.plant_id) : undefined;
    const org = plant ? organisations.find((o) => o.id === plant.organisation_id) : undefined;
    return [org?.name, plant?.name, dept?.name, instance?.name].filter(Boolean).join(' → ');
  };

  const filteredRuns = stateFilter ? runs.filter((r) => r.current_state === stateFilter) : runs;
  const states = [...new Set(runs.map((r) => r.current_state))];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity</h1>
          <p className="mt-1 text-sm text-slate-500">All heats, observations, and corrective actions across the platform.</p>
        </div>
        <label className="text-sm text-slate-600">
          Filter by state{' '}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card title="Process runs (heats)">
        <Table
          data={filteredRuns}
          emptyMessage="No heats yet. Workers can start heats from Shift Dashboard."
          columns={[
            {
              key: 'run',
              header: 'Heat',
              render: (r) => (
                <Link to={`/heat/${r.id}`} className="font-medium text-brand-600 hover:underline">
                  {r.run_number}
                </Link>
              ),
            },
            { key: 'instance', header: 'Furnace', render: (r) => instanceName(r.process_instance_id) },
            { key: 'state', header: 'State', render: (r) => <Badge color="blue">{r.current_state}</Badge> },
            { key: 'context', header: 'Location', render: (r) => runContext(r) || '—' },
            {
              key: 'started',
              header: 'Started',
              render: (r) => (r.started_at ? new Date(r.started_at).toLocaleString() : '—'),
            },
          ]}
        />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Observations">
          <div className="space-y-3">
            {observations.map((o) => (
              <div key={o.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <Badge color={o.severity === 'critical' ? 'purple' : 'gray'}>{o.severity}</Badge>
                <p className="mt-2 text-slate-700">{o.description}</p>
              </div>
            ))}
            {observations.length === 0 && <p className="text-sm text-slate-500">No observations recorded.</p>}
          </div>
        </Card>

        <Card title="Open corrective actions">
          <div className="space-y-3">
            {actions.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <p className="font-medium text-slate-800">{a.title}</p>
                  <Badge color="gray">{a.priority}</Badge>
                </div>
                <p className="mt-1 text-slate-500">{a.status}</p>
              </div>
            ))}
            {actions.length === 0 && <p className="text-sm text-slate-500">No open actions.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
