/**
 * Centralized hooks for the Bovinos module.
 *
 * Goals:
 *   - One place to declare query keys and cache strategy.
 *   - DTO-typed inputs and outputs (no `any`).
 *   - Consistent invalidation across mutations.
 *   - Lazy-loading patterns (`enabled`) for tab content.
 *
 * Conventions:
 *   - All `queryFn` extract `.data.data` (axios → ApiSuccessResponse → DTO).
 *   - Mutations call related invalidations in `onSuccess`. The `bovine-full`
 *     cache is the most-touched: anything that mutates a bovine should
 *     invalidate it.
 *   - Hooks accept optional `enabled` so consumers can lazy-load.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryOptions, QueryClient } from '@tanstack/react-query';
import { bovinesApi } from '@/api/bovines.api';
import type {
  BovineListResponse,
  BovineDetailResponse,
  BovineFullResponse,
  BovineCurrentLocationResponse,
  BovineFilters,
  PaginationOptions,
  BovineStatistics,
  BovineFiltersOptionsResponse,
  BovineMediaListResponse,
  BovineMediaUploadResponse,
  BovineMediaType,
  BovineMapMarkersResponse,
  MapMarkersFilters,
  MapMarkersOptions,
  VaccinationListResponse,
  VaccinationResponse,
  VaccinationStatusResponse,
  CreateVaccinationInput,
  ListVaccinationsFilters,
  CreateBovineInput,
  MoveBovineInput,
} from '@/types/bovine.dtos';

// ────────────────────────────────────────────────────────────────────────────
// Query keys — single source of truth (avoid string typos and key drift)
// ────────────────────────────────────────────────────────────────────────────

export const bovineKeys = {
  all: ['bovines'] as const,
  lists: () => [...bovineKeys.all, 'list'] as const,
  list: (filters: Partial<BovineFilters & PaginationOptions>) =>
    [...bovineKeys.lists(), filters] as const,
  details: () => [...bovineKeys.all, 'detail'] as const,
  detail: (id: string) => [...bovineKeys.details(), id] as const,
  full: (id: string) => [...bovineKeys.all, 'full', id] as const,
  currentLocation: (id: string) => [...bovineKeys.all, 'current-location', id] as const,
  vaccinations: (id: string, filters?: Omit<ListVaccinationsFilters, 'bovineId'>) =>
    [...bovineKeys.all, 'vaccinations', id, filters ?? {}] as const,
  vaccinationStatus: (id: string) => [...bovineKeys.all, 'vaccination-status', id] as const,
  media: (id: string) => [...bovineKeys.all, 'media', id] as const,
  mapMarkers: (filters: MapMarkersFilters, options?: MapMarkersOptions) =>
    [...bovineKeys.all, 'map-markers', filters, options ?? {}] as const,
  filterOptions: () => [...bovineKeys.all, 'filter-options'] as const,
  statistics: () => [...bovineKeys.all, 'statistics'] as const,
} as const;

/**
 * Invalidate every cache that displays bovine COUNTS (ranch + location
 * occupancy widgets, KPIs, stat cards, capacity bars, occupancy dots).
 *
 * Called inside every bovine mutation that changes the population of a ranch
 * or location: create / update / delete / move / bulk-move.
 *
 * Why this helper exists:
 *   - The ranch summary (`/ranch/:id` → currentCattleCount / maxCattleCapacity
 *     / occupancyRate) was NOT refreshing after creating, moving or deleting
 *     bovines because the bovine mutations only invalidated bovine-scoped
 *     caches. Same for the location capacity bars and occupancy dots on the
 *     ranch detail mini-map.
 *   - Centralizing the list of affected keys here means future mutations only
 *     have to call one function instead of remembering 6+ key prefixes.
 */
