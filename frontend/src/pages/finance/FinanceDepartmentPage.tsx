import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import {
  COST_CATEGORY_LABELS,
  fetchDepartmentCostDetail,
  formatCurrency,
} from '../../api/finance';
import { fetchProcesses } from '../../api/platform';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function FinanceDepartmentPage() {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchDepartmentCostDetail>> | null>(null);
  const [processes, setProcesses] = useState<Awaited<ReturnType<typeof fetchProcesses>>>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchDepartmentCostDetail(id), fetchProcesses(id)])
      .then(([d, p]) => {
        setDetail(d);
        setProcesses(p);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [id]);

  if (!detail) {
    return <div className="text-slate-500">{error || 'Loading...'}</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/finance/dashboard" className="text-sm text-brand-600 hover:underline">
          ← Plant Summary
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {detail.department_code} — {detail.department_name}
        </h1>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-slate-500">Total Cost</p>
          <p className="text-xl font-bold">{formatCurrency(detail.total_cost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Cost Per Run</p>
          <p className="text-xl font-bold">{formatCurrency(detail.cost_per_run)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Cost Per Ton</p>
          <p className="text-xl font-bold">
            {detail.cost_per_ton != null ? formatCurrency(detail.cost_per_ton) : '—'}
          </p>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Cost Breakdown</h2>
        <Table
          data={detail.breakdown.map((r) => ({ ...r, id: r.category }))}
          emptyMessage="No breakdown."
          columns={[
            { key: 'cat', header: 'Category', render: (r) => COST_CATEGORY_LABELS[r.category] },
            { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
            { key: 'pct', header: '%', render: (r) => `${r.percentage}%` },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Processes</h2>
        <Table
          data={processes}
          emptyMessage="No processes."
          columns={[
            {
              key: 'code',
              header: 'Process',
              render: (r) => (
                <Link
                  to={`/finance/dashboard/processes/${r.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {r.code} — {r.name}
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
