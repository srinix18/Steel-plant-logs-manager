import { useCallback, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getErrorMessage } from '@/src/api/client';
import {
  fetchGradeElements,
  fetchMaterials,
  fetchPlantUsers,
  fetchPlants,
  fetchSteelGrades,
} from '@/src/api/lookups';
import {
  fetchProcessRun,
  fetchTemplate,
  fetchTemplateVersion,
} from '@/src/api/processRuns';
import { getStoredUser } from '@/src/api/storage';
import { buildCardSteps } from '@/src/features/run-host/buildCardSteps';
import { countCardStepOptions } from '@/src/features/run-host/countCardStepOptions';
import {
  initSectionDataMap,
  type GradeElement,
  type MaterialCatalogItem,
  type SectionDataMap,
  type SteelGrade,
} from '@/src/features/run-host/section-data';
import { buildReportHtml } from '@/src/features/reports/buildReportHtml';
import type { ProcessRunDetail, TemplateSection } from '@/src/types/processRun';
import type { User } from '@/src/types/user';
import { mergeCalculatedIntoFields } from '@/src/utils/formulaEngine';

function fieldValuesToRecord(
  fieldValues: ProcessRunDetail['field_values']
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const fv of fieldValues) {
    out[fv.field_key] = fv.value == null ? '' : String(fv.value);
  }
  return out;
}

export function useRunReport(runId: string | undefined) {
  const [run, setRun] = useState<ProcessRunDetail | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [sectionDataMap, setSectionDataMap] = useState<SectionDataMap>({});
  const [gradeElements, setGradeElements] = useState<GradeElement[]>([]);
  const [steelGrades, setSteelGrades] = useState<SteelGrade[]>([]);
  const [alloyMaterials, setAlloyMaterials] = useState<MaterialCatalogItem[]>([]);
  const [scrapMaterials, setScrapMaterials] = useState<MaterialCatalogItem[]>([]);
  const [plantUsers, setPlantUsers] = useState<User[]>([]);
  const [docNo, setDocNo] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const steps = useMemo(() => {
    const options = countCardStepOptions(sections, sectionDataMap);
    return buildCardSteps(sections, options);
  }, [sections, sectionDataMap]);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!runId) return;
      if (opts?.soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const storedUser = await getStoredUser();
        setCurrentUserId(storedUser?.id ?? null);

        const [detail, alloys, scrap, grades] = await Promise.all([
          fetchProcessRun(runId),
          fetchMaterials('alloy').catch(() => [] as MaterialCatalogItem[]),
          fetchMaterials('scrap').catch(() => [] as MaterialCatalogItem[]),
          fetchSteelGrades().catch(() => [] as SteelGrade[]),
        ]);
        const template = await fetchTemplateVersion(detail.template_version_id);
        const sorted = [...template.sections].sort((a, b) => a.sort_order - b.sort_order);

        let resolvedPlantId = storedUser?.plant_id ?? null;
        if (!resolvedPlantId) {
          const plants = await fetchPlants().catch(() => []);
          resolvedPlantId = plants[0]?.id ?? null;
        }

        let users: User[] = [];
        if (resolvedPlantId) {
          users = await fetchPlantUsers(resolvedPlantId).catch(() => [] as User[]);
        }
        if (storedUser && !users.some((u) => u.id === storedUser.id)) {
          users = [storedUser, ...users];
        }

        const gradeId = detail.grade_id || fieldValuesToRecord(detail.field_values).grade;
        let elements: GradeElement[] = [];
        if (gradeId) {
          elements = await fetchGradeElements(gradeId).catch(() => []);
        } else if (grades[0]) {
          elements = await fetchGradeElements(grades[0].id).catch(() => []);
        }

        const rawSections: Record<string, unknown> = {};
        for (const sd of detail.section_data) {
          rawSections[sd.section_key] = sd.data;
        }

        let vals = fieldValuesToRecord(detail.field_values);
        vals = mergeCalculatedIntoFields(sorted, vals);

        let resolvedDoc: string | null = null;
        let resolvedName: string | null = null;
        try {
          const meta = await fetchTemplate(template.template_id);
          resolvedDoc = meta.doc_no;
          resolvedName = meta.name;
        } catch {
          /* optional metadata */
        }

        setRun(detail);
        setSections(sorted);
        setFieldValues(vals);
        setSectionDataMap(initSectionDataMap(sorted, elements, rawSections));
        setGradeElements(elements);
        setSteelGrades(grades);
        setAlloyMaterials(alloys);
        setScrapMaterials(scrap);
        setPlantUsers(users);
        setDocNo(resolvedDoc);
        setTemplateName(resolvedName);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [runId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const shareHtml = useCallback(async () => {
    if (!run) return;
    setSharing(true);
    setError(null);
    setMessage(null);
    try {
      const html = buildReportHtml({
        runNumber: run.run_number,
        runState: run.current_state,
        runType: run.run_type,
        docNo,
        templateName,
        sections,
        fieldValues,
        sectionDataMap,
        steelGrades,
        plantUsers,
      });
      const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!base) {
        throw new Error('No writable directory for share file');
      }
      const path = `${base}moi-report-${run.run_number.replace(/[^\w.-]+/g, '_')}.html`;
      await FileSystem.writeAsStringAsync(path, html, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setMessage(`HTML saved at ${path}`);
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'text/html',
        dialogTitle: `Share ${run.run_number}`,
        UTI: 'public.html',
      });
      setMessage('Share sheet opened.');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSharing(false);
    }
  }, [docNo, fieldValues, plantUsers, run, sectionDataMap, sections, steelGrades, templateName]);

  return {
    run,
    sections,
    steps,
    fieldValues,
    sectionDataMap,
    gradeElements,
    steelGrades,
    alloyMaterials,
    scrapMaterials,
    plantUsers,
    docNo,
    templateName,
    currentUserId,
    loading,
    refreshing,
    sharing,
    error,
    message,
    reload: load,
    shareHtml,
    setError,
    setMessage,
  };
}
