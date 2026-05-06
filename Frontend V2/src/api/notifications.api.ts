import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, Notification } from '@/types';

export const notificationsApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<Notification>>>('/notifications', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Notification>>(`/notifications/${id}`),

  unreadCount: () =>
    apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count'),

  markAsRead: (id: string) =>
    apiClient.patch<ApiResponse<Notification>>(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post<ApiResponse<null>>('/notifications/mark-all-read'),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/notifications/${id}`),
};
