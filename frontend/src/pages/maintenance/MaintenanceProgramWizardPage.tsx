import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import {
  createMaintenanceProgram,
  createProgramNotificationRule,
  createProgramTaskTemplate,
  createProgramTrigger,
  fetchMaintenanceProgram,
  fetchProgramNotificationRules,
  fetchProgramTaskTemplates,
  fetchProgramTriggers,
  TRIGGER_TYPE_LABELS,
  updateMaintenanceProgram,
  type MaintenanceNotificationRule,
  type MaintenanceTaskTemplate,
  type MaintenanceTrigger,
  type MaintenanceTriggerType,
} from '../../api/maintenancePm';
import { fetchDepartments, fetchPlants } from '../../api/platform';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

const STEPS = ['Program', 'Triggers', 'Tasks', 'Notifications', 'Auto WO', 'Review'] as const;

const TRIGGER_TYPES: MaintenanceTriggerType[] = [
  'time',
  'runtime_hours',
  'heat_count',
  'production_count',
  'tonnage',
  'manual',
];

const METER_TRIGGER_TYPES = new Set<MaintenanceTriggerType>([
  'runtime_hours',
  'heat_count',
  'production_count',
  'tonnage',
]);

function thresholdLabel(type: MaintenanceTriggerType): string {
  switch (type) {
    case 'heat_count':
      return 'Every N heats';
    case 'runtime_hours':
      return 'Every N runtime hours';
    case 'production_count':
      return 'Every N production units';
    case 'tonnage':
      return 'Every N tonnes';
    default:
      return 'Threshold';
  }
}

function formatTriggerSummary(t: MaintenanceTrigger): string {
  const label = TRIGGER_TYPE_LABELS[t.trigger_type] ?? t.trigger_type;
  if (t.trigger_type === 'time' && t.interval_days) {
    return `${label} — every ${t.interval_days} days`;
  }
  if (METER_TRIGGER_TYPES.has(t.trigger_type) && t.threshold_value != null) {
    return `${label} — every ${t.threshold_value}`;
  }
  return label;
}

