import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, Event, EventFormData } from '@/types';
import type { EventsListFilters, EventsListEnvelope } from '@/types/event.types';

export const eventsApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<Event>>>('/events', { params }),

  /**
   * Listado con filtros multi (eventType, status, priority como CSV) y
   * paginacion. El backend devuelve `data` + `pagination` a la raiz del
   * envelope (no anidado dentro de data), por eso usamos
   * `EventsListEnvelope` directo en lugar de `ApiResponse<T>`.
   */
  listFiltered: (filters: EventsListFilters = {}) => {
    const params: Record<string, string | number | undefined> = {};
    if (filters.bovineId)       params.bovineId       = filters.bovineId;
    if (filters.ranchId)        params.ranchId        = filters.ranchId;
    if (filters.assignedTo)     params.assignedTo     = filters.assignedTo;
    if (filters.veterinarianId) params.veterinarianId = filters.veterinarianId;
    if (filters.startDate)      params.startDate      = filters.startDate;
    if (filters.endDate)        params.endDate        = filters.endDate;
    if (filters.isActive != null) params.isActive     = String(filters.isActive);
    if (filters.eventType?.length) params.eventType   = filters.eventType.join(',');
    if (filters.status?.length)    params.status      = filters.status.join(',');
    if (filters.priority?.length)  params.priority    = filters.priority.join(',');
    if (filters.page != null)   params.page  = filters.page;
    if (filters.limit != null)  params.limit = filters.limit;
    return apiClient.get<EventsListEnvelope>('/events', { params });
  },

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
