import type {
  BlowProcessSectionData,
  ChemistrySectionData,
  GradeElement,
  MaterialSectionData,
  ProductionLogSectionData,
  SampleChemistrySectionData,
  SectionRenderContext,
  StaticMaterialSectionData,
  TargetChemistrySectionData,
  TemplateSection,
} from '../../types';
import { Button } from '../ui/Button';
import {
  DelayRegisterTable,
  buildEmptyDelayRegister,
  getDelayRegisterConfig,
  parseDelayRegister,
} from './DelayRegisterTable';
import {
  HourlyProductionMatrix,
  buildEmptyHourlyMatrix,
  getHourlyMatrixConfig,
  parseHourlyMatrix,
} from './HourlyProductionMatrix';
import {
  BlowProcessMatrix,
  buildBlowProcessSection,
  getBlowProcessConfig,
  parseBlowProcessSection,
} from './BlowProcessMatrix';
import { ChemistryTable, buildEmptyChemistry, parseChemistryData } from './ChemistryTable';
import {
  ConcastProductionTable,
  buildEmptyProductionLog,
  getProductionLogConfig,
  parseProductionLog,
} from './ConcastProductionTable';
import {
  ProductionRegisterTable,
} from './ProductionRegisterTable';
import { FieldsSection } from './FieldsSection';
import { RemarkThread } from './RemarkThread';
import {
  MaterialRowsTable,
  emptyMaterialSection,
  materialSectionToPayload,
  parseMaterialSection,
} from './MaterialRowsTable';
import {
  SampleChemistryMatrix,
  buildSampleChemistry,
  parseSampleChemistry,
} from './SampleChemistryMatrix';
import {
  StaticMaterialTable,
  buildStaticMaterialSection,
  getStaticMaterialConfig,
  parseStaticMaterialSection,
  staticMaterialToPayload,
} from './StaticMaterialTable';
import { TargetChemistryRow, buildTargetChemistry, parseTargetChemistry } from './TargetChemistryRow';

export type SectionDataMap = Record<string, unknown>;

export function initSectionDataMap(
  sections: TemplateSection[],
  gradeElements: GradeElement[],
  sectionRaw: Record<string, unknown>,
): SectionDataMap {
  const map: SectionDataMap = {};
  for (const section of sections) {
    const raw = sectionRaw[section.key];
    switch (section.section_type) {
      case 'table':
        if (section.key === 'chemistry') {
          map[section.key] = parseChemistryData(raw, gradeElements);
        }
        break;
      case 'repeatable_group':
        map[section.key] = parseMaterialSection(raw);
        break;
      case 'static_material_table':
        map[section.key] = parseStaticMaterialSection(raw, getStaticMaterialConfig(section));
        break;
      case 'matrix_table':
        map[section.key] = parseBlowProcessSection(raw, getBlowProcessConfig(section).rows);
        break;
      case 'target_chemistry':
        map[section.key] = parseTargetChemistry(raw, gradeElements);
        break;
      case 'sample_chemistry_matrix': {
        const sampleRows = (section.config.sample_rows as string[] | undefined) ?? [];
        const elements = (section.config.elements as string[] | undefined) ?? [];
        map[section.key] = parseSampleChemistry(raw, sampleRows, elements);
        break;
      }
      case 'production_log_table': {
        const { columns, defaultEmptyRows } = getProductionLogConfig(section);
        map[section.key] = parseProductionLog(raw, columns, defaultEmptyRows);
        break;
      }
      case 'production_register_table': {
        const { columns, defaultEmptyRows } = getProductionLogConfig(section);
        map[section.key] = parseProductionLog(raw, columns, defaultEmptyRows);
        break;
      }
      case 'delay_register_table': {
        const { defaultEmptyRows } = getDelayRegisterConfig(section);
        map[section.key] = parseDelayRegister(raw, defaultEmptyRows);
        break;
      }
      case 'hourly_production_matrix': {
        const { hours, rows } = getHourlyMatrixConfig(section);
        map[section.key] = parseHourlyMatrix(raw, hours, rows);
        break;
      }
      default:
        break;
    }
  }
  return map;
}

