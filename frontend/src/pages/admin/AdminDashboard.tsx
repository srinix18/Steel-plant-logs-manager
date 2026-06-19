import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboardMetrics } from '../../api/operations';
import { fetchAllRuns } from '../../api/processRuns';
import {
  fetchDepartments,
  fetchOrganisations,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
} from '../../api/platform';
import { fetchTemplates } from '../../api/templatesMoi';
import { getErrorMessage } from '../../api/client';
import type { DashboardMetrics, ProcessRun, TemplateSummary } from '../../types';
import { OrgHierarchyCard } from '../../components/admin/OrgHierarchyTree';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

const metricCards = [
  { key: 'total_organisations' as const, label: 'Organisations', color: 'text-indigo-600' },
  { key: 'total_plants' as const, label: 'Plants', color: 'text-purple-600' },
  { key: 'active_runs' as const, label: 'Active Heats', color: 'text-blue-600' },
  { key: 'open_observations' as const, label: 'Open Observations', color: 'text-orange-600' },
  { key: 'open_corrective_actions' as const, label: 'Open Actions', color: 'text-red-600' },
];

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [organisations, setOrganisations] = useState<Awaited<ReturnType<typeof fetchOrganisations>>>([]);
  const [plants, setPlants] = useState<Awaited<ReturnType<typeof fetchPlants>>>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [processes, setProcesses] = useState<Awaited<ReturnType<typeof fetchProcesses>>>([]);
  const [instances, setInstances] = useState<Awaited<ReturnType<typeof fetchProcessInstances>>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchDashboardMetrics(),
      fetchAllRuns(),
      fetchTemplates(),
      fetchOrganisations(),
      fetchPlants(),
      fetchDepartments(),
      fetchProcesses(),
      fetchProcessInstances(),
    ])
      .then(([m, r, t, orgs, plts, depts, procs, insts]) => {
        setMetrics(m);
        setRuns(r.slice(0, 8));
        setTemplates(t);
        setOrganisations(orgs);
        setPlants(plts);
        setDepartments(depts);
        setProcesses(procs);
        setInstances(insts);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const furnaceLog = templates.find((t) => t.doc_no === 'F/PRD/02');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cross-organisation view of plants, departments, log sheets, and live activity.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metricCards.map(({ key, label, color }) => (
          <Card key={key}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{metrics ? metrics[key] : '—'}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <OrgHierarchyCard
            organisations={organisations}
            plants={plants}
            departments={departments}
            processes={processes}
            instances={instances}
          />
        </div>

        <div className="space-y-6">
          <Card title="Log sheets">
            {templates.length === 0 ? (
              <p className="text-sm text-slate-500">No templates configured.</p>
            ) : (
              <div className="space-y-3">
                {templates.map((t) => (
                  <Link
                    key={t.id}
                    to={`/admin/sheets?doc=${t.doc_no}`}
                    className="block rounded-lg border border-slate-100 p-3 hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{t.name}</p>
                        <p className="text-xs text-slate-500">Doc {t.doc_no}</p>
                      </div>
                      <Badge color={t.doc_no === 'F/PRD/02' ? 'blue' : 'gray'}>
                        {t.versions.find((v) => v.status === 'published')?.rev_no ?? 'draft'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {furnaceLog && (
              <Link
                to="/admin/sheets?doc=F/PRD/02"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                Open Furnace Log Sheet →
              </Link>
            )}
          </Card>

          <Card
            title="Recent heats"
            action={
              <Link to="/admin/activity" className="text-xs font-medium text-brand-600 hover:underline">
                View all
              </Link>
            }
          >
            <div className="space-y-2">
              {runs.map((run) => (
                <Link
                  key={run.id}
                  to={`/heat/${run.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-800">{run.run_number}</span>
                  <Badge color="blue">{run.current_state}</Badge>
                </Link>
              ))}
              {runs.length === 0 && (
                <p className="text-sm text-slate-500">No heats recorded yet. Start one from Shift Dashboard.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
