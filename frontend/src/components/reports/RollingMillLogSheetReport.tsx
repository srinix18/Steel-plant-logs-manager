import {
  ConcastProductionTable,
  buildEmptyProductionLog,
  getProductionLogConfig,
  parseProductionLog,
} from '../logsheet/ConcastProductionTable';
import {
  DelayRegisterTable,
  buildEmptyDelayRegister,
  getDelayRegisterConfig,
  parseDelayRegister,
} from '../logsheet/DelayRegisterTable';
import {
  HourlyProductionMatrix,
  buildEmptyHourlyMatrix,
  getHourlyMatrixConfig,
  parseHourlyMatrix,
} from '../logsheet/HourlyProductionMatrix';
import { RemarkThread } from '../logsheet/RemarkThread';
import { ReportDocHeader } from './ReportDocHeader';
import { ReportFieldGrid, ReportSignatureRow } from './ReportFieldGrid';
import { ReportSheetShell } from './ReportSheetShell';
import { fieldVal, findSection, sectionFields, type LogSheetReportProps } from './reportFieldUtils';

export function RollingMillLogSheetReport({
  run,
  sections,
  fieldValues,
  sectionDataMap,
  renderCtx,
  templateMeta,
  versionMeta,
}: LogSheetReportProps) {
  const shiftFields = sectionFields(sections, 'shift_details');
  const summaryFields = sectionFields(sections, 'production_summary');
  const energyFields = sectionFields(sections, 'energy');
  const personnelFields = sectionFields(sections, 'personnel');
  const approvalFields = sectionFields(sections, 'approvals');

  const delaySection = findSection(sections, 'delay_register');
  const delayData = delaySection
    ? parseDelayRegister(sectionDataMap.delay_register, getDelayRegisterConfig(delaySection).defaultEmptyRows)
    : buildEmptyDelayRegister();

  const batchSection = findSection(sections, 'production_batches');
  const { columns, defaultEmptyRows } = batchSection
    ? getProductionLogConfig(batchSection)
    : { columns: [], defaultEmptyRows: 5 };
  const batchData = batchSection
    ? parseProductionLog(sectionDataMap.production_batches, columns, defaultEmptyRows)
    : buildEmptyProductionLog(columns, defaultEmptyRows);

  const hourlySection = findSection(sections, 'hourly_matrix');
  const { hours, rows: hourlyRows } = hourlySection
    ? getHourlyMatrixConfig(hourlySection)
    : { hours: [], rows: [] };
  const hourlyData = hourlySection
    ? parseHourlyMatrix(sectionDataMap.hourly_matrix, hours, hourlyRows)
    : buildEmptyHourlyMatrix(hours, hourlyRows);

  return (
    <ReportSheetShell orientation="landscape">
      <ReportDocHeader
        companyLine="CHANDAN STEEL LIMITED"
        divisionLine="ROLLING MILL PRODUCTION"
        sheetTitle="SHIFT PRODUCTION REPORT"
        templateMeta={templateMeta}
        versionMeta={versionMeta}
      />

      <div className="report-no-print-break mb-2 grid gap-2 lg:grid-cols-2">
        <ReportFieldGrid fields={shiftFields} fieldValues={fieldValues} ctx={renderCtx} />
        <div className="rounded border border-slate-300 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Production Summary</p>
          <ReportFieldGrid fields={summaryFields} fieldValues={fieldValues} ctx={renderCtx} columns={2} />
          <ReportFieldGrid fields={energyFields} fieldValues={fieldValues} ctx={renderCtx} columns={2} />
        </div>
      </div>

      <div className="report-no-print-break mb-2">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Shift Personnel</p>
        <ReportFieldGrid fields={personnelFields} fieldValues={fieldValues} ctx={renderCtx} columns={3} />
      </div>

      <div className="report-no-print-break mb-2 grid gap-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Delay Register</p>
          <DelayRegisterTable
            data={delayData}
            plantUsers={renderCtx.plantUsers ?? []}
            onChange={() => {}}
            readOnly
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Remarks</p>
          <RemarkThread runId={run.id} runState={run.current_state} readOnly />
        </div>
      </div>

      <div className="report-no-print-break mb-2">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Production Register</p>
        {batchSection && (
          <ConcastProductionTable
            columns={columns}
            data={batchData}
            grades={renderCtx.steelGrades ?? []}
            onChange={() => {}}
            readOnly
            compact
            filterEmptyRows
          />
        )}
      </div>

      <div className="report-no-print-break mb-2">
        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-600">Hourly Production</p>
        <HourlyProductionMatrix hours={hours} rows={hourlyRows} data={hourlyData} onChange={() => {}} readOnly />
      </div>

      <ReportSignatureRow
        items={approvalFields.map((f) => ({
          label: f.label,
          value: fieldVal(fieldValues, f.name),
        }))}
      />
      <p className="mt-2 text-[9px] text-slate-500">
        Run {run.run_number} · Shift {fieldVal(fieldValues, 'shift') || '—'} ·{' '}
        {fieldVal(fieldValues, 'date') || '—'}
      </p>
    </ReportSheetShell>
  );
}
