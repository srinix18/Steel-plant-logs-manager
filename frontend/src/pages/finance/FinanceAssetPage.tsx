import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchAssetCostDetail, formatCurrency } from '../../api/finance';
import { Card } from '../../components/ui/Card';

export function FinanceAssetPage() {
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchAssetCostDetail>> | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchAssetCostDetail(id)
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
          {detail.asset_no} — {detail.asset_name}
        </h1>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-slate-500">Production</p>
          <p className="text-xl font-bold">{detail.total_production_kg.toLocaleString()} kg</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Power Cost</p>
          <p className="text-xl font-bold">{formatCurrency(detail.power_cost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Maintenance Cost</p>
          <p className="text-xl font-bold">{formatCurrency(detail.maintenance_cost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Total Cost</p>
          <p className="text-xl font-bold">{formatCurrency(detail.total_cost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Cost Per Ton</p>
          <p className="text-xl font-bold">
            {detail.cost_per_ton != null ? formatCurrency(detail.cost_per_ton) : '—'}
          </p>
        </Card>
      </div>
    </div>
  );
}
