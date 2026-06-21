import {
  ChemistryTable,
  buildEmptyChemistry,
  parseChemistryData,
} from '../logsheet/ChemistryTable';
import {
  MaterialRowsTable,
  emptyMaterialSection,
  parseMaterialSection,
} from '../logsheet/MaterialRowsTable';
import { RemarkThread } from '../logsheet/RemarkThread';
import { ReportDocHeader } from './ReportDocHeader';
import { ReportFieldGrid, ReportLabeledValue, ReportSignatureRow } from './ReportFieldGrid';
import { ReportSheetShell } from './ReportSheetShell';
import {
  fieldVal,
  formatFieldValue,
  sectionFields,
  type LogSheetReportProps,
} from './reportFieldUtils';

export function IafLogSheetReport({
  run,
  sections,
  fieldValues,
  sectionDataMap,
  renderCtx,
  templateMeta,
  versionMeta,
  gradeLabel,
}: LogSheetReportProps) {
  const heatFields = sectionFields(sections, 'heat_info');
  const timingFields = sectionFields(sections, 'timing_equipment');
  const statusFields = sectionFields(sections, 'furnace_status');
  const signoffFields = sectionFields(sections, 'remarks_signoff');

  const chemistrySection = sections.find((s) => s.key === 'chemistry');
  const chemistryData = chemistrySection
    ? parseChemistryData(sectionDataMap.chemistry, renderCtx.gradeElements)
    : buildEmptyChemistry(renderCtx.gradeElements);

  const ferroData = parseMaterialSection(sectionDataMap.ferro_alloys ?? emptyMaterialSection());
  const chargeData = parseMaterialSection(sectionDataMap.charge_mix ?? emptyMaterialSection());

  const prevTapField = timingFields.find((f) => f.name === 'previous_heat_tapping_time');
  const timingRowFields = timingFields.filter((f) => f.name !== 'previous_heat_tapping_time');

  const signFields = signoffFields.filter((f) => f.field_type === 'signature');

  return (
    <ReportSheetShell orientation="portrait">
      <ReportDocHeader
        sheetTitle="FURNACE LOG SHEET"
        templateMeta={templateMeta}
        versionMeta={versionMeta}
      />

      <div className="report-no-print-break mb-1">
        <ReportFieldGrid fields={heatFields} fieldValues={fieldValues} ctx={renderCtx} gradeLabel={gradeLabel} />
      </div>

      {prevTapField && (
        <div className="report-no-print-break mb-1">
          <p className="text-[8px] font-semibold uppercase">Previous Heat Tapping Time :-</p>
          <p className="report-field-value inline-block min-w-[8rem]">
            {formatFieldValue(prevTapField, fieldVal(fieldValues, prevTapField.name), {
              steelGrades: renderCtx.steelGrades,
              gradeLabel,
              plantUsers: renderCtx.plantUsers,
            })}
          </p>
        </div>
      )}

      <div className="report-no-print-break mb-1">
        <table className="report-table-compact w-full text-[8px]">
          <thead>
            <tr>
              {timingRowFields.map((f) => (
                <th key={f.name}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {timingRowFields.map((f) => (
                <td key={f.name} className="text-center">
                  {formatFieldValue(f, fieldVal(fieldValues, f.name), {
                    steelGrades: renderCtx.steelGrades,
                    gradeLabel,
                    plantUsers: renderCtx.plantUsers,
                  })}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="report-no-print-break mb-1 grid grid-cols-[1.1fr_0.9fr] gap-1">
        <div>
          <p className="report-section-title">Chemical Composition of Furnace Sample</p>
          <ChemistryTable
            elements={renderCtx.gradeElements}
            data={chemistryData}
            maxSamples={(chemistrySection?.config.max_samples as number | undefined) ?? 8}
            onChange={() => {}}
            readOnly
            compact
          />
        </div>
        <div className="space-y-1">
          <MaterialRowsTable
            materials={renderCtx.alloyMaterials}
            data={ferroData}
            onChange={() => {}}
            readOnly
            compact
            title="Ferro Alloys Addition"
            quantityLabel="Qty"
          />
          <MaterialRowsTable
            materials={renderCtx.scrapMaterials}
            data={chargeData}
            onChange={() => {}}
            readOnly
            compact
            title="Charge Mix Approx"
            quantityLabel="Qty"
          />
        </div>
      </div>

      <div className="report-no-print-break mb-1 grid grid-cols-2 gap-1">
        <div className="space-y-1">
          <ReportLabeledValue
            label="Final Voltage"
            value={fieldVal(fieldValues, 'final_voltage')}
          />
          <ReportLabeledValue
            label="Final Frequency"
            value={fieldVal(fieldValues, 'final_frequency')}
          />
          {statusFields.map((f) =>
            f.name === 'condition' || f.name === 'condition_notes' ? (
              <ReportLabeledValue
                key={f.name}
                label={f.label}
                value={fieldVal(fieldValues, f.name)}
              />
            ) : null,
          )}
        </div>
        <div>
          <p className="report-section-title">Power Consumption</p>
          <table className="report-table-compact w-full text-[8px]">
            <thead>
              <tr>
                <th>Initial Reading</th>
                <th>Final Reading</th>
                <th>Total Units</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-center">{fieldVal(fieldValues, 'power_initial') || '—'}</td>
                <td className="text-center">{fieldVal(fieldValues, 'power_final') || '—'}</td>
                <td className="text-center font-semibold">{fieldVal(fieldValues, 'power_total') || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-no-print-break">
        <RemarkThread runId={run.id} runState={run.current_state} readOnly compact />
        <ReportSignatureRow
          items={signFields.map((f) => ({
            label: f.label,
            value: fieldVal(fieldValues, f.name),
          }))}
        />
      </div>
    </ReportSheetShell>
  );
}
