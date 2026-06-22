import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllRuns } from '../../api/processRuns';
import {
  createMaintenanceIssue,
  fetchMaintenanceCategories,
  fetchMaintenanceIssues,
  type IssueCategory,
  type IssueSeverity,
  type MaintenanceIssue,
} from '../../api/maintenance';
import {
  fetchDepartments,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
} from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { ProcessRun } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';

export function SupervisorMonitor() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [instances, setInstances] = useState<Awaited<ReturnType<typeof fetchProcessInstances>>>([]);
  const [processes, setProcesses] = useState<Awaited<ReturnType<typeof fetchProcesses>>>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [plantId, setPlantId] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintCategories, setMaintCategories] = useState<{ value: IssueCategory; label: string }[]>([]);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDescription, setMaintDescription] = useState('');
  const [maintCategory, setMaintCategory] = useState<IssueCategory>('equipment');
  const [maintSeverity, setMaintSeverity] = useState<IssueSeverity>('medium');
  const [maintRunId, setMaintRunId] = useState('');
  const [savingMaint, setSavingMaint] = useState(false);
  const [openMaintIssues, setOpenMaintIssues] = useState<MaintenanceIssue[]>([]);

  useEffect(() => {
    Promise.all([fetchAllRuns(), fetchProcessInstances(), fetchProcesses(), fetchDepartments(), fetchPlants()])
      .then(([r, insts, procs, depts, plants]) => {
        setRuns(r);
        setInstances(insts);
        setProcesses(procs);
        setDepartments(depts);
        const pid = user?.plant_id ?? plants[0]?.id ?? '';
        setPlantId(pid);
      })
      .catch((e) => setError(getErrorMessage(e)));
    fetchMaintenanceCategories().then(setMaintCategories).catch(() => {});
    fetchMaintenanceIssues({ status: 'open' }).then(setOpenMaintIssues).catch(() => {});
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

  const submitMaintenanceIssue = async () => {
    if (!plantId || !maintTitle.trim() || !maintDescription.trim()) return;
    setSavingMaint(true);
    try {
      setFormError('');
      await createMaintenanceIssue({
        plant_id: plantId,
        run_id: maintRunId || undefined,
        title: maintTitle.trim(),
        description: maintDescription.trim(),
        category: maintCategory,
        severity: maintSeverity,
      });
      setShowMaintModal(false);
      setMaintTitle('');
      setMaintDescription('');
      setMaintRunId('');
      fetchMaintenanceIssues({ status: 'open' }).then(setOpenMaintIssues).catch(() => {});
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSavingMaint(false);
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
          <Button onClick={() => setShowMaintModal(true)}>Raise maintenance issue</Button>
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
      {formError && <p className="mb-4 text-sm text-red-600">{formError}</p>}

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

      {openMaintIssues.length > 0 && (
        <div className="mt-6">
          <Card title={`Open maintenance issues (${openMaintIssues.length})`}>
            <div className="space-y-2">
              {openMaintIssues.slice(0, 8).map((issue) => (
                <div key={issue.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{issue.title}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {issue.category} · {issue.raised_by_user?.full_name ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color="blue">{issue.status.replace(/_/g, ' ')}</Badge>
                      {issue.run_id && (
                        <Link to={`/reports/${issue.run_id}`} className="text-xs text-brand-600 hover:underline">
                          Run
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {showMaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Raise maintenance issue</h2>
            <p className="mt-1 text-xs text-slate-500">Routed to the maintenance crew for the selected category.</p>
            <div className="mt-4 space-y-3">
              <Input label="Title" value={maintTitle} onChange={(e) => setMaintTitle(e.target.value)} />
              <label className="block text-sm">
                Category
                <select
                  value={maintCategory}
                  onChange={(e) => setMaintCategory(e.target.value as IssueCategory)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {(maintCategories.length ? maintCategories : [
                    { value: 'quality', label: 'Quality' },
                    { value: 'safety', label: 'Safety' },
                    { value: 'energy', label: 'Energy' },
                    { value: 'equipment', label: 'Equipment' },
                    { value: 'process', label: 'Process' },
                  ]).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Severity
                <select
                  value={maintSeverity}
                  onChange={(e) => setMaintSeverity(e.target.value as IssueSeverity)}
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
                  value={maintRunId}
                  onChange={(e) => setMaintRunId(e.target.value)}
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
                  value={maintDescription}
                  onChange={(e) => setMaintDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowMaintModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitMaintenanceIssue}
                disabled={savingMaint || !maintTitle.trim() || !maintDescription.trim()}
              >
                {savingMaint ? 'Submitting…' : 'Submit issue'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
