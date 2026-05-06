import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, Medication, MedicationInventory, DoseCalculation } from '@/types';

export const medicationsApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<Medication>>>('/medications', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Medication>>(`/medications/${id}`),

  getSummary: (id: string) =>
    apiClient.get<ApiResponse<unknown>>(`/medications/${id}/summary`),

  create: (data: Partial<Medication>) =>
    apiClient.post<ApiResponse<Medication>>('/medications', data),

  update: (id: string, data: Partial<Medication>) =>
    apiClient.put<ApiResponse<Medication>>(`/medications/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/medications/${id}`),

  calculateDose: (data: { medicationId: string; weight: number }) =>
    apiClient.post<ApiResponse<DoseCalculation>>('/medications/calculate-dose', data),

  getSafetyWarnings: (id: string) =>
    apiClient.get<ApiResponse<unknown>>(`/medications/${id}/safety-warnings`),

  checkCompatibility: (data: { medicationId: string; conditions: string[] }) =>
    apiClient.post<ApiResponse<unknown>>('/medications/check-compatibility', data),

  // Inventory
  getStock: (medicationCode: string) =>
    apiClient.get<ApiResponse<MedicationInventory>>(`/medication-inventory/stock/${medicationCode}`),

  getStockLevels: () =>
    apiClient.get<ApiResponse<MedicationInventory[]>>('/medication-inventory/stock-levels'),

  getExpiring: () =>
    apiClient.get<ApiResponse<MedicationInventory[]>>('/medication-inventory/expiring'),

  recordConsumption: (data: unknown) =>
    apiClient.post<ApiResponse<unknown>>('/medication-inventory/consumption', data),

  recordPurchase: (data: unknown) =>
    apiClient.post<ApiResponse<unknown>>('/medication-inventory/purchase', data),
};
