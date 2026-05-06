import apiClient from './client';
import type { ApiResponse, PaginationParams, LocationFormData, LocationSummary, LocationCapacity, LocationMovement } from '@/types';
import type { Location } from '@/types';
import type {
  LocationMonitoring, MonitoringStats, MonitoringAlert, MaintenanceRecord,
  LocationRelation, LocationRelationGroup, RelationType,
} from '@/types/location.types';

interface LocationListResponse {
  items: Location[];
  total: number;
  totalPages: number;
}

// ─── Media types (local to this module) ──────────────────────────────────────

export type LocationMediaKind = 'images' | 'documents' | 'videos' | 'maps';

export interface LocationMediaResponse {
  locationId: string;
  images: string[];
  documents: string[];
  videos: string[];
  maps: string[];
  totals: {
    images: number;
    documents: number;
    videos: number;
    maps: number;
    all: number;
  };
}

export interface LocationMediaUploadResult {
  locationId: string;
  mediaType: LocationMediaKind;
  url: string;
  storagePath: string;
  thumbnailUrl?: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/**
 * Derive the R2 storagePath from a full URL.
 * Used to call DELETE /media/* (which expects the path after /media/).
 * Example:
 *   https://r2.example.com/location_images/2026/04/abc.jpg
 *   → location_images/2026/04/abc.jpg
 */
export function storagePathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, '');
  } catch {
    // Already a relative path
    return url.replace(/^\/+/, '');
  }
}

// ─── Capacity payload (subset, matches backend LocationCapacity model) ───────

export interface LocationCapacityPayload {
  maxAnimals?: number;
  currentAnimals?: number;
  area?: number;
  areaUnit?: 'M2' | 'HA' | 'ACRE';
  carryingCapacity?: number;
  waterSources?: number;
  feedingStations?: number;
  shelters?: number;
  hasElectricity?: boolean;
  hasWater?: boolean;
  hasInternet?: boolean;
  hasRoadAccess?: boolean;
  securityLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ─── Occupancy DTOs (match new backend endpoints) ───────────────────────────

export interface LocationOccupancyDto {
  locationId: string;
  locationName: string;
  currentAnimals: number;
  maxAnimals: number;
  available: number;
  percentage: number;
  isFull: boolean;
}

export interface RanchOccupancyDto {
  ranchId: string;
  totalCurrentAnimals: number;
  totalMaxAnimals: number;
  totalAvailable: number;
  averagePercentage: number;
  locationsCount: number;
  locationsWithCapacity: number;
  locations: LocationOccupancyDto[];
}

// ─── List filters ───────────────────────────────────────────────────────────

/**
 * Filters supported by GET /api/locations. Mirrors the backend route docs.
 */
export interface LocationListFilters {
  // Pagination
  page?: number;
  limit?: number;

  // Free-text search (matches name, code, description)
  search?: string;

  // Exact filters
  type?: string;             // LocationType enum
  status?: string;           // LocationStatus enum
  ranchId?: string;          // uuid
  parentLocationId?: string; // uuid

