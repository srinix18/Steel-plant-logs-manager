import { apiClient } from './client';
import type { Department, GradeElement, MaterialCatalogItem, Organisation, Plant, Process, ProcessInstance, Shift, SteelGrade, User } from '../types';

export async function fetchOrganisations(): Promise<Organisation[]> {
  const { data } = await apiClient.get<Organisation[]>('/organisations');
  return data;
}

export async function fetchDepartments(plantId?: string): Promise<Department[]> {
  const { data } = await apiClient.get<Department[]>('/departments', { params: { plant_id: plantId } });
  return data;
}

export async function fetchPlantUsers(plantId: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(`/plants/${plantId}/users`);
  return data;
}

export async function fetchUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users');
  return data;
}

export async function fetchPlants(): Promise<Plant[]> {
  const { data } = await apiClient.get<Plant[]>('/plants');
  return data;
}

export async function fetchProcesses(departmentId?: string): Promise<Process[]> {
  const { data } = await apiClient.get<Process[]>('/processes', { params: { department_id: departmentId } });
  return data;
}

export async function fetchProcessInstances(processId?: string): Promise<ProcessInstance[]> {
  const { data } = await apiClient.get<ProcessInstance[]>('/process-instances', { params: { process_id: processId } });
  return data;
}

export async function fetchShifts(plantId?: string): Promise<Shift[]> {
  const { data } = await apiClient.get<Shift[]>('/shifts', { params: { plant_id: plantId } });
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

export async function fetchMaterials(materialType?: 'scrap' | 'alloy'): Promise<MaterialCatalogItem[]> {
  const { data } = await apiClient.get<MaterialCatalogItem[]>('/materials', {
    params: materialType ? { material_type: materialType } : {},
  });
  return data;
}
