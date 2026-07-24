/** Section payload shapes for run-host adapters (P2-ENGINE-03). */

export type GradeElement = {
  element: string;
  min_value?: number | null;
  max_value?: number | null;
};

export type MaterialCatalogItem = {
  id?: string;
  code: string;
  name: string;
  type?: string;
};

export type SteelGrade = {
  id: string;
  code: string;
  description?: string;
};

export type ChemistryRow = {
  element: string;
  min?: number | null;
  max?: number | null;
  samples: (number | null)[];
};

export type ChemistrySectionData = { rows: ChemistryRow[] };

export type MaterialRow = {
  material: string;
  quantity_kg: number | null;
};

export type MaterialSectionData = { rows: MaterialRow[] };

export type StaticMaterialConfig = { code: string; label: string };
export type StaticMaterialSectionData = { rows: MaterialRow[] };

export type MatrixColumnDef = {
  key: string;
  label: string;
  type: string;
  group?: string;
};

export type BlowProcessSectionData = {
  rows: { blow_no: string; values: Record<string, string | number | null> }[];
};

export type TargetChemistrySectionData = {
  targets: Record<string, number | null>;
};

export type SampleChemistrySectionData = {
  rows: {
    sample: string;
    temperature: number | null;
    elements: Record<string, number | null>;
  }[];
};

export type TimeRangeValue = {
  start: string | null;
  end: string | null;
  total_minutes: number | null;
};

export type StrandPairValue = {
  strand_1: string | number | null;
  strand_2: string | number | null;
};

export type ZoneStrandValue = {
  zone_1: StrandPairValue;
  zone_2: StrandPairValue;
};

export type MouldTubeValue = {
  strand_1: { no: string; life: number | null };
  strand_2: { no: string; life: number | null };
};

export type LadleTempValue = {
  before_purging: number | null;
  after_purging: number | null;
};

export type FurnaceZonesValue = {
  heat_zone_1: number | null;
  heat_zone_2: number | null;
  soak_zone_1: number | null;
  soak_zone_2: number | null;
};

export type HeatRefValue = { run_id: string; heat_no: string };
export type CoilRefValue = { coil_id: string; coil_no: string };

export type ProductionLogColumnDef = {
  key: string;
  label: string;
  type: string;
  options?: string[];
  formula?: string;
  subtype?: 'number' | 'datetime' | 'text';
  fields?: { key: string; label: string; type: string }[];
};

export type ProductionLogCellValue =
  | string
  | number
  | null
  | TimeRangeValue
  | StrandPairValue
  | ZoneStrandValue
  | MouldTubeValue
  | LadleTempValue
  | FurnaceZonesValue
  | HeatRefValue
  | CoilRefValue
  | Record<string, unknown>;

export type ProductionLogSectionData = {
  rows: { values: Record<string, ProductionLogCellValue> }[];
};

export type DelayRegisterRow = {
  id: string;
  time_from: string;
  time_to: string;
  time_lost_minutes: number | null;
  delay_code_id: string;
  reason: string;
  action_taken: string;
  assigned_to: string;
  status: string;
};

export type DelayRegisterSectionData = { rows: DelayRegisterRow[] };

export type HourlyMatrixRowDef = { key: string; label: string; type: string };
export type HourlyMatrixSectionData = {
  hours: Record<string, Record<string, string | number | null>>;
};

export type SectionDataMap = Record<string, unknown>;
