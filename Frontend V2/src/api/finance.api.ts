import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, Transaction, FinanceSummary, ROIAnalysis } from '@/types';

export const financeApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<Transaction>>>('/finance', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Transaction>>(`/finance/${id}`),

  create: (data: Partial<Transaction>) =>
    apiClient.post<ApiResponse<Transaction>>('/finance', data),

  update: (id: string, data: Partial<Transaction>) =>
    apiClient.put<ApiResponse<Transaction>>(`/finance/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/finance/${id}`),

  summary: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<FinanceSummary>>('/finance/summary', { params }),

  veterinaryCosts: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<unknown>>('/finance/veterinary-costs', { params }),

  roiAnalysis: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<ROIAnalysis>>('/finance/roi-analysis', { params }),
};
