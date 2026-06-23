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

export function BrightBarProductionReport({
  run,
  sections,
  fieldValues,
  sectionDataMap,
  renderCtx,
  templateMeta,
  versionMeta,
}: LogSheetReportProps) {
  const headerFields = sectionFields(sections, 'register_header');
  const approvalFields = sectionFields(sections, 'approvals');

  const registerSection = findSection(sections, 'production_register');
  const { columns, defaultEmptyRows } = registerSection
    ? getProductionLogConfig(registerSection)
    : { columns: [], defaultEmptyRows: 5 };
  const registerData = registerSection
    ? parseProductionLog(sectionDataMap.production_register, columns, defaultEmptyRows)
    : buildEmptyProductionLog(columns, defaultEmptyRows);

  return (
    <ReportSheetShell orientation="landscape">
      <ReportDocHeader
        companyLine="CHANDAN STEEL LIMITED"
        divisionLine="BRIGHT BAR DIVISION"
        sheetTitle="BRIGHT BAR PRODUCTION REGISTER"
        templateMeta={templateMeta}
        versionMeta={versionMeta}
      />

      <div className="report-no-print-break mb-3 grid gap-2 lg:grid-cols-2">
        <ReportFieldGrid fields={headerFields} fieldValues={fieldValues} ctx={renderCtx} columns={2} />
        <div className="rounded border border-slate-300 p-2 text-[10px]">
          <p>
            <span className="font-semibold">No:</span> {run.run_number}
          </p>
          <p>
            <span className="font-semibold">Date:</span> {fieldVal(fieldValues, 'date') || '—'}
          </p>
        </div>
      </div>

      <div className="report-no-print-break mb-3">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Production Register</p>
        <ProductionRegisterTable
          columns={columns}
          data={registerData}
          grades={renderCtx.steelGrades ?? []}
          plantId={renderCtx.plantId}
          onChange={() => {}}
          readOnly
          compact
          filterEmptyRows
        />
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