export function invalidateOccupancyCaches(queryClient: QueryClient) {
  // Ranch-scoped caches
  queryClient.invalidateQueries({ queryKey: ['ranches'] });
  queryClient.invalidateQueries({ queryKey: ['ranch'] });
  queryClient.invalidateQueries({ queryKey: ['ranch-summary'] });
  queryClient.invalidateQueries({ queryKey: ['ranch-locations'] });
  queryClient.invalidateQueries({ queryKey: ['ranch-occupancy'] });
  // Location-scoped caches (capacity inline + standalone occupancy DTOs)
  queryClient.invalidateQueries({ queryKey: ['locations'] });
  queryClient.invalidateQueries({ queryKey: ['location'] });
  queryClient.invalidateQueries({ queryKey: ['location-summary'] });
  queryClient.invalidateQueries({ queryKey: ['location-occupancy'] });
  queryClient.invalidateQueries({ queryKey: ['location-current-occupancy'] });
  queryClient.invalidateQueries({ queryKey: ['locations-at-capacity'] });
  queryClient.invalidateQueries({ queryKey: ['locations-available'] });
}

// ────────────────────────────────────────────────────────────────────────────
// LIST
// ────────────────────────────────────────────────────────────────────────────

type ListOpts = Omit<
  UseQueryOptions<BovineListResponse, Error, BovineListResponse, ReturnType<typeof bovineKeys.list>>,
  'queryKey' | 'queryFn'
>;

