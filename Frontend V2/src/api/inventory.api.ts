import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams, InventoryItem, InventoryValuation, InventoryAlert } from '@/types';

export const inventoryApi = {
  list: (params?: PaginationParams) =>
    apiClient.get<ApiResponse<PaginatedResponse<InventoryItem>>>('/inventory', { params }),

  getById: (itemId: string) =>
    apiClient.get<ApiResponse<InventoryItem>>(`/inventory/${itemId}`),

  valuation: (ranchId: string) =>
    apiClient.get<ApiResponse<InventoryValuation>>(`/inventory/valuation/${ranchId}`),

  alerts: (ranchId: string) =>
    apiClient.get<ApiResponse<InventoryAlert[]>>(`/inventory/alerts/${ranchId}`),

  updateStock: (itemId: string, data: { quantity: number; type: 'ADD' | 'REMOVE' }) =>
    apiClient.post<ApiResponse<InventoryItem>>(`/inventory/${itemId}/update-stock`, data),

  reserve: (itemId: string, data: { quantity: number; reason?: string }) =>
    apiClient.post<ApiResponse<unknown>>(`/inventory/${itemId}/reserve`, data),

  release: (itemId: string, data: { quantity: number }) =>
    apiClient.post<ApiResponse<unknown>>(`/inventory/${itemId}/release`, data),
};
