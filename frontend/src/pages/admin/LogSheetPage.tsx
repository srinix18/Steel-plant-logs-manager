import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchTemplateVersion, fetchTemplates } from '../../api/templatesMoi';
import { fetchGradeElements, fetchMaterials, fetchSteelGrades } from '../../api/platform';
import { getErrorMessage } from '../../api/client';
import {
  ChemistryTable,
  buildEmptyChemistry,
} from '../../components/logsheet/ChemistryTable';
import {
  MaterialRowsTable,
  emptyMaterialSection,
} from '../../components/logsheet/MaterialRowsTable';
import type {
  ChemistrySectionData,
  GradeElement,
  MaterialCatalogItem,
  MaterialSectionData,
  TemplateSection,
  TemplateSummary,
  TemplateVersionDetail,
} from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

function FieldsPreview({ section }: { section: TemplateSection }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {section.fields.map((field) => (
        <div key={field.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {field.field_type}
            {field.formula ? ` · calculated` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

export function LogSheetPage() {
  const [searchParams] = useSearchParams();
  const docParam = searchParams.get('doc') ?? 'F/PRD/02';

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [versionDetail, setVersionDetail] = useState<TemplateVersionDetail | null>(null);
  const [gradeElements, setGradeElements] = useState<GradeElement[]>([]);
  const [alloyMaterials, setAlloyMaterials] = useState<MaterialCatalogItem[]>([]);
  const [scrapMaterials, setScrapMaterials] = useState<MaterialCatalogItem[]>([]);
  const [chemistryData, setChemistryData] = useState<ChemistrySectionData>({ rows: [] });
  const [ferroData, setFerroData] = useState<MaterialSectionData>(emptyMaterialSection());
  const [chargeData, setChargeData] = useState<MaterialSectionData>(emptyMaterialSection());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? templates.find((t) => t.doc_no === docParam),
    [templates, selectedTemplateId, docParam],
  );

  useEffect(() => {
    Promise.all([
      fetchTemplates(),
      fetchSteelGrades(),
      fetchMaterials('alloy'),
      fetchMaterials('scrap'),
    ])
      .then(async ([items, grades, alloys, scrap]) => {
        setTemplates(items);
        setAlloyMaterials(alloys);
        setScrapMaterials(scrap);
        const match = items.find((t) => t.doc_no === docParam) ?? items[0];
        if (match) {
          setSelectedTemplateId(match.id);
          const published = match.versions.find((v) => v.status === 'published') ?? match.versions[0];
          if (published) setSelectedVersionId(published.id);
        }
        if (grades[0]) {
          const elements = await fetchGradeElements(grades[0].id);
          setGradeElements(elements);
          setChemistryData(buildEmptyChemistry(elements));
        }
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [docParam]);

  useEffect(() => {
    if (!selectedVersionId) return;
    fetchTemplateVersion(selectedVersionId)
      .then(setVersionDetail)
      .catch((e) => setError(getErrorMessage(e)));
  }, [selectedVersionId]);

  const statusColor = (status: string) =>
    status === 'published' ? 'blue' : status === 'draft' ? 'gray' : 'purple';

  const renderSection = (section: TemplateSection) => {
    if (section.section_type === 'table' && section.key === 'chemistry') {
      const maxSamples = (section.config.max_samples as number | undefined) ?? 8;
      return (
        <ChemistryTable
          elements={gradeElements}
          data={chemistryData}
          maxSamples={maxSamples}
          onChange={setChemistryData}
        />
      );
    }
    if (section.section_type === 'repeatable_group' && section.key === 'ferro_alloys') {
      return (
        <MaterialRowsTable
          materials={alloyMaterials}
          data={ferroData}
          onChange={setFerroData}
          quantityLabel="Qty (kg)"
        />
      );
    }
    if (section.section_type === 'repeatable_group' && section.key === 'charge_mix') {
      return (
        <MaterialRowsTable
          materials={scrapMaterials}
          data={chargeData}
          onChange={setChargeData}
          quantityLabel="Qty (kg)"
        />
      );
    }
    if (section.section_type === 'fields') {
      return <FieldsPreview section={section} />;
    }
    return <p className="text-sm text-slate-500">Section type not supported in preview.</p>;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Log Sheets</h1>
        <p className="mt-1 text-sm text-slate-500">
          Furnace Log Sheet F/PRD/02 — enter sample readings, ferro alloy additions, and charge mix rows below.
        </p>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-4">
        <label className="text-sm text-slate-600">
          Sheet{' '}
          <select
            value={selectedTemplate?.id ?? ''}
            onChange={(e) => {
              const tmpl = templates.find((t) => t.id === e.target.value);
              setSelectedTemplateId(e.target.value);
              const ver = tmpl?.versions.find((v) => v.status === 'published') ?? tmpl?.versions[0];
              if (ver) setSelectedVersionId(ver.id);
            }}
            className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.doc_no} — {t.name}
              </option>
            ))}
          </select>
        </label>

        {selectedTemplate && (
          <label className="text-sm text-slate-600">
            Revision{' '}
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {selectedTemplate.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  Rev {v.rev_no} ({v.status})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading template…</p>}

      {!loading && !selectedTemplate && !error && (
        <p className="text-sm text-slate-500">No log sheet templates found.</p>
      )}

      {selectedTemplate && versionDetail && (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">{selectedTemplate.name}</p>
                <p className="text-sm text-slate-500">
                  Document {selectedTemplate.doc_no} · Revision {versionDetail.rev_no}
                </p>
              </div>
              <Badge color={statusColor(versionDetail.status)}>{versionDetail.status}</Badge>
            </div>
          </Card>

          <div className="mt-6 space-y-6">
            {versionDetail.sections
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((section) => (
                <Card key={section.id} title={`${section.sort_order + 1}. ${section.title}`}>
                  {renderSection(section)}
                </Card>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
