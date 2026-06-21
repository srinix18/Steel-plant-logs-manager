import {
  ConcastProductionTable,
  buildEmptyProductionLog,
  getProductionLogConfig,
  parseProductionLog,
} from '../logsheet/ConcastProductionTable';
import { RemarkThread } from '../logsheet/RemarkThread';
import { ReportDocHeader } from './ReportDocHeader';
import { ReportFieldGrid, ReportSignatureRow } from './ReportFieldGrid';
import { ReportSheetShell } from './ReportSheetShell';
import { fieldVal, findSection, sectionFields, type LogSheetReportProps } from './reportFieldUtils';

export function ConcastLogSheetReport({
  run,
  sections,
  fieldValues,
  sectionDataMap,
  renderCtx,
  templateMeta,
  versionMeta,
  gradeLabel,
}: LogSheetReportProps) {
  const castingSection = findSection(sections, 'casting_entries');
  const { columns, defaultEmptyRows } = castingSection
    ? getProductionLogConfig(castingSection)
    : { columns: [], defaultEmptyRows: 5 };

  const castingData = castingSection
    ? parseProductionLog(sectionDataMap.casting_entries, columns, defaultEmptyRows)
    : buildEmptyProductionLog(columns, defaultEmptyRows);

  const approvalFields = sectionFields(sections, 'approvals');
  const shiftFields = sectionFields(sections, 'shift_header');

  return (
    <ReportSheetShell orientation="landscape">
      <ReportDocHeader
        companyLine="CHANDAN STEEL LTD."
        divisionLine="MELTING - PRODUCTION"
        sheetTitle="CONCAST LOG SHEET"
        templateMeta={templateMeta}
        versionMeta={versionMeta}
      />

      <div className="report-no-print-break mb-1 flex items-end justify-between gap-4">
        <ReportFieldGrid
          fields={shiftFields}
          fieldValues={fieldValues}
          ctx={renderCtx}
          gradeLabel={gradeLabel}
        />
      </div>

      <div className="report-no-print-break mb-1 overflow-x-auto">
        {castingSection && (
          <ConcastProductionTable
            columns={columns}
            data={castingData}
            grades={renderCtx.steelGrades ?? []}
            onChange={() => {}}
            readOnly
            compact
            filterEmptyRows
          />
        )}
      </div>

      <div className="report-no-print-break grid grid-cols-[1fr_auto] gap-4">
        <div>
          <RemarkThread runId={run.id} runState={run.current_state} readOnly compact />
        </div>
        <div className="min-w-[14rem]">
          <ReportSignatureRow
            items={approvalFields.map((f) => ({
              label: f.label,
              value: fieldVal(fieldValues, f.name),
            }))}
          />
        </div>
      </div>
    </ReportSheetShell>
  );
}
