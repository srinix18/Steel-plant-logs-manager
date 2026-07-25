import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchDepartments,
  fetchFoundationAssets,
  fetchPlants,
  type FoundationAsset,
} from '@/src/api/lookups';
import {
  createMaintenanceProgram,
  createProgramNotificationRule,
  createProgramTaskTemplate,
  createProgramTrigger,
  fetchMaintenanceProgramDetail,
  TRIGGER_TYPE_LABELS,
  updateMaintenanceProgram,
  type MaintenanceNotificationRule,
  type MaintenanceProgramStatus,
  type MaintenanceTaskTemplate,
  type MaintenanceTrigger,
  type MaintenanceTriggerType,
} from '@/src/api/maintenancePm';
import { useAuth } from '@/src/auth/AuthContext';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import type { Department } from '@/src/types/platform';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

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
  const type = t.trigger_type as MaintenanceTriggerType;
  const label = TRIGGER_TYPE_LABELS[type] ?? t.trigger_type;
  if (type === 'time' && t.interval_days) {
    return `${label} — every ${t.interval_days} days`;
  }
  if (METER_TRIGGER_TYPES.has(type) && t.threshold_value != null) {
    return `${label} — every ${t.threshold_value}`;
  }
  return label;
}

type Props = {
  /** When set, edit mode loads nested detail. */
  programId?: string;
};

/**
 * P3-MAINT-PM-WIZ — 6-step PM Program wizard (port of MaintenanceProgramWizardPage).
 */
