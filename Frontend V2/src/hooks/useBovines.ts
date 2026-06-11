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
  UpdateVaccinationInput,
  ListVaccinationsFilters,
  CreateBovineInput,
  MoveBovineInput,
  MarkBovineSickInput,
  DeceaseBovineInput,
  BovineDeathRecord,
  MortalityReport,
  MortalityReportFilters,
  BovineRiskScore,
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
  protection: (id: string) => [...bovineKeys.all, 'protection', id] as const,
  vaccinationSchedule: (id: string) => [...bovineKeys.all, 'vaccination-schedule', id] as const,
  media: (id: string) => [...bovineKeys.all, 'media', id] as const,
  mapMarkers: (filters: MapMarkersFilters, options?: MapMarkersOptions) =>
    [...bovineKeys.all, 'map-markers', filters, options ?? {}] as const,
  filterOptions: () => [...bovineKeys.all, 'filter-options'] as const,
  statistics: () => [...bovineKeys.all, 'statistics'] as const,
  riskScore: (id: string) => [...bovineKeys.all, 'risk-score', id] as const,
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

/**
 * Enfermedades con casos activos en el rancho del usuario, en forma
 * `{ value: UUID, label }`. Ideal para selects de FILTROS donde el backend
 * espera UUIDs (`?diseaseId=`, `?diseaseIds=`).
 *
 * ⚠️ NO confundir con `useActiveDiseases` (en `hooks/useDiseases.ts`):
 *   - `useActiveDiseases`         → catálogo GLOBAL completo (todas las
 *     enfermedades del backend marcadas `isActive`), devuelve
 *     `DiseaseListItem[]` con `id` (UUID) + metadata clínica completa.
 *     Usar cuando necesitas info adicional (descripción, category, etc.)
 *     o trabajas con el catálogo global (forms de alta de caso, etc.).
 *   - `useRanchActiveDiseases`    → solo las enfermedades con casos en EL
 *     RANCHO actual, ligera (`FilterOption[]`). Usar para selects donde lo
 *     único que importa es el UUID + nombre y querés evitar opciones que
 *     nunca van a producir resultados en el rancho.
 */
