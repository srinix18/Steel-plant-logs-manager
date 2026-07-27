import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import {
  fetchDashboardMetrics,
  fetchOrganisations,
  type DashboardMetrics,
  type Organisation,
} from '@/src/api/admin';
import { getErrorMessage } from '@/src/api/client';
import {
  fetchDepartments,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
} from '@/src/api/lookups';
import { fetchAllRuns, fetchTemplates } from '@/src/api/processRuns';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import type { Department, Plant, Process, ProcessInstance } from '@/src/types/platform';
import type { ProcessRun, TemplateDetail } from '@/src/types/processRun';
import { colors, spacing, typography } from '@/src/theme/tokens';

const METRIC_CARDS: { key: keyof DashboardMetrics; label: string }[] = [
  { key: 'total_organisations', label: 'Organisations' },
  { key: 'total_plants', label: 'Plants' },
  { key: 'active_runs', label: 'Active Heats' },
  { key: 'open_observations', label: 'Open Observations' },
  { key: 'open_corrective_actions', label: 'Open Actions' },
];

/**
 * P5-ADM-HOME — admin overview (port of AdminDashboard).
 */
export function AdminHomeScreen() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [templates, setTemplates] = useState<TemplateDetail[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [m, r, t, orgs, plts, depts, procs, insts] = await Promise.all([
        fetchDashboardMetrics(),
        fetchAllRuns(),
        fetchTemplates(),
        fetchOrganisations(),
        fetchPlants(),
        fetchDepartments(),
        fetchProcesses(),
        fetchProcessInstances(),
      ]);
      setMetrics(m);
      setRuns(r.slice(0, 8));
      setTemplates(t);
      setOrganisations(orgs);
      setPlants(plts);
      setDepartments(depts);
      setProcesses(procs);
      setInstances(insts);
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

  if (loading && !refreshing) {
    return <LoadingView message="Loading admin overview…" />;
  }

  const furnaceLog = templates.find((t) => t.doc_no === 'F/PRD/02');

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Admin Overview</Text>
      <Text style={styles.subtitle}>
        Cross-organisation view of plants, departments, log sheets, and live activity.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.metrics}>
        {METRIC_CARDS.map(({ key, label }) => (
          <Card key={key} style={styles.metric}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{metrics ? metrics[key] : '—'}</Text>
          </Card>
        ))}
      </View>

      <Text style={styles.section}>Organisation hierarchy</Text>
      {organisations.length === 0 ? (
        <EmptyState title="No organisations configured." />
      ) : (
        <View style={styles.list}>
          {organisations.map((org) => {
            const orgPlants = plants.filter((p) => p.organisation_id === org.id);
            return (
              <Card key={org.id} style={styles.hierarchyCard}>
                <View style={styles.rowHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{org.name}</Text>
                    <Text style={styles.rowMeta}>{org.code}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(app)/admin/organisations' as Href)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>View</Text>
                  </Pressable>
                </View>
                {orgPlants.map((plant) => {
                  const plantDepts = departments.filter((d) => d.plant_id === plant.id);
                  return (
                    <View key={plant.id} style={styles.plantBlock}>
                      <Text style={styles.plantTitle}>
                        {plant.name}{' '}
                        <Text style={styles.rowMeta}>({plant.code})</Text>
                      </Text>
                      {plantDepts.map((dept) => {
                        const deptProcesses = processes.filter(
                          (p) => p.department_id === dept.id
                        );
                        return (
                          <View key={dept.id} style={styles.deptBlock}>
                            <Text style={styles.deptTitle}>{dept.name}</Text>
                            {deptProcesses.map((proc) => {
                              const procInstances = instances.filter(
                                (i) => i.process_id === proc.id
                              );
                              return (
                                <Text key={proc.id} style={styles.procLine}>
                                  <Text style={styles.procCode}>{proc.code}</Text> — {proc.name}
                                  {procInstances.length > 0
                                    ? ` (${procInstances.map((i) => i.name).join(', ')})`
                                    : ''}
                                </Text>
                              );
                            })}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </Card>
            );
          })}
        </View>
      )}

      <Text style={styles.section}>Log sheets</Text>
      {templates.length === 0 ? (
        <EmptyState title="No templates configured." />
      ) : (
        <View style={styles.list}>
          {templates.map((t) => {
            const rev =
              (t.versions ?? []).find((v) => v.status === 'published')?.rev_no ?? 'draft';
            return (
              <Pressable
                key={t.id}
                onPress={() =>
                  router.push(`/(app)/admin/sheets?doc=${encodeURIComponent(t.doc_no)}` as Href)
                }
              >
                <Card style={styles.row}>
                  <View style={styles.rowHeader}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{t.name}</Text>
                      <Text style={styles.rowMeta}>Doc {t.doc_no}</Text>
                    </View>
                    <Text style={styles.badge}>{rev}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          {furnaceLog ? (
            <Pressable
              onPress={() =>
                router.push('/(app)/admin/sheets?doc=F%2FPRD%2F02' as Href)
              }
            >
              <Text style={styles.link}>Open Furnace Log Sheet →</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Recent heats</Text>
        <Pressable onPress={() => router.push('/(app)/admin/activity' as Href)}>
          <Text style={styles.link}>View all</Text>
        </Pressable>
      </View>
      {runs.length === 0 ? (
        <EmptyState
          title="No heats recorded yet."
          description="Start one from Shift Dashboard."
        />
      ) : (
        <View style={styles.list}>
          {runs.map((run) => (
            <Card key={run.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{run.run_number}</Text>
                <Text style={styles.badge}>{run.current_state}</Text>
              </View>
              <View style={styles.runActions}>
                <Pressable
                  onPress={() => router.push(`/(app)/heat/${run.id}` as Href)}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>Open heat</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/(app)/reports/${run.id}` as Href)}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>Report</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  metric: { width: '47%', flexGrow: 1, minWidth: 140 },
  metricLabel: { ...typography.caption, color: colors.textMuted },
  metricValue: { ...typography.title, color: colors.brand, marginTop: spacing.xs },
  section: { ...typography.section, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  hierarchyCard: { gap: spacing.sm },
  plantBlock: {
    marginLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.brandSoft,
    paddingLeft: spacing.sm,
    gap: spacing.xs,
  },
  plantTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  deptBlock: {
    marginLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
    gap: 2,
  },
  deptTitle: { ...typography.body, color: colors.text },
  procLine: { ...typography.caption, color: colors.textMuted },
  procCode: { fontWeight: '700', color: colors.text },
  row: { gap: spacing.xs },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  flex: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
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
  link: { ...typography.caption, color: colors.brand, fontWeight: '600' },
  runActions: { flexDirection: 'row', gap: spacing.md },
});
