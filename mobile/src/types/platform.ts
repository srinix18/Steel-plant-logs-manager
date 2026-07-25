export type Plant = {
  id: string;
  organisation_id: string;
  name: string;
  code: string;
  timezone: string;
};

export type Process = {
  id: string;
  department_id: string;
  code: string;
  name: string;
  default_template_id?: string | null;
};

export type Department = {
  id: string;
  plant_id: string;
  organisation_id: string;
  name: string;
  code: string;
  description?: string | null;
};

export type ProcessInstance = {
  id: string;
  process_id: string;
  asset_id: string;
  name: string;
  status: string;
};

export type Shift = {
  id: string;
  code: string;
  name: string;
};

export type AssetGroup = {
  id: string;
  plant_id: string;
  code: string;
  name: string;
};

export type PlantAsset = {
  id: string;
  group_id: string;
  plant_id: string;
  asset_no: string;
  name: string;
  status: string;
  life_counters?: Record<string, unknown>;
};

export type ShiftHandoverNote = {
  id: string;
  note_date: string;
  department_id: string;
  shift_id: string;
  author_id: string;
  note: string;
  created_at: string;
  author_name?: string | null;
  department_code?: string | null;
  shift_code?: string | null;
};

export type ProcessRunType =
  | 'heat'
  | 'shift'
  | 'daily'
  | 'ladle_metallurgy'
  | 'cast'
  | string;

export type ProcessOption = {
  code: string;
  label: string;
  instanceLabel: string;
  runType: ProcessRunType;
  /** When true, launcher opens blocked status screen — never creates a run. */
  notDigitized?: boolean;
};
