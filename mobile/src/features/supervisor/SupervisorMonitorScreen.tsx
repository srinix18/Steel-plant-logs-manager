import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/src/api/client';
import {
  createMaintenanceIssue,
  DEFAULT_ISSUE_CATEGORIES,
  fetchMaintenanceCategories,
  fetchMaintenanceIssues,
  ISSUE_SEVERITIES,
  type IssueCategory,
  type IssueSeverity,
  type MaintenanceCategory,
  type MaintenanceIssue,
} from '@/src/api/maintenance';
import {
  fetchDepartments,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
} from '@/src/api/lookups';
import { fetchAllRuns } from '@/src/api/processRuns';
import { useAuth } from '@/src/auth/AuthContext';
import { hasRole, SUPERVISOR_ONLY_ROLES } from '@/src/auth/roles';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { TextField } from '@/src/components/ui/TextField';
import { VirtualList } from '@/src/components/ui/VirtualList';
import {
  canSubmitMaintenanceIssue,
  filterSupervisorRuns,
  uniqueRunStates,
} from '@/src/features/supervisor/supervisorFilters';
import type { ProcessRun } from '@/src/types/processRun';
import type { Department, Process, ProcessInstance } from '@/src/types/platform';
import { colors, radius, spacing, typography } from '@/src/theme/tokens';

type Props = {
  /** Default: Operations Activity. HOD chunk can override. */
  title?: string;
  subtitle?: string;
};

/**
 * P3-OPS-SUPER — Operations Activity (port of web SupervisorMonitor).
 * FlatList for production runs (P6-PERF).
 */
