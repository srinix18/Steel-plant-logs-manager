import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import {
  fetchWorkOrders,
  transitionWorkOrder,
  WO_STATUS_LABELS,
  type MaintenanceWorkOrderStatus,
} from '../../api/maintenancePm';
import { fetchPlants } from '../../api/platform';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';

const STATUS_TABS: { key: MaintenanceWorkOrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'waiting_parts', label: 'Waiting parts' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Closed' },
];

const statusColor = (s: string) => {
  if (s === 'closed' || s === 'completed' || s === 'verified') return 'green';
  if (s === 'in_progress' || s === 'accepted') return 'blue';
  if (s.includes('waiting')) return 'purple';
  return 'gray';
};

export function WorkOrdersPage() {
  const [error, setError] = useState('');
  const [plantId, setPlantId] = useState('');
  const [tab, setTab] = useState<MaintenanceWorkOrderStatus | 'all'>('all');
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchWorkOrders>>>([]);

  const load = async () => {
    const data = await fetchWorkOrders({
      plant_id: plantId || undefined,
      status: tab === 'all' ? undefined : tab,
    });
    setOrders(data);
  };

  useEffect(() => {
    fetchPlants()
      .then((p) => {
        if (p[0]) setPlantId(p[0].id);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    load().catch((e) => setError(getErrorMessage(e)));
  }, [plantId, tab]);

  const filtered = useMemo(() => orders, [orders]);

  const handleTransition = async (id: string, toState: MaintenanceWorkOrderStatus) => {
    try {
      setError('');
      await transitionWorkOrder(id, { to_state: toState });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Work Orders</h1>
        <p className="mt-1 text-sm text-slate-500">PM and corrective maintenance work order queue.</p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <Table
          data={filtered}
          emptyMessage="No work orders match this filter."
          columns={[
            {
              key: 'wo',
              header: 'WO #',
              render: (wo) => (
                <Link to={`/maintenance/work-orders/${wo.id}`} className="font-medium text-brand-600 hover:underline">
                  {wo.wo_number}
                </Link>
              ),
            },
            { key: 'title', header: 'Title', render: (wo) => wo.title },
            {
              key: 'status',
              header: 'Status',
              render: (wo) => (
                <Badge color={statusColor(wo.status)}>
                  {WO_STATUS_LABELS[wo.status as MaintenanceWorkOrderStatus] ?? wo.status}
                </Badge>
              ),
            },
            {
              key: 'due',
              header: 'Due',
              render: (wo) => (wo.due_at ? new Date(wo.due_at).toLocaleDateString() : '—'),
            },
            {
              key: 'tasks',
              header: 'Tasks',
              render: (wo) => {
                const done = wo.tasks.filter((t) => t.status !== 'pending').length;
                return `${done}/${wo.tasks.length}`;
              },
            },
            {
              key: 'actions',
              header: '',
              render: (wo) => (
                <div className="flex gap-1">
                  {wo.status === 'draft' && (
                    <Button size="sm" onClick={() => handleTransition(wo.id, 'assigned')}>
                      Assign
                    </Button>
                  )}
                  {wo.status === 'assigned' && (
                    <Button size="sm" variant="secondary" onClick={() => handleTransition(wo.id, 'accepted')}>
                      Accept
                    </Button>
                  )}
                  {(wo.status === 'accepted' || wo.status === 'assigned') && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (wo.status === 'assigned') {
                          await handleTransition(wo.id, 'accepted');
                          await handleTransition(wo.id, 'in_progress');
                        } else {
                          await handleTransition(wo.id, 'in_progress');
                        }
                      }}
                    >
                      Start
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
