import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { fetchPlants } from '../../api/platform';
import {
  createPayrollRun,
  fetchPayrollLineItems,
  fetchPayrollRuns,
  fetchSalaryStructures,
  formatCurrency,
  formatPayrollMonth,
  processPayrollRun,
} from '../../api/workforceOps';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function PayrollPage() {
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof fetchPayrollRuns>>>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Awaited<ReturnType<typeof fetchPayrollLineItems>>>([]);
  const [salaryCount, setSalaryCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  const now = new Date();

  useEffect(() => {
    fetchPlants()
      .then((p) => {
        if (p[0]) setPlantId(p[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
    fetchSalaryStructures()
      .then((s) => setSalaryCount(s.length))
      .catch(() => setSalaryCount(0));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    fetchPayrollRuns(plantId)
      .then(setRuns)
      .catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  const selectRun = async (runId: string) => {
    setSelectedRun(runId);
    setLineItems(await fetchPayrollLineItems(runId));
  };

  const createRun = async () => {
    if (!plantId) return;
    try {
      setError('');
      const run = await createPayrollRun({
        plant_id: plantId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });
      setRuns(await fetchPayrollRuns(plantId));
      await selectRun(run.id);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const processRun = async (runId: string) => {
    setProcessing(true);
    try {
      await processPayrollRun(runId);
      setRuns(await fetchPayrollRuns(plantId));
      await selectRun(runId);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">Monthly payroll runs and line items.</p>
        </div>
        <Button onClick={createRun}>Create payroll run</Button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {salaryCount === 0 && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No salary structures found. Add salary structures for employees before processing payroll —
          otherwise no payslips will be generated.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Payroll runs</h2>
          <Table
            data={runs}
            emptyMessage="No payroll runs. Create one for the current month."
            columns={[
              {
                key: 'period',
                header: 'Period',
                render: (r) => (
                  <button type="button" className="text-brand-600" onClick={() => selectRun(r.id)}>
                    {formatPayrollMonth(r.month, r.year)}
                  </button>
                ),
              },
              { key: 'status', header: 'Status', render: (r) => r.status },
              {
                key: 'actions',
                header: '',
                render: (r) =>
                  r.status === 'draft' ? (
                    <Button size="sm" disabled={processing} onClick={() => processRun(r.id)}>
                      Process
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Line items</h2>
          {selectedRun ? (
            <>
              {lineItems.length === 0 && (
                <p className="mb-3 text-sm text-amber-700">
                  No line items yet. Process the run after employees have salary structures and
                  attendance records for the month.
                </p>
              )}
              <Table
                data={lineItems}
                emptyMessage="No line items generated."
                columns={[
                  { key: 'employee', header: 'Employee', render: (r) => r.user_name ?? r.user_id },
                  { key: 'days', header: 'Days', render: (r) => String(r.payable_days) },
                  { key: 'gross', header: 'Gross', render: (r) => formatCurrency(r.gross_salary) },
                  { key: 'ded', header: 'Deductions', render: (r) => formatCurrency(r.deductions) },
                  { key: 'net', header: 'Net', render: (r) => formatCurrency(r.net_salary) },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a payroll run to view line items.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
