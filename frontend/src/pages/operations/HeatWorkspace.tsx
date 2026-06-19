import { useEffect, useState } from 'react';

import { useParams } from 'react-router-dom';

import {

  fetchProcessRun,

  fetchRunEvents,

  fetchTemplateVersion,

  transitionProcessRun,

  updateProcessRun,

} from '../../api/processRuns';

import { fetchGradeElements, fetchMaterials } from '../../api/platform';

import { getErrorMessage } from '../../api/client';

import {
  ChemistryTable,
  parseChemistryData,
} from '../../components/logsheet/ChemistryTable';

import {

  MaterialRowsTable,

  emptyMaterialSection,

  materialSectionToPayload,

  parseMaterialSection,

} from '../../components/logsheet/MaterialRowsTable';

import type {

  ChemistrySectionData,

  GradeElement,

  MaterialCatalogItem,
  MaterialSectionData,

  OperationalEvent,

  ProcessRunDetail,

  TemplateSection,

} from '../../types';

import { Button } from '../../components/ui/Button';

import { Card } from '../../components/ui/Card';

import { Badge } from '../../components/ui/Badge';

import { Input } from '../../components/ui/Input';



export function HeatWorkspace() {

  const { runId } = useParams<{ runId: string }>();

  const [run, setRun] = useState<ProcessRunDetail | null>(null);

  const [sections, setSections] = useState<TemplateSection[]>([]);

  const [activeTab, setActiveTab] = useState(0);

  const [events, setEvents] = useState<OperationalEvent[]>([]);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const [gradeElements, setGradeElements] = useState<GradeElement[]>([]);

  const [alloyMaterials, setAlloyMaterials] = useState<MaterialCatalogItem[]>([]);

  const [scrapMaterials, setScrapMaterials] = useState<MaterialCatalogItem[]>([]);

  const [chemistryData, setChemistryData] = useState<ChemistrySectionData>({ rows: [] });

  const [ferroData, setFerroData] = useState<MaterialSectionData>(emptyMaterialSection());

  const [chargeData, setChargeData] = useState<MaterialSectionData>(emptyMaterialSection());

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

      setSections(tmpl.sections.sort((a, b) => a.sort_order - b.sort_order));



      const vals: Record<string, string> = {};

      data.field_values.forEach((fv) => {

        vals[fv.field_key] = String(fv.value ?? '');

      });

      setFieldValues(vals);



      let elements: GradeElement[] = [];

      if (data.grade_id) {

        elements = await fetchGradeElements(data.grade_id);

        setGradeElements(elements);

      }



      const sectionMap = Object.fromEntries(data.section_data.map((sd) => [sd.section_key, sd.data]));

      setChemistryData(parseChemistryData(sectionMap.chemistry, elements));

      setFerroData(parseMaterialSection(sectionMap.ferro_alloys));

      setChargeData(parseMaterialSection(sectionMap.charge_mix));



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



  const saveSection = async (sectionKey: string, data: unknown) => {

    if (!runId) return;

    setSaving(true);

    try {

      await updateProcessRun(runId, {

        section_data: [{ section_key: sectionKey, data }],

      });

      await load();

    } catch (e) {

      setError(getErrorMessage(e));

    } finally {

      setSaving(false);

    }

  };



  const setNow = (key: string) => {

    setFieldValues((prev) => ({ ...prev, [key]: new Date().toISOString() }));

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



  return (

    <div className="mx-auto max-w-4xl pb-24">

      <div className="mb-4 flex items-center justify-between">

        <div>

          <h1 className="text-2xl font-bold text-slate-900">{run.run_number}</h1>

          <p className="text-sm text-slate-500">Furnace Log Sheet — Rev locked at creation</p>

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

          {section.section_type === 'fields' && (

            <div className="space-y-4">

              {section.fields.map((f) => (

                <div key={f.name}>

                  {f.field_type === 'datetime' ? (

                    <div className="flex gap-2">

                      <Input

                        label={f.label}

                        type="datetime-local"

                        value={fieldValues[f.name]?.slice(0, 16) || ''}

                        onChange={(e) => setFieldValues((p) => ({ ...p, [f.name]: new Date(e.target.value).toISOString() }))}

                      />

                      <Button type="button" variant="secondary" className="mt-6" onClick={() => setNow(f.name)}>

                        Now

                      </Button>

                    </div>

                  ) : f.field_type === 'calculated' ? (

                    <p className="text-sm text-slate-600">

                      <span className="font-medium">{f.label}:</span> {fieldValues[f.name] || '—'}

                    </p>

                  ) : (

                    <Input

                      label={f.label}

                      value={fieldValues[f.name] || ''}

                      onChange={(e) => setFieldValues((p) => ({ ...p, [f.name]: e.target.value }))}

                      required={f.required}

                    />

                  )}

                </div>

              ))}

              <Button onClick={() => saveFields(section.fields.map((f) => f.name))} disabled={saving}>

                {saving ? 'Saving...' : 'Save Section'}

              </Button>

            </div>

          )}



          {section.section_type === 'table' && section.key === 'chemistry' && (

            <div>

              <ChemistryTable

                elements={gradeElements}

                data={chemistryData}

                maxSamples={(section.config.max_samples as number | undefined) ?? 8}

                onChange={setChemistryData}

              />

              <Button

                className="mt-4"

                onClick={() => saveSection('chemistry', chemistryData)}

                disabled={saving}

              >

                {saving ? 'Saving...' : 'Save Chemistry'}

              </Button>

            </div>

          )}



          {section.section_type === 'repeatable_group' && section.key === 'ferro_alloys' && (

            <div>

              <MaterialRowsTable

                materials={alloyMaterials}

                data={ferroData}

                onChange={setFerroData}

                quantityLabel="Qty (kg)"

              />

              <Button

                className="mt-4"

                onClick={() => saveSection('ferro_alloys', materialSectionToPayload(ferroData))}

                disabled={saving}

              >

                {saving ? 'Saving...' : 'Save Ferro Alloys'}

              </Button>

            </div>

          )}



          {section.section_type === 'repeatable_group' && section.key === 'charge_mix' && (

            <div>

              <MaterialRowsTable

                materials={scrapMaterials}

                data={chargeData}

                onChange={setChargeData}

                quantityLabel="Qty (kg)"

              />

              <Button

                className="mt-4"

                onClick={() => saveSection('charge_mix', materialSectionToPayload(chargeData))}

                disabled={saving}

              >

                {saving ? 'Saving...' : 'Save Charge Mix'}

              </Button>

            </div>

          )}

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

        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto">

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

