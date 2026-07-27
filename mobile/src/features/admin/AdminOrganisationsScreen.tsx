import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchOrganisations, type Organisation } from '@/src/api/admin';
import { getErrorMessage } from '@/src/api/client';
import {
  fetchDepartments,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
} from '@/src/api/lookups';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import type { Department, Plant, Process, ProcessInstance } from '@/src/types/platform';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

/**
 * P5-ADM-ORG — organisations hierarchy (GET-only port of AdminOrganisationsPage).
 */
export function AdminOrganisationsScreen() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [orgs, plts, depts, procs, insts] = await Promise.all([
        fetchOrganisations(),
        fetchPlants(),
        fetchDepartments(),
        fetchProcesses(),
        fetchProcessInstances(),
      ]);
      setOrganisations(orgs);
      setPlants(plts);
      setDepartments(depts);
      setProcesses(procs);
      setInstances(insts);
      setSelectedOrgId((prev) => prev ?? orgs[0]?.id ?? null);
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

  const selectedOrg = organisations.find((o) => o.id === selectedOrgId);
  const orgPlants = useMemo(
    () => plants.filter((p) => p.organisation_id === selectedOrgId),
    [plants, selectedOrgId]
  );
  const orgDepts = useMemo(
    () => departments.filter((d) => d.organisation_id === selectedOrgId),
    [departments, selectedOrgId]
  );
  const orgInstances = useMemo(
    () =>
      instances.filter((i) => {
        const proc = processes.find((p) => p.id === i.process_id);
        return proc && orgDepts.some((d) => d.id === proc.department_id);
      }),
    [instances, orgDepts, processes]
  );

  if (loading && !refreshing) {
    return <LoadingView message="Loading organisations…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Organisations</Text>
      <Text style={styles.subtitle}>
        All organisations, plants, and departments in the platform.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.section}>All organisations</Text>
      {organisations.length === 0 ? (
        <EmptyState title="No organisations." />
      ) : (
        <View style={styles.orgList}>
          {organisations.map((org) => {
            const active = selectedOrgId === org.id;
            return (
              <Pressable
                key={org.id}
                onPress={() => setSelectedOrgId(org.id)}
                style={[styles.orgBtn, active && styles.orgBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.orgName, active && styles.orgNameActive]}>{org.name}</Text>
                <Text style={styles.orgCode}>{org.code}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {selectedOrg ? (
        <>
          <Text style={styles.section}>{selectedOrg.name} — Plants</Text>
          {orgPlants.length === 0 ? (
            <EmptyState title="No plants in this organisation." />
          ) : (
            <View style={styles.list}>
              {orgPlants.map((p) => (
                <Card key={p.id} style={styles.row}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowMeta}>
                    {p.code} · {p.timezone}
                  </Text>
                </Card>
              ))}
            </View>
          )}

          <Text style={styles.section}>{selectedOrg.name} — Departments</Text>
          {orgDepts.length === 0 ? (
            <EmptyState title="No departments in this organisation." />
          ) : (
            <View style={styles.list}>
              {orgDepts.map((d) => {
                const plantName = plants.find((p) => p.id === d.plant_id)?.name ?? '—';
                const procCodes = processes
                  .filter((p) => p.department_id === d.id)
                  .map((p) => p.code)
                  .join(', ');
                return (
                  <Card key={d.id} style={styles.row}>
                    <Text style={styles.rowTitle}>
                      {d.name}{' '}
                      <Text style={styles.rowMeta}>({d.code})</Text>
                    </Text>
                    <Text style={styles.rowMeta}>Plant: {plantName}</Text>
                    <Text style={styles.rowMeta}>Processes: {procCodes || '—'}</Text>
                  </Card>
                );
              })}
            </View>
          )}

          <Text style={styles.section}>Equipment instances</Text>
          {orgInstances.length === 0 ? (
            <EmptyState title="No process instances configured." />
          ) : (
            <View style={styles.list}>
              {orgInstances.map((i) => (
                <Card key={i.id} style={styles.row}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>{i.name}</Text>
                    <Text style={styles.badge}>{i.status}</Text>
                  </View>
                  <Text style={styles.rowMeta}>
                    Process: {processes.find((p) => p.id === i.process_id)?.code ?? '—'}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  section: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  orgList: { gap: spacing.sm, marginBottom: spacing.md },
  orgBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  orgBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  orgName: { ...typography.body, color: colors.text, fontWeight: '600' },
  orgNameActive: { color: colors.brand },
  orgCode: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  row: { gap: spacing.xs },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600', flex: 1 },
  rowMeta: { ...typography.caption, color: colors.textMuted },
  badge: {
    ...typography.caption,
    color: colors.brand,
    fontWeight: '700',
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
