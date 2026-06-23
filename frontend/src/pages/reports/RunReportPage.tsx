import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProcessRun } from '../../api/processRuns';
import { fetchTemplateVersion, fetchTemplates } from '../../api/templatesMoi';
import {
  fetchGradeElements,
  fetchMaterials,
  fetchPlantUsers,
  fetchSteelGrades,
  fetchUsersLookup,
} from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { collectUserRefIds, mergeUsers } from '../../utils/userLookup';
import {
  SectionRenderer,
  initSectionDataMap,
  type SectionDataMap,
} from '../../components/logsheet/SectionRenderer';
import { AodLogSheetReport } from '../../components/reports/AodLogSheetReport';
import { ConcastLogSheetReport } from '../../components/reports/ConcastLogSheetReport';
import { IafLogSheetReport } from '../../components/reports/IafLogSheetReport';
import { RollingMillLogSheetReport } from '../../components/reports/RollingMillLogSheetReport';
import { WireFurnaceLogSheetReport } from '../../components/reports/WireFurnaceLogSheetReport';
import { WireDrawingLogSheetReport } from '../../components/reports/WireDrawingLogSheetReport';
import { BrightBarProductionReport } from '../../components/reports/BrightBarProductionReport';
import { MaintenanceIssuesSection } from '../../components/reports/MaintenanceIssuesSection';
import type {
  GradeElement,
  MaterialCatalogItem,
  ProcessRunDetail,
  SteelGrade,
  TemplateSection,
  TemplateSummary,
  TemplateVersionSummary,
} from '../../types';
import { mergeCalculatedIntoFields } from '../../utils/formulaEngine';
import { hasRole, SUPERVISOR_ROLES, WORKER_ROLES } from '../../utils/roles';
import type { LogSheetReportProps } from '../../components/reports/reportFieldUtils';
import { Button } from '../../components/ui/Button';

const SHEET_REPORTS: Record<string, ComponentType<LogSheetReportProps>> = {
  'F/PRD/02': IafLogSheetReport,
  'F/PRD/03': AodLogSheetReport,
  'F/PRD/04': ConcastLogSheetReport,
  'F/PRD/05': RollingMillLogSheetReport,
  'F/PRD/06': WireFurnaceLogSheetReport,
  'F/PRD/07': WireDrawingLogSheetReport,
  'F51 PR 39/005/01-13': BrightBarProductionReport,
};

export function RunReportPage() {
  const { runId } = useParams<{ runId: string }>();
  const { user } = useAuth();
  const [run, setRun] = useState<ProcessRunDetail | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [gradeElements, setGradeElements] = useState<GradeElement[]>([]);
  const [steelGrades, setSteelGrades] = useState<SteelGrade[]>([]);
  const [alloyMaterials, setAlloyMaterials] = useState<MaterialCatalogItem[]>([]);
  const [scrapMaterials, setScrapMaterials] = useState<MaterialCatalogItem[]>([]);
  const [plantUsers, setPlantUsers] = useState<Awaited<ReturnType<typeof fetchPlantUsers>>>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [sectionDataMap, setSectionDataMap] = useState<SectionDataMap>({});
  const [error, setError] = useState('');

  const canOpenWorkspace =
    user &&
    (hasRole(user.role, SUPERVISOR_ROLES) || hasRole(user.role, WORKER_ROLES));

  useEffect(() => {
    if (!runId) return;
    Promise.all([
      fetchProcessRun(runId),
      fetchTemplates(),
      fetchSteelGrades(),
      fetchMaterials('alloy'),
      fetchMaterials('scrap'),
    ])
      .then(async ([data, tmpls, grades, alloys, scrap]) => {
        setRun(data);
        setTemplates(tmpls);
        setSteelGrades(grades);
        setAlloyMaterials(alloys);
        setScrapMaterials(scrap);

        const tmpl = await fetchTemplateVersion(data.template_version_id);
        const sorted = tmpl.sections.sort((a, b) => a.sort_order - b.sort_order);
        setSections(sorted);

        const vals: Record<string, string> = {};
        data.field_values.forEach((fv) => {
          vals[fv.field_key] = String(fv.value ?? '');
        });
        const mergedVals = mergeCalculatedIntoFields(sorted, vals);
        setFieldValues(mergedVals);

        const userIds = collectUserRefIds(sorted, mergedVals);
        if (data.created_by) userIds.push(data.created_by);
        const lookupUsers = await fetchUsersLookup([...new Set(userIds)]);
        const fromPlant = user?.plant_id ? await fetchPlantUsers(user.plant_id).catch(() => []) : [];
        setPlantUsers(mergeUsers(lookupUsers, fromPlant, user ? [user] : []));

        let elements: GradeElement[] = [];
        if (data.grade_id) {
          elements = await fetchGradeElements(data.grade_id);
        } else if (grades[0]) {
          elements = await fetchGradeElements(grades[0].id);
        }
        setGradeElements(elements);

        const rawSections = Object.fromEntries(data.section_data.map((sd) => [sd.section_key, sd.data]));
        setSectionDataMap(initSectionDataMap(sorted, elements, rawSections));
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [runId, user?.plant_id]);

  const templateMeta = useMemo(() => {
    if (!run) return null;
    return templates.find((t) => t.versions.some((v) => v.id === run.template_version_id)) ?? null;
  }, [run, templates]);

  const versionMeta = useMemo((): TemplateVersionSummary | null => {
    if (!run || !templateMeta) return null;
    return templateMeta.versions.find((v) => v.id === run.template_version_id) ?? null;
  }, [run, templateMeta]);

  const gradeLabel = useMemo(() => {
    if (!run?.grade_id) return '—';
    return steelGrades.find((g) => g.id === run.grade_id)?.code ?? run.grade_id;
  }, [run, steelGrades]);

  if (error) {
    return <p className="p-8 text-sm text-red-600">{error}</p>;
  }

  if (!run) {
    return <p className="p-8 text-center text-slate-500">Loading report…</p>;
  }

  const renderCtx = {
    gradeElements,
    alloyMaterials,
    scrapMaterials,
    steelGrades,
    plantUsers,
    currentUserId: user?.id,
    currentUser: user ?? undefined,
    fieldValues,
    onFieldChange: () => {},
  };

  const docNo = templateMeta?.doc_no;
  const SheetReport = docNo ? SHEET_REPORTS[docNo] : undefined;

  const sheetProps = {
    run,
    sections,
    fieldValues,
    sectionDataMap,
    renderCtx,
    templateMeta,
    versionMeta,
    gradeLabel,
  };

  return (
    <div className="print:bg-white">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm text-slate-500">Log sheet report</p>
          <h1 className="text-xl font-bold text-slate-900">{run.run_number}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          {canOpenWorkspace && (
            <Link to={`/heat/${run.id}`}>
              <Button>Open workspace</Button>
            </Link>
          )}
        </div>
      </div>

      {SheetReport ? (
        <SheetReport {...sheetProps} />
      ) : (
        <div className="mx-auto max-w-5xl space-y-6">
          {sections.map((section) => (
            <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">{section.title}</h3>
              <SectionRenderer
                section={section}
                sectionData={sectionDataMap}
                onSectionDataChange={() => {}}
                ctx={renderCtx}
                readOnly
              />
            </div>
          ))}
        </div>
      )}

      {runId && <MaintenanceIssuesSection runId={runId} />}
    </div>
  );
}
