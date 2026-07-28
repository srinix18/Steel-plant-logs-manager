import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { useRunHost } from '@/src/features/run-host/useRunHost';
import { useKeepAwake } from '@/src/hooks/useKeepAwake';
import {
  isAodLadleTemplate,
  isBbarDailyTemplate,
  isCcmCastTemplate,
  isGrindDailyTemplate,
  isIafHeatTemplate,
  isRmillShiftTemplate,
  isWireDivisionTemplate,
  transitionHint,
  transitionsForTab,
} from '@/src/utils/heatWorkflowUi';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  runId: string;
};

export function RunHostScreen({ runId }: Props) {
  useKeepAwake();

  // P6-PERF: keep Screen scroll — one card step at a time (do not FlatList the sheet).
  const host = useRunHost(runId);
  const [stepIndex, setStepIndex] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

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

  const step = host.steps[stepIndex];
  const section = step ? host.sections.find((s) => s.key === step.sectionKey) : undefined;

  // IAF: owning-card CTAs. AOD/CCM/RMILL/Wire/BBAR/GRIND: always show. Else: last card only.
  const tabTransitions =
    useGuided && step
      ? transitionsForTab(availableTransitions, step.sectionKey)
      : isAod || isCcm || isRmill || isWire || isBbar || isGrind || stepIndex === host.steps.length - 1
        ? availableTransitions
        : [];

  function jumpToStep(stepId: string) {
    const idx = host.steps.findIndex((s) => s.id === stepId);
    if (idx >= 0) setStepIndex(idx);
  }

  async function saveCurrent() {
    if (!section || !step) return;
    setLocalError(null);
    host.setMessage(null);
    try {
      if (step.kind === 'fields' || section.section_type === 'fields') {
        await host.saveFields(section.fields.map((f) => f.name));
      } else {
        await host.saveSection(section);
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Save failed');
      throw e;
    }
  }

  async function goNext() {
    try {
      await saveCurrent();
      setStepIndex((i) => Math.min(i + 1, host.steps.length - 1));
    } catch {
      /* error already set */
    }
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
              disabled={stepIndex === 0 || host.saving}
              onPress={() => setStepIndex((i) => Math.max(i - 1, 0))}
            />
            <Button
              title={host.saving ? 'Saving…' : 'Save'}
              variant="secondary"
              size="lg"
              style={styles.footerBtn}
              loading={host.saving}
              onPress={() => void saveCurrent()}
            />
            <Button
              title="Next"
              size="lg"
              style={styles.footerBtn}
              disabled={host.saving || stepIndex >= host.steps.length - 1}
              onPress={() => void goNext()}
            />
          </View>
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
            <Text style={styles.workflowTitle}>Workflow</Text>
            {tabTransitions.length === 1 && transitionHint(tabTransitions[0]) ? (
              <Text style={styles.workflowHint}>{transitionHint(tabTransitions[0])}</Text>
            ) : null}
            {tabTransitions.map((t) => (
              <Button
                key={`${t.from_state}-${t.to_state}`}
                title={host.transitioning ? 'Working…' : t.label}
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
  headerActions: { alignItems: 'flex-end', gap: spacing.xs },
  runNumber: { ...typography.title, color: colors.text },
  stepMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  banner: { marginTop: spacing.sm },
  success: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  stepTitle: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.md,
  },
  workflow: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  workflowTitle: { ...typography.section, color: colors.brandDark },
  workflowHint: { ...typography.caption, color: colors.brandDark, marginBottom: spacing.xs },
  eventsTitle: { ...typography.section, color: colors.text, marginBottom: spacing.sm },
  eventRow: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerBtn: { flex: 1 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
