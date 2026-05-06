import apiClient from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  Bovine,
  BovineFilters,
  BovineFormData,
  BovineStatistics,
} from '@/types';

// Backend returns { data: Bovine[], pagination: {...} } at top level, not nested in data
interface BovineListApiResponse {
  success: boolean;
  data: Bovine[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const bovinesApi = {
  list: (params?: PaginationParams & BovineFilters) =>
    apiClient.get<BovineListApiResponse>('/bovines', { params }).then((res) => ({
      ...res,
      data: {
        ...res.data,
        // Normalize to PaginatedResponse shape used by frontend
        data: {
          items: res.data.data,
          total: res.data.pagination.total,
          totalPages: res.data.pagination.totalPages,
          page: res.data.pagination.page,
          limit: res.data.pagination.limit,
        } as PaginatedResponse<Bovine>,
      },
    })),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Bovine>>(`/bovines/${id}`),

  getByEarTag: (earTag: string) =>
    apiClient.get<ApiResponse<Bovine>>(`/bovines/ear-tag/${earTag}`),

  create: (data: BovineFormData) =>
    apiClient.post<ApiResponse<Bovine>>('/bovines', data),

  update: (id: string, data: Partial<BovineFormData>) =>
    apiClient.put<ApiResponse<Bovine>>(`/bovines/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/bovines/${id}`),

  statistics: () =>
    apiClient.get<ApiResponse<BovineStatistics>>('/bovines/statistics'),

  regenerateQR: (id: string) =>
    apiClient.post<ApiResponse<{ qrCode: string }>>(`/bovines/${id}/regenerate-qr`),

  /** Move a bovine to a different location/potrero */
  moveToLocation: (id: string, data: { locationId: string; reason?: string }) =>
    apiClient.patch<ApiResponse<Bovine>>(`/bovines/${id}/location`, data),

  /** Bulk move multiple bovines to the same location */
  bulkMove: (ids: string[], locationId: string, reason?: string) =>
    Promise.all(ids.map((id) => apiClient.patch<ApiResponse<Bovine>>(`/bovines/${id}/location`, { locationId, reason }))),

  // Geo endpoints
  getHeatmap: (ranchId: string, filters?: { healthStatus?: string; breeds?: string; ageMin?: number; ageMax?: number }) =>
    apiClient.get<ApiResponse<HeatmapPoint[]>>(`/bovines/geo/heatmap/${ranchId}`, { params: filters }),

  getClusters: (ranchId: string, data: { bounds: MapBounds; zoom: number; filters?: Record<string, unknown> }) =>
    apiClient.post<ApiResponse<ClusterPoint[]>>(`/bovines/geo/clusters/${ranchId}`, data),

  expandCluster: (ranchId: string, data: { bounds: MapBounds; filters?: Record<string, unknown> }) =>
    apiClient.post<ApiResponse<BovinePoint[]>>(`/bovines/geo/cluster/expand/${ranchId}`, data),

  getBovinePoint: (bovineId: string) =>
    apiClient.get<ApiResponse<BovinePoint>>(`/bovines/geo/point/${bovineId}`),

  getGeoStats: (ranchId: string) =>
    apiClient.get<ApiResponse<GeoStats>>(`/bovines/tracking/geo-stats/${ranchId}`),

  // ── Media ─────────────────────────────────────────────────────────────────
  /** List all photos attached to this bovine */
  getPhotos: (id: string) =>
    apiClient.get<ApiResponse<BovinePhoto[]>>(`/bovines/${id}/photos`),

  /** Attach an already-uploaded URL to the bovine */
  addPhoto: (id: string, data: { url: string; storagePath: string; caption?: string; takenAt?: string }) =>
    apiClient.post<ApiResponse<BovinePhoto>>(`/bovines/${id}/photos`, data),

  /** Remove a photo by its record id */
  removePhoto: (id: string, photoId: string) =>
    apiClient.delete<ApiResponse<null>>(`/bovines/${id}/photos/${photoId}`),

  /** List documents attached to this bovine */
  getDocuments: (id: string) =>
    apiClient.get<ApiResponse<BovineDocument[]>>(`/bovines/${id}/documents`),

  /** Attach an already-uploaded document */
  addDocument: (id: string, data: { url: string; storagePath: string; name: string; category: string; size?: number }) =>
    apiClient.post<ApiResponse<BovineDocument>>(`/bovines/${id}/documents`, data),

  /** Remove a document by its record id */
  removeDocument: (id: string, docId: string) =>
    apiClient.delete<ApiResponse<null>>(`/bovines/${id}/documents/${docId}`),
};

// Geo types
export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  healthStatus?: string;
  bovineId?: string;
}

export interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
  count: number;
  bounds?: MapBounds;
  healthBreakdown?: Record<string, number>;
}

export interface BovinePoint {
  bovineId: string;
  earTag?: string;
  name?: string;
  lat: number;
  lng: number;
  healthStatus: string;
  breed?: string;
  gender?: string;
  ageInMonths?: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeoStats {
  trackedBovines: number;
  activeLocations: number;
  onlineDevices: number;
  geofenceAlerts: number;
}

export interface BovinePhoto {
  id: string;
  bovineId: string;
  url: string;
  storagePath?: string;
  caption?: string;
  takenAt?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  createdAt: string;
}

export interface BovineDocument {
  id: string;
  bovineId: string;
  url: string;
  storagePath?: string;
  name: string;
  category: string;
  size?: number;
  uploadedBy?: string;
  uploadedByName?: string;
  createdAt: string;
}