export function MaintenanceProgramWizardScreen({ programId }: Props) {
  const { user } = useAuth();
  const isEdit = Boolean(programId);

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [id, setId] = useState(programId ?? '');
  const [plantId, setPlantId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assets, setAssets] = useState<FoundationAsset[]>([]);

  const [program, setProgram] = useState({
    name: '',
    description: '',
    category: 'equipment',
    priority: 'medium',
    department_id: '',
    asset_id: '',
    responsible_team: '',
    estimated_duration_min: '',
    status: 'draft' as MaintenanceProgramStatus,
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
  const [newNotification, setNewNotification] = useState({
    offset_days: '7',
    recipient_role: 'maintenance',
  });

  useEffect(() => {
    if (!plantId) return;
    void fetchDepartments(plantId)
      .then(setDepartments)
      .catch(() => setDepartments([]));
    void fetchFoundationAssets({ plant_id: plantId })
      .then(setAssets)
      .catch(() => setAssets([]));
  }, [plantId]);

  useEffect(() => {
    if (!isEdit || !programId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchMaintenanceProgramDetail(programId)
      .then((detail) => {
        const p = detail.program;
        setId(p.id);
        setPlantId(p.plant_id);
        setProgram({
          name: p.name,
          description: p.description ?? '',
          category: p.category,
          priority: p.priority,
          department_id: p.department_id ?? '',
          asset_id: p.asset_id ?? '',
          responsible_team: p.responsible_team ?? '',
          estimated_duration_min: p.estimated_duration_min?.toString() ?? '',
          status: (p.status as MaintenanceProgramStatus) || 'draft',
          auto_generate_work_orders: p.auto_generate_work_orders,
        });
        setTriggers(detail.triggers);
        setTasks(detail.task_templates);
        setNotifications(detail.notification_rules);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [isEdit, programId]);

  useEffect(() => {
    if (isEdit) return;
    void fetchPlants().then((plants) => {
      const pid =
        (user?.plant_id && plants.find((p) => p.id === user.plant_id)?.id) || plants[0]?.id;
      if (pid && !plantId) setPlantId(pid);
    });
  }, [isEdit, plantId, user?.plant_id]);

  const ensureProgram = useCallback(async (): Promise<string> => {
    if (id) {
      await updateMaintenanceProgram(id, {
        name: program.name,
        description: program.description || undefined,
        category: program.category,
        priority: program.priority,
        department_id: program.department_id || undefined,
        asset_id: program.asset_id || undefined,
        responsible_team: program.responsible_team || undefined,
        estimated_duration_min: program.estimated_duration_min
          ? Number(program.estimated_duration_min)
          : undefined,
        status: program.status,
        auto_generate_work_orders: program.auto_generate_work_orders,
      });
      return id;
    }
    if (!plantId) throw new Error('No plant available');
    const created = await createMaintenanceProgram({
      plant_id: plantId,
      name: program.name,
      description: program.description || undefined,
      category: program.category,
      priority: program.priority,
      department_id: program.department_id || undefined,
      asset_id: program.asset_id || undefined,
      responsible_team: program.responsible_team || undefined,
      estimated_duration_min: program.estimated_duration_min
        ? Number(program.estimated_duration_min)
        : undefined,
      status: program.status,
      auto_generate_work_orders: program.auto_generate_work_orders,
    });
    setId(created.id);
    return created.id;
  }, [id, plantId, program]);

  const saveStep = async () => {
    setSaving(true);
    setError(null);
    try {
      const pid = await ensureProgram();
      if (step === 4) {
        await updateMaintenanceProgram(pid, {
          auto_generate_work_orders: program.auto_generate_work_orders,
        });
      }
      if (step === STEPS.length - 1) {
        if (!isEdit && triggers.length === 0) {
          setError('Add at least one trigger before finishing.');
          return;
        }
        if (!isEdit && tasks.length === 0) {
          setError('Add at least one task template before finishing.');
          return;
        }
        if (!isEdit) {
          await updateMaintenanceProgram(pid, { status: 'active' });
        }
        router.replace('/(app)/maintenance/programs' as Href);
        return;
      }
      if (step < STEPS.length - 1) setStep(step + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAddTrigger = async () => {
    setSaving(true);
    setError(null);
    try {
      const pid = await ensureProgram();
      const t = await createProgramTrigger(pid, {
        trigger_type: newTrigger.trigger_type,
        interval_days:
          newTrigger.trigger_type === 'time' && newTrigger.interval_days
            ? Number(newTrigger.interval_days)
            : undefined,
        threshold_value:
          METER_TRIGGER_TYPES.has(newTrigger.trigger_type) && newTrigger.threshold_value
            ? Number(newTrigger.threshold_value)
            : undefined,
      });
      setTriggers((prev) => [...prev, t]);
      setNewTrigger({ trigger_type: 'time', interval_days: '30', threshold_value: '' });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const pid = await ensureProgram();
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
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAddNotification = async () => {
    setSaving(true);
    setError(null);
    try {
      const pid = await ensureProgram();
      const n = await createProgramNotificationRule(pid, {
        offset_days: Number(newNotification.offset_days) || 0,
        recipient_role: newNotification.recipient_role,
      });
      setNotifications((prev) => [...prev, n]);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const deptOptions = useMemo(
    () => [
      { label: 'Any', value: '' },
      ...departments.map((d) => ({ label: d.name, value: d.id })),
    ],
    [departments]
  );

  const assetOptions = useMemo(
    () => [
      { label: 'Select asset', value: '' },
      ...assets.map((a) => ({ label: `${a.name} (${a.asset_no})`, value: a.id })),
    ],
    [assets]
  );

  if (loading) {
    return <LoadingView message="Loading PM program…" />;
  }

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.push('/(app)/maintenance/programs' as Href)}
        accessibilityRole="link"
      >
        <Text style={styles.back}>← Back to programs</Text>
      </Pressable>
      <Text style={styles.title}>{isEdit ? 'Edit PM Program' : 'New PM Program'}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.steps}
        style={styles.stepsScroll}
      >
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[
              styles.stepChip,
              i === step && styles.stepChipActive,
              i < step && styles.stepChipDone,
            ]}
          >
            <Text
              style={[
                styles.stepChipText,
                i === step && styles.stepChipTextActive,
                i < step && styles.stepChipTextDone,
              ]}
            >
              {i + 1}. {s}
            </Text>
          </View>
        ))}
      </ScrollView>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <Card style={styles.card}>
        {step === 0 ? (
          <View style={styles.form}>
            <TextField
              label="Program name *"
              value={program.name}
              onChangeText={(name) => setProgram({ ...program, name })}
            />
            <TextField
              label="Description"
              value={program.description}
              onChangeText={(description) => setProgram({ ...program, description })}
              multiline
              numberOfLines={3}
            />
            <TextField
              label="Category"
              value={program.category}
              onChangeText={(category) => setProgram({ ...program, category })}
            />
            <SelectSheet
              label="Priority"
              value={program.priority}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Critical', value: 'critical' },
              ]}
              onChange={(priority) => setProgram({ ...program, priority })}
            />
            <SelectSheet
              label="Department"
              value={program.department_id}
              options={deptOptions}
              onChange={(department_id) => setProgram({ ...program, department_id })}
            />
            <SelectSheet
              label="Asset (for heat/runtime triggers)"
              value={program.asset_id}
              options={assetOptions}
              onChange={(asset_id) => setProgram({ ...program, asset_id })}
            />
            {isEdit ? (
              <SelectSheet
                label="Status"
                value={program.status}
                options={[
                  { label: 'Draft', value: 'draft' },
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                ]}
                onChange={(status) =>
                  setProgram({ ...program, status: status as MaintenanceProgramStatus })
                }
              />
            ) : null}
            <TextField
              label="Responsible team"
              value={program.responsible_team}
              onChangeText={(responsible_team) => setProgram({ ...program, responsible_team })}
            />
            <TextField
              label="Estimated duration (min)"
              value={program.estimated_duration_min}
              onChangeText={(estimated_duration_min) =>
                setProgram({ ...program, estimated_duration_min })
              }
              keyboardType="number-pad"
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.form}>
            <Text style={styles.hint}>Define when this PM program should fire.</Text>
            {triggers.map((t) => (
              <View key={t.id} style={styles.listRow}>
                <Text style={styles.listText}>{formatTriggerSummary(t)}</Text>
              </View>
            ))}
            {triggers.length === 0 ? <Text style={styles.muted}>No triggers yet.</Text> : null}
            <SelectSheet
              label="Trigger type"
              value={newTrigger.trigger_type}
              options={TRIGGER_TYPES.map((t) => ({
                label: TRIGGER_TYPE_LABELS[t],
                value: t,
              }))}
              onChange={(trigger_type) => {
                const tt = trigger_type as MaintenanceTriggerType;
                setNewTrigger({
                  trigger_type: tt,
                  interval_days: tt === 'time' ? newTrigger.interval_days || '30' : '',
                  threshold_value: METER_TRIGGER_TYPES.has(tt) ? newTrigger.threshold_value : '',
                });
              }}
            />
            {newTrigger.trigger_type === 'time' ? (
              <TextField
                label="Repeat every (days)"
                value={newTrigger.interval_days}
                onChangeText={(interval_days) => setNewTrigger({ ...newTrigger, interval_days })}
                keyboardType="number-pad"
              />
            ) : null}
            {METER_TRIGGER_TYPES.has(newTrigger.trigger_type) ? (
              <>
                <TextField
                  label={thresholdLabel(newTrigger.trigger_type)}
                  value={newTrigger.threshold_value}
                  onChangeText={(threshold_value) =>
                    setNewTrigger({ ...newTrigger, threshold_value })
                  }
                  keyboardType="number-pad"
                />
                <Text style={styles.muted}>
                  Uses the asset life counter. Set asset on the Program step.
                </Text>
              </>
            ) : null}
            {newTrigger.trigger_type === 'manual' ? (
              <Text style={styles.muted}>
                Manual triggers do not fire automatically — create work orders via evaluate or
                Generate WO.
              </Text>
            ) : null}
            <Button
              title="+ Add trigger"
              variant="secondary"
              size="sm"
              disabled={saving}
              onPress={() => void handleAddTrigger()}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.form}>
            {tasks.map((t) => (
              <View key={t.id} style={styles.listRow}>
                <Text style={styles.listText}>{t.name}</Text>
              </View>
            ))}
            {tasks.length === 0 ? <Text style={styles.muted}>No tasks yet.</Text> : null}
            <TextField
              label="Task name *"
              value={newTask.name}
              onChangeText={(name) => setNewTask({ ...newTask, name })}
            />
            <TextField
              label="Description"
              value={newTask.description}
              onChangeText={(description) => setNewTask({ ...newTask, description })}
            />
            <TextField
              label="Checklist items (one per line)"
              value={newTask.checklist}
              onChangeText={(checklist) => setNewTask({ ...newTask, checklist })}
              multiline
              numberOfLines={4}
            />
            <Button
              title="+ Add task"
              variant="secondary"
              size="sm"
              disabled={saving || !newTask.name.trim()}
              onPress={() => void handleAddTask()}
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.form}>
            {notifications.map((n) => (
              <View key={n.id} style={styles.listRow}>
                <Text style={styles.listText}>
                  {n.offset_days} days before — notify {n.recipient_role}
                </Text>
              </View>
            ))}
            <TextField
              label="Offset (days before due)"
              value={newNotification.offset_days}
              onChangeText={(offset_days) => setNewNotification({ ...newNotification, offset_days })}
              keyboardType="number-pad"
            />
            <TextField
              label="Recipient role"
              value={newNotification.recipient_role}
              onChangeText={(recipient_role) =>
                setNewNotification({ ...newNotification, recipient_role })
              }
              autoCapitalize="none"
            />
            <Button
              title="+ Add notification rule"
              variant="secondary"
              size="sm"
              disabled={saving}
              onPress={() => void handleAddNotification()}
            />
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.form}>
            <Pressable
              style={styles.checkRow}
              onPress={() =>
                setProgram({
                  ...program,
                  auto_generate_work_orders: !program.auto_generate_work_orders,
                })
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: program.auto_generate_work_orders }}
            >
              <View style={[styles.box, program.auto_generate_work_orders && styles.boxOn]}>
                {program.auto_generate_work_orders ? (
                  <Text style={styles.tick}>✓</Text>
                ) : null}
              </View>
              <Text style={styles.checkLabel}>
                Automatically generate work orders when triggers fire
              </Text>
            </Pressable>
            <Text style={styles.muted}>
              When enabled, the PM evaluator creates draft work orders from task templates when a
              trigger fires.
            </Text>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.form}>
            <Text style={styles.reviewLine}>
              <Text style={styles.reviewKey}>Name: </Text>
              {program.name}
            </Text>
            <Text style={styles.reviewLine}>
              <Text style={styles.reviewKey}>Category: </Text>
              {program.category}
            </Text>
            <Text style={styles.reviewLine}>
              <Text style={styles.reviewKey}>Triggers: </Text>
              {triggers.length}
            </Text>
            <Text style={styles.reviewLine}>
              <Text style={styles.reviewKey}>Tasks: </Text>
              {tasks.length}
            </Text>
            <Text style={styles.reviewLine}>
              <Text style={styles.reviewKey}>Notifications: </Text>
              {notifications.length}
            </Text>
            <Text style={styles.reviewLine}>
              <Text style={styles.reviewKey}>Auto WO: </Text>
              {program.auto_generate_work_orders ? 'Yes' : 'No'}
            </Text>
            {!isEdit ? (
              <Text style={styles.reviewLine}>
                <Text style={styles.reviewKey}>On finish: </Text>
                Program will be set to Active
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.navRow}>
          <Button
            title="Back"
            variant="secondary"
            disabled={step === 0 || saving}
            onPress={() => setStep(step - 1)}
          />
          <Button
            title={
              saving
                ? 'Saving…'
                : step === STEPS.length - 1
                  ? isEdit
                    ? 'Save changes'
                    : 'Finish'
                  : 'Save & continue'
            }
            disabled={saving || (step === 0 && !program.name.trim())}
            onPress={() => void saveStep()}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    ...typography.caption,
    color: colors.brandDark,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  stepsScroll: { marginBottom: spacing.md, maxHeight: 40 },
  steps: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.md },
  stepChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  stepChipDone: { backgroundColor: colors.brandSoft, borderColor: '#BFDBFE' },
  stepChipText: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  stepChipTextActive: { color: '#FFFFFF' },
  stepChipTextDone: { color: colors.brandDark },
  banner: { marginBottom: spacing.sm },
  card: { gap: spacing.md },
  form: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  muted: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  listRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: spacing.sm,
  },
  listText: { ...typography.body, color: colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  tick: { color: colors.brandDark, fontWeight: '700', fontSize: 12 },
  checkLabel: { ...typography.body, color: colors.text, flex: 1 },
  reviewLine: { ...typography.body, color: colors.text, marginBottom: 4 },
  reviewKey: { fontWeight: '700' },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
