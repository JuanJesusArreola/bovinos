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
  UpdateVaccinationInput,
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
  MoveBovineResponse,
  MarkBovineSickInput,
  DeceaseBovineInput,
  BovineDeathRecord,
  MortalityReport,
  MortalityReportFilters,
  FilterOption,
  BovineProtectionItem,
  SuggestedScheduleItem,
  BovineRiskScore,
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

  /**
   * POST /api/bovines/:id/sick (Backend C-04) — abre un caso clinico en un
   * bovino existente. Internamente reusa `openCase()` del backend, asi que:
   *   - Actualiza `Bovine.healthStatus` segun severidad/disease
   *   - Sincroniza `BovineHealthSnapshot.activeDiseaseId/activeCaseId`
   *   - Crea CaseSymptom[] si se enviaron
   * Devuelve el caso creado (no el bovino completo).
   */
  markSick: (id: string, data: MarkBovineSickInput) =>
    apiClient.post<ApiSuccessResponse<{ id: string; diseaseId: string; status: string }>>(
      `/bovines/${id}/sick`,
      data,
    ),

  /**
   * POST /api/bovines/:id/decease (Backend X-03) — registra la muerte del
   * bovino en una sola transaccion atomica:
   *   - Crea fila en `bovine_deaths`
   *   - Marca `Bovine.healthStatus = DECEASED`, `isActive = false`,
   *     `exitReason = DECEASED`, `currentLocationId = null`
   *   - Cierra la estancia activa de potrero
   *   - Si `cause = DISEASE` y hay caso activo, cierra el caso con
   *     `outcome = DECEASED` (sin recursion, usa applyDeathSideEffects)
   *   - Elimina (soft) el snapshot de mapa
   *   - Emite evento `DEATH` (best-effort)
   *
   * Errores que la UI debe distinguir:
   *   - 409 ALREADY_DECEASED   → el bovino ya estaba marcado como fallecido
   *   - 400 MISSING_DEATH_CAUSE → falta `cause` en el body
   *   - 400 INVALID_DEATH_DATE → fecha futura o anterior al birthDate
   */
  decease: (id: string, data: DeceaseBovineInput) =>
    apiClient.post<ApiSuccessResponse<BovineDeathRecord>>(`/bovines/${id}/decease`, data),

  /**
   * GET /api/ranches/:ranchId/mortality (Backend X-07) — reporte agregado.
   * Devuelve total + lista de grupos con conteo y porcentaje. El backend
   * resuelve labels en espanol para `cause`.
   */
  getRanchMortality: (ranchId: string, filters?: MortalityReportFilters) =>
    apiClient.get<ApiSuccessResponse<MortalityReport>>(
      `/ranches/${ranchId}/mortality`,
      { params: filters },
    ),

  // ── Statistics ───────────────────────────────────────────────────────────

  statistics: () =>
    apiClient.get<ApiSuccessResponse<BovineStatistics>>('/bovines/statistics'),

  regenerateQR: (id: string) =>
    apiClient.post<ApiSuccessResponse<{ qrCode: string }>>(`/bovines/${id}/regenerate-qr`),

  // ── Movement ─────────────────────────────────────────────────────────────

  /**
   * PATCH /api/bovines/:id/location — register entry to a new location.
   *
   * Backend L-04: la respuesta incluye flags top-level `wasNoOp` y
   * `locationChanged` para que el frontend no compare cliente-side
   * (`MoveBovineResponse` extiende el envelope estandar).
   *
   * Backend L-01: puede responder 409 BOVINE_LOCATION_FULL con
   * `details: { currentOccupancy, maxAnimals }`. Para omitir la validacion
   * reenviar con `data.forceOverride = true`.
   */
  moveToLocation: (id: string, data: MoveBovineInput) =>
    apiClient.patch<MoveBovineResponse>(`/bovines/${id}/location`, data),

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
        apiClient.patch<MoveBovineResponse>(
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
   * PATCH /api/vaccinations/:vaccinationId (Backend V-04) — patch parcial.
   *
   * Errores que la UI debe manejar:
   *   - 404 VACCINATION_NOT_FOUND — registro no existe / borrado.
   *   - 409 VACCINATION_DUPLICATE — el cambio crearia otra vacuna del mismo
   *     tipo en la misma fecha para el mismo bovino.
   *   - 400 VALIDATION_ERROR — p.ej. `nextDueDate <= applicationDate`.
   *
   * Backend recalcula `BovineVaccinationStatus` y la proteccion derivada,
   * por lo que el hook debe invalidar los caches relacionados.
   */
  updateVaccination: (vaccinationId: string, data: UpdateVaccinationInput) =>
    apiClient.patch<ApiSuccessResponse<VaccinationResponse>>(
      `/vaccinations/${vaccinationId}`,
      data,
    ),

  /**
   * DELETE /api/vaccinations/:vaccinationId — soft delete.
   * Backend recalcula el status del bovino post-delete.
   */
  deleteVaccination: (vaccinationId: string) =>
    apiClient.delete<ApiSuccessResponse<null>>(`/vaccinations/${vaccinationId}`),

  /**
   * GET /api/bovines/:id/vaccination-status — derived status snapshot.
   * Recalculated server-side from the active vaccination calendar.
   */
  getVaccinationStatus: (id: string) =>
    apiClient.get<ApiSuccessResponse<VaccinationStatusResponse>>(`/bovines/${id}/vaccination-status`),

  /**
   * GET /api/bovines/:id/protection — proteccion por enfermedad derivada
   * de las vacunas aplicadas + catalogo VaccineDiseaseProtection.
   * Ordenado por daysUntilExpiry asc (lo que ya vencio o esta proximo a
   * vencer arriba). Array vacio si no hay vacunas que mapeen a alguna
   * enfermedad del catalogo.
   */
  getProtection: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovineProtectionItem[]>>(`/bovines/${id}/protection`),

  /**
   * GET /api/bovines/:id/risk-score (Backend E-05) — score de riesgo
   * epidemiológico del bovino (0-100) con nivel y factores ponderados.
   *   Niveles: <25 LOW · <50 MEDIUM · <75 HIGH · ≥75 CRITICAL
   */
  getRiskScore: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovineRiskScore>>(`/bovines/${id}/risk-score`),

  /**
   * GET /api/bovines/:id/vaccination-schedule (Backend V-05 / Modulo 11) —
   * Calendario sugerido para el bovino: que vacunas le tocan segun su
   * edad/sexo/raza, con estado por cada una (APPLIED_CURRENT / OVERDUE /
   * MISSING / ONE_TIME_DONE) y nextDueDate cuando aplica.
   *
   * Array vacio cuando el calendario base no tiene entradas que apliquen
   * a este perfil. 404 si el bovino no existe.
   */
  getVaccinationSchedule: (id: string) =>
    apiClient.get<ApiSuccessResponse<SuggestedScheduleItem[]>>(
      `/bovines/${id}/vaccination-schedule`,
    ),

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
   *
   * ⚠️ `diseases[].value` aquí es el **slug** (para formularios y URLs).
   * NO usar para filtrar el backend por `diseaseId` — ese campo espera UUID.
   * Para filtros usa `getActiveDiseases()` (endpoint hermano, UUIDs).
   */
  getFilterOptions: () =>
    apiClient.get<ApiSuccessResponse<BovineFiltersOptionsResponse>>('/bovines/filters/options'),

  /**
   * GET /api/bovines/filters/active-diseases — enfermedades con al menos un
   * caso activo en el rancho del usuario, en forma `{ value: UUID, label }`.
   *
   * Diseñado para alimentar los selects de filtro de `/health/cases` y de la
   * capa Epidemiología del mapa (`?diseaseId=<uuid>`, `?diseaseIds=<uuid>`).
   * Más ligero que `/diseases` (que devuelve el catálogo entero con sub-
   * collections) y semánticamente filtrado: solo lo que tiene sentido elegir
   * para el rancho actual.
   *
   * ⚠️ Diferencia clave vs `getFilterOptions().diseases`:
   *   - `getActiveDiseases()  → value = UUID`  → para queries (`?diseaseId=`).
   *   - `getFilterOptions().diseases → value = slug` → para formularios / URLs.
   */
  getActiveDiseases: () =>
    apiClient.get<ApiSuccessResponse<FilterOption[]>>('/bovines/filters/active-diseases'),

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

  /**
   * @deprecated Use `getMapMarkers` with `mode: 'clusters'` instead.
   *
   * NOTA SOBRE LA SHAPE:
   *   El backend devuelve `BovineHealthSnapshot` raw con la geometría
   *   ANIDADA: `{ bovineId, location: { latitude, longitude }, healthStatus,
   *   healthColor, breed, ageMonths, diagnosis }`.
   *
   *   Pero el frontend / consumidores esperan la shape PLANA:
   *   `{ lat, lng, intensity, healthStatus, bovineId }`.
   *
   *   Esta función aplica un adapter de aplanamiento antes de devolver,
   *   para que callers como `MapsPage` no tengan que conocer el shape
   *   interno del modelo Sequelize. Sin este adapter `p.lat` y `p.lng`
   *   llegaban `undefined` y el heatmap se renderizaba vacío.
   */
  getHeatmap: async (
    ranchId: string,
    filters?: { healthStatus?: string; breeds?: string; ageMin?: number; ageMax?: number },
  ) => {
    const res = await apiClient.get<ApiSuccessResponse<unknown[]>>(
      `/bovines/geo/heatmap/${ranchId}`,
      { params: filters },
    );
    // Shape REAL devuelta por el backend (BovineGeoService.getHeatmapData):
    //   { id, lat, lng, value, metadata: { healthStatus, breed, age, diagnosis } }
    // Soportamos también shapes alternativas (legacy / future) para no
    // romper si el backend cambia la estructura.
    const raw = (res.data?.data ?? []) as Array<{
      // Shape canónica del backend
      id?: string;
      lat?: number;
      lng?: number;
      value?: number;
      metadata?: {
        healthStatus?: string;
        breed?: string;
        age?: number;
        diagnosis?: string;
      };
      // Shapes alternativas (fallback defensive)
      bovineId?: string;
      location?: { latitude?: number; longitude?: number } | null;
      healthStatus?: string;
      breed?: string;
      ageMonths?: number;
      diagnosis?: string;
    }>;
    const items: HeatmapPoint[] = raw
      .map((r) => {
        const lat = typeof r.lat === 'number' ? r.lat : r.location?.latitude;
        const lng = typeof r.lng === 'number' ? r.lng : r.location?.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        // El backend lo manda en `metadata.healthStatus`; fallback al
        // top-level por si en el futuro la shape se aplana.
        const healthStatus = r.metadata?.healthStatus ?? r.healthStatus;
        return {
          lat: lat as number,
          lng: lng as number,
          intensity: typeof r.value === 'number' ? r.value : 1,
          healthStatus,
          bovineId: r.id ?? r.bovineId,
        };
      })
      .filter((p): p is HeatmapPoint => p !== null);

    // Re-envuelve en el envelope ApiSuccessResponse que esperan los callers.
    return {
      ...res,
      data: { ...res.data, data: items } as ApiSuccessResponse<HeatmapPoint[]>,
    };
  },

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
  MoveBovineResponse,
  CreateVaccinationInput,
  UpdateVaccinationInput,
  MapMarkersFilters,
  MapMarkersOptions,
  DeceaseBovineInput,
  BovineDeathRecord,
  MortalityReport,
  MortalityReportFilters,
  DeathCause,
} from '@/types/bovine.dtos';
