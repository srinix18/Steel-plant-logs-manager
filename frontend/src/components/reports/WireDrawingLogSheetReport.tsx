import {
  ProductionRegisterTable,
  buildEmptyProductionLog,
  getProductionLogConfig,
  parseProductionLog,
} from '../logsheet/ProductionRegisterTable';
import { ReportDocHeader } from './ReportDocHeader';
import { ReportFieldGrid, ReportSignatureRow } from './ReportFieldGrid';
import { ReportSheetShell } from './ReportSheetShell';
import { fieldVal, findSection, sectionFields, type LogSheetReportProps } from './reportFieldUtils';

export function WireDrawingLogSheetReport({
  sections,
  fieldValues,
  sectionDataMap,
  renderCtx,
  templateMeta,
  versionMeta,
}: LogSheetReportProps) {
  const shiftFields = sectionFields(sections, 'shift_details');
  const approvalFields = sectionFields(sections, 'approvals');

  const inputSection = findSection(sections, 'input_material');
  const outputSection = findSection(sections, 'output_material');
  const inputConfig = inputSection
    ? getProductionLogConfig(inputSection)
    : { columns: [], defaultEmptyRows: 5 };
  const outputConfig = outputSection
    ? getProductionLogConfig(outputSection)
    : { columns: [], defaultEmptyRows: 5 };

  const inputData = inputSection
    ? parseProductionLog(
        sectionDataMap.input_material,
        inputConfig.columns,
        inputConfig.defaultEmptyRows,
      )
    : buildEmptyProductionLog(inputConfig.columns, inputConfig.defaultEmptyRows);

  const outputData = outputSection
    ? parseProductionLog(
        sectionDataMap.output_material,
        outputConfig.columns,
        outputConfig.defaultEmptyRows,
      )
    : buildEmptyProductionLog(outputConfig.columns, outputConfig.defaultEmptyRows);

  return (
    <ReportSheetShell orientation="landscape">
      <ReportDocHeader
        companyLine="CHANDAN STEEL LIMITED"
        divisionLine="WIRE DIVISION"
        sheetTitle="WIRE DRAWING / WET DRAWING PRODUCTION RECORD BOOK"
        templateMeta={templateMeta}
        versionMeta={versionMeta}
      />

      <div className="report-no-print-break mb-3">
        <ReportFieldGrid fields={shiftFields} fieldValues={fieldValues} ctx={renderCtx} columns={3} />
      </div>

      <div className="report-no-print-break mb-3 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Input Material</p>
          <ProductionRegisterTable
            columns={inputConfig.columns}
            data={inputData}
            grades={renderCtx.steelGrades ?? []}
            onChange={() => {}}
            readOnly
            compact
            filterEmptyRows
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Output Material</p>
          <ProductionRegisterTable
            columns={outputConfig.columns}
            data={outputData}
            grades={renderCtx.steelGrades ?? []}
            onChange={() => {}}
            readOnly
            compact
            filterEmptyRows
          />
        </div>
      </div>

      <ReportSignatureRow
        items={approvalFields.map((f) => ({
          label: f.label,
          value: fieldVal(fieldValues, f.name),
        }))}
      />
    </ReportSheetShell>
  );
}
