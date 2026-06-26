import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getErrorMessage } from '../../api/client';
import {
  COST_CATEGORY_LABELS,
  fetchCostTrends,
  fetchTopCostDrivers,
  formatCurrency,
} from '../../api/finance';
import { fetchPlants } from '../../api/platform';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function CostAnalyticsPage() {
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [groupBy, setGroupBy] = useState('day');
  const [drivers, setDrivers] = useState<Awaited<ReturnType<typeof fetchTopCostDrivers>>>([]);
  const [trends, setTrends] = useState<Awaited<ReturnType<typeof fetchCostTrends>>>([]);

  useEffect(() => {
    fetchPlants()
      .then((p) => {
        if (p[0]) setPlantId(p[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    Promise.all([fetchTopCostDrivers(plantId), fetchCostTrends(plantId, groupBy)])
      .then(([d, t]) => {
        setDrivers(d);
        setTrends(t);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [plantId, groupBy]);

  const driverChart = drivers.map((d) => ({
    name: COST_CATEGORY_LABELS[d.category],
    amount: d.amount,
    percentage: d.percentage,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cost Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Top drivers and cost trends</p>
        </div>
        <select
          className="rounded border px-3 py-2 text-sm"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
        >
          <option value="day">By Day</option>
          <option value="department">By Department</option>
          <option value="process">By Process</option>
          <option value="asset">By Asset</option>
        </select>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Top Cost Drivers</h2>
          <Table
            data={drivers.map((r) => ({ ...r, id: r.category }))}
            emptyMessage="No cost data."
            columns={[
              { key: 'cat', header: 'Category', render: (r) => COST_CATEGORY_LABELS[r.category] },
              { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
              { key: 'pct', header: '%', render: (r) => `${r.percentage}%` },
            ]}
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Driver Share</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="amount" fill="#2563eb" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Cost Trends</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="total_cost" stroke="#2563eb" name="Total Cost" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
