import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchPlants } from '@/src/api/lookups';
import {
  fetchWorkOrders,
  transitionWorkOrder,
  WO_STATUS_LABELS,
  type MaintenanceWorkOrder,
  type MaintenanceWorkOrderStatus,
} from '@/src/api/maintenancePm';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { VirtualList } from '@/src/components/ui/VirtualList';
import { colors, radius, spacing, touch, typography } from '@/src/theme/tokens';

const STATUS_TABS: { key: MaintenanceWorkOrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'waiting_parts', label: 'Waiting parts' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Closed' },
];

function statusTone(s: string): 'neutral' | 'brand' | 'success' | 'danger' {
  if (s === 'closed' || s === 'completed' || s === 'verified') return 'success';
  if (s === 'in_progress' || s === 'accepted') return 'brand';
  if (s.includes('waiting')) return 'danger';
  return 'neutral';
}

function taskProgress(wo: MaintenanceWorkOrder): string {
  const tasks = wo.tasks ?? [];
  const done = tasks.filter((t) => t.status !== 'pending').length;
  return `${done}/${tasks.length}`;
}

/**
 * P3-MAINT-WO-LIST — Work Orders (port of web WorkOrdersPage).
 * FlatList virtualization (P6-PERF).
 */
export function WorkOrdersScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<MaintenanceWorkOrderStatus | 'all'>('all');
  const [orders, setOrders] = useState<MaintenanceWorkOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false, statusTab: MaintenanceWorkOrderStatus | 'all' = tab) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const resolvedPlant =
          (user?.plant_id && plants.find((p) => p.id === user.plant_id)?.id) ||
          plants[0]?.id ||
          null;
        if (!resolvedPlant) {
          setOrders([]);
          setError('No plant available for work orders.');
          return;
        }
        setOrders(
          await fetchWorkOrders({
            plant_id: resolvedPlant,
            status: statusTab === 'all' ? undefined : statusTab,
          })
        );
      } catch (e) {
        setError(getErrorMessage(e));
        setOrders([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, user?.plant_id]
  );

  useEffect(() => {
    void load(false, tab);
  }, [load, tab]);

  const handleTransition = async (id: string, toState: MaintenanceWorkOrderStatus) => {
    setBusyId(id);
    setError(null);
    try {
      await transitionWorkOrder(id, { to_state: toState });
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleStart = async (wo: MaintenanceWorkOrder) => {
    setBusyId(wo.id);
    setError(null);
    try {
      if (wo.status === 'assigned') {
        await transitionWorkOrder(wo.id, { to_state: 'accepted' });
        await transitionWorkOrder(wo.id, { to_state: 'in_progress' });
      } else {
        await transitionWorkOrder(wo.id, { to_state: 'in_progress' });
      }
      await load(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openExec = (id: string) => {
    router.push(`/(app)/maintenance/work-orders/${id}` as Href);
  };

  if (loading && orders.length === 0) {
    return <LoadingView message="Loading work orders…" />;
  }

  return (
    <VirtualList
      data={orders}
      keyExtractor={(wo) => wo.id}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      header={
        <>
          <Text style={styles.title}>Work Orders</Text>
          <Text style={styles.sub}>PM and corrective maintenance work order queue.</Text>

          {error ? (
            <View style={styles.banner}>
              <ErrorBanner message={error} />
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
            style={styles.tabsScroll}
          >
            {STATUS_TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      }
      empty={<EmptyState title="No work orders" description="No work orders match this filter." />}
      renderItem={({ item: wo }) => {
        const busy = busyId === wo.id;
        const statusLabel =
          WO_STATUS_LABELS[wo.status as MaintenanceWorkOrderStatus] ?? wo.status;
        return (
          <Card style={styles.card}>
            <Pressable onPress={() => openExec(wo.id)} accessibilityRole="button">
              <View style={styles.rowTop}>
                <Text style={styles.woNumber}>{wo.wo_number}</Text>
                <Badge label={statusLabel} tone={statusTone(wo.status)} />
              </View>
              <Text style={styles.woTitle}>{wo.title}</Text>
              <Text style={styles.meta}>
                Due {wo.due_at ? new Date(wo.due_at).toLocaleDateString() : '—'}
                {' · '}
                Tasks {taskProgress(wo)}
              </Text>
            </Pressable>

            <View style={styles.actions}>
              {wo.status === 'draft' ? (
                <Button
                  title="Assign"
                  size="sm"
                  disabled={busy}
                  onPress={() => void handleTransition(wo.id, 'assigned')}
                />
              ) : null}
              {wo.status === 'assigned' ? (
                <Button
                  title="Accept"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onPress={() => void handleTransition(wo.id, 'accepted')}
                />
              ) : null}
              {wo.status === 'accepted' || wo.status === 'assigned' ? (
                <Button
                  title="Start"
                  size="sm"
                  disabled={busy}
                  onPress={() => void handleStart(wo)}
                />
              ) : null}
              <Button
                title="Open"
                variant="secondary"
                size="sm"
                onPress={() => openExec(wo.id)}
              />
            </View>
          </Card>
        );
      }}
    />
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
  tabsScroll: { marginBottom: spacing.md, maxHeight: touch.minTarget + 8 },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.md },
  tab: {
    minHeight: touch.minTarget - 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  tabLabel: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
  tabLabelActive: { color: '#FFFFFF' },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  woNumber: { ...typography.body, fontWeight: '700', color: colors.brandDark },
  woTitle: { ...typography.body, color: colors.text, marginTop: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