export function SupervisorMonitorScreen({
  title = 'Operations Activity',
  subtitle = 'Runs in your plant/department scope. Open a report or workspace to continue.',
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runs, setRuns] = useState<ProcessRun[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [plantId, setPlantId] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintCategories, setMaintCategories] = useState<MaintenanceCategory[]>([]);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDescription, setMaintDescription] = useState('');
  const [maintCategory, setMaintCategory] = useState<IssueCategory>('equipment');
  const [maintSeverity, setMaintSeverity] = useState<IssueSeverity>('medium');
  const [maintRunId, setMaintRunId] = useState('');
  const [savingMaint, setSavingMaint] = useState(false);
  const [openMaintIssues, setOpenMaintIssues] = useState<MaintenanceIssue[]>([]);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [r, insts, procs, depts, plants, issues] = await Promise.all([
          fetchAllRuns(),
          fetchProcessInstances(),
          fetchProcesses(),
          fetchDepartments(),
          fetchPlants(),
          fetchMaintenanceIssues({ status: 'open' }).catch(() => [] as MaintenanceIssue[]),
        ]);
        setRuns(r);
        setInstances(insts);
        setProcesses(procs);
        setDepartments(depts);
        setOpenMaintIssues(issues);
        const pid = user?.plant_id ?? plants[0]?.id ?? '';
        setPlantId(pid);
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
    fetchMaintenanceCategories()
      .then(setMaintCategories)
      .catch(() => setMaintCategories([]));
  }, [load]);

  const metaFor = useCallback(
    (run: ProcessRun) => {
      const instance = instances.find((i) => i.id === run.process_instance_id);
      const process = instance ? processes.find((p) => p.id === instance.process_id) : undefined;
      const dept = process ? departments.find((d) => d.id === process.department_id) : undefined;
      return {
        processCode: process?.code,
        processName: process?.name,
        instanceName: instance?.name,
        deptName: dept?.name,
      };
    },
    [instances, processes, departments]
  );

  const filteredRuns = useMemo(
    () =>
      filterSupervisorRuns(runs, {
        processFilter,
        stateFilter,
        metaFor,
      }),
    [runs, processFilter, stateFilter, metaFor]
  );

  const states = useMemo(() => uniqueRunStates(runs), [runs]);

  const categoryOptions = maintCategories.length
    ? maintCategories
    : DEFAULT_ISSUE_CATEGORIES;

  function resetMaintForm() {
    setMaintTitle('');
    setMaintDescription('');
    setMaintRunId('');
    setMaintCategory('equipment');
    setMaintSeverity('medium');
    setFormError(null);
  }

  async function submitMaintenanceIssue() {
    if (
      !canSubmitMaintenanceIssue({
        plantId,
        title: maintTitle,
        description: maintDescription,
      })
    ) {
      setFormError('Title and description are required.');
      return;
    }
    setSavingMaint(true);
    setFormError(null);
    try {
      await createMaintenanceIssue({
        plant_id: plantId,
        run_id: maintRunId || undefined,
        title: maintTitle.trim(),
        description: maintDescription.trim(),
        category: maintCategory,
        severity: maintSeverity,
      });
      setShowMaintModal(false);
      resetMaintForm();
      const issues = await fetchMaintenanceIssues({ status: 'open' }).catch(
        () => [] as MaintenanceIssue[]
      );
      setOpenMaintIssues(issues);
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSavingMaint(false);
    }
  }

  if (loading && !runs.length && !error) {
    return <LoadingView message="Loading operations…" />;
  }

  return (
    <>
      <VirtualList
        data={filteredRuns}
        keyExtractor={(run) => run.id}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        header={
          <>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub}>{subtitle}</Text>

            {error ? (
              <View style={styles.banner}>
                <ErrorBanner message={error} />
              </View>
            ) : null}

            {user && hasRole(user.role, SUPERVISOR_ONLY_ROLES) ? (
              <Button
                title="Raise maintenance issue"
                size="lg"
                fullWidth
                onPress={() => {
                  resetMaintForm();
                  setShowMaintModal(true);
                }}
                style={styles.raiseBtn}
              />
            ) : null}

            <View style={styles.filters}>
              <View style={styles.filterCol}>
                <SelectSheet
                  label="Process"
                  placeholder="All"
                  options={[
                    { label: 'All', value: '' },
                    ...processes.map((p) => ({ label: p.code, value: p.code })),
                  ]}
                  value={processFilter}
                  onChange={setProcessFilter}
                />
              </View>
              <View style={styles.filterCol}>
                <SelectSheet
                  label="State"
                  placeholder="All"
                  options={[
                    { label: 'All', value: '' },
                    ...states.map((s) => ({ label: s.replace(/_/g, ' '), value: s })),
                  ]}
                  value={stateFilter}
                  onChange={setStateFilter}
                />
              </View>
            </View>

            <Text style={styles.section}>Production runs</Text>
          </>
        }
        empty={
          <EmptyState
            title="No runs in your scope"
            description="Try clearing filters or start a run from Shift."
          />
        }
        renderItem={({ item: run }) => {
          const meta = metaFor(run);
          return (
            <Card style={styles.card}>
              <Pressable
                onPress={() => router.push(`/(app)/reports/${run.id}` as Href)}
                accessibilityRole="link"
                accessibilityLabel={`Report ${run.run_number}`}
              >
                <Text style={styles.runNo}>{run.run_number}</Text>
              </Pressable>
              <Text style={styles.meta}>
                {meta.processName ?? meta.processCode ?? '—'}
                {meta.instanceName ? ` · ${meta.instanceName}` : ''}
              </Text>
              <View style={styles.row}>
                <Badge label={run.current_state.replace(/_/g, ' ')} tone="brand" />
                <Button
                  title="Workspace"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push(`/(app)/heat/${run.id}` as Href)}
                />
              </View>
            </Card>
          );
        }}
        footer={
          openMaintIssues.length > 0 ? (
            <>
              <Text style={[styles.section, styles.issuesTitle]}>
                Open maintenance issues ({openMaintIssues.length})
              </Text>
              {openMaintIssues.slice(0, 8).map((issue) => (
                <Card key={issue.id} style={styles.card}>
                  <View style={styles.row}>
                    <View style={styles.textCol}>
                      <Text style={styles.issueTitle}>{issue.title}</Text>
                      <Text style={styles.meta}>
                        {issue.category} · {issue.raised_by_user?.full_name ?? '—'}
                      </Text>
                    </View>
                    <Badge label={issue.status.replace(/_/g, ' ')} tone="neutral" />
                  </View>
                  {issue.run_id ? (
                    <Button
                      title="View run report"
                      variant="ghost"
                      size="sm"
                      onPress={() => router.push(`/(app)/reports/${issue.run_id}` as Href)}
                    />
                  ) : null}
                </Card>
              ))}
            </>
          ) : null
        }
      />

      <Modal
        visible={showMaintModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMaintModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalSheet} edges={['bottom']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raise maintenance issue</Text>
              <Text style={styles.modalSub}>
                Routed to the maintenance crew for the selected category.
              </Text>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              {formError ? (
                <View style={styles.banner}>
                  <ErrorBanner message={formError} />
                </View>
              ) : null}
              <TextField
                label="Title *"
                value={maintTitle}
                onChangeText={setMaintTitle}
                placeholder="Short summary"
              />
              <SelectSheet
                label="Category *"
                options={categoryOptions.map((c) => ({
                  label: c.label,
                  value: c.value,
                }))}
                value={maintCategory}
                onChange={(v) => setMaintCategory(v as IssueCategory)}
              />
              <SelectSheet
                label="Severity *"
                options={ISSUE_SEVERITIES.map((s) => ({
                  label: s.label,
                  value: s.value,
                }))}
                value={maintSeverity}
                onChange={(v) => setMaintSeverity(v as IssueSeverity)}
              />
              <SelectSheet
                label="Related run (optional)"
                options={[
                  { label: 'None', value: '' },
                  ...runs.slice(0, 50).map((r) => ({
                    label: r.run_number,
                    value: r.id,
                  })),
                ]}
                value={maintRunId}
                onChange={setMaintRunId}
              />
              <TextField
                label="Description *"
                value={maintDescription}
                onChangeText={setMaintDescription}
                placeholder="What happened / what needs attention"
                multiline
                style={styles.multiline}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                size="lg"
                style={styles.modalBtn}
                onPress={() => setShowMaintModal(false)}
              />
              <Button
                title={savingMaint ? 'Submitting…' : 'Submit issue'}
                size="lg"
                style={styles.modalBtn}
                loading={savingMaint}
                disabled={
                  savingMaint ||
                  !canSubmitMaintenanceIssue({
                    plantId,
                    title: maintTitle,
                    description: maintDescription,
                  })
                }
                onPress={() => void submitMaintenanceIssue()}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
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
  raiseBtn: { marginBottom: spacing.md },
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterCol: { flex: 1, minWidth: 0 },
  section: { ...typography.section, color: colors.text, marginBottom: spacing.sm },
  issuesTitle: { marginTop: spacing.lg },
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  runNo: { ...typography.section, color: colors.brandDark },
  meta: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  textCol: { flex: 1, minWidth: 0 },
  issueTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  modalHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.section, color: colors.text },
  modalSub: { ...typography.caption, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  modalBody: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalBtn: { flex: 1 },
});
