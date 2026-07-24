import type { TemplateSection } from '@/src/types/processRun';
import type {
  BlowProcessSectionData,
  ChemistrySectionData,
  DelayRegisterRow,
  DelayRegisterSectionData,
  GradeElement,
  HourlyMatrixRowDef,
  HourlyMatrixSectionData,
  MaterialRow,
  MaterialSectionData,
  MatrixColumnDef,
  ProductionLogCellValue,
  ProductionLogColumnDef,
  ProductionLogSectionData,
  SampleChemistrySectionData,
  SectionDataMap,
  StaticMaterialConfig,
  StaticMaterialSectionData,
  TargetChemistrySectionData,
  TimeRangeValue,
} from '@/src/features/run-host/section-data/types';

export type * from '@/src/features/run-host/section-data/types';

export function buildEmptyChemistry(elements: GradeElement[]): ChemistrySectionData {
  return {
    rows: elements.map((el) => ({
      element: el.element,
      min: el.min_value ?? null,
      max: el.max_value ?? null,
      samples: [],
    })),
  };
}

export function parseChemistryData(raw: unknown, elements: GradeElement[]): ChemistrySectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as ChemistrySectionData).rows)) {
    const parsed = raw as ChemistrySectionData;
    if (parsed.rows.length > 0) return parsed;
  }
  return buildEmptyChemistry(elements);
}

export function emptyMaterialSection(): MaterialSectionData {
  return { rows: [] };
}

export function parseMaterialSection(raw: unknown): MaterialSectionData {
  if (Array.isArray(raw)) return { rows: raw as MaterialRow[] };
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as MaterialSectionData).rows)) {
    return raw as MaterialSectionData;
  }
  return emptyMaterialSection();
}

export function materialSectionToPayload(data: MaterialSectionData): MaterialSectionData {
  return {
    rows: data.rows.filter((r) => r.material || r.quantity_kg != null),
  };
}

export function getStaticMaterialConfig(section: TemplateSection): StaticMaterialConfig[] {
  const materials = section.config.materials;
  return Array.isArray(materials) ? (materials as StaticMaterialConfig[]) : [];
}

export function buildStaticMaterialSection(config: StaticMaterialConfig[]): StaticMaterialSectionData {
  return { rows: config.map((m) => ({ material: m.code, quantity_kg: null })) };
}

export function parseStaticMaterialSection(
  raw: unknown,
  config: StaticMaterialConfig[]
): StaticMaterialSectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as StaticMaterialSectionData).rows)) {
    const parsed = raw as StaticMaterialSectionData;
    const byCode = Object.fromEntries(parsed.rows.map((r) => [r.material, r]));
    return {
      rows: config.map((m) => byCode[m.code] ?? { material: m.code, quantity_kg: null }),
    };
  }
  // API may store bare array (post staticMaterialToPayload)
  if (Array.isArray(raw)) {
    const byCode = Object.fromEntries((raw as MaterialRow[]).map((r) => [r.material, r]));
    return {
      rows: config.map((m) => byCode[m.code] ?? { material: m.code, quantity_kg: null }),
    };
  }
  return buildStaticMaterialSection(config);
}

export function staticMaterialToPayload(data: StaticMaterialSectionData): MaterialRow[] {
  return data.rows.filter((r) => r.quantity_kg != null);
}

export function getBlowProcessConfig(section: TemplateSection) {
  const rows = (section.config.rows as string[] | undefined) ?? [];
  const columns = (section.config.columns as MatrixColumnDef[] | undefined) ?? [];
  return { rows, columns };
}

export function buildBlowProcessSection(rowLabels: string[]): BlowProcessSectionData {
  return { rows: rowLabels.map((blow_no) => ({ blow_no, values: {} })) };
}

export function parseBlowProcessSection(raw: unknown, rowLabels: string[]): BlowProcessSectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as BlowProcessSectionData).rows)) {
    const parsed = raw as BlowProcessSectionData;
    const byBlow = Object.fromEntries(parsed.rows.map((r) => [r.blow_no, r]));
    return {
      rows: rowLabels.map((blow_no) => byBlow[blow_no] ?? { blow_no, values: {} }),
    };
  }
  return buildBlowProcessSection(rowLabels);
}

export function buildTargetChemistry(elements: GradeElement[]): TargetChemistrySectionData {
  const targets: Record<string, number | null> = {};
  for (const el of elements) targets[el.element] = null;
  return { targets };
}

