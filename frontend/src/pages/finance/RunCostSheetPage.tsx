import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import {
  COST_CATEGORY_LABELS,
  computeRunCost,
  fetchRunCostSheet,
  formatCurrency,
} from '../../api/finance';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { hasRole, FINANCE_MASTERS_WRITE_ROLES } from '../../utils/roles';

export function RunCostSheetPage() {
  const { runId } = useParams<{ runId: string }>();
  const { user } = useAuth();
  const canCompute = user ? hasRole(user.role, FINANCE_MASTERS_WRITE_ROLES) : false;
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<Awaited<ReturnType<typeof fetchRunCostSheet>> | null>(null);
  const [computing, setComputing] = useState(false);

  const load = () => {
    if (!runId) return;
    fetchRunCostSheet(runId)
      .then(setSheet)
      .catch((e) => setError(getErrorMessage(e)));
  };

  useEffect(() => {
    load();
  }, [runId]);

  const handleCompute = async () => {
    if (!runId) return;
    setComputing(true);
    setError('');
    try {
      await computeRunCost(runId);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setComputing(false);
    }
  };

  if (!sheet && !error) {
    return (
      <div>
        <p className="text-slate-500">No cost calculation for this run yet.</p>
        {canCompute && runId && (
          <Button className="mt-4" onClick={handleCompute} disabled={computing}>
            {computing ? 'Computing...' : 'Calculate Cost'}
          </Button>
        )}
      </div>
    );
  }

  if (!sheet) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
        {canCompute && runId && (
          <Button className="mt-4" onClick={handleCompute} disabled={computing}>
            Calculate Cost
          </Button>
        )}
      </div>
    );
  }

  const calc = sheet.calculation;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link to="/finance/dashboard" className="text-sm text-brand-600 hover:underline">
            ← Finance Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Run Cost Sheet — {sheet.run_number}</h1>
          <p className="text-sm text-slate-500">
            {sheet.department_code} / {sheet.process_code} · v{calc.version} · {calc.status}
          </p>
        </div>
        {canCompute && (
          <Button onClick={handleCompute} disabled={computing}>
            {computing ? 'Recalculating...' : 'Recalculate'}
          </Button>
        )}
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {calc.warnings.length > 0 && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {calc.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      <Card className="mb-6">
        <p className="text-3xl font-bold text-slate-900">{formatCurrency(calc.total_cost)}</p>
        <p className="text-sm text-slate-500">Total operational cost</p>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Category Contribution</h2>
        <Table
          data={sheet.breakdown.map((r) => ({ ...r, id: r.category }))}
          emptyMessage="No breakdown."
          columns={[
            { key: 'cat', header: 'Category', render: (r) => COST_CATEGORY_LABELS[r.category] },
            { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
            { key: 'pct', header: '%', render: (r) => `${r.percentage}%` },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Line Items</h2>
        <Table
          data={calc.line_items}
          emptyMessage="No line items."
          columns={[
            { key: 'cat', header: 'Category', render: (r) => COST_CATEGORY_LABELS[r.cost_category] },
            { key: 'item', header: 'Item', render: (r) => r.item_name },
            { key: 'qty', header: 'Qty', render: (r) => `${r.quantity} ${r.unit}` },
            { key: 'rate', header: 'Rate', render: (r) => formatCurrency(r.rate) },
            { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
          ]}
        />
      </Card>
    </div>
  );
}
