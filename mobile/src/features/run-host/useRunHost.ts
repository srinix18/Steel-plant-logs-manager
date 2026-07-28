import { useCallback, useEffect, useMemo, useState } from 'react';

import { getErrorMessage } from '@/src/api/client';
import { fetchCoils, type CoilRecord } from '@/src/api/coils';
import {
  fetchAssetGroups,
  fetchAssets,
  fetchCustomers,
  fetchDelayCodes,
  fetchGradeElements,
  fetchMaterials,
  fetchPlantUsers,
  fetchPlants,
  fetchProcessInstances,
  fetchShifts,
  fetchSteelGrades,
  type Customer,
  type DelayCode,
} from '@/src/api/lookups';
import {
  fetchProcessRun,
  fetchRunEvents,
  fetchTemplateVersion,
  transitionProcessRun,
  updateProcessRun,
} from '@/src/api/processRuns';
import { getStoredUser } from '@/src/api/storage';
import { enqueueDraftSave } from '@/src/offline/draftQueue';
import { isNetworkFailure } from '@/src/offline/isNetworkFailure';
import { buildCardSteps, type CardStep } from '@/src/features/run-host/buildCardSteps';
import { countCardStepOptions } from '@/src/features/run-host/countCardStepOptions';
import {
  buildEmptyChemistry,
  initSectionDataMap,
  sectionDataToPayload,
  type GradeElement,
  type MaterialCatalogItem,
  type SectionDataMap,
  type SteelGrade,
} from '@/src/features/run-host/section-data';
import type { PlantAsset } from '@/src/types/platform';
import type {
  OperationalEvent,
  ProcessRunDetail,
  TemplateSection,
  WorkflowTransition,
} from '@/src/types/processRun';
import type { User } from '@/src/types/user';
import { gasFieldsFromBlow } from '@/src/utils/aodGasFromBlow';
import { mergeCalculatedIntoFields } from '@/src/utils/formulaEngine';
import {
  firstStepIndexForSection,
  iafDesiredStateForStep,
  isBbarDailyTemplate,
  isGrindDailyTemplate,
  isIafHeatTemplate,
  isRmillShiftTemplate,
  isWdrawShiftTemplate,
  isWireDivisionTemplate,
  pickIafPhaseTransition,
  stateTabKey,
} from '@/src/utils/heatWorkflowUi';
import type { BlowProcessSectionData } from '@/src/features/run-host/section-data/types';

function fieldValuesToRecord(
  fieldValues: ProcessRunDetail['field_values']
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const fv of fieldValues) {
    out[fv.field_key] = fv.value == null ? '' : String(fv.value);
  }
  return out;
}

function templateHasCoilRef(sections: TemplateSection[]): boolean {
  return sections.some((s) =>
    ((s.config.columns as { type?: string }[] | undefined) ?? []).some(
      (c) => c.type === 'coil_ref'
    )
  );
}

function templateHasCustomerRef(sections: TemplateSection[]): boolean {
  return sections.some((s) =>
    ((s.config.columns as { type?: string; key?: string }[] | undefined) ?? []).some(
      (c) => c.type === 'customer_ref' || c.key === 'customer_id'
    )
  );
}

function applyShiftFieldDefaults(
  vals: Record<string, string>,
  shiftCode: string | undefined
): Record<string, string> {
  const next = { ...vals };
  if (!next.date) next.date = new Date().toISOString().slice(0, 10);
  if (!next.shift && shiftCode) next.shift = shiftCode;
  return next;
}

function applyIafDefaults(
  vals: Record<string, string>,
  detail: ProcessRunDetail,
  shiftCode: string | undefined,
  currentUserId: string | undefined
): Record<string, string> {
  const next = applyShiftFieldDefaults(vals, shiftCode);
  if (!next.grade && detail.grade_id) next.grade = detail.grade_id;
  if (!next.melter && currentUserId) next.melter = currentUserId;
  if (!next.heat_no) {
    next.heat_no = detail.run_number.split('-').pop() ?? detail.run_number;
  }
  return next;
}

