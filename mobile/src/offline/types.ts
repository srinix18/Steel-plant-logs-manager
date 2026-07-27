/** Queued process-run PATCH payloads for offline / failed saves (P6-OFFLINE). */

export type ProcessRunPatchPayload = {
  field_values?: { field_key: string; value: unknown }[];
  section_data?: { section_key: string; data: unknown }[];
  grade_id?: string;
};

export type DraftSaveItem = {
  id: string;
  runId: string;
  payload: ProcessRunPatchPayload;
  createdAt: string;
  lastError?: string;
};