export function useRanchActiveDiseases(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...bovineKeys.all, 'filter-options', 'active-diseases'] as const,
    queryFn: async () => {
      const res = await bovinesApi.getActiveDiseases();
      return res.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60_000,
    gcTime:    15 * 60_000,
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

/**
 * Proteccion por enfermedad del bovino (derivada de vacunas aplicadas +
 * catalogo VaccineDiseaseProtection). El array viene ordenado por
 * daysUntilExpiry asc del backend; vacio si no hay vacunas que cubran
 * enfermedades del catalogo.
 *
 * Cache 5 min porque la proteccion solo cambia al aplicar/eliminar
 * vacunas, o al cruzar la frontera de medianoche (un dia mas pasado
 * desde la ultima aplicacion). En la mayoria de sesiones el dato es
 * estable.
 */
export function useBovineProtection(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bovineKeys.protection(id ?? ''),
    queryFn: async () => {
      const res = await bovinesApi.getProtection(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}

/**
 * F-39 / Backend V-05: calendario sugerido del bovino. Devuelve la lista
 * de vacunas que le tocan segun edad/sexo/raza con estado por cada una.
 * El servidor recompute() y este endpoint comparten la misma logica,
 * asi que invalidar tras aplicar/borrar vacuna es OBLIGATORIO para que
 * el calendario refleje el cambio.
 */
export function useBovineVaccinationSchedule(
  id: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bovineKeys.vaccinationSchedule(id ?? ''),
    queryFn: async () => {
      const res = await bovinesApi.getVaccinationSchedule(id!);
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
      // Proteccion por enfermedad: cualquier vacuna nueva amplia o renueva
      // la proteccion contra alguna enfermedad del catalogo.
      queryClient.invalidateQueries({ queryKey: bovineKeys.protection(id) });
      // V-05: el calendario sugerido depende de las vacunas aplicadas.
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinationSchedule(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
      // Vaccination status is also reflected in the detail / list cells.
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
    },
  });
}

/**
 * Editar una vacuna existente (Backend V-04). El input `vaccinationId` es
 * la PK de la fila a editar; `bovineId` se necesita solo para invalidar
 * los caches del bovino destino (mismo set que `useCreateBovineVaccination`).
 *
 * El backend revalida duplicado / orden de fechas; los errores comunes
 * (404, 409, 400) llegan a `onError` con sus codigos para que la UI
 * muestre mensajes especificos via `getFriendlyMessage`.
 */
interface UpdateVaccinationArgs {
  vaccinationId: string;
  data: UpdateVaccinationInput;
}

export function useUpdateBovineVaccination(bovineId: string) {
  const queryClient = useQueryClient();
  return useMutation<VaccinationResponse, Error, UpdateVaccinationArgs>({
    mutationFn: async ({ vaccinationId, data }) => {
      const res = await bovinesApi.updateVaccination(vaccinationId, data);
      return res.data.data;
    },
    onSuccess: () => {
      // Mismas invalidaciones que en create: el backend recalcula status
      // y proteccion derivada en cada update.
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinations(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinationStatus(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.protection(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinationSchedule(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
    },
  });
}

/**
 * Eliminar (soft delete) una vacuna. Backend recalcula el status del bovino
 * post-delete; aqui invalidamos los mismos caches que create/update.
 */
export function useDeleteBovineVaccination(bovineId: string) {
  const queryClient = useQueryClient();
  return useMutation<null, Error, string>({
    mutationFn: async (vaccinationId) => {
      const res = await bovinesApi.deleteVaccination(vaccinationId);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinations(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinationStatus(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.protection(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.vaccinationSchedule(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(bovineId) });
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

/**
 * Backend C-04: marca enfermo a un bovino existente abriendo un caso clinico
 * en `BovineDiseaseCase` + sincronizando `healthStatus` y `BovineHealthSnapshot`.
 * Invalida todo lo que dependa del estado de salud del bovino para que el
 * detalle y el listado reflejen el cambio inmediatamente.
 *
 * Errores comunes:
 *   - 400 MISSING_CLINICAL_DATA → faltan campos clinicos
 *   - 400 VALIDATION_ERROR     → diseaseId no existe, severity invalida, etc.
 */
export function useMarkBovineSick(bovineId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; diseaseId: string; status: string },
    Error,
    MarkBovineSickInput
  >({
    mutationFn: async (data) => {
      const res = await bovinesApi.markSick(bovineId, data);
      return res.data.data;
    },
    onSuccess: () => {
      // Cualquier vista que renderee healthStatus, salud o casos del bovino.
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bovineKeys.statistics() });
      // Cases caches (modulo Salud) — el caso recien creado debe aparecer ahi.
      queryClient.invalidateQueries({ queryKey: ['bovineCases'] });
      queryClient.invalidateQueries({ queryKey: ['ranch-active-diseases'] });
      // Map markers reflejan el cambio de healthStatus.
      queryClient.invalidateQueries({ queryKey: [...bovineKeys.all, 'map-markers'] });
    },
  });
}

/**
 * F-27 / Backend X-03: registra la muerte de un bovino. Es una accion
 * destructiva e irreversible — el backend crea la fila en `bovine_deaths`,
 * marca el bovino DECEASED+isActive=false, cierra ubicacion y caso clinico
 * activo si aplica. Por eso invalidamos absolutamente todo lo que dependa
 * del bovino o de los conteos del rancho.
 *
 * Errores comunes que la UI debe mapear:
 *   - 409 ALREADY_DECEASED
 *   - 400 MISSING_DEATH_CAUSE
 *   - 400 INVALID_DEATH_DATE
 */
export function useDeceaseBovine(bovineId: string) {
  const queryClient = useQueryClient();
  return useMutation<BovineDeathRecord, Error, DeceaseBovineInput>({
    mutationFn: async (data) => {
      const res = await bovinesApi.decease(bovineId, data);
      return res.data.data;
    },
    onSuccess: () => {
      // Detail page y todas sus tabs (incluido vaccinations / location history).
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.detail(bovineId) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.currentLocation(bovineId) });
      // Listado y estadisticas — el bovino se marca isActive=false y desaparece
      // por default (a menos que se active el switch F-30).
      queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bovineKeys.statistics() });
      // Map markers: el bovino se quita del mapa (snapshot eliminado).
      queryClient.invalidateQueries({ queryKey: [...bovineKeys.all, 'map-markers'] });
      // Casos clinicos: si murio por enfermedad, su caso quedo cerrado.
      queryClient.invalidateQueries({ queryKey: ['bovineCases'] });
      // Epidemiologia: deceasedCount + mortalityRate cambian.
      queryClient.invalidateQueries({ queryKey: ['epidemiology'] });
      queryClient.invalidateQueries({ queryKey: ['ranch-mortality'] });
      // Capacidad de potrero: el bovino dejo de ocupar el suyo.
      invalidateOccupancyCaches(queryClient);
    },
  });
}

/**
 * F-29 / Backend X-07: reporte de mortalidad por rancho con dropdown de
 * groupBy (cause/month/location). El backend resuelve labels en espanol.
 * Cache 5 min porque los datos no cambian frecuentemente y el reporte se
 * consulta varias veces seguidas al cambiar el groupBy.
 */
export function useRanchMortality(
  ranchId: string | null | undefined,
  filters?: MortalityReportFilters,
  options?: { enabled?: boolean },
) {
  return useQuery<MortalityReport>({
    queryKey: ['ranch-mortality', ranchId, filters ?? {}],
    queryFn: async () => {
      const res = await bovinesApi.getRanchMortality(ranchId!, filters);
      return res.data.data;
    },
    enabled: !!ranchId && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
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

/**
 * Resultado del move: incluye los flags top-level que el backend agrega tras
 * L-04 (`wasNoOp`, `locationChanged`). Asi la UI puede mostrar feedback
 * diferenciado sin comparar destino vs ubicacion actual en cliente
 * (esa comparacion era vulnerable a estados stale).
 */
export interface MoveBovineResult {
  bovine:           BovineDetailResponse;
  wasNoOp:          boolean;
  locationChanged:  boolean;
}

/** Move a single bovine to a different location. */
export function useMoveBovine() {
  const queryClient = useQueryClient();
  return useMutation<MoveBovineResult, Error, MoveBovineMutationInput>({
    mutationFn: async ({ id, data }) => {
      const res = await bovinesApi.moveToLocation(id, data);
      // res.data es el envelope completo `MoveBovineResponse`:
      // { success, data: bovine, wasNoOp, locationChanged }
      return {
        bovine:          res.data.data,
        wasNoOp:         res.data.wasNoOp,
        locationChanged: res.data.locationChanged,
      };
    },
    onSuccess: (result, { id }) => {
      // L-04: si fue no-op no tiene sentido invalidar todo el universo de
      // caches — solo los que dependen de la ubicacion actual (por si el GPS
      // se actualizo). Si si cambio el potrero, invalidamos todo.
      queryClient.invalidateQueries({ queryKey: bovineKeys.full(id) });
      queryClient.invalidateQueries({ queryKey: bovineKeys.currentLocation(id) });
      if (result.locationChanged) {
        queryClient.invalidateQueries({ queryKey: bovineKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: bovineKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...bovineKeys.all, 'map-markers'] });
        // A move changes the source AND destination location occupancy.
        invalidateOccupancyCaches(queryClient);
      }
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

/** Summary returned by useBulkMoveBovines so callers can show differentiated toasts. */
export interface BulkMoveSummary {
  /** Bovinos que SÍ cambiaron de potrero. */
  moved: number;
  /** Bovinos que ya estaban en el destino (no-op silencioso del backend). */
  noOps: number;
}

/** Bulk-move multiple bovines to the same location (sequential — no batch endpoint). */
export function useBulkMoveBovines() {
  const queryClient = useQueryClient();
  return useMutation<BulkMoveSummary, Error, BulkMoveInputArg>({
    mutationFn: async ({ ids, locationId, reason, movementType, notes }) => {
      const results = await bovinesApi.bulkMove(ids, locationId, reason, movementType, notes);
      const noOps = results.filter((r) => r.data.wasNoOp === true).length;
      return { moved: ids.length - noOps, noOps };
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

// ────────────────────────────────────────────────────────────────────────────
// RISK SCORE (E-05)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Score de riesgo epidemiológico del bovino (0-100).
 * Se carga lazy en el detalle — habilitado solo cuando la pestaña de salud
 * está activa y el bovino no está DECEASED.
 */
export function useBovineRiskScore(
  id: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery<BovineRiskScore>({
    queryKey: bovineKeys.riskScore(id ?? ''),
    queryFn: async () => {
      const res = await bovinesApi.getRiskScore(id!);
      return res.data.data;
    },
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: 5 * 60_000,
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
  UpdateVaccinationInput,
  ListVaccinationsFilters,
  CreateBovineInput,
  MoveBovineInput,
  MarkBovineSickInput,
  DeceaseBovineInput,
  BovineDeathRecord,
  MortalityReport,
  MortalityReportFilters,
};
