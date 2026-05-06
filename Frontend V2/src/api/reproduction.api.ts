import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, ReproductionEvent, ConceptionRate, CalvingInterval } from '@/types';

export const reproductionApi = {
  listEvents: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<ReproductionEvent>>>('/reproduction/events', { params }),

  getEvent: (id: string) =>
    apiClient.get<ApiResponse<ReproductionEvent>>(`/reproduction/events/${id}`),

  getRanchEvents: (ranchId: string, params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<ReproductionEvent>>>(`/reproduction/ranch/${ranchId}/events`, { params }),

  registerHeat: (data: Partial<ReproductionEvent>) =>
    apiClient.post<ApiResponse<ReproductionEvent>>('/reproduction/heat', data),

  registerInsemination: (data: Partial<ReproductionEvent>) =>
    apiClient.post<ApiResponse<ReproductionEvent>>('/reproduction/insemination', data),

  confirmPregnancy: (data: Partial<ReproductionEvent>) =>
    apiClient.post<ApiResponse<ReproductionEvent>>('/reproduction/pregnancy', data),

  registerBirth: (data: Partial<ReproductionEvent>) =>
    apiClient.post<ApiResponse<ReproductionEvent>>('/reproduction/birth', data),

  updateEvent: (id: string, data: Partial<ReproductionEvent>) =>
    apiClient.put<ApiResponse<ReproductionEvent>>(`/reproduction/events/${id}`, data),

  deleteEvent: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/reproduction/events/${id}`),

  conceptionRate: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<ConceptionRate>>('/reproduction/metrics/conception-rate', { params }),

  calvingInterval: (ranchId: string) =>
    apiClient.get<ApiResponse<CalvingInterval>>(`/reproduction/ranch/${ranchId}/metrics/calving-interval`),
};
