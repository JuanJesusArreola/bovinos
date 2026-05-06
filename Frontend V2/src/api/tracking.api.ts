import apiClient from './client';
import type { ApiResponse, TrackingLocation, TrackingPath, GeoCluster, HeatmapPoint, DeviceStatus } from '@/types';

export const trackingApi = {
  registerLocation: (data: TrackingLocation) =>
    apiClient.post<ApiResponse<unknown>>('/bovines/tracking/location', data),

  registerBatch: (data: TrackingLocation[]) =>
    apiClient.post<ApiResponse<unknown>>('/bovines/tracking/batch', data),

  getLastLocation: (bovineId: string) =>
    apiClient.get<ApiResponse<TrackingLocation>>(`/bovines/${bovineId}/tracking/last`),

  getHistory: (bovineId: string, params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<TrackingLocation[]>>(`/bovines/${bovineId}/tracking/history`, { params }),

  getPath: (bovineId: string, params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<TrackingPath>>(`/bovines/${bovineId}/tracking/path`, { params }),

  getMovementStats: (bovineId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/bovines/${bovineId}/tracking/stats`),

  getDeviceStatus: (deviceId: string) =>
    apiClient.get<ApiResponse<DeviceStatus>>(`/bovines/tracking/device/${deviceId}/status`),

  getBovinesInRadius: (params: { lat: number; lng: number; radius: number }) =>
    apiClient.get<ApiResponse<unknown>>('/bovines/tracking/radius', { params }),

  getGeoStats: (ranchId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/bovines/tracking/geo-stats/${ranchId}`),

  // Geo
  getHeatmap: (ranchId: string) =>
    apiClient.get<ApiResponse<HeatmapPoint[]>>(`/bovines/geo/heatmap/${ranchId}`),

  getClusters: (ranchId: string, data: { bounds: unknown; zoom: number }) =>
    apiClient.post<ApiResponse<GeoCluster[]>>(`/bovines/geo/clusters/${ranchId}`, data),

  expandCluster: (ranchId: string, data: { clusterId: string }) =>
    apiClient.post<ApiResponse<unknown>>(`/bovines/geo/cluster/expand/${ranchId}`, data),

  getPoint: (bovineId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/bovines/geo/point/${bovineId}`),
};
