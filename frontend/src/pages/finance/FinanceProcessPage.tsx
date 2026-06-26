import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchProcessCostDetail, formatCurrency } from '../../api/finance';
import { Card } from '../../components/ui/Card';

export function FinanceProcessPage() {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchProcessCostDetail>> | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchProcessCostDetail(id)
      .then(setDetail)
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
          {detail.process_code} — {detail.process_name}
        </h1>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase text-slate-500">Total Cost</p>
          <p className="text-xl font-bold">{formatCurrency(detail.total_cost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Average Cost</p>
          <p className="text-xl font-bold">{formatCurrency(detail.average_cost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Highest Cost Run</p>
          <p className="text-xl font-bold">{formatCurrency(detail.highest_cost)}</p>
          {detail.highest_cost_run_id && (
            <Link
              to={`/finance/runs/${detail.highest_cost_run_id}/cost-sheet`}
              className="text-xs text-brand-600 hover:underline"
            >
              {detail.highest_cost_run_number}
            </Link>
          )}
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Lowest Cost Run</p>
          <p className="text-xl font-bold">{formatCurrency(detail.lowest_cost)}</p>
          {detail.lowest_cost_run_id && (
            <Link
              to={`/finance/runs/${detail.lowest_cost_run_id}/cost-sheet`}
              className="text-xs text-brand-600 hover:underline"
            >
              {detail.lowest_cost_run_number}
            </Link>
          )}
        </Card>
      </div>
      <p className="mt-4 text-sm text-slate-500">{detail.run_count} runs with cost calculations</p>
    </div>
  );
}
