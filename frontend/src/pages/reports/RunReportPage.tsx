import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProcessRun } from '../../api/processRuns';
import { fetchTemplateVersion, fetchTemplates } from '../../api/templatesMoi';
import {
  fetchDepartments,
  fetchGradeElements,
  fetchMaterials,
  fetchOrganisations,
  fetchPlants,
  fetchProcessInstances,
  fetchProcesses,
  fetchSteelGrades,
} from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import {
  SectionRenderer,
  initSectionDataMap,
  type SectionDataMap,
} from '../../components/logsheet/SectionRenderer';
import type {
  GradeElement,
  MaterialCatalogItem,
  ProcessRunDetail,
  SteelGrade,
  TemplateSection,
  TemplateSummary,
} from '../../types';
import { mergeCalculatedIntoFields } from '../../utils/formulaEngine';
import { hasRole, SUPERVISOR_ROLES, WORKER_ROLES } from '../../utils/roles';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export function RunReportPage() {
  const { runId } = useParams<{ runId: string }>();
  const { user } = useAuth();
  const [run, setRun] = useState<ProcessRunDetail | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [instances, setInstances] = useState<Awaited<ReturnType<typeof fetchProcessInstances>>>([]);
  const [processes, setProcesses] = useState<Awaited<ReturnType<typeof fetchProcesses>>>([]);
  const [plants, setPlants] = useState<Awaited<ReturnType<typeof fetchPlants>>>([]);
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [organisations, setOrganisations] = useState<Awaited<ReturnType<typeof fetchOrganisations>>>([]);
  const [gradeElements, setGradeElements] = useState<GradeElement[]>([]);
  const [steelGrades, setSteelGrades] = useState<SteelGrade[]>([]);
  const [alloyMaterials, setAlloyMaterials] = useState<MaterialCatalogItem[]>([]);
  const [scrapMaterials, setScrapMaterials] = useState<MaterialCatalogItem[]>([]);
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
      fetchProcessInstances(),
      fetchProcesses(),
      fetchPlants(),
      fetchDepartments(),
      fetchOrganisations(),
      fetchSteelGrades(),
      fetchMaterials('alloy'),
      fetchMaterials('scrap'),
    ])
      .then(async ([data, tmpls, insts, procs, plts, depts, orgs, grades, alloys, scrap]) => {
        setRun(data);
        setTemplates(tmpls);
        setInstances(insts);
        setProcesses(procs);
        setPlants(plts);
        setDepartments(depts);
        setOrganisations(orgs);
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
        setFieldValues(mergeCalculatedIntoFields(sorted, vals));

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
  }, [runId]);

  const locationChain = useMemo(() => {
    if (!run) return '';
    const instance = instances.find((i) => i.id === run.process_instance_id);
    const process = instance ? processes.find((p) => p.id === instance.process_id) : undefined;
    const dept = process ? departments.find((d) => d.id === process.department_id) : undefined;
    const plant = dept ? plants.find((p) => p.id === dept.plant_id) : undefined;
    const org = plant ? organisations.find((o) => o.id === plant.organisation_id) : undefined;
    return [org?.name, plant?.name, dept?.name, process?.name, instance?.name].filter(Boolean).join(' → ');
  }, [run, instances, processes, departments, plants, organisations]);

  const templateMeta = useMemo(() => {
    if (!run) return null;
    return templates.find((t) =>
      t.versions.some((v) => v.id === run.template_version_id),
    );
  }, [run, templates]);

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
    fieldValues,
    onFieldChange: () => {},
  };

  return (
    <div className="mx-auto max-w-5xl pb-12 print:max-w-none print:pb-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm text-slate-500">Consolidated log sheet report</p>
          <h1 className="text-2xl font-bold text-slate-900">{run.run_number}</h1>
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

      <div className="mb-6 print:border-0 print:shadow-none rounded-xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Document</p>
            <p className="text-sm font-semibold text-slate-900">
              {templateMeta?.doc_no ?? '—'} {templateMeta?.name ?? ''}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Run type</p>
            <p className="text-sm text-slate-800">{run.run_type.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">State</p>
            <Badge color="blue">{run.current_state.replace(/_/g, ' ')}</Badge>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs font-medium uppercase text-slate-400">Location</p>
            <p className="text-sm text-slate-800">{locationChain || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Grade</p>
            <p className="text-sm text-slate-800">{gradeLabel}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Started</p>
            <p className="text-sm text-slate-800">
              {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Completed</p>
            <p className="text-sm text-slate-800">
              {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 print:space-y-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className="rounded-xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid print:border print:border-slate-300 print:shadow-none"
          >
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
            </div>
            <div className="p-6">
            <SectionRenderer
              section={section}
              sectionData={sectionDataMap}
              onSectionDataChange={() => {}}
              ctx={renderCtx}
              readOnly
            />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
