import { useEffect, useState } from 'react';
import { fetchDashboardMetrics } from '../../api/operations';
import { getErrorMessage } from '../../api/client';
import type { DashboardMetrics } from '../../types';
import { Card } from '../ui/Card';

const metricCards = [
  { key: 'total_organisations' as const, label: 'Organisations', color: 'text-indigo-600' },
  { key: 'total_plants' as const, label: 'Plants', color: 'text-purple-600' },
  { key: 'active_runs' as const, label: 'Active Runs', color: 'text-blue-600' },
  { key: 'open_observations' as const, label: 'Observations', color: 'text-orange-600' },
  { key: 'open_corrective_actions' as const, label: 'Actions', color: 'text-green-600' },
];

export function DashboardMetricsView({ title }: { title: string }) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardMetrics().then(setMetrics).catch((e) => setError(getErrorMessage(e)));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metricCards.map(({ key, label, color }) => (
          <Card key={key}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{metrics ? metrics[key] : '—'}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
