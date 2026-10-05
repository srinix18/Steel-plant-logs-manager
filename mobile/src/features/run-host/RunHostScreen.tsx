import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/src/auth/AuthContext';
import { hasRole, PLATFORM_ADMIN_ROLES } from '@/src/auth/roles';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { Screen } from '@/src/components/ui/Screen';
import { StickyFooter } from '@/src/components/ui/StickyFooter';
import { CardStepBody } from '@/src/features/run-host/CardStepBody';
import { HeatWorkflowStepper } from '@/src/features/run-host/HeatWorkflowStepper';
import {
  DETAIL_STEP_KINDS,
  LIST_STEP_KINDS,
  nextCardStepIndex,
} from '@/src/features/run-host/nextCardStepIndex';
import { useRunHost } from '@/src/features/run-host/useRunHost';
import { useKeepAwake } from '@/src/hooks/useKeepAwake';
import {
  iafManualTransitionsForStep,
  isAodLadleTemplate,
  isBbarDailyTemplate,
  isCcmCastTemplate,
  isGrindDailyTemplate,
  isIafHeatTemplate,
  isRmillShiftTemplate,
  isWireDivisionTemplate,
  transitionHint,
} from '@/src/utils/heatWorkflowUi';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  runId: string;
};

/** Mirrors backend `_assert_run_editable`: approved or terminal runs accept no field edits. */
const LOCKED_RUN_STATES = new Set(['approved', 'closed', 'aborted']);