export function MaintenanceProgramWizardPage() {
  const { programId } = useParams();
  const isEdit = Boolean(programId && programId !== 'new');
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState(programId && programId !== 'new' ? programId : '');
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [plantId, setPlantId] = useState('');

  const [program, setProgram] = useState({
    name: '',
    description: '',
    category: 'equipment',
    priority: 'medium',
    department_id: '',
    responsible_team: '',
    estimated_duration_min: '',
    status: 'draft' as 'draft' | 'active' | 'inactive',
    auto_generate_work_orders: true,
  });

  const [triggers, setTriggers] = useState<MaintenanceTrigger[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTaskTemplate[]>([]);
  const [notifications, setNotifications] = useState<MaintenanceNotificationRule[]>([]);

  const [newTrigger, setNewTrigger] = useState({
    trigger_type: 'time' as MaintenanceTriggerType,
    interval_days: '30',
    threshold_value: '',
  });
  const [newTask, setNewTask] = useState({ name: '', description: '', checklist: '' });
  const [newNotification, setNewNotification] = useState({ offset_days: '7', recipient_role: 'maintenance' });

  useEffect(() => {
    fetchPlants().then((p) => {
      if (p[0]) {
        setPlantId(p[0].id);
        fetchDepartments(p[0].id).then(setDepartments);
      }
    });
  }, []);

  useEffect(() => {
    if (!isEdit || !programId) return;
    fetchMaintenanceProgram(programId)
      .then((p) => {
        setId(p.id);
        setPlantId(p.plant_id);
        setProgram({
          name: p.name,
          description: p.description ?? '',
          category: p.category,
          priority: p.priority,
          department_id: p.department_id ?? '',
          responsible_team: p.responsible_team ?? '',
          estimated_duration_min: p.estimated_duration_min?.toString() ?? '',
          status: p.status as 'draft' | 'active' | 'inactive',
          auto_generate_work_orders: p.auto_generate_work_orders,
        });
      })
      .catch((e) => setError(getErrorMessage(e)));
    Promise.all([
      fetchProgramTriggers(programId!),
      fetchProgramTaskTemplates(programId!),
      fetchProgramNotificationRules(programId!),
    ])
      .then(([t, tk, n]) => {
        setTriggers(t);
        setTasks(tk);
        setNotifications(n);
      })
      .catch(() => {});
  }, [isEdit, programId]);

  const ensureProgram = async (): Promise<string> => {
    if (id) {
      await updateMaintenanceProgram(id, {
        name: program.name,
        description: program.description || undefined,
        category: program.category,
        priority: program.priority,
        department_id: program.department_id || undefined,
        responsible_team: program.responsible_team || undefined,
        estimated_duration_min: program.estimated_duration_min
          ? Number(program.estimated_duration_min)
          : undefined,
        status: program.status,
        auto_generate_work_orders: program.auto_generate_work_orders,
      });
      return id;
    }
    const created = await createMaintenanceProgram({
      plant_id: plantId,
      name: program.name,
      description: program.description || undefined,
      category: program.category,
      priority: program.priority,
      department_id: program.department_id || undefined,
      responsible_team: program.responsible_team || undefined,
      estimated_duration_min: program.estimated_duration_min
        ? Number(program.estimated_duration_min)
        : undefined,
      status: program.status,
      auto_generate_work_orders: program.auto_generate_work_orders,
    });
    setId(created.id);
    return created.id;
  };

  const saveStep = async () => {
    setSaving(true);
    setError('');
    try {
      const pid = await ensureProgram();
      if (step === 1 && newTrigger.trigger_type) {
        const t = await createProgramTrigger(pid, {
          trigger_type: newTrigger.trigger_type,
          interval_days: newTrigger.interval_days ? Number(newTrigger.interval_days) : undefined,
          threshold_value: newTrigger.threshold_value ? Number(newTrigger.threshold_value) : undefined,
        });
        setTriggers((prev) => [...prev, t]);
        setNewTrigger({ trigger_type: 'time', interval_days: '30', threshold_value: '' });
      }
      if (step === 2 && newTask.name.trim()) {
        const checklist = newTask.checklist
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((label) => ({ label, type: 'checkbox' }));
        const t = await createProgramTaskTemplate(pid, {
          name: newTask.name.trim(),
          description: newTask.description || undefined,
          checklist,
          sort_order: tasks.length,
        });
        setTasks((prev) => [...prev, t]);
        setNewTask({ name: '', description: '', checklist: '' });
      }
      if (step === 3) {
        const n = await createProgramNotificationRule(pid, {
          offset_days: Number(newNotification.offset_days) || 0,
          recipient_role: newNotification.recipient_role,
        });
        setNotifications((prev) => [...prev, n]);
      }
      if (step === 4) {
        await updateMaintenanceProgram(pid, {
          auto_generate_work_orders: program.auto_generate_work_orders,
        });
      }
      if (step === STEPS.length - 1) {
        await updateMaintenanceProgram(pid, { status: 'active' });
        navigate('/maintenance/programs');
        return;
      }
      if (step < STEPS.length - 1) setStep(step + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/maintenance/programs" className="text-sm text-brand-600 hover:underline">
          ← Back to programs
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {isEdit ? 'Edit PM Program' : 'New PM Program'}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Card className="max-w-2xl">
        {step === 0 && (
          <div className="space-y-3">
            <Input label="Program name" value={program.name} onChange={(e) => setProgram({ ...program, name: e.target.value })} />
            <label className="block text-sm">
              <span className="text-slate-600">Description</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={3}
                value={program.description}
                onChange={(e) => setProgram({ ...program, description: e.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Category" value={program.category} onChange={(e) => setProgram({ ...program, category: e.target.value })} />
              <label className="block text-sm">
                <span className="text-slate-600">Priority</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={program.priority}
                  onChange={(e) => setProgram({ ...program, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-slate-600">Department</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={program.department_id}
                onChange={(e) => setProgram({ ...program, department_id: e.target.value })}
              >
                <option value="">Any</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <Input
              label="Responsible team"
              value={program.responsible_team}
              onChange={(e) => setProgram({ ...program, responsible_team: e.target.value })}
            />
            <Input
              label="Estimated duration (min)"
              type="number"
              value={program.estimated_duration_min}
              onChange={(e) => setProgram({ ...program, estimated_duration_min: e.target.value })}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Define when this PM program should fire.</p>
            <ul className="space-y-2 text-sm">
              {triggers.map((t) => (
                <li key={t.id} className="rounded border px-3 py-2">
                  {formatTriggerSummary(t)}
                </li>
              ))}
              {triggers.length === 0 && <li className="text-slate-500">No triggers yet.</li>}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-600">Trigger type</span>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={newTrigger.trigger_type}
                  onChange={(e) => {
                    const trigger_type = e.target.value as MaintenanceTriggerType;
                    setNewTrigger({
                      trigger_type,
                      interval_days: trigger_type === 'time' ? newTrigger.interval_days : '',
                      threshold_value: METER_TRIGGER_TYPES.has(trigger_type) ? newTrigger.threshold_value : '',
                    });
                  }}
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t} value={t}>{TRIGGER_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              {newTrigger.trigger_type === 'time' && (
                <Input
                  label="Repeat every (days)"
                  type="number"
                  min={1}
                  value={newTrigger.interval_days}
                  onChange={(e) => setNewTrigger({ ...newTrigger, interval_days: e.target.value })}
                />
              )}
              {METER_TRIGGER_TYPES.has(newTrigger.trigger_type) && (
                <Input
                  label={thresholdLabel(newTrigger.trigger_type)}
                  type="number"
                  min={1}
                  value={newTrigger.threshold_value}
                  onChange={(e) => setNewTrigger({ ...newTrigger, threshold_value: e.target.value })}
                />
              )}
              {newTrigger.trigger_type === 'manual' && (
                <p className="sm:col-span-2 text-sm text-slate-500">
                  Manual triggers do not fire automatically — work orders are created when you run PM evaluate or assign manually.
                </p>
              )}
            </div>
            {METER_TRIGGER_TYPES.has(newTrigger.trigger_type) && (
              <p className="text-xs text-slate-500">
                Uses the asset&apos;s life counter ({newTrigger.trigger_type.replace(/_/g, ' ')}). Link this program to an asset on the program record after saving.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm">
              {tasks.map((t) => (
                <li key={t.id} className="rounded border px-3 py-2">{t.name}</li>
              ))}
            </ul>
            <Input label="Task name" value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} />
            <Input label="Description" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
            <label className="block text-sm">
              <span className="text-slate-600">Checklist items (one per line)</span>
              <textarea
                className="mt-1 w-full rounded-lg border px-3 py-2"
                rows={4}
                value={newTask.checklist}
                onChange={(e) => setNewTask({ ...newTask, checklist: e.target.value })}
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm">
              {notifications.map((n) => (
                <li key={n.id} className="rounded border px-3 py-2">
                  {n.offset_days} days before — notify {n.recipient_role}
                </li>
              ))}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Offset (days before due)"
                type="number"
                value={newNotification.offset_days}
                onChange={(e) => setNewNotification({ ...newNotification, offset_days: e.target.value })}
              />
              <Input
                label="Recipient role"
                value={newNotification.recipient_role}
                onChange={(e) => setNewNotification({ ...newNotification, recipient_role: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={program.auto_generate_work_orders}
                onChange={(e) => setProgram({ ...program, auto_generate_work_orders: e.target.checked })}
              />
              Automatically generate work orders when triggers fire
            </label>
            <p className="text-sm text-slate-500">
              When enabled, the PM evaluator creates work orders from task templates when a trigger fires. New work orders start in <span className="font-medium">Draft</span> so a supervisor can review and assign them before work begins.
            </p>
          </div>
        )}

        {step === 5 && (
          <dl className="space-y-2 text-sm">
            <div><dt className="inline font-medium">Name: </dt><dd className="inline">{program.name}</dd></div>
            <div><dt className="inline font-medium">Category: </dt><dd className="inline">{program.category}</dd></div>
            <div><dt className="inline font-medium">Triggers: </dt><dd className="inline">{triggers.length}</dd></div>
            <div><dt className="inline font-medium">Tasks: </dt><dd className="inline">{tasks.length}</dd></div>
            <div><dt className="inline font-medium">Notifications: </dt><dd className="inline">{notifications.length}</dd></div>
            <div><dt className="inline font-medium">Auto WO: </dt><dd className="inline">{program.auto_generate_work_orders ? 'Yes' : 'No'}</dd></div>
            <div><dt className="inline font-medium">On finish: </dt><dd className="inline">Program will be set to Active</dd></div>
          </dl>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </Button>
          <Button onClick={saveStep} disabled={saving || (step === 0 && !program.name.trim())}>
            {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish' : 'Save & continue'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