  // Sorting
  sortBy?: 'name' | 'locationCode' | 'createdAt' | 'updatedAt' | 'type' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// ─── Movements (location history events) ───────────────────────────────────

export type MovementEventType = 'ENTRY' | 'EXIT';
export type MovementReason = 'GRAZING' | 'MEDICAL' | 'QUARANTINE' | 'BREEDING' | 'TRANSFER' | 'SALE';

export interface LocationMovementEvent {
  historyId: string;
  type: MovementEventType;
  occurredAt: string;
  bovineId: string;
  bovineEarTag: string;
  bovineName: string | null;
  reason: MovementReason | string;
  movementType: string;
  recordedBy: string;
  recordedByName: string | null;
  notes: string | null;
}

export interface LocationMovementsResponse {
  locationId: string;
  total: number;
  limit: number;
  offset: number;
  movements: LocationMovementEvent[];
}

export interface LocationMovementsParams {
  limit?: number;
  offset?: number;
  type?: MovementEventType;
  reason?: MovementReason;
  fromDate?: string;
  toDate?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const locationsApi = {
  list: async (params?: LocationListFilters | PaginationParams): Promise<LocationListResponse> => {
    const res = await apiClient.get<ApiResponse<Location[] | { items: Location[]; total: number; totalPages: number }>>('/locations', { params });
    const payload = res.data.data;

    if (Array.isArray(payload)) {
      const pagination = (res.data as any).pagination;
      return {
        items: payload,
        total: pagination?.total ?? payload.length,
        totalPages: pagination?.totalPages ?? 1,
      };
    }
    return payload as LocationListResponse;
  },

  getById: (id: string) =>
    apiClient.get<ApiResponse<Location>>(`/locations/${id}`),

  getSummary: (id: string) =>
    apiClient.get<ApiResponse<LocationSummary>>(`/locations/${id}/summary`),

  create: (data: LocationFormData) =>
    apiClient.post<ApiResponse<Location>>('/locations', data),

  update: (id: string, data: Partial<LocationFormData>) =>
    apiClient.put<ApiResponse<Location>>(`/locations/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/locations/${id}`),

  /**
   * Nearby locations to a point.
   * NOTE: backend expects `latitude`/`longitude` (not `lat`/`lng`).
   */
  nearby: (params: { latitude: number; longitude: number; radius?: number; limit?: number }) =>
    apiClient.get<ApiResponse<Location[]>>('/locations/nearby', { params }),

  /** Distance (meters) between two locations. Path: /locations/:id/distance/:targetId */
  distance: (id: string, targetId: string) =>
    apiClient.get<ApiResponse<{ distance: number }>>(`/locations/${id}/distance/${targetId}`),

  // ── Capacity ───────────────────────────────────────────────────────────────
  /**
   * Fetch the LocationCapacity record for a location.
   * Returns `null` if no capacity has been configured yet (backend answers 400/404).
   */
  getCapacity: async (locationId: string): Promise<LocationCapacity | null> => {
    try {
      // silent: 400/404 son respuestas esperadas (ubicación sin capacity) — no mostrar toast global
      const res = await apiClient.get<ApiResponse<LocationCapacity>>(
        `/locations/${locationId}/capacity`,
        { silent: true },
      );
      return res.data.data ?? null;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400 || status === 404) return null;
      throw err;
    }
  },

  /** Create capacity record. Fails (409) if it already exists. */
  createCapacity: (locationId: string, data: LocationCapacityPayload) =>
    apiClient.post<ApiResponse<LocationCapacity>>(`/locations/${locationId}/capacity`, data),

  /** Update existing capacity record. Fails (404) if it doesn't exist. */
  updateCapacity: (locationId: string, data: LocationCapacityPayload) =>
    apiClient.put<ApiResponse<LocationCapacity>>(`/locations/${locationId}/capacity`, data),

  /** Upsert capacity (create or update). Preferred for the edit modal. */
  upsertCapacity: (locationId: string, data: LocationCapacityPayload) =>
    apiClient.patch<ApiResponse<LocationCapacity>>(`/locations/${locationId}/capacity`, data),

  getOccupancy: (locationId: string) =>
    apiClient.get<ApiResponse<{ occupancy: number }>>(`/locations/${locationId}/occupancy`),

  /**
   * Per-location current-occupancy snapshot (live, from LocationCapacity).
   */
  getCurrentOccupancy: (locationId: string) =>
    apiClient.get<ApiResponse<LocationOccupancyDto>>(`/locations/${locationId}/current-occupancy`),

  /**
   * Global list of locations that reached/exceeded capacity.
   * Endpoint is GLOBAL (no :id) — filter via query params.
   */
  listAtCapacity: (params?: { ranchId?: string; threshold?: number }) =>
    apiClient.get<ApiResponse<Location[]>>('/locations/at-capacity', { params }),