function applyWireDefaults(
  vals: Record<string, string>,
  shiftCode: string | undefined,
  currentUserId: string | undefined
): Record<string, string> {
  const next = applyShiftFieldDefaults(vals, shiftCode);
  if (!next.operator && currentUserId) next.operator = currentUserId;
  return next;
}

function applyGrindDefaults(
  vals: Record<string, string>,
  workCentreHint?: string
): Record<string, string> {
  const next = applyShiftFieldDefaults(vals, undefined);
  if (!next.work_centre && workCentreHint) next.work_centre = workCentreHint;
  return next;
}

export function useRunHost(runId: string | undefined) {
  const [run, setRun] = useState<ProcessRunDetail | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [sectionDataMap, setSectionDataMap] = useState<SectionDataMap>({});
  const [gradeElements, setGradeElements] = useState<GradeElement[]>([]);
  const [steelGrades, setSteelGrades] = useState<SteelGrade[]>([]);
  const [alloyMaterials, setAlloyMaterials] = useState<MaterialCatalogItem[]>([]);
  const [scrapMaterials, setScrapMaterials] = useState<MaterialCatalogItem[]>([]);
  const [plantUsers, setPlantUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<PlantAsset[]>([]);
  const [assetGroupsByCode, setAssetGroupsByCode] = useState<Record<string, string>>({});
  const [delayCodes, setDelayCodes] = useState<DelayCode[]>([]);
  const [coils, setCoils] = useState<CoilRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [suggestedStepIndex, setSuggestedStepIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [remarksRefreshKey, setRemarksRefreshKey] = useState(0);

  const steps: CardStep[] = useMemo(() => {
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
        const sectionKeys = sorted.map((s) => s.key);
        const iaf = isIafHeatTemplate(sectionKeys);
        const rmill = isRmillShiftTemplate(sectionKeys);
        const wire = isWireDivisionTemplate(sectionKeys);
        const bbar = isBbarDailyTemplate(sectionKeys);
        const grind = isGrindDailyTemplate(sectionKeys);

        let resolvedPlantId = storedUser?.plant_id ?? null;
        if (!resolvedPlantId) {
          const plants = await fetchPlants().catch(() => []);
          resolvedPlantId = plants[0]?.id ?? null;
        }
        setPlantId(resolvedPlantId);

        let users: User[] = [];
        let plantAssets: PlantAsset[] = [];
        let codes: DelayCode[] = [];
        let coilList: CoilRecord[] = [];
        let customerList: Customer[] = [];
        const groupMap: Record<string, string> = {};
        if (resolvedPlantId) {
          const [fromPlant, groups, allAssets, delayList] = await Promise.all([
            fetchPlantUsers(resolvedPlantId).catch(() => [] as User[]),
            fetchAssetGroups(resolvedPlantId).catch(() => []),
            fetchAssets({ plantId: resolvedPlantId }).catch(() => [] as PlantAsset[]),
            fetchDelayCodes(resolvedPlantId).catch(() => [] as DelayCode[]),
          ]);
          users = fromPlant;
          plantAssets = allAssets;
          codes = delayList.filter((c) => c.is_active !== false);
          for (const g of groups) groupMap[g.code] = g.id;

          if (templateHasCoilRef(sorted) && runId) {
            const purpose = isWdrawShiftTemplate(sectionKeys) ? 'drawing' : undefined;
            // WFURN furnace picker needs non-completed coils for this run (no purpose).
            // Always load both furnace list for WFURN; WDRAW uses drawing purpose.
            coilList = await fetchCoils({
              plantId: resolvedPlantId,
              runId,
              purpose: purpose === 'drawing' ? 'drawing' : undefined,
            }).catch(() => [] as CoilRecord[]);
          }

          if (templateHasCustomerRef(sorted)) {
            customerList = await fetchCustomers(resolvedPlantId).catch(() => [] as Customer[]);
          }
        }
        if (storedUser && !users.some((u) => u.id === storedUser.id)) {
          users = [storedUser, ...users];
        }

        let shiftCode: string | undefined;
        if (detail.shift_id) {
          const shifts = await fetchShifts(resolvedPlantId ?? undefined).catch(() => []);
          shiftCode = shifts.find((s) => s.id === detail.shift_id)?.code;
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
        if (iaf) {
          vals = applyIafDefaults(vals, detail, shiftCode, storedUser?.id);
        } else if (wire) {
          vals = applyWireDefaults(vals, shiftCode, storedUser?.id);
        } else if (grind) {
          let workCentreHint: string | undefined;
          if (!vals.work_centre) {
            const instances = await fetchProcessInstances().catch(() => []);
            workCentreHint = instances.find((i) => i.id === detail.process_instance_id)?.name;
          }
          vals = applyGrindDefaults(vals, workCentreHint);
        } else if (rmill || bbar) {
          vals = applyShiftFieldDefaults(vals, shiftCode);
        }
        vals = mergeCalculatedIntoFields(sorted, vals);

        setRun(detail);
        setSections(sorted);
        setFieldValues(vals);
        setSectionDataMap(initSectionDataMap(sorted, elements, rawSections));
        setGradeElements(elements);
        setSteelGrades(grades);
        setAlloyMaterials(alloys);
        setScrapMaterials(scrap);
        setPlantUsers(users);
        setAssets(plantAssets);
        setAssetGroupsByCode(groupMap);
        setDelayCodes(codes);
        setCoils(coilList);
        setCustomers(customerList);

        if (iaf && !opts?.soft) {
          const tab = stateTabKey(detail.current_state);
          if (tab) {
            // steps not yet from this render — compute with empty section data counts
            const provisional = buildCardSteps(
              sorted,
              countCardStepOptions(sorted, initSectionDataMap(sorted, elements, rawSections))
            );
            const idx = firstStepIndexForSection(provisional, tab);
            setSuggestedStepIndex(idx >= 0 ? idx : 0);
          } else {
            setSuggestedStepIndex(0);
          }
        }

        try {
          setEvents(await fetchRunEvents(runId));
        } catch {
          setEvents([]);
        }
        setRemarksRefreshKey((k) => k + 1);
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

  const setFieldValue = useCallback(
    (key: string, value: string) => {
      setFieldValues((prev) => {
        const next = { ...prev, [key]: value };
        return mergeCalculatedIntoFields(sections, next);
      });

      if (key === 'grade' && value) {
        void (async () => {
          try {
            const elements = await fetchGradeElements(value);
            setGradeElements(elements);
            setSectionDataMap((prev) => {
              const chemistry = prev.chemistry;
              const hasSamples =
                chemistry &&
                typeof chemistry === 'object' &&
                'rows' in chemistry &&
                Array.isArray((chemistry as { rows: unknown[] }).rows) &&
                (chemistry as { rows: unknown[] }).rows.some(
                  (r) =>
                    r &&
                    typeof r === 'object' &&
                    Array.isArray((r as { samples?: unknown[] }).samples) &&
                    ((r as { samples: unknown[] }).samples?.length ?? 0) > 0 &&
                    (r as { samples: { value?: unknown }[] }).samples.some(
                      (s) => s && s.value != null && String(s.value) !== ''
                    )
                );
              if (hasSamples) return prev;
              return { ...prev, chemistry: buildEmptyChemistry(elements) };
            });
          } catch {
            /* keep prior elements */
          }
        })();
      }
    },
    [sections]
  );

  const setSectionData = useCallback(
    (key: string, data: unknown) => {
      setSectionDataMap((prev) => ({ ...prev, [key]: data }));
      if (key === 'blow_process' && data && typeof data === 'object' && 'rows' in data) {
        const gas = gasFieldsFromBlow(data as BlowProcessSectionData);
        setFieldValues((prev) =>
          mergeCalculatedIntoFields(sections, {
            ...prev,
            ...gas,
          })
        );
      }
    },
    [sections]
  );

  const saveFields = useCallback(
    async (keys: string[]) => {
      if (!runId) return;
      setSaving(true);
      setError(null);
      setMessage(null);
      const calculatedKeys = sections
        .flatMap((s) => s.fields)
        .filter((f) => f.field_type === 'calculated')
        .map((f) => f.name);
      const allKeys = [...new Set([...keys, ...calculatedKeys])];
      const payload: {
        field_values: { field_key: string; value: string }[];
        grade_id?: string;
      } = {
        field_values: allKeys.map((k) => ({
          field_key: k,
          value: fieldValues[k] ?? '',
        })),
      };
      if (fieldValues.grade) {
        payload.grade_id = fieldValues.grade;
      }
      try {
        await updateProcessRun(runId, payload);
        setMessage('Saved.');
        await load({ soft: true });
      } catch (e) {
        if (isNetworkFailure(e)) {
          // P6-OFFLINE / Q8: never silent fail — queue + visible retry.
          await enqueueDraftSave(runId, payload, getErrorMessage(e));
          setError(
            'Save failed (offline/network). Draft queued — tap Retry on the banner when online.'
          );
          return;
        }
        setError(getErrorMessage(e));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [fieldValues, load, runId, sections]
  );

  const saveSection = useCallback(
    async (section: TemplateSection) => {
      if (!runId) return;
      setSaving(true);
      setError(null);
      setMessage(null);
      const data = sectionDataToPayload(section, sectionDataMap[section.key]);
      const payload: {
        section_data: { section_key: string; data: unknown }[];
        field_values?: { field_key: string; value: string }[];
      } = {
        section_data: [{ section_key: section.key, data }],
      };
      // Persist gas rollup with blow so totals survive soft reload (P2-SMS-AOD).
      if (section.key === 'blow_process') {
        payload.field_values = ['o2_nm3', 'n2_nm3', 'ar_nm3'].map((k) => ({
          field_key: k,
          value: fieldValues[k] ?? '',
        }));
      }
      try {
        await updateProcessRun(runId, payload);
        setMessage('Section saved.');
        await load({ soft: true });
      } catch (e) {
        if (isNetworkFailure(e)) {
          await enqueueDraftSave(runId, payload, getErrorMessage(e));
          setError(
            'Save failed (offline/network). Draft queued — tap Retry on the banner when online.'
          );
          return;
        }
        setError(getErrorMessage(e));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [fieldValues, load, runId, sectionDataMap]
  );

  const doTransition = useCallback(
    async (t: WorkflowTransition) => {
      if (!runId) return;
      setTransitioning(true);
      setError(null);
      setMessage(null);
      try {
        await transitionProcessRun(runId, t.to_state);
        setMessage(`Moved to ${t.to_state.replace(/_/g, ' ')}.`);
        await load({ soft: true });
      } catch (e) {
        setError(getErrorMessage(e));
        throw e;
      } finally {
        setTransitioning(false);
      }
    },
    [load, runId]
  );

  /**
   * Auto-advance (or reverse when edges exist) so backend phase matches the card
   * the worker just opened. Never auto-completes tap / approve / abort.
   */
  const syncIafPhaseForStep = useCallback(
    async (step: CardStep) => {
      if (!runId) return;
      const desired = iafDesiredStateForStep(step);
      if (!desired) return;

      setTransitioning(true);
      setError(null);
      try {
        for (let i = 0; i < 8; i++) {
          const detail = await fetchProcessRun(runId);
          const available = detail.workflow?.available_transitions ?? [];
          const pick = pickIafPhaseTransition(
            available,
            detail.current_state,
            desired
          );
          if (!pick) break;
          await transitionProcessRun(runId, pick.to_state);
        }
        await load({ soft: true });
      } catch (e) {
        setError(getErrorMessage(e));
        // Don't rethrow — worker can still edit the card; phase sync is best-effort.
      } finally {
        setTransitioning(false);
      }
    },
    [load, runId]
  );

  const clearSuggestedStep = useCallback(() => setSuggestedStepIndex(null), []);

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
    assets,
    assetGroupsByCode,
    delayCodes,
    coils,
    customers,
    plantId,
    currentUserId,
    events,
    suggestedStepIndex,
    clearSuggestedStep,
    loading,
    refreshing,
    saving,
    transitioning,
    error,
    message,
    remarksRefreshKey,
    setFieldValue,
    setSectionData,
    saveFields,
    saveSection,
    doTransition,
    syncIafPhaseForStep,
    reload: load,
    setError,
    setMessage,
  };
}
