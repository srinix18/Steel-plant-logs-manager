import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchPlantCostSummary, formatCurrency } from '../../api/finance';
import { fetchPlants } from '../../api/platform';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { COST_CATEGORY_LABELS } from '../../api/finance';

export function FinanceDashboardPage() {
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchPlantCostSummary>> | null>(null);

  useEffect(() => {
    fetchPlants()
      .then((plants) => {
        if (plants[0]) setPlantId(plants[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    fetchPlantCostSummary(plantId)
      .then(setSummary)
      .catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Finance — Plant Cost Summary</h1>
        <p className="mt-1 text-sm text-slate-500">Operational manufacturing cost visibility</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {summary && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">Total Cost Today</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(summary.total_cost_today)}</p>
              <p className="text-xs text-slate-400">{summary.run_count_today} runs</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-slate-500">Total Cost This Month</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(summary.total_cost_month)}</p>
              <p className="text-xs text-slate-400">{summary.run_count_month} runs</p>
            </Card>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Cost By Department</h2>
              <Table
                data={summary.by_department.map((r) => ({ ...r, id: r.department_id }))}
                emptyMessage="No department costs yet."
                columns={[
                  {
                    key: 'department',
                    header: 'Department',
                    render: (r) => (
                      <Link
                        to={`/finance/dashboard/departments/${r.department_id}`}
                        className="text-brand-600 hover:underline"
                      >
                        {r.department_code} — {r.department_name}
                      </Link>
                    ),
                  },
                  { key: 'total_cost', header: 'Total', render: (r) => formatCurrency(r.total_cost) },
                  { key: 'run_count', header: 'Runs', render: (r) => String(r.run_count) },
                ]}
              />
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Cost By Category</h2>
              <Table
                data={summary.by_category.map((r) => ({ ...r, id: r.category }))}
                emptyMessage="No category breakdown yet."
                columns={[
                  {
                    key: 'category',
                    header: 'Category',
                    render: (r) => COST_CATEGORY_LABELS[r.category] || r.category,
                  },
                  { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
                  { key: 'percentage', header: '%', render: (r) => `${r.percentage}%` },
                ]}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
