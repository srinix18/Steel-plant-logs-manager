import { useEffect, useState } from 'react';
import { fetchDashboardMetrics } from '../../api/dashboard';
import { exportRecords } from '../../api/records';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { DashboardMetrics } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const metricCards = [
  { key: 'total_organisations' as const, label: 'Organisations', color: 'text-indigo-600', adminOnly: true },
  { key: 'total_users' as const, label: 'Total Users', color: 'text-blue-600' },
  { key: 'total_departments' as const, label: 'Departments', color: 'text-purple-600' },
  { key: 'total_templates' as const, label: 'Templates', color: 'text-green-600' },
  { key: 'total_records' as const, label: 'Records', color: 'text-orange-600' },
];

export function DashboardMetricsView({ title }: { title: string }) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const canExport = user?.role === 'admin' || user?.role === 'department';

  useEffect(() => {
    fetchDashboardMetrics().then(setMetrics).catch((e) => setError(getErrorMessage(e)));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportRecords();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'records_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {canExport && (
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        )}
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metricCards
          .filter(({ adminOnly }) => !adminOnly || user?.role === 'admin')
          .map(({ key, label, color }) => (
          <Card key={key}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{metrics ? metrics[key] : '—'}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