  /**
   * Global list of locations with available slots.
   * Endpoint is GLOBAL (no :id) — filter via query params.
   */
  listAvailable: (params?: { ranchId?: string; minSlots?: number }) =>
    apiClient.get<ApiResponse<Location[]>>('/locations/available', { params }),

  /** Capacity usage stats for a single location. Path: /locations/:id/capacity/stats */
  getCapacityStats: (locationId: string, params?: { fromDate?: string; toDate?: string }) =>
    apiClient.get<ApiResponse<unknown>>(`/locations/${locationId}/capacity/stats`, { params }),

  // ── Bovine entry / exit ────────────────────────────────────────────────────
  registerEntry: (data: { bovineId: string; locationId: string; reason?: string; movementType?: string }) =>
    apiClient.post<ApiResponse<unknown>>('/bovines/location/entry', data),

  registerExit: (data: { bovineId: string; exitedAt?: string; notes?: string }) =>
    apiClient.post<ApiResponse<unknown>>('/bovines/location/exit', data),

  getBovineCurrentLocation: (bovineId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/bovines/${bovineId}/location/current`),

  getBovinesAtLocation: (locationId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/bovines/location/${locationId}/current`),

  /** Full movement history for a bovine (potrero changes) */
  getLocationHistory: (bovineId: string) =>
    apiClient.get<ApiResponse<LocationMovement[]>>(`/bovines/${bovineId}/location/history`),

  /**
   * Movement events (entries / exits) at a specific location.
   * Each BovineLocationHistory row generates 1 or 2 events:
   *   - always an ENTRY at enteredAt
   *   - an EXIT at exitedAt if the stay has ended
   * Sorted desc by occurredAt, paginated.
   */
  getMovements: (locationId: string, params?: LocationMovementsParams) =>
    apiClient.get<ApiResponse<LocationMovementsResponse>>(
      `/locations/${locationId}/movements`,
      { params },
    ),

  // ── Media (images / documents / videos / maps) ────────────────────────────
  /**
   * List all media for a location, grouped by type.
   * Backend returns { images: string[], documents: string[], ... } — each item is just the URL.
   */
  getMedia: (locationId: string) =>
    apiClient.get<ApiResponse<LocationMediaResponse>>(`/locations/${locationId}/media`),

