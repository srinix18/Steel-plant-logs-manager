import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { StickyFooter } from '@/src/components/ui/StickyFooter';
import { CardStepBody } from '@/src/features/run-host/CardStepBody';
import { reportSheetLabel } from '@/src/features/reports/reportMeta';
import { useRunReport } from '@/src/features/reports/useRunReport';
import { colors, spacing, typography } from '@/src/theme/tokens';

type Props = {
  runId: string;
};

/**
 * P2-REPORTS — read-only structured run report + share HTML (no PDF backend).
 */
export function RunReportScreen({ runId }: Props) {
  const report = useRunReport(runId);

  if (report.loading && !report.run) {
    return <LoadingView message="Loading report…" />;
  }

  if (!report.run) {
    return (
      <Screen>
        {report.error ? <ErrorBanner message={report.error} /> : null}
        <EmptyState title="Report unavailable" description="Could not load this run." />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshing={report.refreshing}
      onRefresh={() => void report.reload({ soft: true })}
      footer={
        <StickyFooter>
          <View style={styles.footerRow}>
            <Button
              title="Open run"
              variant="secondary"
              size="lg"
              style={styles.footerBtn}
              onPress={() => router.push(`/(app)/heat/${runId}` as Href)}
            />
            <Button
              title={report.sharing ? 'Sharing…' : 'Share HTML'}
              size="lg"
              style={styles.footerBtn}
              loading={report.sharing}
              disabled={report.sharing}
              onPress={() => void report.shareHtml()}
            />
          </View>
        </StickyFooter>
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.runNumber} numberOfLines={1}>
            {report.run.run_number}
          </Text>
          <Text style={styles.meta}>
            {reportSheetLabel(report.docNo)}
            {report.docNo ? ` · ${report.docNo}` : ''}
          </Text>
        </View>
        <Badge label={report.run.current_state.replace(/_/g, ' ')} tone="brand" />
      </View>

      <Text style={styles.readOnly}>Read-only report — editing is on the run host.</Text>

      {report.error ? (
        <View style={styles.banner}>
          <ErrorBanner message={report.error} />
        </View>
      ) : null}
      {report.message ? <Text style={styles.success}>{report.message}</Text> : null}

      {report.steps.length === 0 ? (
        <EmptyState
          title="No sections"
          description="This template has no sections to display."
        />
      ) : (
        report.steps.map((step) => {
          const section = report.sections.find((s) => s.key === step.sectionKey);
          if (!section) return null;
          return (
            <Card key={step.id} style={styles.card}>
              <Text style={styles.stepTitle}>{step.label}</Text>
              <CardStepBody
                step={step}
                section={section}
                sectionData={report.sectionDataMap}
                onSectionDataChange={() => {}}
                ctx={{
                  runId,
                  runState: report.run!.current_state,
                  gradeElements: report.gradeElements,
                  steelGrades: report.steelGrades,
                  alloyMaterials: report.alloyMaterials,
                  scrapMaterials: report.scrapMaterials,
                  fieldValues: report.fieldValues,
                  onFieldChange: () => {},
                  fieldLookups: {
                    steelGrades: report.steelGrades,
                    plantUsers: report.plantUsers,
                    currentUserId: report.currentUserId,
                  },
                  plantUsers: report.plantUsers,
                  remarksRefreshKey: 0,
                  disabled: true,
                }}
              />
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  runNumber: { ...typography.title, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  readOnly: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  banner: { marginBottom: spacing.sm },
  success: { ...typography.caption, color: colors.success, marginBottom: spacing.sm },
  card: { marginBottom: spacing.md },
  stepTitle: { ...typography.section, color: colors.text, marginBottom: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerBtn: { flex: 1 },
});