export function parseTargetChemistry(
  raw: unknown,
  elements: GradeElement[]
): TargetChemistrySectionData {
  if (raw && typeof raw === 'object' && 'targets' in raw) {
    return raw as TargetChemistrySectionData;
  }
  return buildTargetChemistry(elements);
}

export function buildSampleChemistry(
  sampleRows: string[],
  elements: string[]
): SampleChemistrySectionData {
  return {
    rows: sampleRows.map((sample) => ({
      sample,
      temperature: null,
      elements: Object.fromEntries(elements.map((e) => [e, null])),
    })),
  };
}

export function parseSampleChemistry(
  raw: unknown,
  sampleRows: string[],
  elements: string[]
): SampleChemistrySectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as SampleChemistrySectionData).rows)) {
    const parsed = raw as SampleChemistrySectionData;
    if (parsed.rows.length > 0) return parsed;
  }
  return buildSampleChemistry(sampleRows.length ? sampleRows : ['Sample 1'], elements);
}

export function emptyTimeRange(): TimeRangeValue {
  return { start: null, end: null, total_minutes: null };
}

export function computeTotalMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  // Support HH:MM (blow) and ISO datetime
  if (/^\d{1,2}:\d{2}/.test(start) && /^\d{1,2}:\d{2}/.test(end)) {
    const [fh, fm] = start.split(':').map(Number);
    const [th, tm] = end.split(':').map(Number);
    if (Number.isNaN(fh) || Number.isNaN(th)) return null;
    let fromM = fh * 60 + (fm || 0);
    let toM = th * 60 + (tm || 0);
    if (toM < fromM) toM += 24 * 60;
    return toM - fromM;
  }
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 60000);
}

export function emptyStrandPair() {
  return { strand_1: null as string | number | null, strand_2: null as string | number | null };
}

export function emptyZoneStrand() {
  return { zone_1: emptyStrandPair(), zone_2: emptyStrandPair() };
}

export function emptyMouldTube() {
  return {
    strand_1: { no: '', life: null as number | null },
    strand_2: { no: '', life: null as number | null },
  };
}

export function emptyLadleTemp() {
  return { before_purging: null as number | null, after_purging: null as number | null };
}

export function emptyFurnaceZones() {
  return {
    heat_zone_1: null as number | null,
    heat_zone_2: null as number | null,
    soak_zone_1: null as number | null,
    soak_zone_2: null as number | null,
  };
}

export function getProductionLogConfig(section: TemplateSection) {
  const columns = (section.config.columns as ProductionLogColumnDef[] | undefined) ?? [];
  const defaultEmptyRows = (section.config.default_empty_rows as number | undefined) ?? 5;
  return { columns, defaultEmptyRows };
}

function emptyCellValue(col: ProductionLogColumnDef): ProductionLogCellValue {
  switch (col.type) {
    case 'object':
    case 'ladle_temp':
      return emptyLadleTemp();
    case 'time_range':
      return emptyTimeRange();
    case 'strand_pair':
      return emptyStrandPair();
    case 'zone_strand':
      return emptyZoneStrand();
    case 'mould_tube':
      return emptyMouldTube();
    case 'furnace_zones':
      return emptyFurnaceZones();
    case 'heat_ref':
      return { run_id: '', heat_no: '' };
    case 'coil_ref':
      return { coil_id: '', coil_no: '' };
    default:
      return null;
  }
}

function emptyProductionRow(columns: ProductionLogColumnDef[]) {
  const values: Record<string, ProductionLogCellValue> = {};
  for (const col of columns) values[col.key] = emptyCellValue(col);
  return { values };
}

/** Empty production log row with typed cell shells (time_range, mould_tube, …). */
export function buildEmptyProductionRow(columns: ProductionLogColumnDef[]) {
  return emptyProductionRow(columns);
}

export function buildEmptyProductionLog(
  columns: ProductionLogColumnDef[],
  rowCount = 5
): ProductionLogSectionData {
  return { rows: Array.from({ length: Math.max(rowCount, 1) }, () => emptyProductionRow(columns)) };
}

