import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import {
  executeWorkOrderTask,
  fetchWorkOrder,
  transitionWorkOrder,
  WO_STATUS_LABELS,
  type MaintenanceTaskExecutionStatus,
  type MaintenanceWorkOrderStatus,
} from '../../api/maintenancePm';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function WorkOrderExecutionPage() {
  const { workOrderId } = useParams();
  const [error, setError] = useState('');
  const [wo, setWo] = useState<Awaited<ReturnType<typeof fetchWorkOrder>> | null>(null);
  const [saving, setSaving] = useState(false);
  const [taskRemarks, setTaskRemarks] = useState<Record<string, string>>({});
  const [checklistState, setChecklistState] = useState<Record<string, Record<string, boolean>>>({});

  const load = async () => {
    if (!workOrderId) return;
    const data = await fetchWorkOrder(workOrderId);
    setWo(data);
  };

  useEffect(() => {
    load().catch((e) => setError(getErrorMessage(e)));
  }, [workOrderId]);

  const handleTaskStatus = async (taskId: string, status: MaintenanceTaskExecutionStatus) => {
    if (!workOrderId) return;
    setSaving(true);
    try {
      setError('');
      await executeWorkOrderTask(workOrderId, taskId, {
        status,
        remarks: taskRemarks[taskId] || undefined,
        checklist_responses: checklistState[taskId] ?? {},
        time_spent_min: 15,
      });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!workOrderId || !wo) return;
    setSaving(true);
    try {
      await transitionWorkOrder(workOrderId, { to_state: 'completed', notes: 'All tasks executed' });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!wo) {
    return <p className="text-slate-500">Loading work order…</p>;
  }

  const allDone = wo.tasks.length > 0 && wo.tasks.every((t) => t.status !== 'pending');
  const checklistItems = (task: (typeof wo.tasks)[0]) => {
    const fromTemplate = Array.isArray((task as { checklist?: unknown[] }).checklist)
      ? ((task as { checklist?: { label?: string }[] }).checklist ?? [])
      : [];
    if (fromTemplate.length > 0) return fromTemplate;
    return Object.keys(task.checklist_responses).length > 0
      ? Object.keys(task.checklist_responses).map((k) => ({ label: k }))
      : [{ label: 'Inspection complete' }];
  };

  return (
    <div>
      <Link to="/maintenance/work-orders" className="text-sm text-brand-600 hover:underline">
        ← Back to work orders
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {wo.wo_number} — {wo.title}
          </h1>
          <span className="mt-2 inline-block">
            <Badge color="blue">
              {WO_STATUS_LABELS[wo.status as MaintenanceWorkOrderStatus] ?? wo.status}
            </Badge>
          </span>
        </div>
        {wo.status === 'draft' && (
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await transitionWorkOrder(workOrderId!, { to_state: 'assigned' });
                await load();
              } catch (e) {
                setError(getErrorMessage(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            Assign to team
          </Button>
        )}
        {wo.status === 'assigned' && (
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await transitionWorkOrder(workOrderId!, { to_state: 'accepted' });
                await transitionWorkOrder(workOrderId!, { to_state: 'in_progress' });
                await load();
              } catch (e) {
                setError(getErrorMessage(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            Accept & start
          </Button>
        )}
        {allDone && wo.status === 'in_progress' && (
          <Button onClick={handleComplete} disabled={saving}>
            Mark completed
          </Button>
        )}
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="space-y-4">
        {wo.tasks
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((task) => (
            <Card key={task.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">{task.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">Status: {task.status.replace(/_/g, ' ')}</p>
                </div>
                {task.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => handleTaskStatus(task.id, 'not_applicable')}
                    >
                      N/A
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={saving}
                      onClick={() => handleTaskStatus(task.id, 'fail')}
                    >
                      Fail
                    </Button>
                    <Button size="sm" disabled={saving} onClick={() => handleTaskStatus(task.id, 'pass')}>
                      Pass
                    </Button>
                  </div>
                )}
              </div>

              {task.status === 'pending' && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Checklist</p>
                  <ul className="space-y-2">
                    {checklistItems(task).map((item, idx) => {
                      const key = item.label ?? `item_${idx}`;
                      return (
                        <li key={key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checklistState[task.id]?.[key] ?? false}
                            onChange={(e) =>
                              setChecklistState((prev) => ({
                                ...prev,
                                [task.id]: { ...prev[task.id], [key]: e.target.checked },
                              }))
                            }
                          />
                          {key}
                        </li>
                      );
                    })}
                  </ul>
                  <label className="block text-sm">
                    <span className="text-slate-600">Remarks</span>
                    <textarea
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      rows={2}
                      value={taskRemarks[task.id] ?? ''}
                      onChange={(e) => setTaskRemarks((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    />
                  </label>
                </div>
              )}

              {task.status !== 'pending' && task.remarks && (
                <p className="mt-3 text-sm text-slate-600">Remarks: {task.remarks}</p>
              )}
            </Card>
          ))}
        {wo.tasks.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">No tasks on this work order.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