export function initPreviewSectionData(
  sections: TemplateSection[],
  gradeElements: GradeElement[],
): SectionDataMap {
  const map: SectionDataMap = {};
  for (const section of sections) {
    switch (section.section_type) {
      case 'table':
        if (section.key === 'chemistry') {
          map[section.key] = buildEmptyChemistry(gradeElements);
        }
        break;
      case 'repeatable_group':
        map[section.key] = emptyMaterialSection();
        break;
      case 'static_material_table':
        map[section.key] = buildStaticMaterialSection(getStaticMaterialConfig(section));
        break;
      case 'matrix_table':
        map[section.key] = buildBlowProcessSection(getBlowProcessConfig(section).rows);
        break;
      case 'target_chemistry':
        map[section.key] = buildTargetChemistry(gradeElements);
        break;
      case 'sample_chemistry_matrix': {
        const sampleRows = (section.config.sample_rows as string[] | undefined) ?? [];
        const elements = (section.config.elements as string[] | undefined) ?? [];
        map[section.key] = buildSampleChemistry(sampleRows, elements);
        break;
      }
      case 'production_log_table': {
        const { columns, defaultEmptyRows } = getProductionLogConfig(section);
        map[section.key] = buildEmptyProductionLog(columns, defaultEmptyRows);
        break;
      }
      case 'production_register_table': {
        const { columns, defaultEmptyRows } = getProductionLogConfig(section);
        map[section.key] = buildEmptyProductionLog(columns, defaultEmptyRows);
        break;
      }
      case 'delay_register_table': {
        const { defaultEmptyRows } = getDelayRegisterConfig(section);
        map[section.key] = buildEmptyDelayRegister(defaultEmptyRows);
        break;
      }
      case 'hourly_production_matrix': {
        const { hours, rows } = getHourlyMatrixConfig(section);
        map[section.key] = buildEmptyHourlyMatrix(hours, rows);
        break;
      }
      default:
        break;
    }
  }
  return map;
}

export function sectionDataToPayload(section: TemplateSection, data: unknown): unknown {
  switch (section.section_type) {
    case 'repeatable_group':
      return materialSectionToPayload(data as MaterialSectionData);
    case 'static_material_table':
      return staticMaterialToPayload(data as StaticMaterialSectionData);
    default:
      return data;
  }
}

interface SectionRendererProps {
  section: TemplateSection;
  sectionData: SectionDataMap;
  onSectionDataChange: (key: string, data: unknown) => void;
  ctx: SectionRenderContext;
  readOnly?: boolean;
  showSave?: boolean;
  saving?: boolean;
  onSaveSection?: (section: TemplateSection) => void;
  onSaveFields?: (fieldKeys: string[]) => void;
}

