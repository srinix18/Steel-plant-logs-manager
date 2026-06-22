import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboardMetrics } from '../../api/operations';
import { fetchOpenMaintenanceCount, fetchMaintenanceIssues } from '../../api/maintenance';
import { fetchAllRuns } from '../../api/processRuns';
import { fetchDepartments, fetchPlants, fetchProcessInstances, fetchProcesses } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { DashboardMetrics, ProcessRun } from '../../types';
import type { MaintenanceIssue } from '../../api/maintenance';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

const metricCards = [
  { key: 'total_plants' as const, label: 'Plants', color: 'text-purple-600' },
  { key: 'active_runs' as const, label: 'Active Runs', color: 'text-blue-600' },
  { key: 'open_observations' as const, label: 'Open Observations', color: 'text-orange-600' },
  { key: 'open_corrective_actions' as const, label: 'Open Actions', color: 'text-red-600' },
];

export function ExecutiveOverviewPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [openMaintCount, setOpenMaintCount] = useState(0);
  const [openMaintIssues, setOpenMaintIssues] = useState<MaintenanceIssue[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetchDashboardMetrics(),
      fetchAllRuns(),
      fetchPlants(),
      fetchDepartments(),
      fetchProcesses(),
      fetchProcessInstances(),
      fetchOpenMaintenanceCount(),
      fetchMaintenanceIssues({ status: 'open' }),
    ])
      .then(([m, r, , , , , maintCount, maintIssues]) => {
        setMetrics(m);
        setRuns(r.slice(0, 10));
        setOpenMaintCount(maintCount);
        setOpenMaintIssues(maintIssues.slice(0, 8));
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Executive Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Organisation-wide activity for {user?.full_name}. All departments, processes, and live runs.
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
        <Card>
          <p className="text-sm text-slate-500">Open maintenance issues</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{openMaintCount}</p>
        </Card>
      </div>

      {openMaintIssues.length > 0 && (
        <Card title="Open maintenance issues">
          <div className="mb-6 space-y-2">
            {openMaintIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{issue.title}</p>
                  <p className="text-xs text-slate-500 capitalize">
                    {issue.category} · raised by {issue.raised_by_user?.full_name ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color="blue">{issue.status.replace(/_/g, ' ')}</Badge>
                  {issue.run_id && (
                    <Link to={`/reports/${issue.run_id}`} className="text-xs text-brand-600 hover:underline">
                      View run
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Recent activity across organisation">
        <div className="space-y-2">
          {runs.map((run) => (
            <Link
              key={run.id}
              to={`/reports/${run.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
            >
              <span className="text-sm font-medium text-slate-800">{run.run_number}</span>
              <Badge color="blue">{run.current_state}</Badge>
            </Link>
          ))}
          {runs.length === 0 && <p className="text-sm text-slate-500">No runs in your organisation yet.</p>}
        </div>
      </Card>
    </div>
  );
}
