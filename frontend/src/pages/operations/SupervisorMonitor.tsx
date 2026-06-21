import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllRuns } from '../../api/processRuns';
import {
  createCorrectiveAction,
  createObservation,
  fetchObservations,
  fetchOpenActions,
} from '../../api/operations';
import {
  fetchDepartments,
  fetchPlantUsers,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
} from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { CorrectiveAction, Observation, ProcessRun, User } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

export function SupervisorMonitor() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [instances, setInstances] = useState<Awaited<ReturnType<typeof fetchProcessInstances>>>([]);
  const [processes, setProcesses] = useState<Awaited<ReturnType<typeof fetchProcesses>>>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [plantId, setPlantId] = useState('');
  const [plantUsers, setPlantUsers] = useState<User[]>([]);
  const [stateFilter, setStateFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [error, setError] = useState('');
  const [obsError, setObsError] = useState('');

  const [showObsModal, setShowObsModal] = useState(false);
  const [obsDescription, setObsDescription] = useState('');
  const [obsCategory, setObsCategory] = useState('process');
  const [obsSeverity, setObsSeverity] = useState('medium');
  const [obsRunId, setObsRunId] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  const [actionObservationId, setActionObservationId] = useState<string | null>(null);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [actionAssignee, setActionAssignee] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  const reloadObservations = async (pid: string) => {
    try {
      setObsError('');
      const [obs, acts] = await Promise.all([fetchObservations(pid), fetchOpenActions(pid)]);
      setObservations(obs);
      setActions(acts);
    } catch (e) {
      setObsError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    Promise.all([fetchAllRuns(), fetchProcessInstances(), fetchProcesses(), fetchDepartments(), fetchPlants()])
      .then(async ([r, insts, procs, depts, plants]) => {
        setRuns(r);
        setInstances(insts);
        setProcesses(procs);
        setDepartments(depts);
        const pid = user?.plant_id ?? plants[0]?.id ?? '';
        setPlantId(pid);
        if (pid) {
          await reloadObservations(pid);
          fetchPlantUsers(pid).then(setPlantUsers).catch(() => {});
        }
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [user?.plant_id]);

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

  const submitObservation = async () => {
    if (!plantId || !obsDescription.trim()) return;
    setSavingObs(true);
    try {
      await createObservation({
        plant_id: plantId,
        run_id: obsRunId || undefined,
        category: obsCategory,
        description: obsDescription.trim(),
        severity: obsSeverity,
      });
      setShowObsModal(false);
      setObsDescription('');
      setObsRunId('');
      await reloadObservations(plantId);
    } catch (e) {
      setObsError(getErrorMessage(e));
    } finally {
      setSavingObs(false);
    }
  };

  const submitAction = async () => {
    if (!actionObservationId || !actionTitle.trim() || !actionAssignee) return;
    setSavingAction(true);
    try {
      await createCorrectiveAction(actionObservationId, {
        title: actionTitle.trim(),
        description: actionDescription.trim() || undefined,
        assigned_to: actionAssignee,
      });
      setActionObservationId(null);
      setActionTitle('');
      setActionDescription('');
      setActionAssignee('');
      if (plantId) await reloadObservations(plantId);
    } catch (e) {
      setObsError(getErrorMessage(e));
    } finally {
      setSavingAction(false);
    }
  };

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
          <Button onClick={() => setShowObsModal(true)}>Raise observation</Button>
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
      {obsError && <p className="mb-4 text-sm text-red-600">{obsError}</p>}

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
                <div className="flex items-center justify-between gap-2">
                  <Badge color={o.severity === 'critical' ? 'purple' : 'gray'}>{o.severity}</Badge>
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => {
                      setActionObservationId(o.id);
                      setActionTitle('');
                      setActionDescription('');
                      setActionAssignee('');
                    }}
                  >
                    Add action
                  </Button>
                </div>
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

      {showObsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Raise observation</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                Category
                <select
                  value={obsCategory}
                  onChange={(e) => setObsCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="process">Process</option>
                  <option value="safety">Safety</option>
                  <option value="quality">Quality</option>
                  <option value="equipment">Equipment</option>
                </select>
              </label>
              <label className="block text-sm">
                Severity
                <select
                  value={obsSeverity}
                  onChange={(e) => setObsSeverity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="block text-sm">
                Related run (optional)
                <select
                  value={obsRunId}
                  onChange={(e) => setObsRunId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {runs.slice(0, 50).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.run_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Description
                <textarea
                  value={obsDescription}
                  onChange={(e) => setObsDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowObsModal(false)}>
                Cancel
              </Button>
              <Button onClick={submitObservation} disabled={savingObs || !obsDescription.trim()}>
                {savingObs ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {actionObservationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Create corrective action</h2>
            <div className="mt-4 space-y-3">
              <Input label="Title" value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} />
              <label className="block text-sm">
                Description
                <textarea
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                Assign to
                <select
                  value={actionAssignee}
                  onChange={(e) => setActionAssignee(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {plantUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setActionObservationId(null)}>
                Cancel
              </Button>
              <Button
                onClick={submitAction}
                disabled={savingAction || !actionTitle.trim() || !actionAssignee}
              >
                {savingAction ? 'Saving…' : 'Create action'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