export function SectionRenderer({
  section,
  sectionData,
  onSectionDataChange,
  ctx,
  readOnly,
  showSave,
  saving,
  onSaveSection,
  onSaveFields,
}: SectionRendererProps) {
  if (section.section_type === 'fields') {
    const hasRemarksField = section.fields.some((f) => f.name === 'remarks');
    const fields = ctx.runId && hasRemarksField
      ? section.fields.filter((f) => f.name !== 'remarks')
      : section.fields;
    return (
      <div>
        {ctx.runId && hasRemarksField && (
          <RemarkThread
            runId={ctx.runId}
            runState={ctx.runState ?? ''}
            readOnly={readOnly}
          />
        )}
        <FieldsSection
          section={{ ...section, fields }}
          {...ctx}
          readOnly={readOnly}
          showSave={showSave}
          saving={saving}
          onSave={onSaveFields ? () => onSaveFields(fields.map((f) => f.name)) : undefined}
        />
      </div>
    );
  }

  if (section.section_type === 'table' && section.key === 'chemistry') {
    const data = (sectionData[section.key] as ChemistrySectionData) ?? buildEmptyChemistry(ctx.gradeElements);
    return (
      <div>
        <ChemistryTable
          elements={ctx.gradeElements}
          data={data}
          maxSamples={(section.config.max_samples as number | undefined) ?? 8}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : 'Save Chemistry'}
          </Button>
        )}
      </div>
    );
  }

  if (section.section_type === 'repeatable_group') {
    const materials =
      section.key === 'charge_mix' ? ctx.scrapMaterials : ctx.alloyMaterials;
    const data = (sectionData[section.key] as MaterialSectionData) ?? emptyMaterialSection();
    return (
      <div>
        <MaterialRowsTable
          materials={materials}
          data={data}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : `Save ${section.title}`}
          </Button>
        )}
      </div>
    );
  }

  if (section.section_type === 'static_material_table') {
    const config = getStaticMaterialConfig(section);
    const data =
      (sectionData[section.key] as StaticMaterialSectionData) ?? buildStaticMaterialSection(config);
    return (
      <div>
        <StaticMaterialTable
          config={config}
          data={data}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : `Save ${section.title}`}
          </Button>
        )}
      </div>
    );
  }

  if (section.section_type === 'matrix_table') {
    const { rows, columns } = getBlowProcessConfig(section);
    const data =
      (sectionData[section.key] as BlowProcessSectionData) ?? buildBlowProcessSection(rows);
    return (
      <div>
        <BlowProcessMatrix
          rowLabels={rows}
          columns={columns}
          data={data}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : `Save ${section.title}`}
          </Button>
        )}
      </div>
    );
  }

  if (section.section_type === 'target_chemistry') {
    const elementCodes = (section.config.elements as string[] | undefined) ?? undefined;
    const data =
      (sectionData[section.key] as TargetChemistrySectionData) ??
      buildTargetChemistry(ctx.gradeElements);
    return (
      <div>
        <TargetChemistryRow
          elements={ctx.gradeElements}
          elementCodes={elementCodes}
          data={data}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : `Save ${section.title}`}
          </Button>
        )}
      </div>
    );
  }

  if (section.section_type === 'sample_chemistry_matrix') {
    const sampleRows = (section.config.sample_rows as string[] | undefined) ?? [];
    const elements = (section.config.elements as string[] | undefined) ?? [];
    const includeTemperature = Boolean(section.config.include_temperature);
    const data =
      (sectionData[section.key] as SampleChemistrySectionData) ??
      buildSampleChemistry(sampleRows, elements);
    return (
      <div>
        <SampleChemistryMatrix
          sampleRows={sampleRows}
          elements={elements}
          includeTemperature={includeTemperature}
          data={data}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : `Save ${section.title}`}
          </Button>
        )}
      </div>
    );
  }

  if (section.section_type === 'delay_register_table') {
    const { defaultEmptyRows } = getDelayRegisterConfig(section);
    const data =
      (sectionData[section.key] as ReturnType<typeof parseDelayRegister>) ??
      buildEmptyDelayRegister(defaultEmptyRows);
    return (
      <div>
        <DelayRegisterTable
          data={data}
          plantId={ctx.plantId}
          plantUsers={ctx.plantUsers ?? []}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : `Save ${section.title}`}
          </Button>
        )}
      </div>
    );
  }

  if (section.section_type === 'hourly_production_matrix') {
    const { hours, rows } = getHourlyMatrixConfig(section);
    const data =
      (sectionData[section.key] as ReturnType<typeof parseHourlyMatrix>) ??
      buildEmptyHourlyMatrix(hours, rows);
    return (
      <div>
        <HourlyProductionMatrix
          hours={hours}
          rows={rows}
          data={data}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : `Save ${section.title}`}
          </Button>
        )}
      </div>
    );
  }

  if (section.section_type === 'production_log_table' || section.section_type === 'production_register_table') {
    const { columns, defaultEmptyRows } = getProductionLogConfig(section);
    const data =
      (sectionData[section.key] as ProductionLogSectionData) ??
      buildEmptyProductionLog(columns, defaultEmptyRows);
    const Table =
      section.section_type === 'production_register_table'
        ? ProductionRegisterTable
        : ConcastProductionTable;
    const coilPurpose =
      (section.config.coil_picker_purpose as 'drawing' | undefined) ??
      (section.key === 'input_material' || section.key === 'output_material' ? 'drawing' : undefined);
    return (
      <div>
        <Table
          columns={columns}
          data={data}
          grades={ctx.steelGrades ?? []}
          plantId={ctx.plantId}
          runId={ctx.runId}
          coilPurpose={coilPurpose}
          onChange={(d) => onSectionDataChange(section.key, d)}
          readOnly={readOnly}
        />
        {showSave && onSaveSection && !readOnly && (
          <Button className="mt-4" onClick={() => onSaveSection(section)} disabled={saving}>
            {saving ? 'Saving...' : `Save ${section.title}`}
          </Button>
        )}
      </div>
    );
  }

  return <p className="text-sm text-slate-500">Section type &quot;{section.section_type}&quot; is not supported yet.</p>;
}
