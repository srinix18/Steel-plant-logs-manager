import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  executeWorkOrderTask,
  fetchWorkOrder,
  transitionWorkOrder,
  WO_ALLOWED_TRANSITIONS,
  WO_STATUS_LABELS,
  WO_TRANSITION_ACTION_LABELS,
  type MaintenanceTaskExecutionStatus,
  type MaintenanceWorkOrder,
  type MaintenanceWorkOrderStatus,
  type MaintenanceWorkOrderTask,
} from '@/src/api/maintenancePm';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import { colors, spacing, typography } from '@/src/theme/tokens';

type ChecklistItem = { key: string; label: string };

function checklistItems(task: MaintenanceWorkOrderTask): ChecklistItem[] {
  const fromTemplate = Array.isArray(task.checklist) ? task.checklist : [];
  if (fromTemplate.length > 0) {
    return fromTemplate.map((item, idx) => {
      const label = item.label ?? item.key ?? `item_${idx}`;
      return { key: item.key ?? label, label };
    });
  }
  const responses = task.checklist_responses ?? {};
  const keys = Object.keys(responses);
  if (keys.length > 0) {
    return keys.map((k) => ({ key: k, label: k }));
  }
  return [{ key: 'Inspection complete', label: 'Inspection complete' }];
}

function statusTone(s: string): 'neutral' | 'brand' | 'success' | 'danger' {
  if (s === 'closed' || s === 'completed' || s === 'verified' || s === 'pass') return 'success';
  if (s === 'fail') return 'danger';
  if (s === 'in_progress' || s === 'accepted') return 'brand';
  return 'neutral';
}

/**
 * P3-MAINT-WO-EXEC — Work Order execution (port of web WorkOrderExecutionPage).
 * Wires every transition allowed by the API (not only web’s subset).
 */
