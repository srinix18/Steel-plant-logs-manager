import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getErrorMessage } from '../../api/client';
import { evaluatePmTriggers, fetchMaintenanceAnalytics } from '../../api/maintenancePm';
import { fetchPlants } from '../../api/platform';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function MaintenanceDashboardPage() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [plantId, setPlantId] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof fetchMaintenanceAnalytics>> | null>(null);

  const loadAnalytics = () => {
    if (!plantId) return Promise.resolve();
    return fetchMaintenanceAnalytics({ plant_id: plantId }).then(setAnalytics);
  };

  useEffect(() => {
    fetchPlants()
      .then((plants) => {
        if (plants[0]) setPlantId(plants[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    loadAnalytics().catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  const runEvaluate = async (force: boolean) => {
    setEvaluating(true);
    setError('');
    setMessage('');
    try {
      const result = await evaluatePmTriggers({ plantId, force });
      setMessage(
        `Evaluated ${result.triggers_evaluated} trigger(s) · ${result.work_orders_generated} new work order(s) · ${result.notifications_sent} notification(s)`,
      );
      await loadAnalytics();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setEvaluating(false);
    }
  };

  const chartData = analytics
    ? [
        { name: 'Open', count: analytics.open_work_orders },
        { name: 'Overdue', count: analytics.overdue_work_orders },
        { name: 'Completed', count: analytics.completed_work_orders },
      ]
    : [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">PM compliance, reliability KPIs, and work order status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={evaluating || !plantId} onClick={() => runEvaluate(false)}>
            {evaluating ? 'Running…' : 'Run PM evaluate'}
          </Button>
          <Button variant="secondary" disabled={evaluating || !plantId} onClick={() => runEvaluate(true)}>
            Force evaluate (demo)
          </Button>
          <Link to="/maintenance/work-orders">
            <Button variant="secondary">Work orders</Button>
          </Link>
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {message && (
        <p className="mb-4 rounded border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{message}</p>
      )}

      {analytics && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">PM Compliance</p>
              <p className="mt-1 text-2xl font-bold text-brand-700">
                {analytics.pm_compliance_pct != null ? `${analytics.pm_compliance_pct.toFixed(1)}%` : '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">MTBF (hours)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {analytics.mtbf_hours != null ? analytics.mtbf_hours.toFixed(1) : '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">MTTR (hours)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {analytics.mttr_hours != null ? analytics.mttr_hours.toFixed(1) : '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">Total downtime (min)</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {analytics.total_downtime_min.toLocaleString()}
              </p>
            </Card>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">Open work orders</p>
              <p className="mt-1 text-2xl font-bold">{analytics.open_work_orders}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">Overdue</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{analytics.overdue_work_orders}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">Completed (period)</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{analytics.completed_work_orders}</p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Work order status breakdown</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
