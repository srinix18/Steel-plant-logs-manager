import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import {
  fetchOpenCorrectiveActions,
  fetchOpsObservations,
  fetchOrganisations,
  type OpsCorrectiveAction,
  type OpsObservation,
  type Organisation,
} from '@/src/api/admin';
import { getErrorMessage } from '@/src/api/client';
import {
  fetchDepartments,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
} from '@/src/api/lookups';
import { fetchAllRuns } from '@/src/api/processRuns';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import type { Department, Plant, Process, ProcessInstance } from '@/src/types/platform';
import type { ProcessRun } from '@/src/types/processRun';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P5-ADM-ACT — platform activity feed (port of AdminActivityPage).
 */
export function AdminActivityScreen() {
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [observations, setObservations] = useState<OpsObservation[]>([]);
  const [actions, setActions] = useState<OpsCorrectiveAction[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [orgFilter, setOrgFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [r, insts, procs, plts, depts, orgs] = await Promise.all([
        fetchAllRuns(),
        fetchProcessInstances(),
        fetchProcesses(),
        fetchPlants(),
        fetchDepartments(),
        fetchOrganisations(),
      ]);
      setRuns(r);
      setInstances(insts);
      setProcesses(procs);
      setPlants(plts);
      setDepartments(depts);
      setOrganisations(orgs);
      const plantId = plts[0]?.id;
      if (plantId) {
        const [obs, acts] = await Promise.all([
          fetchOpsObservations(plantId).catch(() => [] as OpsObservation[]),
          fetchOpenCorrectiveActions(plantId).catch(() => [] as OpsCorrectiveAction[]),
        ]);
        setObservations(obs);
        setActions(acts);
      } else {
        setObservations([]);
        setActions([]);
      }
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

  const runMeta = useCallback(
    (run: ProcessRun) => {
      const instance = instances.find((i) => i.id === run.process_instance_id);
      const process = instance
        ? processes.find((p) => p.id === instance.process_id)
        : undefined;
      const dept = process
        ? departments.find((d) => d.id === process.department_id)
        : undefined;
      const plant = dept ? plants.find((p) => p.id === dept.plant_id) : undefined;
      const org = plant
        ? organisations.find((o) => o.id === plant.organisation_id)
        : undefined;
      return { instance, process, dept, plant, org };
    },
    [instances, processes, departments, plants, organisations]
  );

  const departmentsForOrg = useMemo(
    () => (orgFilter ? departments.filter((d) => d.organisation_id === orgFilter) : departments),
    [departments, orgFilter]
  );

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const { org, dept, process } = runMeta(run);
      if (orgFilter && org?.id !== orgFilter) return false;
      if (deptFilter && dept?.id !== deptFilter) return false;
      if (processFilter && process?.code !== processFilter) return false;
      if (stateFilter && run.current_state !== stateFilter) return false;
      return true;
    });
  }, [runs, orgFilter, deptFilter, processFilter, stateFilter, runMeta]);

  const states = useMemo(
    () => [...new Set(runs.map((r) => r.current_state))].sort(),
    [runs]
  );

  if (loading && !refreshing) {
    return <LoadingView message="Loading activity…" />;
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void load(true)}>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.subtitle}>
        All production runs across the platform. Open a run report or heat workspace.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      <SelectSheet
        label="Organisation"
        options={[
          { value: '', label: 'All' },
          ...organisations.map((o) => ({ value: o.id, label: o.name })),
        ]}
        value={orgFilter}
        onChange={(v) => {
          setOrgFilter(v);
          setDeptFilter('');
        }}
      />
      <SelectSheet
        label="Department"
        options={[
          { value: '', label: 'All' },
          ...departmentsForOrg.map((d) => ({ value: d.id, label: d.name })),
        ]}
        value={deptFilter}
        onChange={setDeptFilter}
      />
      <SelectSheet
        label="Process"
        options={[
          { value: '', label: 'All' },
          ...processes.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
        ]}
        value={processFilter}
        onChange={setProcessFilter}
      />
      <SelectSheet
        label="State"
        options={[
          { value: '', label: 'All' },
          ...states.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
        ]}
        value={stateFilter}
        onChange={setStateFilter}
      />

      <Text style={styles.section}>
        Process runs ({filteredRuns.length}/{runs.length})
      </Text>
      {filteredRuns.length === 0 ? (
        <EmptyState title="No runs match the selected filters." />
      ) : (
        <View style={styles.list}>
          {filteredRuns.map((run) => {
            const meta = runMeta(run);
            const location = [meta.org?.name, meta.plant?.name, meta.dept?.name, meta.instance?.name]
              .filter(Boolean)
              .join(' → ');
            return (
              <Card key={run.id} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{run.run_number}</Text>
                  <Badge label={run.current_state.replace(/_/g, ' ')} tone="brand" />
                </View>
                <Text style={styles.rowMeta}>
                  {meta.process?.name ?? '—'} · {run.run_type.replace(/_/g, ' ')}
                </Text>
                <Text style={styles.rowMeta}>Line: {meta.instance?.name ?? '—'}</Text>
                <Text style={styles.rowMeta}>Location: {location || '—'}</Text>
                <Text style={styles.rowMeta}>
                  Started:{' '}
                  {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                </Text>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => router.push(`/(app)/reports/${run.id}` as Href)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>Report</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/(app)/heat/${run.id}` as Href)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>Heat</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Text style={styles.section}>Observations</Text>
      {observations.length === 0 ? (
        <EmptyState title="No observations recorded." />
      ) : (
        <View style={styles.list}>
          {observations.map((o) => (
            <Card key={o.id} style={styles.row}>
              <Badge
                label={o.severity}
                tone={o.severity === 'critical' ? 'danger' : 'neutral'}
              />
              <Text style={styles.rowBody}>{o.description}</Text>
              <Text style={styles.rowMeta}>{o.category}</Text>
            </Card>
          ))}
        </View>
      )}

      <Text style={styles.section}>Open corrective actions</Text>
      {actions.length === 0 ? (
        <EmptyState title="No open actions." />
      ) : (
        <View style={styles.list}>
          {actions.map((a) => (
            <Card key={a.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{a.title}</Text>
                {a.priority ? <Badge label={a.priority} tone="neutral" /> : null}
              </View>
              <Text style={styles.rowMeta}>{a.status}</Text>
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
  section: {
    ...typography.section,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
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
  rowBody: { ...typography.body, color: colors.text, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  link: { ...typography.caption, color: colors.brand, fontWeight: '600' },
});
