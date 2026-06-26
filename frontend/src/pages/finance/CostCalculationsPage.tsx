import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { bulkComputeCosts } from '../../api/finance';
import { fetchDepartments, fetchPlants } from '../../api/platform';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { hasRole, FINANCE_MASTERS_WRITE_ROLES } from '../../utils/roles';

export function CostCalculationsPage() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, FINANCE_MASTERS_WRITE_ROLES) : false;
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ computed: number; failed: number; skipped: number } | null>(null);
  const [plantId, setPlantId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Promise.all([fetchPlants(), fetchDepartments()])
      .then(([plants, depts]) => {
        if (plants[0]) setPlantId(plants[0].id);
        setDepartments(depts);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const handleBulk = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await bulkComputeCosts({
        plant_id: plantId || undefined,
        department_id: departmentId || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Cost Calculations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bulk recalculate costs after updating masters or mappings. If raw material shows ₹0, ensure
          process runs have saved charge mix rows with materials before closing the run.
        </p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {canWrite ? (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">Department (optional)</label>
              <select
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">From date</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">To date</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" onClick={handleBulk} disabled={running}>
            {running ? 'Running...' : 'Bulk Compute'}
          </Button>
          {result && (
            <p className="mt-4 text-sm text-slate-600">
              Computed: {result.computed} · Failed: {result.failed} · Skipped: {result.skipped}
            </p>
          )}
        </Card>
      ) : (
        <p className="text-sm text-slate-500">Read-only access. Contact plant admin to run bulk calculations.</p>
      )}
    </div>
  );
}
