import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchProcessRun,
  fetchRunEvents,
  fetchTemplateVersion,
  transitionProcessRun,
  updateProcessRun,
} from '../../api/processRuns';
import { fetchGradeElements, fetchMaterials, fetchSteelGrades } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import {
  SectionRenderer,
  initSectionDataMap,
  sectionDataToPayload,
  type SectionDataMap,
} from '../../components/logsheet/SectionRenderer';
import type { GradeElement, MaterialCatalogItem, OperationalEvent, ProcessRunDetail, SteelGrade, TemplateSection } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function HeatWorkspace() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<ProcessRunDetail | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [sectionDataMap, setSectionDataMap] = useState<SectionDataMap>({});
  const [gradeElements, setGradeElements] = useState<GradeElement[]>([]);
  const [steelGrades, setSteelGrades] = useState<SteelGrade[]>([]);
  const [alloyMaterials, setAlloyMaterials] = useState<MaterialCatalogItem[]>([]);
  const [scrapMaterials, setScrapMaterials] = useState<MaterialCatalogItem[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!runId) return;
    try {
      const [data, alloys, scrap] = await Promise.all([
        fetchProcessRun(runId),
        fetchMaterials('alloy'),
        fetchMaterials('scrap'),
      ]);
      setRun(data);
      setAlloyMaterials(alloys);
      setScrapMaterials(scrap);

      const tmpl = await fetchTemplateVersion(data.template_version_id);
      const sorted = tmpl.sections.sort((a, b) => a.sort_order - b.sort_order);
      setSections(sorted);

      const vals: Record<string, string> = {};
      data.field_values.forEach((fv) => {
        vals[fv.field_key] = String(fv.value ?? '');
      });
      setFieldValues(vals);

      let elements: GradeElement[] = [];
      const grades = await fetchSteelGrades();
      setSteelGrades(grades);
      if (data.grade_id) {
        elements = await fetchGradeElements(data.grade_id);
      } else if (grades[0]) {
        elements = await fetchGradeElements(grades[0].id);
      }
      setGradeElements(elements);

      const rawSections = Object.fromEntries(data.section_data.map((sd) => [sd.section_key, sd.data]));
      setSectionDataMap(initSectionDataMap(sorted, elements, rawSections));

      const ev = await fetchRunEvents(runId);
      setEvents(ev);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, [runId]);

  const saveFields = async (keys: string[]) => {
    if (!runId) return;
    setSaving(true);
    try {
      await updateProcessRun(runId, {
        field_values: keys.map((k) => ({ field_key: k, value: fieldValues[k] })),
      });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (section: TemplateSection) => {
    if (!runId) return;
    setSaving(true);
    try {
      const data = sectionDataToPayload(section, sectionDataMap[section.key]);
      await updateProcessRun(runId, {
        section_data: [{ section_key: section.key, data }],
      });
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (toState: string) => {
    if (!runId) return;
    try {
      await transitionProcessRun(runId, toState);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  if (!run) {
    return <div className="p-8 text-center text-slate-500">Loading heat workspace...</div>;
  }

  const section = sections[activeTab];
  const renderCtx = {
    gradeElements,
    alloyMaterials,
    scrapMaterials,
    steelGrades,
    fieldValues,
    onFieldChange: (key: string, value: string) => setFieldValues((p) => ({ ...p, [key]: value })),
    onFieldNow: (key: string) => setFieldValues((p) => ({ ...p, [key]: new Date().toISOString() })),
  };

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{run.run_number}</h1>
          <p className="text-sm text-slate-500">Log sheet — revision locked at creation</p>
        </div>
        <Badge color="blue">{run.current_state.replace(/_/g, ' ')}</Badge>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {sections.map((s, idx) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`whitespace-nowrap px-4 py-3 text-sm font-medium ${
              activeTab === idx ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {section && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{section.title}</h2>
          <SectionRenderer
            section={section}
            sectionData={sectionDataMap}
            onSectionDataChange={(key, data) => setSectionDataMap((p) => ({ ...p, [key]: data }))}
            ctx={renderCtx}
            showSave
            saving={saving}
            onSaveSection={saveSection}
            onSaveFields={saveFields}
          />
        </Card>
      )}

      <Card>
        <h3 className="mb-2 font-semibold">Recent Events</h3>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No events yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.slice(-5).map((e) => (
              <li key={e.id} className="text-sm text-slate-600">
                <span className="font-medium">{e.event_type}</span> — {new Date(e.occurred_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 md:left-64">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto">
          {run.workflow?.available_transitions.map((t) => (
            <Button key={t.to_state} onClick={() => handleTransition(t.to_state)} className="whitespace-nowrap">
              {t.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
