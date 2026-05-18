import apiClient from './client';
import type {
  ApiSuccessResponse,
  BovineDetailResponse,
  BovineListResponse,
  BovineFilters,
  BovineStatistics,
  PaginationOptions,
  BovineFullResponse,
  BovineCurrentLocationResponse,
  VaccinationResponse,
  VaccinationListResponse,
  VaccinationStatusResponse,
  CreateVaccinationInput,
  ListVaccinationsFilters,
  BovineMediaListResponse,
  BovineMediaUploadResponse,
  BovineMediaType,
  BovineMapMarkersResponse,
  MapMarkersFilters,
  MapMarkersOptions,
  BovineFiltersOptionsResponse,
  CreateBovineInput,
  MoveBovineInput,
} from '@/types/bovine.dtos';

/**
 * Bovines API client.
 *
 * Each method returns the raw axios response (`AxiosResponse<ApiSuccessResponse<T>>`)
 * so callers can either:
 *   - read `.data.data` (legacy pattern still in use across pages)
 *   - or use the centralized hooks (`hooks/useBovines.ts`) that unwrap once.
 *
 * All `T` are tied to the DTOs in `@/types/bovine.dtos` — single source of
 * truth mirrored from `backend/src/dtos/bovine.dtos.ts`.
 */

// ─── List & detail ──────────────────────────────────────────────────────────

/**
 * Flatten complex filters to query params:
 * - arrays → CSV (`ranchIds=a,b,c`)
 * - ranges → flat min/max (`ageMin=12&ageMax=24`)
 *
 * Accepts a "loose" object so callers can pass either a strict
 * `BovineFilters` (recommended) or a quick `{ healthStatus: 'HEALTHY' }`
 * literal during refactor. Backend validates the values.
 */
function flattenFilters(
  filters: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const out: Record<string, string | number | boolean | undefined> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value.join(',');
    } else if (typeof value === 'object') {
      const range = value as { min?: number; max?: number };
      const baseKey = key.replace(/Range$/, '');
      if (range.min != null) out[`${baseKey}Min`] = range.min;
      if (range.max != null) out[`${baseKey}Max`] = range.max;
    } else {
      out[key] = value as string | number | boolean;
    }
  });
  return out;
}

