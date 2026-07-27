import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchGradeElements,
  fetchMaterials,
  fetchSteelGrades,
} from '@/src/api/lookups';
import { fetchTemplates, fetchTemplateVersion } from '@/src/api/processRuns';
import { Badge } from '@/src/components/ui/Badge';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorBanner } from '@/src/components/ui/ErrorBanner';
import { LoadingView } from '@/src/components/ui/LoadingView';
import { Screen } from '@/src/components/ui/Screen';
import { SelectSheet } from '@/src/components/ui/SelectSheet';
import { CardStepBody } from '@/src/features/run-host/CardStepBody';
import { buildCardSteps } from '@/src/features/run-host/buildCardSteps';
import { initSectionDataMap } from '@/src/features/run-host/section-data';
import type {
  GradeElement,
  MaterialCatalogItem,
  SteelGrade,
} from '@/src/features/run-host/section-data/types';
import type { TemplateDetail, TemplateVersionDetail } from '@/src/types/processRun';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * P5-ADM-SHEETS — template preview (port of LogSheetPage, no DesktopOnlyGate).
 * Phone-simplified: read-only CardStepBody cards per section.
 */
export function AdminLogSheetsScreen() {
  const params = useLocalSearchParams<{ doc?: string }>();
  const docParam = (Array.isArray(params.doc) ? params.doc[0] : params.doc) || 'F/PRD/02';

  const [templates, setTemplates] = useState<TemplateDetail[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [versionDetail, setVersionDetail] = useState<TemplateVersionDetail | null>(null);
  const [steelGrades, setSteelGrades] = useState<SteelGrade[]>([]);
  const [gradeElements, setGradeElements] = useState<GradeElement[]>([]);
  const [alloyMaterials, setAlloyMaterials] = useState<MaterialCatalogItem[]>([]);
  const [scrapMaterials, setScrapMaterials] = useState<MaterialCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () =>
      templates.find((t) => t.id === selectedTemplateId) ??
      templates.find((t) => t.doc_no === docParam) ??
      null,
    [templates, selectedTemplateId, docParam]
  );

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, grades, alloys, scrap] = await Promise.all([
        fetchTemplates(),
        fetchSteelGrades(),
        fetchMaterials('alloy'),
        fetchMaterials('scrap'),
      ]);
      setTemplates(items);
      setSteelGrades(grades);
      setAlloyMaterials(alloys);
      setScrapMaterials(scrap);

      const match = items.find((t) => t.doc_no === docParam) ?? items[0];
      if (match) {
        setSelectedTemplateId(match.id);
        const published =
          (match.versions ?? []).find((v) => v.status === 'published') ??
          (match.versions ?? [])[0];
        if (published) setSelectedVersionId(published.id);
      }
      if (grades[0]) {
        setGradeElements(await fetchGradeElements(grades[0].id));
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [docParam]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!selectedVersionId) {
      setVersionDetail(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setError(null);
    fetchTemplateVersion(selectedVersionId)
      .then((detail) => {
        if (!cancelled) setVersionDetail(detail);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(getErrorMessage(e));
          setVersionDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVersionId]);

  const sections = useMemo(
    () =>
      versionDetail
        ? [...versionDetail.sections].sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [versionDetail]
  );

  const sectionDataMap = useMemo(
    () => initSectionDataMap(sections, gradeElements, {}),
    [sections, gradeElements]
  );

  const steps = useMemo(() => {
    // Preview: one chemistry sample / one row where expandable — keep list cards light.
    return buildCardSteps(sections, {
      chemistrySampleCount: { chemistry: 1 },
      materialRowCount: Object.fromEntries(
        sections.filter((s) => s.section_type === 'repeatable_group').map((s) => [s.key, 1])
      ),
      productionRowCount: Object.fromEntries(
        sections
          .filter(
            (s) =>
              s.section_type === 'production_log_table' ||
              s.section_type === 'production_register_table'
          )
          .map((s) => [s.key, 1])
      ),
      delayRowCount: Object.fromEntries(
        sections
          .filter((s) => s.section_type === 'delay_register_table')
          .map((s) => [s.key, 1])
      ),
      matrixRowCount: Object.fromEntries(
        sections.filter((s) => s.section_type === 'matrix_table').map((s) => [s.key, 1])
      ),
      sampleChemRowCount: Object.fromEntries(
        sections
          .filter((s) => s.section_type === 'sample_chemistry_matrix')
          .map((s) => [s.key, 1])
      ),
    }).filter((step) => {
      // Phone-simplified: section overview cards; skip dense per-row editors except first matrix row.
      if (step.kind === 'matrix_row') return step.itemIndex === 0;
      return (
        step.kind === 'fields' ||
        step.kind.endsWith('_list') ||
        step.kind === 'static_material' ||
        step.kind === 'target_chemistry'
      );
    });
  }, [sections]);

  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: `${t.doc_no} — ${t.name}`,
  }));

  const versionOptions = (selectedTemplate?.versions ?? []).map((v) => ({
    value: v.id,
    label: `Rev ${v.rev_no} (${v.status})`,
  }));

  if (loading) {
    return <LoadingView message="Loading templates…" />;
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Log Sheets</Text>
      <Text style={styles.subtitle}>
        Template preview (read-only). Production runs are saved from Shift Dashboard → Heat Workspace.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      <SelectSheet
        label="Sheet"
        options={templateOptions}
        value={selectedTemplate?.id ?? null}
        onChange={(id) => {
          setSelectedTemplateId(id);
          const tmpl = templates.find((t) => t.id === id);
          const ver =
            (tmpl?.versions ?? []).find((v) => v.status === 'published') ??
            (tmpl?.versions ?? [])[0];
          setSelectedVersionId(ver?.id ?? '');
        }}
        placeholder="Select template…"
      />

      {selectedTemplate ? (
        <SelectSheet
          label="Revision"
          options={versionOptions}
          value={selectedVersionId || null}
          onChange={setSelectedVersionId}
          placeholder="Select revision…"
        />
      ) : null}

      {!selectedTemplate ? (
        <EmptyState title="No log sheet templates found." />
      ) : null}

      {selectedTemplate && versionDetail ? (
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.flex}>
              <Text style={styles.sheetName}>{selectedTemplate.name}</Text>
              <Text style={styles.rowMeta}>
                Document {selectedTemplate.doc_no} · Revision {versionDetail.rev_no}
              </Text>
            </View>
            <Badge
              label={versionDetail.status}
              tone={versionDetail.status === 'published' ? 'brand' : 'neutral'}
            />
          </View>
        </Card>
      ) : null}

      {previewLoading ? <LoadingView message="Loading section preview…" /> : null}

      {!previewLoading && selectedTemplate && versionDetail && steps.length === 0 ? (
        <EmptyState title="No sections" description="This revision has no sections to preview." />
      ) : null}

      {!previewLoading &&
        steps.map((step) => {
          const section = sections.find((s) => s.key === step.sectionKey);
          if (!section) return null;
          return (
            <Card key={step.id} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{step.label}</Text>
              <Text style={styles.sectionType}>{section.section_type}</Text>
              <CardStepBody
                step={step}
                section={section}
                sectionData={sectionDataMap}
                onSectionDataChange={() => {}}
                ctx={{
                  runId: 'preview',
                  runState: 'preview',
                  gradeElements,
                  steelGrades,
                  alloyMaterials,
                  scrapMaterials,
                  fieldValues: {},
                  onFieldChange: () => {},
                  fieldLookups: {
                    steelGrades,
                    plantUsers: [],
                    currentUserId: undefined,
                  },
                  plantUsers: [],
                  remarksRefreshKey: 0,
                  disabled: true,
                }}
              />
            </Card>
          );
        })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  headerCard: { marginTop: spacing.md, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  sheetName: { ...typography.section, color: colors.text },
  rowMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  sectionCard: { marginBottom: spacing.md, gap: spacing.xs },
  sectionTitle: { ...typography.section, color: colors.text },
  sectionType: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
});
