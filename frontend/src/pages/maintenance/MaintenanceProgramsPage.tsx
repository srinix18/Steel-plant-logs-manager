import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { fetchMaintenancePrograms } from '../../api/maintenancePm';
import { fetchPlants } from '../../api/platform';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function MaintenanceProgramsPage() {
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [programs, setPrograms] = useState<Awaited<ReturnType<typeof fetchMaintenancePrograms>>>([]);

  useEffect(() => {
    fetchPlants()
      .then((p) => {
        if (p[0]) setPlantId(p[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    fetchMaintenancePrograms(plantId)
      .then(setPrograms)
      .catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PM Programs</h1>
          <p className="mt-1 text-sm text-slate-500">Preventive maintenance program definitions and triggers.</p>
        </div>
        <Link to="/maintenance/programs/new">
          <Button>Create program</Button>
        </Link>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card>
        <Table
          data={programs}
          emptyMessage="No PM programs yet. Create one to get started."
          columns={[
            {
              key: 'name',
              header: 'Program',
              render: (p) => (
                <Link to={`/maintenance/programs/${p.id}/edit`} className="font-medium text-brand-600 hover:underline">
                  {p.name}
                </Link>
              ),
            },
            { key: 'category', header: 'Category', render: (p) => p.category },
            { key: 'priority', header: 'Priority', render: (p) => p.priority },
            {
              key: 'status',
              header: 'Status',
              render: (p) => (
                <Badge color={p.status === 'active' ? 'green' : p.status === 'draft' ? 'gray' : 'purple'}>
                  {p.status}
                </Badge>
              ),
            },
            {
              key: 'auto',
              header: 'Auto WO',
              render: (p) => (p.auto_generate_work_orders ? 'Yes' : 'No'),
            },
            {
              key: 'team',
              header: 'Team',
              render: (p) => p.responsible_team ?? '—',
            },
          ]}
        />
      </Card>
    </div>
  );
}
