import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, User, UserRole } from '@/types';

export const usersApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<User>>>('/users', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<User>>(`/users/${id}`),

  update: (id: string, data: Partial<User>) =>
    apiClient.put<ApiResponse<User>>(`/users/${id}`, data),

  deactivate: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/users/${id}`),

  activate: (id: string) =>
    apiClient.post<ApiResponse<User>>(`/users/${id}/activate`),

  // Admin
  createUser: (data: { email: string; password: string; firstName: string; lastName: string; role: UserRole; ranchId?: string }) =>
    apiClient.post<ApiResponse<User>>('/admin/users', data),

  getAssignableRoles: () =>
    apiClient.get<ApiResponse<UserRole[]>>('/admin/roles'),

  // Security
  getSecurityEvents: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<unknown>>>('/security/events', { params }),

  getUnresolvedEvents: () =>
    apiClient.get<ApiResponse<unknown[]>>('/security/events/unresolved'),

  resolveEvent: (id: string) =>
    apiClient.post<ApiResponse<unknown>>(`/security/events/${id}/resolve`),

  resolveBatch: (ids: string[]) =>
    apiClient.post<ApiResponse<unknown>>('/security/events/resolve-batch', { ids }),

  getSecurityStats: () =>
    apiClient.get<ApiResponse<unknown>>('/security/stats'),
};
