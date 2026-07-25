import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchPlants } from '@/src/api/lookups';
import {
  evaluatePmTriggers,
  fetchMaintenancePrograms,
  generateWorkOrderFromProgram,
  updateMaintenanceProgram,
  type MaintenanceProgram,
} from '@/src/api/maintenancePm';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

function statusTone(s: string): 'neutral' | 'brand' | 'success' | 'danger' {
  if (s === 'active') return 'success';
  if (s === 'draft') return 'neutral';
  return 'brand';
}

/**
 * P3-MAINT-PM-LIST — PM Programs (port of web MaintenanceProgramsPage).
 */
export function MaintenanceProgramsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<MaintenanceProgram[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const pid =
          (user?.plant_id && plants.find((p) => p.id === user.plant_id)?.id) ||
          plants[0]?.id ||
          null;
        setPlantId(pid);
        if (!pid) {
          setPrograms([]);
          setError('No plant available for PM programs.');
          return;
        }
        setPrograms(await fetchMaintenancePrograms(pid));
      } catch (e) {
        setError(getErrorMessage(e));
        setPrograms([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.plant_id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async (id: string) => {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await updateMaintenanceProgram(id, { status: 'active' });
      setMessage('Program activated — run PM evaluate or generate a work order.');
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const generateWo = async (id: string) => {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const wo = await generateWorkOrderFromProgram(id);
      setMessage(`Work order ${wo.wo_number} created (Draft). Open Work Orders → Assign.`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const runEvaluate = async (force: boolean) => {
    if (!plantId) return;
    setEvaluating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await evaluatePmTriggers({ plantId, force });
      setMessage(
        `PM evaluate: ${result.triggers_evaluated} trigger(s) checked, ${result.work_orders_generated} work order(s) created.`
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setEvaluating(false);
    }
  };

  if (loading && programs.length === 0) {
    return <LoadingView message="Loading PM programs…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>PM Programs</Text>
      <Text style={styles.sub}>
        Preventive maintenance programs. Only active programs with triggers fire on evaluate.
      </Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      {message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={evaluating ? 'Evaluating…' : 'Run PM evaluate'}
          variant="secondary"
          size="lg"
          style={styles.actionBtn}
          disabled={evaluating || !plantId}
          onPress={() => void runEvaluate(false)}
        />
        <Button
          title="Force evaluate"
          variant="secondary"
          size="lg"
          style={styles.actionBtn}
          disabled={evaluating || !plantId}
          onPress={() => void runEvaluate(true)}
        />
        <Button
          title="Create program"
          size="lg"
          style={styles.actionBtn}
          onPress={() => router.push('/(app)/maintenance/programs/new' as Href)}
        />
        <Button
          title="Work orders"
          variant="secondary"
          size="lg"
          style={styles.actionBtn}
          onPress={() => router.push('/(app)/maintenance/work-orders' as Href)}
        />
      </View>

      <Card style={styles.tipCard}>
        <Text style={styles.tipText}>
          Draft programs do not evaluate. Activate the program, then Generate WO or Run PM
          evaluate. New work orders appear under Work Orders as Draft.
        </Text>
      </Card>

      {programs.length === 0 ? (
        <EmptyState
          title="No PM programs"
          description="No PM programs yet. Create one to get started."
        />
      ) : (
        programs.map((p) => {
          const busy = busyId === p.id;
          return (
            <Card key={p.id} style={styles.card}>
              <Pressable
                onPress={() =>
                  router.push(`/(app)/maintenance/programs/${p.id}/edit` as Href)
                }
                accessibilityRole="button"
              >
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Badge label={p.status} tone={statusTone(p.status)} />
                </View>
                <Text style={styles.meta}>
                  {p.category} · {p.priority}
                  {' · '}
                  Auto WO {p.auto_generate_work_orders ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.meta}>Team {p.responsible_team ?? '—'}</Text>
              </Pressable>
              <View style={styles.rowActions}>
                {p.status === 'draft' ? (
                  <Button
                    title="Activate"
                    size="sm"
                    disabled={busy}
                    onPress={() => void activate(p.id)}
                  />
                ) : null}
                <Button
                  title="Generate WO"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onPress={() => void generateWo(p.id)}
                />
                <Button
                  title="Edit"
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    router.push(`/(app)/maintenance/programs/${p.id}/edit` as Href)
                  }
                />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  banner: { marginBottom: spacing.sm },
  messageBox: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  messageText: { ...typography.caption, color: '#166534', lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionBtn: { flexGrow: 1, minWidth: '45%' },
  tipCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.brandSoft,
    borderColor: '#BFDBFE',
  },
  tipText: { ...typography.caption, color: colors.text, lineHeight: 18 },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { ...typography.body, fontWeight: '700', color: colors.brandDark, flex: 1 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
