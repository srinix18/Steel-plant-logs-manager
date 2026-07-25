import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/src/api/client';
import { fetchDepartments, fetchPlants, fetchProcesses } from '@/src/api/lookups';
import { useAuth } from '@/src/auth/AuthContext';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { ListRow } from '@/src/components/ui/ListRow';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import {
  isShellDepartmentCode,
  shellDepartmentHref,
  shellDepartmentMessage,
} from '@/src/features/org/deptShells';
import { isLogSheetProcessCode } from '@/src/features/shift/processOptions';
import type { Department, Process } from '@/src/types/platform';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P2-DEPT-SHELLS — read-only org department browser.
 * QUAL / UTIL: browse-only. MAINT: deep-link Maintenance module. No fake log templates.
 */
export function DeptBrowserScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [processesByDept, setProcessesByDept] = useState<Record<string, Process[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const plants = await fetchPlants();
        const plantId =
          (user?.plant_id && plants.find((p) => p.id === user.plant_id)?.id) || plants[0]?.id;
        const depts = await fetchDepartments(plantId);
        setDepartments(depts);

        const procMap: Record<string, Process[]> = {};
        await Promise.all(
          depts.map(async (d) => {
            procMap[d.id] = await fetchProcesses(d.id).catch(() => [] as Process[]);
          })
        );
        setProcessesByDept(procMap);
      } catch (e) {
        setError(getErrorMessage(e));
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

  if (loading && !departments.length) {
    return <LoadingView message="Loading departments…" />;
  }

  const selected = departments.find((d) => d.id === selectedId) ?? null;
  const procs = selected ? processesByDept[selected.id] ?? [] : [];
  const shell = selected ? isShellDepartmentCode(selected.code) : false;
  const maintHref = selected ? shellDepartmentHref(selected.code) : null;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Departments</Text>
      <Text style={styles.sub}>
        Browse plant departments. QUAL / UTIL are shells (no log sheet). Maintenance opens the
        Maintenance module — never a fake run host.
      </Text>

      {error ? (
        <View style={styles.banner}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {!departments.length ? (
        <EmptyState title="No departments" description="No departments returned for this plant." />
      ) : (
        <Card padded={false} style={styles.listCard}>
          {departments.map((d) => {
            const isShell = isShellDepartmentCode(d.code);
            return (
              <ListRow
                key={d.id}
                title={`${d.code} — ${d.name}`}
                subtitle={isShell ? 'Shell · no log sheet' : 'Production / ops'}
                onPress={() => setSelectedId(d.id)}
                right={
                  <Badge
                    label={isShell ? 'Shell' : 'Ops'}
                    tone={isShell ? 'neutral' : 'brand'}
                  />
                }
              />
            );
          })}
        </Card>
      )}

      {selected ? (
        <Card style={styles.detail}>
          <Text style={styles.detailTitle}>
            {selected.code} — {selected.name}
          </Text>
          {shell ? (
            <>
              <Text style={styles.detailBody}>{shellDepartmentMessage(selected.code)}</Text>
              {maintHref ? (
                <ListRow
                  title="Open Maintenance"
                  subtitle="Issue queue / PM (Part E)"
                  onPress={() => router.push(maintHref as Href)}
                />
              ) : (
                <Text style={styles.muted}>No log sheet launcher for this department.</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.detailBody}>
                Processes below can open the Shift Dashboard when they are in the log-sheet catalog.
                Codes outside that catalog never start a run.
              </Text>
              {procs.length === 0 ? (
                <Text style={styles.muted}>No processes under this department.</Text>
              ) : (
                procs.map((p) => {
                  const loggable = isLogSheetProcessCode(p.code);
                  return (
                    <ListRow
                      key={p.id}
                      title={`${p.code} — ${p.name}`}
                      subtitle={
                        loggable
                          ? 'Log sheet available via Shift Dashboard'
                          : 'Not a mobile log sheet — will not open run host'
                      }
                      onPress={
                        loggable ? () => router.push('/(app)/shift' as Href) : undefined
                      }
                      showChevron={loggable}
                    />
                  );
                })
              )}
            </>
          )}
        </Card>
      ) : null}
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
  listCard: { overflow: 'hidden', marginBottom: spacing.md },
  detail: { gap: spacing.sm },
  detailTitle: { ...typography.section, color: colors.text },
  detailBody: { ...typography.body, color: colors.text, lineHeight: 22 },
  muted: { ...typography.caption, color: colors.textMuted },
});
