import apiClient from './client';
import type { ApiResponse, DashboardData } from '@/types';

export const analyticsApi = {
  getDashboard: (params: { ranchId: string; period?: string; startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<DashboardData>>('/analytics/dashboard', { params }),

  getMapData: (data: { ranchId: string; bounds: unknown; zoom: number; healthStatus?: string; breeds?: string[] }) =>
    apiClient.post<ApiResponse<unknown>>('/analytics/map', data),

  getHeatmapStats: (params: { ranchId: string }) =>
    apiClient.get<ApiResponse<unknown>>('/analytics/heatmap/stats', { params }),

  getWeightedHeatmap: (data: { ranchId: string; weightField: 'weight' | 'age' | 'production' }) =>
    apiClient.post<ApiResponse<unknown>>('/analytics/heatmap/weighted', data),

  getTemporalHeatmap: (data: { ranchId: string; date: string }) =>
    apiClient.post<ApiResponse<unknown>>('/analytics/heatmap/temporal', data),

  expandCluster: (data: { ranchId: string; bounds: unknown }) =>
    apiClient.post<ApiResponse<unknown>>('/analytics/cluster/expand', data),

  getClusterStats: (params: { ranchId: string; bounds: string; zoom: number }) =>
    apiClient.get<ApiResponse<unknown>>('/analytics/cluster/stats', { params }),

  getNearbyClusters: (data: { ranchId: string; point: { lat: number; lng: number }; radiusKm: number }) =>
    apiClient.post<ApiResponse<unknown>>('/analytics/nearby-clusters', data),
};
