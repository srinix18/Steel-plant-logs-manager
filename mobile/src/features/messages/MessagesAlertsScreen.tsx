import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchNotifications,
  markNotificationRead,
  type AppNotification,
} from '@/src/api/messages';
import { useAuth } from '@/src/auth/AuthContext';
import { hasRole, MAINTENANCE_ROLES } from '@/src/auth/roles';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import {
  isMaintenanceAlert,
  maintenanceAlertSubtitle,
  maintenanceAlertTarget,
  maintenanceAlertTitle,
} from '@/src/utils/maintenanceAlerts';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

/**
 * P3-MSG-ALERTS — System notifications (port of MessagesPage alerts tab).
 */
export function MessagesAlertsScreen() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setAlerts(await fetchNotifications());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAlert = async (alert: AppNotification) => {
    setSelected(alert);
    setError(null);
    try {
      if (!alert.read_at) {
        await markNotificationRead(alert.id);
        await load(true);
        setSelected({ ...alert, read_at: new Date().toISOString() });
      }
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const openTarget = (alert: AppNotification) => {
    if (!user) return;
    const target = maintenanceAlertTarget(alert, user.role);
    if (target) router.push(target as Href);
  };

  if (loading && alerts.length === 0) {
    return <LoadingView message="Loading alerts…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Pressable
        onPress={() => router.push('/(app)/messages' as Href)}
        accessibilityRole="link"
      >
        <Text style={styles.back}>← Messages</Text>
      </Pressable>
      <Text style={styles.title}>Alerts</Text>
      <Text style={styles.sub}>System notifications. Tap to mark read and open related work.</Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {alerts.length === 0 ? (
        <EmptyState title="No alerts" description="You’re all caught up." />
      ) : (
        alerts.map((a) => {
          const unread = !a.read_at;
          const active = selected?.id === a.id;
          return (
            <Pressable
              key={a.id}
              style={[
                styles.row,
                unread && styles.rowUnread,
                active && styles.rowActive,
              ]}
              onPress={() => void openAlert(a)}
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {maintenanceAlertTitle(a)}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {[maintenanceAlertSubtitle(a), new Date(a.created_at).toLocaleString()]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {unread ? <Badge label="New" tone="brand" /> : null}
            </Pressable>
          );
        })
      )}

      {selected ? (
        <>
          <Text style={styles.section}>Alert detail</Text>
          <Card style={styles.detailCard}>
            <Text style={styles.detailTitle}>{maintenanceAlertTitle(selected)}</Text>
            <Text style={styles.rowMeta}>
              {new Date(selected.created_at).toLocaleString()}
            </Text>

            {isMaintenanceAlert(selected) && selected.maintenance_issue ? (
              <View style={styles.detailBody}>
                {selected.maintenance_issue.category ? (
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailKey}>Category: </Text>
                    {selected.maintenance_issue.category}
                  </Text>
                ) : null}
                {selected.maintenance_issue.status ? (
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailKey}>Status: </Text>
                    {selected.maintenance_issue.status.replace(/_/g, ' ')}
                  </Text>
                ) : null}
                {selected.notification_type === 'maintenance_issue_closed' &&
                selected.maintenance_issue.closed_by_user ? (
                  <Text style={styles.detailLine}>
                    <Text style={styles.detailKey}>Closed by: </Text>
                    {selected.maintenance_issue.closed_by_user.full_name}
                  </Text>
                ) : null}
                {selected.maintenance_issue.resolution_notes ? (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.detailKey}>Resolution</Text>
                    <Text style={styles.resolutionText}>
                      {selected.maintenance_issue.resolution_notes}
                    </Text>
                  </View>
                ) : null}
                {user && maintenanceAlertTarget(selected, user.role) ? (
                  <Button
                    title={
                      hasRole(user.role, MAINTENANCE_ROLES)
                        ? 'Open issue queue'
                        : 'View related run report'
                    }
                    size="sm"
                    onPress={() => openTarget(selected)}
                  />
                ) : selected.maintenance_issue.run_id ? (
                  <Button
                    title="View related run report"
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      router.push(
                        `/(app)/reports/${selected.maintenance_issue!.run_id}` as Href
                      )
                    }
                  />
                ) : null}
              </View>
            ) : (
              <Text style={styles.detailLine}>{maintenanceAlertSubtitle(selected)}</Text>
            )}
          </Card>
        </>
      ) : null}
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
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  banner: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  rowUnread: {
    borderColor: '#BFDBFE',
    backgroundColor: colors.brandSoft,
  },
  rowActive: {
    borderColor: colors.brand,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  section: { ...typography.section, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  detailCard: { gap: spacing.sm, marginBottom: spacing.lg },
  detailTitle: { ...typography.section, color: colors.text },
  detailBody: { gap: spacing.sm, marginTop: spacing.sm },
  detailLine: { ...typography.body, color: colors.text },
  detailKey: { color: colors.textMuted, fontWeight: '600' },
  resolutionBox: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.input,
    backgroundColor: colors.background,
  },
  resolutionText: { ...typography.body, color: colors.text, marginTop: spacing.xs, lineHeight: 22 },
});
