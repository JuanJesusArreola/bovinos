import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, Event, EventFormData } from '@/types';

export const eventsApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<Event>>>('/events', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Event>>(`/events/${id}`),

  create: (data: EventFormData) =>
    apiClient.post<ApiResponse<Event>>('/events', data),

  update: (id: string, data: Partial<EventFormData>) =>
    apiClient.put<ApiResponse<Event>>(`/events/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/events/${id}`),

  upcoming: () =>
    apiClient.get<ApiResponse<Event[]>>('/events/upcoming'),

  overdue: () =>
    apiClient.get<ApiResponse<Event[]>>('/events/overdue'),

  getByBovine: (bovineId: string) =>
    apiClient.get<ApiResponse<Event[]>>(`/events/bovine/${bovineId}`),

  start: (id: string) =>
    apiClient.post<ApiResponse<Event>>(`/events/${id}/start`),

  complete: (id: string) =>
    apiClient.post<ApiResponse<Event>>(`/events/${id}/complete`),

  cancel: (id: string) =>
    apiClient.post<ApiResponse<Event>>(`/events/${id}/cancel`),

  postpone: (id: string, data: { newDate: string; reason?: string }) =>
    apiClient.post<ApiResponse<Event>>(`/events/${id}/postpone`, data),
};