  /**
   * Upload a file to R2 + register its URL in LocationInfo.
   * @param mediaType "images" | "documents" | "videos" | "maps" — validated against file MIME by backend.
   */
  uploadMedia: (locationId: string, file: File, mediaType: LocationMediaKind) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mediaType', mediaType);
    return apiClient.post<ApiResponse<LocationMediaUploadResult>>(
      `/locations/${locationId}/media`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  /**
   * Delete a media file. `storagePath` is the path returned from R2
   * (e.g. "location_images/2026/04/abc.jpg") — derive from URL via storagePathFromUrl().
   */
  deleteMedia: (locationId: string, storagePath: string, mediaType?: LocationMediaKind) => {
    const cleanPath = storagePath.replace(/^\/+/, '');
    const qs = mediaType ? `?mediaType=${mediaType}` : '';
    // NOTE: do NOT encodeURIComponent — the path contains / that must reach the backend as-is
    return apiClient.delete<ApiResponse<{ removed: boolean; mediaType: LocationMediaKind }>>(
      `/locations/${locationId}/media/${cleanPath}${qs}`,
    );
  },

  // ── IoT Monitoring ─────────────────────────────────────────────────────────
  /**
   * Get monitoring record for a location.
   * Returns `null` if no device is configured (backend answers 404).
   */
  getMonitoring: async (id: string): Promise<LocationMonitoring | null> => {
    try {
      // silent: 404 es respuesta esperada (ubicación sin device IoT) — no toast global
      const res = await apiClient.get<ApiResponse<LocationMonitoring>>(
        `/locations/${id}/monitoring`,
        { silent: true },
      );
      return res.data.data ?? null;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  // Monitoring per-location actions — path is /locations/:id/monitoring/<action>
  pingDevice: (id: string) =>
    apiClient.post<ApiResponse<LocationMonitoring>>(`/locations/${id}/monitoring/ping`),

  registerReading: (id: string, data: { type: string; value: number; unit: string; sensorId?: string }) =>
    apiClient.post<ApiResponse<LocationMonitoring>>(`/locations/${id}/monitoring/reading`, data),

  registerAlert: (id: string, data: { type: string; severity: string; message: string }) =>
    apiClient.post<ApiResponse<LocationMonitoring>>(`/locations/${id}/monitoring/alert`, data),

  /** Resolve alerts. Backend route is /resolve (not /resolve-alerts). */
  resolveAlerts: (id: string, alertIds?: string[]) =>
    apiClient.post<ApiResponse<LocationMonitoring>>(`/locations/${id}/monitoring/resolve`, { alertIds }),

  registerMaintenance: (id: string, data: { type: string; description?: string; performedAt?: string; nextDue?: string; cost?: number }) =>
    apiClient.post<ApiResponse<LocationMonitoring>>(`/locations/${id}/monitoring/maintenance`, data),

  getMonitoringStats: () =>
    apiClient.get<ApiResponse<MonitoringStats>>('/locations/monitoring/stats'),

  getActiveAlerts: () =>
    apiClient.get<ApiResponse<MonitoringAlert[]>>('/locations/monitoring/active-alerts'),

  getOfflineDevices: () =>
    apiClient.get<ApiResponse<LocationMonitoring[]>>('/locations/monitoring/offline-devices'),

  getLowBattery: () =>
    apiClient.get<ApiResponse<LocationMonitoring[]>>('/locations/monitoring/low-battery'),

  // ── Relations ─────────────────────────────────────────────────────────────
  getChildren: (id: string) =>
    apiClient.get<ApiResponse<LocationRelation[]>>(`/locations/${id}/relations/children`),

  getParents: (id: string) =>
    apiClient.get<ApiResponse<LocationRelation[]>>(`/locations/${id}/relations/parents`),

  getAdjacent: (id: string) =>
    apiClient.get<ApiResponse<LocationRelation[]>>(`/locations/${id}/relations/adjacent`),

  getConnected: (id: string) =>
    apiClient.get<ApiResponse<LocationRelation[]>>(`/locations/${id}/relations/connected`),

  /**
   * Fetch all 4 relation kinds in parallel and return them grouped.
   * Replaces the non-existent `/relations` endpoint the UI was previously calling.
   */
  getAllRelations: async (id: string): Promise<LocationRelationGroup> => {
    const safe = <T,>(p: Promise<{ data: ApiResponse<T[]> }>): Promise<T[]> =>
      p.then((r) => r.data.data ?? []).catch(() => []);
    const [children, parents, adjacent, connected] = await Promise.all([
      safe(apiClient.get<ApiResponse<LocationRelation[]>>(`/locations/${id}/relations/children`)),
      safe(apiClient.get<ApiResponse<LocationRelation[]>>(`/locations/${id}/relations/parents`)),
      safe(apiClient.get<ApiResponse<LocationRelation[]>>(`/locations/${id}/relations/adjacent`)),
      safe(apiClient.get<ApiResponse<LocationRelation[]>>(`/locations/${id}/relations/connected`)),
    ]);
    return { children, parents, adjacent, connected } as LocationRelationGroup;
  },

  /**
   * Create a location relation.
   * Backend body: { fromLocationId, toLocationId, relationType, ... }
   */
  addRelation: (data: {
    fromLocationId: string;
    toLocationId: string;
    relationType: RelationType;
    bidirectional?: boolean;
    distance?: number;
    notes?: string;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
  }) =>
    apiClient.post<ApiResponse<LocationRelation>>('/location-relations', data),

  removeRelation: (relationId: string) =>
    apiClient.delete<ApiResponse<null>>(`/location-relations/${relationId}`),
};
