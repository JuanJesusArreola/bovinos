import apiClient from './client';
import type { ApiResponse, PaginationParams, Ranch, RanchFormData, RanchSummary, RanchMedia } from '@/types';
import type { RanchOccupancyDto } from './locations.api';
import type { RanchBoundaryDto } from '@/types/ranch.types';
import type { GeofenceConfig } from '@/types/location.types';

interface RanchListResponse {
  items: Ranch[];
  total: number;
  totalPages: number;
}

export const ranchApi = {
  list: async (params?: PaginationParams): Promise<RanchListResponse> => {
    const res = await apiClient.get<ApiResponse<Ranch[] | { items: Ranch[]; total: number; totalPages: number }>>('/ranch', { params });
    const payload = res.data.data;

    // Normalize: backend may return array + pagination or nested object
    if (Array.isArray(payload)) {
      const pagination = (res.data as any).pagination;
      return {
        items: payload,
        total: pagination?.total ?? payload.length,
        totalPages: pagination?.totalPages ?? 1,
      };
    }
    return payload as RanchListResponse;
  },

  getById: (id: string) =>
    apiClient.get<ApiResponse<Ranch>>(`/ranch/${id}`),

  create: (data: RanchFormData) =>
    apiClient.post<ApiResponse<Ranch>>('/ranch', data),

  update: (id: string, data: Partial<RanchFormData>) =>
    apiClient.put<ApiResponse<Ranch>>(`/ranch/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/ranch/${id}`),

  getSummary: (id: string) =>
    apiClient.get<ApiResponse<RanchSummary>>(`/ranch/${id}/summary`),

  getOccupancy: (id: string) =>
    apiClient.get<ApiResponse<{ occupancy: number }>>(`/ranch/${id}/occupancy`),

  /**
   * Aggregated occupancy across all locations of a ranch.
   * Lives at `/ranches/:id/occupancy` (plural) — independent of the old
   * `/ranch/:id/occupancy` which only reads Ranch.currentCattleCount.
   * This one SUMS LocationCapacity.currentAnimals / maxAnimals.
   */
  getAggregatedOccupancy: (ranchId: string) =>
    apiClient.get<ApiResponse<RanchOccupancyDto>>(`/ranches/${ranchId}/occupancy`),

  /**
   * Lightweight read of just the ranch perimeter + center.
   * Faster than getById() when only boundary info is needed (e.g. MapPicker).
   * Endpoint: GET /api/ranches/:id/boundary
   */
  getBoundary: (ranchId: string) =>
    apiClient.get<ApiResponse<RanchBoundaryDto>>(`/ranches/${ranchId}/boundary`),

  /**
   * Update ONLY the ranch perimeter. Backend runs cross-validation:
   * if any existing location would fall outside the new boundary, returns
   * 409 BOUNDARY_LEAVES_LOCATIONS_OUTSIDE with details.outsideLocations[].
   * Endpoint: PUT /api/ranches/:id/boundary
   */
  updateBoundary: (ranchId: string, boundary: GeofenceConfig | null) =>
    apiClient.put<ApiResponse<{ boundary: GeofenceConfig | null }>>(
      `/ranches/${ranchId}/boundary`,
      { boundary },
    ),

  getCattleDensity: (id: string) =>
    apiClient.get<ApiResponse<{ density: number }>>(`/ranch/${id}/cattle-density`),

  // Legal
  getOwnership: (ranchId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/ranch/legal/${ranchId}/ownership`),

  getCertifications: (ranchId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/ranch/legal/${ranchId}/certifications/valid`),

  getLicenses: (ranchId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/ranch/legal/${ranchId}/licenses/valid`),

  getInsurances: (ranchId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/ranch/legal/${ranchId}/insurances/coverage`),

  // Operations
  getProduction: (ranchId: string, year: number) =>
    apiClient.get<ApiResponse<unknown>>(`/ranch/operations/${ranchId}/production/${year}`),

  getFinancial: (ranchId: string, year: number) =>
    apiClient.get<ApiResponse<unknown>>(`/ranch/operations/${ranchId}/financial/${year}`),

  getSustainability: (ranchId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/ranch/operations/${ranchId}/sustainability`),

  // ── Media (mounted at /ranch/management) ────────────────────────────
  listMedia: (ranchId: string, params?: { type?: string; category?: string; limit?: number; offset?: number }) =>
    apiClient.get<ApiResponse<RanchMedia[]>>(`/ranch/management/${ranchId}/media`, { params }),

  getMedia: (mediaId: string) =>
    apiClient.get<ApiResponse<RanchMedia>>(`/ranch/management/media/${mediaId}`),

  uploadMedia: (ranchId: string, file: File, meta: { title: string; type: string; category: string; description?: string; tags?: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', meta.title);
    formData.append('type', meta.type);
    formData.append('category', meta.category);
    if (meta.description) formData.append('description', meta.description);
    if (meta.tags) formData.append('tags', meta.tags);
    return apiClient.post<ApiResponse<RanchMedia>>(`/ranch/management/${ranchId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteMedia: (mediaId: string) =>
    apiClient.delete<ApiResponse<null>>(`/ranch/management/media/${mediaId}`),
};