/** Paginated list of bovines with filters. */
export function useBovineList(
  filters: Partial<BovineFilters & PaginationOptions> = {},
  options?: ListOpts,
) {
  return useQuery({
    queryKey: bovineKeys.list(filters),
    queryFn: async () => {
      const res = await bovinesApi.list(filters);
      return res.data.data;
    },
    staleTime: 60_000,
    ...options,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// DETAIL (basic)
// ────────────────────────────────────────────────────────────────────────────

/** Single bovine — basic shape (no full bundle). Prefer `useBovineFull` for the detail page. */
export function useBovine(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bovineKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await bovinesApi.getById(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// FULL (composite — main source for detail page)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Composite endpoint /bovines/:id/full.
 *
 * Returns bovine + media + currentLocation + vaccinationStatus +
 * recentVaccinations + recentHealthRecords + recentMovements in a single
 * request. Cached server-side 5 min; we cache client-side 1 min so manual
 * refresh feels snappy after mutations.
 */
export function useBovineFull(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bovineKeys.full(id ?? ''),
    queryFn: async () => {
      const res = await bovinesApi.getFull(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// CURRENT LOCATION (live snapshot)
// ────────────────────────────────────────────────────────────────────────────

interface CurrentLocationOpts {
  enabled?: boolean;
  /** When true, refetch every 60s while the tab is mounted. Default false. */
  poll?: boolean;
}

/**
 * Live current-location snapshot. Use `poll: true` only on the active tab.
 * Returns IN_LOCATION / GPS_ONLY / GPS_STALE / UNKNOWN with the relevant data.
 */
export function useBovineCurrentLocation(id: string | undefined, options?: CurrentLocationOpts) {
  return useQuery({
    queryKey: bovineKeys.currentLocation(id ?? ''),
    queryFn: async () => {
      const res = await bovinesApi.getCurrentLocation(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 30_000,
    refetchInterval: options?.poll ? 60_000 : false,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// FILTER OPTIONS (catalog — global, near-static)
// ────────────────────────────────────────────────────────────────────────────

/** Options used by the filter panel (cattle types, breeds, vaccine types, etc.). */
export function useBovineFilterOptions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bovineKeys.filterOptions(),
    queryFn: async () => {
      const res = await bovinesApi.getFilterOptions();
      return res.data.data;
    },
    enabled: options?.enabled ?? true,
    // Catalog rarely changes; align with backend's 30-min cache.
    staleTime: 30 * 60_000,
    gcTime:    60 * 60_000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// STATISTICS
// ────────────────────────────────────────────────────────────────────────────

export function useBovineStatistics(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bovineKeys.statistics(),
    queryFn: async () => {
      const res = await bovinesApi.statistics();
      return res.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MAP MARKERS / CLUSTERS
// ────────────────────────────────────────────────────────────────────────────

interface MapMarkersOpts {
  enabled?: boolean;
}

/**
 * Map markers OR clusters (server-side decision via discriminated union).
 *
 * The query key includes filters AND options (bbox, zoom) so any pan/zoom
 * change triggers a refetch. Caller is responsible for debouncing pan/zoom
 * before calling this hook (recommended 300-500ms).
 */
export function useBovineMapMarkers(
  filters: MapMarkersFilters,
  mapOptions?: MapMarkersOptions,
  options?: MapMarkersOpts,
) {
  return useQuery({
    queryKey: bovineKeys.mapMarkers(filters, mapOptions),
    queryFn: async () => {
      const res = await bovinesApi.getMapMarkers(filters, mapOptions);
      return res.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MEDIA
// ────────────────────────────────────────────────────────────────────────────

export function useBovineMedia(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bovineKeys.media(id ?? ''),
    queryFn: async () => {
      const res = await bovinesApi.getMedia(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

interface UploadMediaInput {
  file: File;
  mediaType: BovineMediaType;
  caption?: string;
}

export function useUploadBovineMedia(id: string) {
  const queryClient = useQueryClient();
  return useMutation<BovineMediaUploadResponse, Error, UploadMediaInput>({
    mutationFn: async ({ file, mediaType, caption }) => {
      const res = await bovinesApi.uploadMedia(id, file, mediaType, caption);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bovineKeys.media(id) });
      // The /full payload includes media — keep it fresh too.
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
    },
  });
}

interface DeleteMediaInput {
  storagePath: string;
  mediaType?: BovineMediaType;
}

export function useDeleteBovineMedia(id: string) {
  const queryClient = useQueryClient();
  return useMutation<{ removed: boolean; mediaType: BovineMediaType }, Error, DeleteMediaInput>({
    mutationFn: async ({ storagePath, mediaType }) => {
      const res = await bovinesApi.deleteMedia(id, storagePath, mediaType);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bovineKeys.media(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// VACCINATIONS
// ────────────────────────────────────────────────────────────────────────────

export function useBovineVaccinations(
  id: string | undefined,
  filters?: Omit<ListVaccinationsFilters, 'bovineId'>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bovineKeys.vaccinations(id ?? '', filters),
    queryFn: async () => {
      const res = await bovinesApi.listVaccinations(id!, filters);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}

export function useBovineVaccinationStatus(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bovineKeys.vaccinationStatus(id ?? ''),
    queryFn: async () => {
      const res = await bovinesApi.getVaccinationStatus(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}

export function useCreateBovineVaccination(id: string) {
  const queryClient = useQueryClient();
  return useMutation<VaccinationResponse, Error, Omit<CreateVaccinationInput, 'bovineId'>>({
    mutationFn: async (data) => {
      const res = await bovinesApi.createVaccination(id, data);
      return res.data.data;
    },
    onSuccess: () => {
      // Vaccinations list, derived status, and the /full bundle all change.
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinations(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinationStatus(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
      // Vaccination status is also reflected in the detail / list cells.
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// CRUD MUTATIONS
// ────────────────────────────────────────────────────────────────────────────

export function useCreateBovine() {
  const queryClient = useQueryClient();
  return useMutation<BovineDetailResponse, Error, CreateBovineInput>({
    mutationFn: async (data) => {
      const res = await bovinesApi.create(data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bovineKeys.statistics() });
      // Also invalidate map markers — the new bovine may appear on the map.
      queryClient.invalidateQueries({ queryKey: [...bovineKeys.all, 'map-markers'] });
      // Ranch + location occupancy widgets must reflect the new head count.
      invalidateOccupancyCaches(queryClient);
    },
  });
}

export function useUpdateBovine(id: string) {
  const queryClient = useQueryClient();
  return useMutation<BovineDetailResponse, Error, Partial<CreateBovineInput>>({
    mutationFn: async (data) => {
      const res = await bovinesApi.update(id, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
      queryClient.invalidateQueries({ queryKey: [...bovineKeys.all, 'map-markers'] });
      // Update may have changed ranchId or location → refresh occupancy.
      invalidateOccupancyCaches(queryClient);
    },
  });
}

export function useDeleteBovine() {
  const queryClient = useQueryClient();
  return useMutation<null, Error, string>({
    mutationFn: async (id) => {
      const res = await bovinesApi.delete(id);
      return res.data.data;
    },
    onSuccess: (_data, id) => {
      // Remove the cached detail to avoid 404 on stale reads.
      queryClient.removeQueries({ queryKey: bovineKeys.detail(id) });
      queryClient.removeQueries({ queryKey: bovineKeys.full(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bovineKeys.statistics() });
      queryClient.invalidateQueries({ queryKey: [...bovineKeys.all, 'map-markers'] });
      // Population dropped by one — refresh ranch/location occupancy widgets.
      invalidateOccupancyCaches(queryClient);
    },
  });
}

/**
 * Regenerate a bovine's QR code. Returns the new `qrCode` string and
 * automatically invalidates the affected caches so any visible QR (modal,
 * detail page, list) refreshes without a manual reload.
 *
 * Note: this rotates the stored code on the backend — any QR previously
 * printed becomes invalid. Gated by `REGENERATE_QR` permission in the UI.
 */
export function useRegenerateBovineQr() {
  const queryClient = useQueryClient();
  return useMutation<{ qrCode: string }, Error, string>({
    mutationFn: async (id: string) => {
      const res = await bovinesApi.regenerateQR(id);
      return res.data.data;
    },
    onSuccess: (_data, id) => {
      // Refresh anywhere the qrCode might be displayed.
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
    },
  });
}

interface MoveBovineMutationInput {
  id: string;
  data: MoveBovineInput;
}

/** Move a single bovine to a different location. */
export function useMoveBovine() {
  const queryClient = useQueryClient();
  return useMutation<BovineDetailResponse, Error, MoveBovineMutationInput>({
    mutationFn: async ({ id, data }) => {
      const res = await bovinesApi.moveToLocation(id, data);
      return res.data.data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.currentLocation(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
      queryClient.invalidateQueries({ queryKey: [...bovineKeys.all, 'map-markers'] });
      // A move changes the source AND destination location occupancy.
      invalidateOccupancyCaches(queryClient);
    },
  });
}

interface BulkMoveInputArg {
  ids: string[];
  locationId: string;
  reason?: string;
  /** Strict enum value (MANUAL / AUTOMATED / SCHEDULED) when provided. */
  movementType?: string;
  /** Free-form notes shared by all bovines in the bulk move. */
  notes?: string;
}

/** Bulk-move multiple bovines to the same location (sequential — no batch endpoint). */
export function useBulkMoveBovines() {
  const queryClient = useQueryClient();
  return useMutation<unknown[], Error, BulkMoveInputArg>({
    mutationFn: async ({ ids, locationId, reason, movementType, notes }) => {
      return bovinesApi.bulkMove(ids, locationId, reason, movementType, notes);
    },
    onSuccess: (_data, { ids }) => {
      ids.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
        queryClient.invalidateQueries({ queryKey: bovineKeys.currentLocation(id) });
        queryClient.invalidateQueries({ queryKey: bovineKeys.detail(id) });
      });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
      queryClient.invalidateQueries({ queryKey: [...bovineKeys.all, 'map-markers'] });
      // Bulk move affects multiple locations' occupancy — refresh widgets.
      invalidateOccupancyCaches(queryClient);
    },
  });
}

// Re-export DTO types so consumers can import everything from a single hook module.
export type {
  BovineListResponse,
  BovineDetailResponse,
  BovineFullResponse,
  BovineCurrentLocationResponse,
  BovineFilters,
  PaginationOptions,
  BovineStatistics,
  BovineFiltersOptionsResponse,
  BovineMediaListResponse,
  BovineMediaUploadResponse,
  BovineMediaType,
  BovineMapMarkersResponse,
  MapMarkersFilters,
  MapMarkersOptions,
  VaccinationListResponse,
  VaccinationResponse,
  VaccinationStatusResponse,
  CreateVaccinationInput,
  ListVaccinationsFilters,
  CreateBovineInput,
  MoveBovineInput,
};
