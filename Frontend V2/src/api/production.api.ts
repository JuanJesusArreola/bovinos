import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, ProductionRecord, ProductionMetrics, ProductionTrend } from '@/types';

export const productionApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<ProductionRecord>>>('/production', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<ProductionRecord>>(`/production/${id}`),

  create: (data: Partial<ProductionRecord>) =>
    apiClient.post<ApiResponse<ProductionRecord>>('/production', data),

  update: (id: string, data: Partial<ProductionRecord>) =>
    apiClient.put<ApiResponse<ProductionRecord>>(`/production/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/production/${id}`),

  metrics: (bovineId: string) =>
    apiClient.get<ApiResponse<ProductionMetrics>>(`/production/metrics/${bovineId}`),

  trends: (bovineId: string) =>
    apiClient.get<ApiResponse<ProductionTrend[]>>(`/production/trends/${bovineId}`),
};