export function RunHostScreen({ runId }: Props) {
  useKeepAwake();

  // P6-PERF: keep Screen scroll — one card step at a time (do not FlatList the sheet).
  const host = useRunHost(runId);
  const { user } = useAuth();
  // Super Admin may inspect a log sheet but the server refuses every change.
  const viewOnly = !!user && hasRole(user.role, PLATFORM_ADMIN_ROLES);
  const [stepIndex, setStepIndex] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  /** Jump after steps rebuild (e.g. Add sample). */
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null);

  const sectionKeys = useMemo(() => host.sections.map((s) => s.key), [host.sections]);
  const useGuided = isIafHeatTemplate(sectionKeys);
  const isAod = isAodLadleTemplate(sectionKeys);
  const isCcm = isCcmCastTemplate(sectionKeys);
  const isRmill = isRmillShiftTemplate(sectionKeys);
  const isWire = isWireDivisionTemplate(sectionKeys);
  const isBbar = isBbarDailyTemplate(sectionKeys);
  const isGrind = isGrindDailyTemplate(sectionKeys);
  const availableTransitions = host.run?.workflow?.available_transitions ?? [];

  useEffect(() => {
    if (stepIndex >= host.steps.length) {
      setStepIndex(Math.max(0, host.steps.length - 1));
    }
  }, [host.steps.length, stepIndex]);

  useEffect(() => {
    if (host.suggestedStepIndex == null) return;
    setStepIndex(host.suggestedStepIndex);
    host.clearSuggestedStep();
  }, [host.suggestedStepIndex, host.clearSuggestedStep]);

  useEffect(() => {
    if (!pendingJumpId) return;
    const idx = host.steps.findIndex((s) => s.id === pendingJumpId);
    if (idx < 0) return;
    setStepIndex(idx);
    setPendingJumpId(null);
  }, [host.steps, pendingJumpId]);

  const step = host.steps[stepIndex];
  const section = step ? host.sections.find((s) => s.key === step.sectionKey) : undefined;

  // IAF: only Complete tap / Approve / Abort — phase advances with Save&Next.
  // Other templates: always-on CTAs (or last card for generic).
  const guidedOrAlwaysOn =
    useGuided && step
      ? iafManualTransitionsForStep(availableTransitions, step)
      : isAod || isCcm || isRmill || isWire || isBbar || isGrind || stepIndex === host.steps.length - 1
        ? availableTransitions
        : [];
  const tabTransitions = viewOnly ? [] : guidedOrAlwaysOn;

  function jumpToStep(stepId: string) {
    const idx = host.steps.findIndex((s) => s.id === stepId);
    if (idx >= 0) {
      setStepIndex(idx);
      if (useGuided) {
        const dest = host.steps[idx];
        if (dest) void host.syncIafPhaseForStep(dest);
      }
    } else setPendingJumpId(stepId);
  }

  async function saveCurrent() {
    if (!section || !step || viewOnly) return;
    // Server rejects edits once approved/closed/aborted (409); saving first would block Close.
    if (host.run && LOCKED_RUN_STATES.has(host.run.current_state)) return;
    setLocalError(null);
    host.setMessage(null);
    try {
      if (step.kind === 'fields' || section.section_type === 'fields') {
        const names = step.fieldNames?.length
          ? step.fieldNames
          : section.fields.map((f) => f.name);
        await host.saveFields(names);
      } else {
        await host.saveSection(section);
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Save failed');
      throw e;
    }
  }

  async function moveToStep(nextIdx: number) {
    setStepIndex(nextIdx);
    if (useGuided) {
      const dest = host.steps[nextIdx];
      if (dest) await host.syncIafPhaseForStep(dest);
    }
  }

  async function goNext() {
    try {
      await saveCurrent();
      const next = nextCardStepIndex(host.steps, stepIndex);
      if (next !== stepIndex) await moveToStep(next);
    } catch {
      /* error already set */
    }
  }

  async function goBack() {
    const cur = host.steps[stepIndex];
    if (cur && DETAIL_STEP_KINDS.has(cur.kind)) {
      const listIdx = host.steps.findIndex(
        (s) => s.sectionKey === cur.sectionKey && LIST_STEP_KINDS.has(s.kind)
      );
      if (listIdx >= 0) {
        await moveToStep(listIdx);
        return;
      }
    }
    const prev = Math.max(stepIndex - 1, 0);
    if (prev !== stepIndex) await moveToStep(prev);
  }

  if (host.loading && !host.run) {
    return <LoadingView message="Loading run…" />;
  }

  if (!host.run || !step || !section) {
    return (
      <Screen>
        {host.error ? <ErrorBanner message={host.error} /> : null}
        <EmptyState
          title="No log sheet for this run"
          description="This process has no fillable template sections on mobile. QUAL / MAINT / UTIL department shells never open a fake run host — use Maintenance or the department browser instead."
        />
      </Screen>
    );
  }

  const progress = host.steps.length > 0 ? (stepIndex + 1) / host.steps.length : 0;
  const banner = localError || host.error;
  const workflowTitle =
    step.sectionKey === 'electrical_power'
      ? 'Finish tap'
      : step.sectionKey === 'remarks_signoff'
        ? 'Sign-off'
        : 'Actions';
  const showDashboardExit =
    step.sectionKey === 'furnace_status' ||
    step.sectionKey === 'remarks_signoff' ||
    stepIndex >= host.steps.length - 1 ||
    ['completed', 'approved', 'closed'].includes(host.run.current_state);

  return (
    <Screen
      scroll
      refreshing={host.refreshing}
      onRefresh={() => void host.reload({ soft: true })}
      footer={
        <StickyFooter>
          <View style={styles.footerRow}>
            <Button
              title="Back"
              variant="secondary"
              size="lg"
              style={styles.footerBtn}
              disabled={stepIndex === 0 || host.saving || host.transitioning}
              onPress={() => void goBack()}
            />
            {viewOnly ? null : (
              <Button
                title={host.saving ? 'Saving…' : 'Save'}
                variant="secondary"
                size="lg"
                style={styles.footerBtn}
                loading={host.saving}
                onPress={() => void saveCurrent()}
              />
            )}
            <Button
              title="Next"
              size="lg"
              style={styles.footerBtn}
              disabled={
                host.saving ||
                host.transitioning ||
                nextCardStepIndex(host.steps, stepIndex) === stepIndex
              }
              onPress={() => void goNext()}
            />
          </View>
          {showDashboardExit ? (
            <Button
              title="Back to dashboard"
              variant="secondary"
              size="lg"
              fullWidth
              disabled={host.saving || host.transitioning}
              onPress={() => {
                void (async () => {
                  try {
                    await saveCurrent();
                  } catch {
                    /* still allow leave */
                  }
                  router.replace('/(app)/home' as Href);
                })();
              }}
            />
          ) : null}
        </StickyFooter>
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.runNumber} numberOfLines={1}>
            {host.run.run_number}
          </Text>
          <Text style={styles.stepMeta}>
            Step {stepIndex + 1} of {host.steps.length}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            title="Report"
            variant="secondary"
            size="md"
            onPress={() => router.push(`/(app)/reports/${runId}` as Href)}
          />
          <Badge label={host.run.current_state.replace(/_/g, ' ')} tone="brand" />
        </View>
      </View>

      <ProgressBar progress={progress} />

      {useGuided ? <HeatWorkflowStepper currentState={host.run.current_state} /> : null}

      {banner ? (
        <View style={styles.banner}>
          <ErrorBanner message={banner} />
        </View>
      ) : null}
      {host.message ? <Text style={styles.success}>{host.message}</Text> : null}
      {viewOnly ? (
        <Text style={styles.success}>Read-only: Super Admin can view this log sheet but not change it.</Text>
      ) : null}

      <Card>
        <Text style={styles.stepTitle}>{step.label}</Text>

        <CardStepBody
          step={step}
          section={section}
          sectionData={host.sectionDataMap}
          onSectionDataChange={host.setSectionData}
          onJumpToStep={jumpToStep}
          ctx={{
            runId,
            runState: host.run.current_state,
            gradeElements: host.gradeElements,
            steelGrades: host.steelGrades,
            alloyMaterials: host.alloyMaterials,
            scrapMaterials: host.scrapMaterials,
            fieldValues: host.fieldValues,
            onFieldChange: host.setFieldValue,
            fieldLookups: {
              steelGrades: host.steelGrades,
              plantUsers: host.plantUsers,
              assets: host.assets,
              assetGroupsByCode: host.assetGroupsByCode,
              currentUserId: host.currentUserId,
            },
            delayCodes: host.delayCodes,
            plantUsers: host.plantUsers,
            coils: host.coils,
            customers: host.customers,
            remarksRefreshKey: host.remarksRefreshKey,
            disabled: host.saving || host.transitioning,
          }}
        />

        {tabTransitions.length > 0 ? (
          <View style={styles.workflow}>
            <Text style={styles.workflowTitle}>{workflowTitle}</Text>
            {tabTransitions.length === 1 && transitionHint(tabTransitions[0]) ? (
              <Text style={styles.workflowHint}>{transitionHint(tabTransitions[0])}</Text>
            ) : null}
            {tabTransitions.map((t) => (
              <Button
                key={`${t.from_state}-${t.to_state}`}
                title={
                  host.transitioning
                    ? 'Working…'
                    : step.sectionKey === 'electrical_power' && t.to_state === 'completed'
                      ? 'Complete tap'
                      : t.label
                }
                size="lg"
                fullWidth
                variant={t.to_state === 'aborted' ? 'danger' : 'primary'}
                disabled={host.saving || host.transitioning}
                loading={host.transitioning}
                onPress={() => {
                  void (async () => {
                    try {
                      await saveCurrent();
                      await host.doTransition(t);
                    } catch {
                      /* shown via error */
                    }
                  })();
                }}
              />
            ))}
          </View>
        ) : null}
      </Card>

      {host.events.length > 0 ? (
        <Card>
          <Text style={styles.eventsTitle}>Activity ({host.events.length})</Text>
          {host.events.slice(0, 5).map((ev) => (
            <Text key={ev.id} style={styles.eventRow}>
              {new Date(ev.occurred_at).toLocaleString()} · {ev.event_type}
            </Text>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  runNumber: { ...typography.title, color: colors.text },
  stepMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  banner: { marginBottom: spacing.sm },
  success: { ...typography.caption, color: colors.success, marginBottom: spacing.sm },
  stepTitle: { ...typography.subtitle, color: colors.text, marginBottom: spacing.md },
  workflow: { marginTop: spacing.lg, gap: spacing.sm },
  workflowTitle: { ...typography.subtitle, color: colors.text },
  workflowHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  eventsTitle: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  eventRow: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerBtn: { flex: 1 },
});
