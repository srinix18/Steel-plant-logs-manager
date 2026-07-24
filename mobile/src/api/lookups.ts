import { apiClient } from '@/src/api/client';
import type {
  GradeElement,
  MaterialCatalogItem,
  SteelGrade,
} from '@/src/features/run-host/section-data/types';
import type {
  AssetGroup,
  Plant,
  PlantAsset,
  Process,
  ProcessInstance,
  Shift,
  ShiftHandoverNote,
} from '@/src/types/platform';
import type { User } from '@/src/types/user';

export async function fetchPlants(): Promise<Plant[]> {
  const { data } = await apiClient.get<Plant[]>('/plants');
  return data;
}

export async function fetchProcesses(departmentId?: string): Promise<Process[]> {
  const q = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
  const { data } = await apiClient.get<Process[]>(`/processes${q}`);
  return data;
}

export async function fetchProcessInstances(processId?: string): Promise<ProcessInstance[]> {
  const q = processId ? `?process_id=${encodeURIComponent(processId)}` : '';
  const { data } = await apiClient.get<ProcessInstance[]>(`/process-instances${q}`);
  return data;
}

export async function fetchShifts(plantId?: string): Promise<Shift[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<Shift[]>(`/shifts${q}`);
  return data;
}

export async function fetchSteelGrades(): Promise<SteelGrade[]> {
  const { data } = await apiClient.get<SteelGrade[]>('/steel-grades');
  return data;
}

export async function fetchGradeElements(gradeId: string): Promise<GradeElement[]> {
  const { data } = await apiClient.get<GradeElement[]>(`/steel-grades/${gradeId}/elements`);
  return data;
}

export async function fetchMaterials(
  materialType?: 'scrap' | 'alloy'
): Promise<MaterialCatalogItem[]> {
  const q = materialType ? `?type=${encodeURIComponent(materialType)}` : '';
  const { data } = await apiClient.get<MaterialCatalogItem[]>(`/materials${q}`);
  return data;
}

export async function fetchPlantUsers(plantId: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(`/plants/${plantId}/users`);
  return data;
}

export async function fetchAssetGroups(plantId?: string): Promise<AssetGroup[]> {
  const q = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : '';
  const { data } = await apiClient.get<AssetGroup[]>(`/asset-groups${q}`);
  return data;
}

export async function fetchAssets(opts?: {
  plantId?: string;
  groupId?: string;
}): Promise<PlantAsset[]> {
  const params = new URLSearchParams();
  if (opts?.plantId) params.set('plant_id', opts.plantId);
  if (opts?.groupId) params.set('group_id', opts.groupId);
  const q = params.toString() ? `?${params.toString()}` : '';
  const { data } = await apiClient.get<PlantAsset[]>(`/assets${q}`);
  return data;
}

export async function fetchPreviousHandover(
  departmentId: string,
  shiftId: string,
  noteDate?: string
): Promise<ShiftHandoverNote | null> {
  const params = new URLSearchParams({
    department_id: departmentId,
    shift_id: shiftId,
  });
  if (noteDate) params.set('note_date', noteDate);
  const { data } = await apiClient.get<ShiftHandoverNote | null>(
    `/workforce/handover-notes/previous?${params.toString()}`
  );
  return data;
}