export const bovinesApi = {
  // ── List & detail ────────────────────────────────────────────────────────

  /**
   * GET /api/bovines — paginated list with filters.
   *
   * The strict shape of `params` is `Partial<BovineFilters & PaginationOptions>`,
   * but for retro-compat during the migration we accept any record. Hooks should
   * always type their input strictly via `BovineFilters`.
   */
  list: (params?: Partial<BovineFilters & PaginationOptions> | Record<string, unknown>) =>
    apiClient.get<ApiSuccessResponse<BovineListResponse>>('/bovines', {
      params: params ? flattenFilters(params as Record<string, unknown>) : undefined,
    }),

  /** GET /api/bovines/:id — single bovine detail (basic shape). */
  getById: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovineDetailResponse>>(`/bovines/${id}`),

  /** GET /api/bovines/ear-tag/:tag — lookup by ear tag. */
  getByEarTag: (earTag: string) =>
    apiClient.get<ApiSuccessResponse<BovineDetailResponse>>(`/bovines/ear-tag/${earTag}`),

  /**
   * GET /api/bovines/:id/full — composite endpoint (bovine + media +
   * currentLocation + vaccinationStatus + recent vaccinations + recent
   * health records + recent movements). Cached server-side 5 min.
   */
  getFull: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovineFullResponse>>(`/bovines/${id}/full`),

  // ── CRUD ─────────────────────────────────────────────────────────────────

  create: (data: CreateBovineInput) =>
    apiClient.post<ApiSuccessResponse<BovineDetailResponse>>('/bovines', data),

  update: (id: string, data: Partial<CreateBovineInput>) =>
    apiClient.put<ApiSuccessResponse<BovineDetailResponse>>(`/bovines/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiSuccessResponse<null>>(`/bovines/${id}`),

  // ── Statistics ───────────────────────────────────────────────────────────

  statistics: () =>
    apiClient.get<ApiSuccessResponse<BovineStatistics>>('/bovines/statistics'),

  regenerateQR: (id: string) =>
    apiClient.post<ApiSuccessResponse<{ qrCode: string }>>(`/bovines/${id}/regenerate-qr`),

  // ── Movement ─────────────────────────────────────────────────────────────

  /** PATCH /api/bovines/:id/location — register entry to a new location. */
  moveToLocation: (id: string, data: MoveBovineInput) =>
    apiClient.patch<ApiSuccessResponse<BovineDetailResponse>>(`/bovines/${id}/location`, data),

  /**
   * Sequential bulk-move helper. The backend has no batch endpoint yet, so we
   * fan-out `PATCH /bovines/:id/location` for each id with the same metadata
   * (locationId / reason / movementType / notes / enteredAt).
   */
  bulkMove: (
    ids: string[],
    locationId: string,
    reason?: string,
    movementType?: string,
    notes?: string,
  ) =>
    Promise.all(
      ids.map((id) =>
        apiClient.patch<ApiSuccessResponse<BovineDetailResponse>>(
          `/bovines/${id}/location`,
          {
            locationId,
            reason,
            movementType,
            notes,
            enteredAt: new Date().toISOString(),
          },
        ),
      ),
    ),

  // ── Current location (live) ──────────────────────────────────────────────

  /** GET /api/bovines/:id/current-location — consolidated current location. */
  getCurrentLocation: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovineCurrentLocationResponse>>(`/bovines/${id}/current-location`),

  // ── Vaccinations ─────────────────────────────────────────────────────────

  /** GET /api/bovines/:id/vaccinations — paginated list of vaccinations. */
  listVaccinations: (id: string, filters?: Omit<ListVaccinationsFilters, 'bovineId'>) =>
    apiClient.get<ApiSuccessResponse<VaccinationListResponse>>(`/bovines/${id}/vaccinations`, {
      params: filters,
    }),

  /** POST /api/bovines/:id/vaccinations — register a new vaccination. */
  createVaccination: (id: string, data: Omit<CreateVaccinationInput, 'bovineId'>) =>
    apiClient.post<ApiSuccessResponse<VaccinationResponse>>(`/bovines/${id}/vaccinations`, data),

  /**
   * GET /api/bovines/:id/vaccination-status — derived status snapshot.
   * Recalculated server-side from the active vaccination calendar.
   */
  getVaccinationStatus: (id: string) =>
    apiClient.get<ApiSuccessResponse<VaccinationStatusResponse>>(`/bovines/${id}/vaccination-status`),

  // ── Media (unified API) ──────────────────────────────────────────────────

  /**
   * GET /api/bovines/:id/media — list all media grouped by type
   * (images / documents / videos), with totals.
   */
  getMedia: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovineMediaListResponse>>(`/bovines/${id}/media`),

  /**
   * POST /api/bovines/:id/media — upload a single file.
   * Backend validates MIME against `mediaType` and size limits per category.
   */
  uploadMedia: (id: string, file: File, mediaType: BovineMediaType, caption?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mediaType', mediaType);
    if (caption) fd.append('caption', caption);
    return apiClient.post<ApiSuccessResponse<BovineMediaUploadResponse>>(
      `/bovines/${id}/media`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  /**
   * DELETE /api/bovines/:id/media/<storagePath>
   * Path uses wildcard — pass storagePath WITHOUT URL-encoding the slashes.
   */
  deleteMedia: (id: string, storagePath: string, mediaType?: BovineMediaType) => {
    const cleanPath = storagePath.replace(/^\/+/, '');
    const qs = mediaType ? `?mediaType=${mediaType}` : '';
    return apiClient.delete<ApiSuccessResponse<{ removed: boolean; mediaType: BovineMediaType }>>(
      `/bovines/${id}/media/${cleanPath}${qs}`,
    );
  },

  // ── Filter options (catalog) ─────────────────────────────────────────────

  /**
   * GET /api/bovines/filters/options — global catalog of dropdown options.
   * Cached 30 min server-side.
   */
  getFilterOptions: () =>
    apiClient.get<ApiSuccessResponse<BovineFiltersOptionsResponse>>('/bovines/filters/options'),

  // ── Map markers ──────────────────────────────────────────────────────────

  /**
   * GET /api/bovines/geo/map-markers — markers OR clusters (discriminated
   * union) decided server-side based on count and zoom.
   */
  getMapMarkers: (filters: MapMarkersFilters, options?: MapMarkersOptions) => {
    const params: Record<string, string | number | undefined> = {};
    if (filters.ranchIds && filters.ranchIds.length)         params.ranchIds = filters.ranchIds.join(',');
    if (filters.healthStatus && filters.healthStatus.length) params.healthStatus = filters.healthStatus.join(',');
    if (filters.breeds && filters.breeds.length)             params.breeds = filters.breeds.join(',');
    if (filters.cattleTypes && filters.cattleTypes.length)   params.cattleTypes = filters.cattleTypes.join(',');
    if (filters.genders && filters.genders.length)           params.genders = filters.genders.join(',');
    if (filters.diseases && filters.diseases.length)         params.diseases = filters.diseases.join(',');
    if (filters.vaccinationStatus) params.vaccinationStatus = filters.vaccinationStatus;
    if (filters.locationId)        params.locationId = filters.locationId;
    if (filters.ageRange) {
      if (filters.ageRange.min != null) params.ageMin = filters.ageRange.min;
      if (filters.ageRange.max != null) params.ageMax = filters.ageRange.max;
    }
    if (options?.bbox) {
      params.north = options.bbox.north;
      params.south = options.bbox.south;
      params.east  = options.bbox.east;
      params.west  = options.bbox.west;
    }
    if (options?.zoom != null)        params.zoom       = options.zoom;
    if (options?.maxMarkers != null)  params.maxMarkers = options.maxMarkers;
    if (options?.gridSize != null)    params.gridSize   = options.gridSize;

    return apiClient.get<ApiSuccessResponse<BovineMapMarkersResponse>>('/bovines/geo/map-markers', { params });
  },

  /** GET /api/bovines/tracking/geo-stats/:ranchId */
  getGeoStats: (ranchId: string) =>
    apiClient.get<ApiSuccessResponse<GeoStats>>(`/bovines/tracking/geo-stats/${ranchId}`),

  // ── Legacy geo (pre-/map-markers — kept for MapsPage until migrated) ─────

  /** @deprecated Use `getMapMarkers` with `mode: 'clusters'` instead. */
  getHeatmap: (
    ranchId: string,
    filters?: { healthStatus?: string; breeds?: string; ageMin?: number; ageMax?: number },
  ) => apiClient.get<ApiSuccessResponse<HeatmapPoint[]>>(`/bovines/geo/heatmap/${ranchId}`, { params: filters }),

  /** @deprecated Use `getMapMarkers` (mode discriminated by backend). */
  getClusters: (
    ranchId: string,
    data: { bounds: MapBounds; zoom: number; filters?: Record<string, unknown> },
  ) => apiClient.post<ApiSuccessResponse<ClusterPoint[]>>(`/bovines/geo/clusters/${ranchId}`, data),

  /** @deprecated Click-to-expand replaced by re-fetching map-markers with smaller bbox. */
  expandCluster: (
    ranchId: string,
    data: { bounds: MapBounds; filters?: Record<string, unknown> },
  ) => apiClient.post<ApiSuccessResponse<BovinePoint[]>>(`/bovines/geo/cluster/expand/${ranchId}`, data),

  /** @deprecated Single-point lookup; for detail use getFull. */
  getBovinePoint: (bovineId: string) =>
    apiClient.get<ApiSuccessResponse<BovinePoint>>(`/bovines/geo/point/${bovineId}`),

  // ──────────────────────────────────────────────────────────────────────────
  // LEGACY (deprecated — to be removed once callers migrate to the unified
  // media/vaccination/location endpoints above)
  // ──────────────────────────────────────────────────────────────────────────

  /** @deprecated Use `getMedia(id)` and read `.images`. */
  getPhotos: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovinePhotoLegacy[]>>(`/bovines/${id}/photos`),

  /** @deprecated Use `uploadMedia(id, file, 'images')`. */
  addPhoto: (id: string, data: { url: string; storagePath: string; caption?: string; takenAt?: string }) =>
    apiClient.post<ApiSuccessResponse<BovinePhotoLegacy>>(`/bovines/${id}/photos`, data),

  /** @deprecated Use `deleteMedia(id, storagePath, 'images')`. */
  removePhoto: (id: string, photoId: string) =>
    apiClient.delete<ApiSuccessResponse<null>>(`/bovines/${id}/photos/${photoId}`),

  /** @deprecated Use `getMedia(id)` and read `.documents`. */
  getDocuments: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovineDocumentLegacy[]>>(`/bovines/${id}/documents`),

  /** @deprecated Use `uploadMedia(id, file, 'documents')`. */
  addDocument: (id: string, data: { url: string; storagePath: string; name: string; category: string; size?: number }) =>
    apiClient.post<ApiSuccessResponse<BovineDocumentLegacy>>(`/bovines/${id}/documents`, data),

  /** @deprecated Use `deleteMedia(id, storagePath, 'documents')`. */
  removeDocument: (id: string, docId: string) =>
    apiClient.delete<ApiSuccessResponse<null>>(`/bovines/${id}/documents/${docId}`),
};

// ─── Auxiliary types ────────────────────────────────────────────────────────

export interface GeoStats {
  trackedBovines: number;
  activeLocations: number;
  onlineDevices: number;
  geofenceAlerts: number;
}

// ─── Legacy geo types (kept for MapsPage; new code should use BovineMapMarkerResponse/BovineMapClusterResponse) ─────

/** @deprecated Use `BovineMapClusterResponse`. */
export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  healthStatus?: string;
  bovineId?: string;
}

/** @deprecated Use `BovineMapClusterResponse`. */
export interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
  count: number;
  bounds?: MapBounds;
  healthBreakdown?: Record<string, number>;
}

/** @deprecated Use `BovineMapMarkerResponse`. */
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

/** @deprecated kept for legacy callers (BovineMediaTab old shape). Migrate to BovineMediaItemResponse. */
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

/** @deprecated alias for BovinePhoto. */
export type BovinePhotoLegacy = BovinePhoto;

/** @deprecated kept for legacy callers (BovineMediaTab old shape). Migrate to BovineMediaItemResponse. */
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

/** @deprecated alias for BovineDocument. */
export type BovineDocumentLegacy = BovineDocument;

// Re-export DTOs for callers that import directly from the api module
export type {
  BovineDetailResponse,
  BovineListResponse,
  BovineFilters,
  BovineFullResponse,
  BovineCurrentLocationResponse,
  VaccinationResponse,
  VaccinationListResponse,
  VaccinationStatusResponse,
  BovineMediaListResponse,
  BovineMediaItemResponse,
  BovineMediaUploadResponse,
  BovineMediaType,
  BovineMapMarkersResponse,
  BovineMapMarkerResponse,
  BovineMapClusterResponse,
  BovineFiltersOptionsResponse,
  CreateBovineInput,
  UpdateBovineInput,
  MoveBovineInput,
  CreateVaccinationInput,
  MapMarkersFilters,
  MapMarkersOptions,
} from '@/types/bovine.dtos';
