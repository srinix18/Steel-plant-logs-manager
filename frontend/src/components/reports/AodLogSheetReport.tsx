import {
  BlowProcessMatrix,
  buildBlowProcessSection,
  getBlowProcessConfig,
  parseBlowProcessSection,
} from '../logsheet/BlowProcessMatrix';
import {
  SampleChemistryMatrix,
  buildSampleChemistry,
  parseSampleChemistry,
} from '../logsheet/SampleChemistryMatrix';
import {
  StaticMaterialTable,
  buildStaticMaterialSection,
  getStaticMaterialConfig,
  parseStaticMaterialSection,
} from '../logsheet/StaticMaterialTable';
import {
  TargetChemistryRow,
  buildTargetChemistry,
  parseTargetChemistry,
} from '../logsheet/TargetChemistryRow';
import { RemarkThread } from '../logsheet/RemarkThread';
import { ReportDocHeader } from './ReportDocHeader';
import { ReportFieldGrid, ReportSignatureRow } from './ReportFieldGrid';
import { ReportSheetShell } from './ReportSheetShell';
import { fieldVal, findSection, sectionFields, type LogSheetReportProps } from './reportFieldUtils';

export function AodLogSheetReport({
  run,
  sections,
  fieldValues,
  sectionDataMap,
  renderCtx,
  templateMeta,
  versionMeta,
  gradeLabel,
}: LogSheetReportProps) {
  const blowSection = findSection(sections, 'blow_process');
  const sampleSection = findSection(sections, 'sample_chemistry');
  const alloySection = findSection(sections, 'alloy_additions');
  const fluxSection = findSection(sections, 'flux_additions');
  const reqChemSection = findSection(sections, 'required_chemistry');

  const blowConfig = blowSection ? getBlowProcessConfig(blowSection) : { rows: [], columns: [] };
  const blowData = blowSection
    ? parseBlowProcessSection(sectionDataMap.blow_process, blowConfig.rows)
    : buildBlowProcessSection(blowConfig.rows);

  const sampleRows = (sampleSection?.config.sample_rows as string[] | undefined) ?? [];
  const sampleElements = (sampleSection?.config.elements as string[] | undefined) ?? [];
  const sampleData = sampleSection
    ? parseSampleChemistry(sectionDataMap.sample_chemistry, sampleRows, sampleElements)
    : buildSampleChemistry(sampleRows, sampleElements);

  const alloyConfig = alloySection ? getStaticMaterialConfig(alloySection) : [];
  const alloyData = alloySection
    ? parseStaticMaterialSection(sectionDataMap.alloy_additions, alloyConfig)
    : buildStaticMaterialSection(alloyConfig);

  const fluxConfig = fluxSection ? getStaticMaterialConfig(fluxSection) : [];
  const fluxData = fluxSection
    ? parseStaticMaterialSection(sectionDataMap.flux_additions, fluxConfig)
    : buildStaticMaterialSection(fluxConfig);

  const reqChemData = reqChemSection
    ? parseTargetChemistry(sectionDataMap.required_chemistry, renderCtx.gradeElements)
    : buildTargetChemistry(renderCtx.gradeElements);

  const timeFields = sectionFields(sections, 'time_summary');
  const gasFields = sectionFields(sections, 'gas_consumption');
  const approvalFields = sectionFields(sections, 'approvals');

  return (
    <ReportSheetShell orientation="portrait" variant="aod">
      <ReportDocHeader sheetTitle="AOD Log Sheet" templateMeta={templateMeta} versionMeta={versionMeta} />

      <div className="report-no-print-break mb-1 grid grid-cols-4 gap-1">
        <ReportFieldGrid
          fields={sectionFields(sections, 'heat_info')}
          fieldValues={fieldValues}
          ctx={renderCtx}
          gradeLabel={gradeLabel}
          layout="stack"
        />
        <ReportFieldGrid
          fields={sectionFields(sections, 'equipment_info')}
          fieldValues={fieldValues}
          ctx={renderCtx}
          gradeLabel={gradeLabel}
          layout="stack"
        />
        <ReportFieldGrid
          fields={sectionFields(sections, 'personnel')}
          fieldValues={fieldValues}
          ctx={renderCtx}
          gradeLabel={gradeLabel}
          layout="stack"
        />
        <ReportFieldGrid
          fields={sectionFields(sections, 'weight_info')}
          fieldValues={fieldValues}
          ctx={renderCtx}
          gradeLabel={gradeLabel}
          layout="stack"
        />
      </div>

      <div className="report-no-print-break mb-1 overflow-x-auto">
        <p className="report-section-title">AOD Si Blow Addition</p>
        {blowSection && (
          <BlowProcessMatrix
            rowLabels={blowConfig.rows}
            columns={blowConfig.columns}
            data={blowData}
            onChange={() => {}}
            readOnly
            compact
          />
        )}
      </div>

      <div className="report-no-print-break mb-1 overflow-x-auto">
        <p className="report-section-title">Sample No. &amp; Temp / Chemical Analysis</p>
        {sampleSection && (
          <SampleChemistryMatrix
            sampleRows={sampleRows}
            elements={sampleElements}
            includeTemperature={Boolean(sampleSection.config.include_temperature)}
            data={sampleData}
            onChange={() => {}}
            readOnly
            compact
          />
        )}
      </div>

      <div className="report-no-print-break mb-1 grid grid-cols-[1fr_1fr_1.2fr] gap-1">
        <div className="space-y-1">
          {alloySection && (
            <StaticMaterialTable
              config={alloyConfig}
              data={alloyData}
              onChange={() => {}}
              readOnly
              compact
              title="Ferro Alloys & Additions"
            />
          )}
          {fluxSection && (
            <StaticMaterialTable
              config={fluxConfig}
              data={fluxData}
              onChange={() => {}}
              readOnly
              compact
              title="Raw Material / Flux"
            />
          )}
        </div>
        <div className="space-y-1">
          <p className="report-section-title">Process Times &amp; Measurements</p>
          <ReportFieldGrid
            fields={timeFields}
            fieldValues={fieldValues}
            ctx={renderCtx}
            gradeLabel={gradeLabel}
            layout="stack"
          />
          <p className="report-section-title">Consumption of Gases</p>
          <table className="report-table-compact w-full">
            <thead>
              <tr>
                <th>Gas</th>
                <th>PENAL (Nm3)</th>
              </tr>
            </thead>
            <tbody>
              {gasFields.map((f) => (
                <tr key={f.name}>
                  <td>{f.label}</td>
                  <td className="text-center">{fieldVal(fieldValues, f.name) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          {reqChemSection && (
            <TargetChemistryRow
              elements={renderCtx.gradeElements}
              elementCodes={(reqChemSection.config.elements as string[] | undefined) ?? undefined}
              data={reqChemData}
              onChange={() => {}}
              readOnly
              compact
            />
          )}
        </div>
      </div>

      <div className="report-no-print-break">
        <RemarkThread runId={run.id} runState={run.current_state} readOnly compact />
        <ReportSignatureRow
          items={approvalFields.map((f) => ({
            label: f.label,
            value: fieldVal(fieldValues, f.name),
          }))}
        />
      </div>
    </ReportSheetShell>
  );
}
