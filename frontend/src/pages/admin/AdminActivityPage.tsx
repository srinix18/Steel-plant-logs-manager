import { useEffect, useMemo, useState } from 'react';
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
  const [orgFilter, setOrgFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
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
          fetchObservations(plts[0].id).then(setObservations).catch(() => {});
          fetchOpenActions(plts[0].id).then(setActions).catch(() => {});
        }
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const runMeta = (run: ProcessRun) => {
    const instance = instances.find((i) => i.id === run.process_instance_id);
    const process = instance ? processes.find((p) => p.id === instance.process_id) : undefined;
    const dept = process ? departments.find((d) => d.id === process.department_id) : undefined;
    const plant = dept ? plants.find((p) => p.id === dept.plant_id) : undefined;
    const org = plant ? organisations.find((o) => o.id === plant.organisation_id) : undefined;
    return { instance, process, dept, plant, org };
  };

  const runContext = (run: ProcessRun) => {
    const { org, plant, dept, instance } = runMeta(run);
    return [org?.name, plant?.name, dept?.name, instance?.name].filter(Boolean).join(' → ');
  };

  const departmentsForOrg = useMemo(
    () => (orgFilter ? departments.filter((d) => d.organisation_id === orgFilter) : departments),
    [departments, orgFilter],
  );

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const { org, dept, process } = runMeta(run);
      if (orgFilter && org?.id !== orgFilter) return false;
      if (deptFilter && dept?.id !== deptFilter) return false;
      if (processFilter && process?.code !== processFilter) return false;
      if (stateFilter && run.current_state !== stateFilter) return false;
      return true;
    });
  }, [runs, orgFilter, deptFilter, processFilter, stateFilter, instances, processes, departments, organisations, plants]);

  const states = [...new Set(runs.map((r) => r.current_state))];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity</h1>
          <p className="mt-1 text-sm text-slate-500">
            All production runs across the platform. Click a run to open its consolidated report.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-slate-600">
            Organisation{' '}
            <select
              value={orgFilter}
              onChange={(e) => {
                setOrgFilter(e.target.value);
                setDeptFilter('');
              }}
              className="ml-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="">All</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Department{' '}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="ml-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="">All</option>
              {departmentsForOrg.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Process{' '}
            <select
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              className="ml-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="">All</option>
              {processes.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            State{' '}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="ml-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="">All</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card title="Process runs">
        <Table
          data={filteredRuns}
          emptyMessage="No runs match the selected filters."
          columns={[
            {
              key: 'run',
              header: 'Run',
              render: (r) => (
                <Link to={`/reports/${r.id}`} className="font-medium text-brand-600 hover:underline">
                  {r.run_number}
                </Link>
              ),
            },
            {
              key: 'process',
              header: 'Process',
              render: (r) => runMeta(r).process?.name ?? '—',
            },
            {
              key: 'type',
              header: 'Type',
              render: (r) => r.run_type.replace(/_/g, ' '),
            },
            {
              key: 'instance',
              header: 'Line / Unit',
              render: (r) => runMeta(r).instance?.name ?? '—',
            },
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