export function parseProductionLog(
  raw: unknown,
  columns: ProductionLogColumnDef[],
  defaultEmptyRows: number
): ProductionLogSectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as ProductionLogSectionData).rows)) {
    const parsed = raw as ProductionLogSectionData;
    if (parsed.rows.length > 0) {
      return {
        rows: parsed.rows.map((row) => {
          const values: Record<string, ProductionLogCellValue> = {};
          for (const col of columns) {
            values[col.key] = row.values?.[col.key] ?? emptyCellValue(col);
          }
          return { values };
        }),
      };
    }
  }
  return buildEmptyProductionLog(columns, defaultEmptyRows);
}

function newDelayId(): string {
  return `delay-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function emptyDelayRow(): DelayRegisterRow {
  return {
    id: newDelayId(),
    time_from: '',
    time_to: '',
    time_lost_minutes: null,
    delay_code_id: '',
    reason: '',
    action_taken: '',
    assigned_to: '',
    status: 'open',
  };
}

export function buildEmptyDelayRegister(rowCount = 6): DelayRegisterSectionData {
  return { rows: Array.from({ length: Math.max(rowCount, 1) }, () => emptyDelayRow()) };
}

export function parseDelayRegister(raw: unknown, defaultRows = 6): DelayRegisterSectionData {
  if (raw && typeof raw === 'object' && 'rows' in raw && Array.isArray((raw as DelayRegisterSectionData).rows)) {
    const parsed = raw as DelayRegisterSectionData;
    if (parsed.rows.length > 0) {
      return {
        rows: parsed.rows.map((row) => ({
          ...emptyDelayRow(),
          ...row,
          id: row.id || newDelayId(),
        })),
      };
    }
  }
  return buildEmptyDelayRegister(defaultRows);
}

export function getDelayRegisterConfig(section: { config: Record<string, unknown> }) {
  const defaultEmptyRows = (section.config.default_empty_rows as number | undefined) ?? 6;
  return { defaultEmptyRows };
}

export function delayMinutesBetween(from: string, to: string): number | null {
  return computeTotalMinutes(from, to);
}

export function getHourlyMatrixConfig(section: { config: Record<string, unknown> }) {
  const hours = (section.config.hours as string[] | undefined) ?? [];
  const rows = (section.config.rows as HourlyMatrixRowDef[] | undefined) ?? [];
  return { hours, rows };
}

export function buildEmptyHourlyMatrix(
  hours: string[],
  rows: HourlyMatrixRowDef[]
): HourlyMatrixSectionData {
  const rowKeys = rows.map((r) => r.key);
  const data: Record<string, Record<string, string | number | null>> = {};
  for (const h of hours) {
    data[h] = Object.fromEntries(rowKeys.map((k) => [k, null]));
  }
  return { hours: data };
}

export function parseHourlyMatrix(
  raw: unknown,
  hours: string[],
  rows: HourlyMatrixRowDef[]
): HourlyMatrixSectionData {
  const empty = buildEmptyHourlyMatrix(hours, rows);
  if (!raw || typeof raw !== 'object' || !('hours' in raw)) return empty;
  const parsed = raw as HourlyMatrixSectionData;
  const merged = { ...empty.hours };
  for (const h of hours) {
    merged[h] = { ...empty.hours[h], ...(parsed.hours?.[h] ?? {}) };
  }
  return { hours: merged };
}

export function initSectionDataMap(
  sections: TemplateSection[],
  gradeElements: GradeElement[],
  sectionRaw: Record<string, unknown>
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
      case 'matrix_table': {
        const { rows } = getBlowProcessConfig(section);
        map[section.key] = parseBlowProcessSection(raw, rows);
        break;
      }
      case 'target_chemistry':
        map[section.key] = parseTargetChemistry(raw, gradeElements);
        break;
      case 'sample_chemistry_matrix': {
        const sampleRows = (section.config.sample_rows as string[] | undefined) ?? [];
        const elements = (section.config.elements as string[] | undefined) ?? [];
        map[section.key] = parseSampleChemistry(raw, sampleRows, elements);
        break;
      }
      case 'production_log_table':
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
        if (raw && typeof raw === 'object') map[section.key] = raw;
        break;
    }
  }
  return map;
}

export function sectionDataToPayload(section: TemplateSection, data: unknown): unknown {
  switch (section.section_type) {
    case 'repeatable_group':
      return materialSectionToPayload((data as MaterialSectionData) ?? emptyMaterialSection());
    case 'static_material_table':
      return staticMaterialToPayload(
        (data as StaticMaterialSectionData) ??
          buildStaticMaterialSection(getStaticMaterialConfig(section))
      );
    default:
      return data;
  }
}
