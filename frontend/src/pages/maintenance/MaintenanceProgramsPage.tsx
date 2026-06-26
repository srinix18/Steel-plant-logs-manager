import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import {
  evaluatePmTriggers,
  fetchMaintenancePrograms,
  generateWorkOrderFromProgram,
  updateMaintenanceProgram,
} from '../../api/maintenancePm';
import { fetchPlants } from '../../api/platform';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

export function MaintenanceProgramsPage() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [plantId, setPlantId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [programs, setPrograms] = useState<Awaited<ReturnType<typeof fetchMaintenancePrograms>>>([]);

  const load = async () => {
    if (!plantId) return;
    setPrograms(await fetchMaintenancePrograms(plantId));
  };

  useEffect(() => {
    fetchPlants()
      .then((p) => {
        if (p[0]) setPlantId(p[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [plantId]);

  const activate = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await updateMaintenanceProgram(id, { status: 'active' });
      setMessage('Program activated — run PM evaluate or generate a work order.');
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId('');
    }
  };

  const generateWo = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const wo = await generateWorkOrderFromProgram(id);
      setMessage(`Work order ${wo.wo_number} created (Draft). Open Work Orders → Assign.`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId('');
    }
  };

  const runEvaluate = async (force: boolean) => {
    setEvaluating(true);
    setError('');
    try {
      const result = await evaluatePmTriggers({ plantId, force });
      setMessage(
        `PM evaluate: ${result.triggers_evaluated} trigger(s) checked, ${result.work_orders_generated} work order(s) created.`,
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PM Programs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Preventive maintenance programs. Only <strong>active</strong> programs with triggers fire on evaluate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={evaluating} onClick={() => runEvaluate(false)}>
            {evaluating ? 'Evaluating…' : 'Run PM evaluate'}
          </Button>
          <Button variant="secondary" disabled={evaluating} onClick={() => runEvaluate(true)}>
            Force evaluate (demo)
          </Button>
          <Link to="/maintenance/programs/new">
            <Button>Create program</Button>
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {message && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>
      )}

      <Card className="mb-4 border-brand-100 bg-brand-50/40">
        <p className="text-sm text-slate-700">
          <strong>Demo tip:</strong> Draft programs do not evaluate. Activate the program, add at least one trigger and
          task, then click <strong>Run PM evaluate</strong> or <strong>Generate WO</strong> on a row. New work orders
          appear under <Link to="/maintenance/work-orders" className="text-brand-600 underline">Work Orders</Link> as{' '}
          <strong>Draft</strong> — click Assign to start.
        </p>
      </Card>

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
            {
              key: 'actions',
              header: 'Actions',
              render: (p) => (
                <div className="flex flex-wrap gap-1">
                  {p.status === 'draft' && (
                    <Button size="sm" disabled={busyId === p.id} onClick={() => activate(p.id)}>
                      Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === p.id}
                    onClick={() => generateWo(p.id)}
                  >
                    Generate WO
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