export function WorkOrderExecScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workOrderId = typeof params.id === 'string' ? params.id : params.id?.[0];

  const [wo, setWo] = useState<MaintenanceWorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskRemarks, setTaskRemarks] = useState<Record<string, string>>({});
  const [checklistState, setChecklistState] = useState<Record<string, Record<string, boolean>>>(
    {}
  );
  const [photoDraft, setPhotoDraft] = useState<Record<string, string>>({});
  const [taskPhotos, setTaskPhotos] = useState<Record<string, string[]>>({});

  const load = useCallback(
    async (soft = false) => {
      if (!workOrderId) return;
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setWo(await fetchWorkOrder(workOrderId));
      } catch (e) {
        setError(getErrorMessage(e));
        setWo(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workOrderId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const allDone = useMemo(() => {
    if (!wo || wo.tasks.length === 0) return false;
    return wo.tasks.every((t) => t.status !== 'pending');
  }, [wo]);

  const allowedNext = useMemo(() => {
    if (!wo) return [] as MaintenanceWorkOrderStatus[];
    return WO_ALLOWED_TRANSITIONS[wo.status] ?? [];
  }, [wo]);

  const handleTransition = async (toState: MaintenanceWorkOrderStatus, notes?: string) => {
    if (!workOrderId) return;
    if (toState === 'completed' && !allDone) {
      setError('Complete all tasks before marking the work order completed.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await transitionWorkOrder(workOrderId, {
        to_state: toState,
        notes: notes ?? (toState === 'completed' ? 'All tasks executed' : undefined),
      });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTaskStatus = async (
    taskId: string,
    status: MaintenanceTaskExecutionStatus
  ) => {
    if (!workOrderId) return;
    setSaving(true);
    setError(null);
    try {
      const photos = taskPhotos[taskId] ?? [];
      await executeWorkOrderTask(workOrderId, taskId, {
        status,
        remarks: taskRemarks[taskId]?.trim() || undefined,
        checklist_responses: checklistState[taskId] ?? {},
        photos: photos.length > 0 ? photos : undefined,
        time_spent_min: 15,
      });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addPhoto = (taskId: string) => {
    const uri = (photoDraft[taskId] ?? '').trim();
    if (!uri) return;
    setTaskPhotos((prev) => ({
      ...prev,
      [taskId]: [...(prev[taskId] ?? []), uri],
    }));
    setPhotoDraft((prev) => ({ ...prev, [taskId]: '' }));
  };

  if (!workOrderId) {
    return (
      <Screen>
        <EmptyState title="Missing work order" description="No work order id in the route." />
        <Button
          title="Back to list"
          onPress={() => router.replace('/(app)/maintenance/work-orders' as Href)}
        />
      </Screen>
    );
  }

  if (loading && !wo) {
    return <LoadingView message="Loading work order…" />;
  }

  if (!wo) {
    return (
      <Screen>
        {error ? <ErrorBanner message={error} /> : null}
        <EmptyState title="Not found" description="Could not load this work order." />
        <Button
          title="Back to list"
          onPress={() => router.replace('/(app)/maintenance/work-orders' as Href)}
        />
      </Screen>
    );
  }

  const statusLabel = WO_STATUS_LABELS[wo.status as MaintenanceWorkOrderStatus] ?? wo.status;
  const tasks = [...wo.tasks].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Pressable
        onPress={() => router.push('/(app)/maintenance/work-orders' as Href)}
        accessibilityRole="link"
      >
        <Text style={styles.back}>← Back to work orders</Text>
      </Pressable>

      <Text style={styles.title}>
        {wo.wo_number} — {wo.title}
      </Text>
      <Badge label={statusLabel} tone={statusTone(wo.status)} />

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {allowedNext.length > 0 ? (
        <View style={styles.transitions}>
          <Text style={styles.section}>Transitions</Text>
          <View style={styles.actions}>
            {allowedNext.map((to) => {
              const blockedComplete = to === 'completed' && !allDone;
              return (
                <Button
                  key={to}
                  title={WO_TRANSITION_ACTION_LABELS[to]}
                  size="sm"
                  variant={to === 'completed' || to === 'closed' ? 'primary' : 'secondary'}
                  disabled={saving || blockedComplete}
                  onPress={() => void handleTransition(to)}
                />
              );
            })}
          </View>
          {allowedNext.includes('completed') && !allDone ? (
            <Text style={styles.hint}>Complete every task before Mark completed.</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.section}>Tasks</Text>
      {tasks.length === 0 ? (
        <Card>
          <EmptyState title="No tasks" description="No tasks on this work order." />
        </Card>
      ) : (
        tasks.map((task) => {
          const pending = task.status === 'pending';
          const items = checklistItems(task);
          const photos = taskPhotos[task.id] ?? [];
          return (
            <Card key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={styles.taskText}>
                  <Text style={styles.taskName}>{task.name}</Text>
                  <Text style={styles.meta}>Status: {task.status.replace(/_/g, ' ')}</Text>
                </View>
                {!pending ? (
                  <Badge label={task.status.replace(/_/g, ' ')} tone={statusTone(task.status)} />
                ) : null}
              </View>

              {pending ? (
                <>
                  <Text style={styles.checklistTitle}>Checklist</Text>
                  {items.map((item) => {
                    const checked = checklistState[task.id]?.[item.key] ?? false;
                    return (
                      <Pressable
                        key={item.key}
                        style={styles.checkRow}
                        onPress={() =>
                          setChecklistState((prev) => ({
                            ...prev,
                            [task.id]: {
                              ...prev[task.id],
                              [item.key]: !checked,
                            },
                          }))
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                      >
                        <View style={[styles.box, checked && styles.boxOn]}>
                          {checked ? <Text style={styles.tick}>✓</Text> : null}
                        </View>
                        <Text style={styles.checkLabel}>{item.label}</Text>
                      </Pressable>
                    );
                  })}

                  <TextField
                    label="Remarks"
                    value={taskRemarks[task.id] ?? ''}
                    onChangeText={(t) =>
                      setTaskRemarks((prev) => ({ ...prev, [task.id]: t }))
                    }
                    multiline
                    numberOfLines={2}
                    placeholder="Optional notes"
                  />

                  <TextField
                    label="Photo URI (optional)"
                    value={photoDraft[task.id] ?? ''}
                    onChangeText={(t) =>
                      setPhotoDraft((prev) => ({ ...prev, [task.id]: t }))
                    }
                    placeholder="https://… or file://"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Button
                    title="Add photo reference"
                    variant="ghost"
                    size="sm"
                    onPress={() => addPhoto(task.id)}
                  />
                  {photos.length > 0 ? (
                    <Text style={styles.meta}>Photos queued: {photos.length}</Text>
                  ) : null}

                  <View style={styles.actions}>
                    <Button
                      title="N/A"
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onPress={() => void handleTaskStatus(task.id, 'not_applicable')}
                    />
                    <Button
                      title="Fail"
                      variant="danger"
                      size="sm"
                      disabled={saving}
                      onPress={() => void handleTaskStatus(task.id, 'fail')}
                    />
                    <Button
                      title="Pass"
                      size="sm"
                      disabled={saving}
                      onPress={() => void handleTaskStatus(task.id, 'pass')}
                    />
                  </View>
                </>
              ) : (
                <>
                  {task.remarks ? (
                    <Text style={styles.meta}>Remarks: {task.remarks}</Text>
                  ) : null}
                  {(task.photos?.length ?? 0) > 0 ? (
                    <Text style={styles.meta}>Photos: {task.photos!.length}</Text>
                  ) : null}
                </>
              )}
            </Card>
          );
        })
      )}
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
  banner: { marginTop: spacing.sm, marginBottom: spacing.sm },
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  transitions: { marginTop: spacing.sm },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  taskCard: { marginBottom: spacing.sm, gap: spacing.sm },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  taskText: { flex: 1, minWidth: 0 },
  taskName: { ...typography.body, fontWeight: '700', color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  checklistTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  boxOn: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  tick: { color: colors.brandDark, fontWeight: '700', fontSize: 12 },
  checkLabel: { ...typography.body, color: colors.text, flex: 1 },
});
