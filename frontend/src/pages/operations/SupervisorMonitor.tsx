import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllRuns } from '../../api/processRuns';
import { fetchObservations, fetchOpenActions } from '../../api/operations';
import { fetchDepartments, fetchPlants, fetchProcessInstances, fetchProcesses } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import type { CorrectiveAction, Observation, ProcessRun } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';

export function SupervisorMonitor() {
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [instances, setInstances] = useState<Awaited<ReturnType<typeof fetchProcessInstances>>>([]);
  const [processes, setProcesses] = useState<Awaited<ReturnType<typeof fetchProcesses>>>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [stateFilter, setStateFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchAllRuns(), fetchProcessInstances(), fetchProcesses(), fetchDepartments(), fetchPlants()])
      .then(async ([r, insts, procs, depts, plants]) => {
        setRuns(r);
        setInstances(insts);
        setProcesses(procs);
        setDepartments(depts);
        if (plants[0]) {
          fetchObservations(plants[0].id).then(setObservations).catch(() => {});
          fetchOpenActions(plants[0].id).then(setActions).catch(() => {});
        }
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const runMeta = (run: ProcessRun) => {
    const instance = instances.find((i) => i.id === run.process_instance_id);
    const process = instance ? processes.find((p) => p.id === instance.process_id) : undefined;
    const dept = process ? departments.find((d) => d.id === process.department_id) : undefined;
    return { instance, process, dept };
  };

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const { process } = runMeta(run);
      if (processFilter && process?.code !== processFilter) return false;
      if (stateFilter && run.current_state !== stateFilter) return false;
      return true;
    });
  }, [runs, processFilter, stateFilter, instances, processes, departments]);

  const states = [...new Set(runs.map((r) => r.current_state))];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations Activity</h1>
          <p className="mt-1 text-sm text-slate-500">
            Runs in your plant/department scope. Open a consolidated report or use Shift Dashboard to edit.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
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
                  {p.code}
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

      <Card title="Production runs">
        <Table
          data={filteredRuns}
          emptyMessage="No runs in your scope."
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
              key: 'line',
              header: 'Line',
              render: (r) => runMeta(r).instance?.name ?? '—',
            },
            {
              key: 'state',
              header: 'State',
              render: (r) => <Badge color="blue">{r.current_state}</Badge>,
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <Link to={`/heat/${r.id}`} className="text-sm text-slate-600 hover:text-brand-600">
                  Workspace
                </Link>
              ),
            },
          ]}
        />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Observations">
          <div className="space-y-2">
            {observations.slice(0, 8).map((o) => (
              <div key={o.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <Badge color={o.severity === 'critical' ? 'purple' : 'gray'}>{o.severity}</Badge>
                <p className="mt-1 text-slate-700">{o.description}</p>
              </div>
            ))}
            {observations.length === 0 && <p className="text-sm text-slate-500">No observations.</p>}
          </div>
        </Card>

        <Card title="Open corrective actions">
          <div className="space-y-2">
            {actions.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium">{a.title}</p>
                <Badge color="gray">{a.status}</Badge>
              </div>
            ))}
            {actions.length === 0 && <p className="text-sm text-slate-500">No open actions.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
