// ============================================================================
// FRONTEND MIRROR — backend/src/dtos/bovine.dtos.ts
// ============================================================================
// Esta es la fuente de verdad de tipos para el módulo Bovinos en frontend.
// Replica literalmente las shapes del backend (re-exports + tipos de services).
//
// IMPORTANTE: cualquier cambio en el contrato backend debe reflejarse aquí
// MANUALMENTE. Si los archivos divergen, hay drift de tipos. Mantener sincronía:
//   - backend/src/dtos/bovine.dtos.ts
//   - backend/src/services/Bovine*.ts (interfaces exportadas)
//   - backend/src/models/Bovine.ts (enums)
//   - backend/src/models/Vaccination.ts (enums)
//
// Última sincronización: 2026-05-06.
// ============================================================================

// ────────────────────────────────────────────────────────────────────────────
// ENUMS — modelos backend (Bovine + Vaccination)
// ────────────────────────────────────────────────────────────────────────────

export enum CattleType {
  CATTLE = 'CATTLE',
  BULL   = 'BULL',
  COW    = 'COW',
  CALF   = 'CALF',
}

export enum HealthStatus {
  HEALTHY    = 'HEALTHY',
  SICK       = 'SICK',
  RECOVERING = 'RECOVERING',
  QUARANTINE = 'QUARANTINE',
  DECEASED   = 'DECEASED',
  UNKNOWN    = 'UNKNOWN',
}

export enum VaccinationStatus {
  UP_TO_DATE = 'UP_TO_DATE',
  PENDING    = 'PENDING',
  OVERDUE    = 'OVERDUE',
  NONE       = 'NONE',
}

export enum GenderType {
  MALE    = 'MALE',
  FEMALE  = 'FEMALE',
  UNKNOWN = 'UNKNOWN',
}

export enum VaccineType {
  BRUCELLOSIS    = 'BRUCELLOSIS',
  FOOT_AND_MOUTH = 'FOOT_AND_MOUTH',
  ANTHRAX        = 'ANTHRAX',
  RABIES         = 'RABIES',
  BLACKLEG       = 'BLACKLEG',
  IBR            = 'IBR',
  BVD            = 'BVD',
  LEPTOSPIROSIS  = 'LEPTOSPIROSIS',
  CLOSTRIDIAL    = 'CLOSTRIDIAL',
  PASTEURELLA    = 'PASTEURELLA',
  TUBERCULOSIS   = 'TUBERCULOSIS',
  TETANUS        = 'TETANUS',
  VIRAL_DIARRHEA = 'VIRAL_DIARRHEA',
  PARAINFLUENZA  = 'PARAINFLUENZA',
  RSV            = 'RSV',
  OTHER          = 'OTHER',
}

export enum ApplicationRoute {
  INTRAMUSCULAR = 'INTRAMUSCULAR',
  SUBCUTANEOUS  = 'SUBCUTANEOUS',
  INTRANASAL    = 'INTRANASAL',
  ORAL          = 'ORAL',
  INTRADERMAL   = 'INTRADERMAL',
  OTHER         = 'OTHER',
}

// ────────────────────────────────────────────────────────────────────────────
// SHARED — LocationData (embedded en Bovine + create/update)
// ────────────────────────────────────────────────────────────────────────────

export interface LocationData {
  latitude:    number;
  longitude:   number;
  altitude?:   number;
  accuracy?:   number;
  address?:    string;
  municipality?: string;
  state?:      string;
  country?:    string;
  timestamp?:  string;            // serializado como ISO date
  source?:     'GPS' | 'MANUAL' | 'ESTIMATED';
}

// ────────────────────────────────────────────────────────────────────────────
// API ENVELOPE
// ────────────────────────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ────────────────────────────────────────────────────────────────────────────
// BOVINE — detalle base (BovineResponse) — bovine-response.dto.ts
// ────────────────────────────────────────────────────────────────────────────
// Nota: lo importamos como `BovineDetailResponse` para coincidir con el alias
// que usa el archivo bovine.dtos.ts del backend.

export interface BovineDetailResponse {
  id: string;
  earTag: string;
  name?: string;
  cattleType: CattleType;
  cattleTypeLabel: string;
  breed: string;
  gender: GenderType;
  genderLabel: string;
  /** ISO date string (en JSON, las Date se serializan como string). */
  birthDate: string;
  ageInMonths: number;
  ageInYears: number;
  ageDisplay: string;
  weight?: number;
  healthStatus: HealthStatus;
  healthStatusLabel: string;
  /** Hex color string (ej. '#10b981'). */
  healthColor: string;
  vaccinationStatus: VaccinationStatus;
  vaccinationStatusLabel: string;
  /** Eager-loaded LocationData. Backend lo tipa `any` pero la shape es estable. */
  location: LocationData | null;
  qrCode: string;
  isAdult: boolean;
  ranch?: { id: string; name: string };
  lastHealthCheck?: string;       // ISO date
  isPregnant?: boolean;
  expectedCalvingDate?: string;   // ISO date
  daysInOperation?: number;

  // ── Optional fields the backend may include when eager-loaded ──────────
  // These are NOT in the canonical BovineResponse DTO of the backend, but
  // the actual response from /bovines/:id and /bovines/:id/full does
  // include them (formatBovineResponse extends the DTO with these).
  ranchId?: string;
  isActive?: boolean;
  notes?: string;
  createdAt?: string;             // ISO
  updatedAt?: string;             // ISO

  // Genealogy — populated when mother/father associations are eager-loaded
  motherId?: string;
  fatherId?: string;
  mother?: BovineDetailResponseMinimal;
  father?: BovineDetailResponseMinimal;
}

/** Minimal projection of a bovine (used for mother/father refs and lists). */
export type BovineDetailResponseMinimal = Pick<
  BovineDetailResponse,
  'id' | 'earTag' | 'name' | 'breed' | 'healthStatus' | 'ageDisplay' | 'gender'
>;

// ────────────────────────────────────────────────────────────────────────────
// BOVINE — listado y filtros — services/BovineService.ts
// ────────────────────────────────────────────────────────────────────────────

/**
 * Filtros aceptados por GET /api/bovines.
 * El backend serializa arrays a CSV (?healthStatus=HEALTHY,SICK).
 */
export interface BovineFilters {
  searchTerm?: string;
  cattleType?: CattleType;
  breed?: string;
  gender?: GenderType;
  healthStatus?: HealthStatus;
  /** Se evalúa contra BovineVaccinationStatus (snapshot derivado). */
  vaccinationStatus?: VaccinationStatus;
  ageRange?: { min: number; max: number };
  weightRange?: { min: number; max: number };
  /** Filtro por un solo rancho (ignora `ranchIds` si está presente). */
  ranchId?: string;
  /** Filtro por múltiples ranchos (intersección con permisos del usuario). */
  ranchIds?: string[];
  /** Filtro por ubicación ACTUAL (JOIN BLH con exitedAt IS NULL). */
  locationId?: string;
  ownerId?: string;
  isActive?: boolean;
  isPregnant?: boolean;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface BovineListResponse {
  /** El backend lo nombra `bovines` — NO `items` (importante respetar). */
  bovines: BovineDetailResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  // ── Legacy compat aliases (deprecated) ──────────────────────────────────
  // Some pages still read `items` / `total` / `totalPages` from a normalized
  // wrapper. These optional fields let TypeScript accept that pattern while
  // the migration to `bovines` / `pagination.*` happens. Remove once all
  // callers migrate.
  /** @deprecated Use `bovines` instead. */
  items?: BovineDetailResponse[];
  /** @deprecated Use `pagination.total` instead. */
  total?: number;
  /** @deprecated Use `pagination.totalPages` instead. */
  totalPages?: number;
}

export interface BovineStatistics {
  totalBovines: number;
  totalByType: Record<CattleType, number>;
  totalByGender: Record<GenderType, number>;
  totalByHealthStatus: Record<HealthStatus, number>;
  totalByVaccinationStatus: Record<VaccinationStatus, number>;
  averageWeight: number;
  averageAge: number;
  upcomingVaccinations: number;
  sickAnimals: number;
  pregnantCows: number;

  // ── Legacy compat aliases ──────────────────────────────────────────────
  // Some pages read these flatter fields. The backend may compute them as
  // shortcuts to common derivations. Optional to avoid breaking strict mode.
  /** @deprecated Use `totalBovines` instead. */
  total?: number;
  /** @deprecated Compute as `totalByHealthStatus.HEALTHY` if needed. */
  active?: number;
  /** @deprecated Compute from another module. */
  sold?: number;
  /** @deprecated Use `totalByHealthStatus.DECEASED`. */
  deceased?: number;
  /** @deprecated Use `totalByHealthStatus.QUARANTINE`. */
  quarantined?: number;
  /** @deprecated Compute from breeds list if needed. */
  byBreed?: Record<string, number>;
}

// ────────────────────────────────────────────────────────────────────────────
// BOVINE — endpoint compuesto /full — services/BovineFullService.ts
// ────────────────────────────────────────────────────────────────────────────

export interface BovineRecentHealthRecord {
  id: string;
  recordType: string;
  recordDate: string;          // ISO
  veterinarianName?: string | null;
  chiefComplaint?: string | null;
  diagnosisSummary?: string | null;
}

export interface BovineRecentMovement {
  historyId: string;
  bovineId: string;
  locationId: string;
  enteredAt: string;           // ISO
  exitedAt: string | null;     // ISO o null si stay activa
  reason: string | null;
  movementType: string | null;
  recordedBy: string | null;
  notes: string | null;
}

/**
 * GET /api/bovines/:id/full
 *
 * Backend retorna `bovine: any` (espacio para crecer). El frontend lo trata
 * como `BovineDetailResponse` ya que el shape coincide. Si en el futuro el
 * backend añade campos extra a `bovine`, hay que actualizar el alias aquí.
 */
export interface BovineFullResponse {
  bovine: BovineDetailResponse;
  media: BovineMediaListResponse;
  currentLocation: BovineCurrentLocationResponse;
  vaccinationStatus: VaccinationStatusResponse;
  recentVaccinations: VaccinationResponse[];   // últimas 5
  recentHealthRecords: BovineRecentHealthRecord[]; // últimos 10
  recentMovements: BovineRecentMovement[];     // últimos 20
  computedAt: string;          // ISO
  ttlSeconds: number;
}

// ────────────────────────────────────────────────────────────────────────────
// BOVINE — ubicación actual consolidada — services/BovineLocationService.ts
// ────────────────────────────────────────────────────────────────────────────

export type CurrentLocationStatus =
  | 'IN_LOCATION'   // hay stay activa (BLH.exitedAt = null)
  | 'GPS_ONLY'      // no stay, GPS reciente (<24h)
  | 'GPS_STALE'     // no stay, GPS viejo (>=24h)
  | 'UNKNOWN';      // ni stay ni GPS

export interface BovineCurrentLocationResponse {
  bovineId: string;
  status: CurrentLocationStatus;
  location: {
    id: string;
    name: string;
    type: string;
    enteredAt: string;          // ISO
    timeSpentMinutes: number;
    reason: string | null;
  } | null;
  gpsPoint: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    recordedAt: string;         // ISO
    batteryLevel: number | null;
    deviceId: string | null;
    source: string;
  } | null;
  lastSeenAt: string | null;    // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// VACUNACIÓN — services/VaccinationService.ts
// ────────────────────────────────────────────────────────────────────────────

export interface CreateVaccinationInput {
  bovineId: string;
  vaccineType: VaccineType;
  vaccineName?: string;
  manufacturer?: string;
  batchNumber?: string;
  doseNumber?: number;
  doseAmountMl?: number;
  applicationRoute?: ApplicationRoute;
  /** Acepta string ISO o Date; en frontend siempre enviamos string. */
  applicationDate: string;
  nextDueDate?: string;
  applicatorId: string;
  withdrawalPeriodDays?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface ListVaccinationsFilters {
  bovineId: string;
  vaccineType?: VaccineType;
  fromDate?: string;            // ISO
  toDate?: string;              // ISO
  applicatorId?: string;
  limit?: number;
  offset?: number;
}

export interface VaccinationResponse {
  id: string;
  bovineId: string;
  vaccineType: VaccineType;
  vaccineName: string | null;
  manufacturer: string | null;
  batchNumber: string | null;
  doseNumber: number;
  doseAmountMl: number | null;
  applicationRoute: ApplicationRoute | null;
  applicationDate: string;      // ISO
  nextDueDate: string | null;   // ISO
  applicatorId: string;
  applicatorName: string | null;
  withdrawalPeriodDays: number | null;
  notes: string | null;
  createdAt: string;            // ISO
}

export interface VaccinationListResponse {
  total: number;
  limit: number;
  offset: number;
  items: VaccinationResponse[];
}

// ────────────────────────────────────────────────────────────────────────────
// VACUNACIÓN — estado derivado — services/BovineVaccinationStatusService.ts
// ────────────────────────────────────────────────────────────────────────────

export interface VaccinationStatusResponse {
  bovineId: string;
  status: VaccinationStatus;
  lastVaccinationAt: string | null;   // ISO
  lastVaccineType: string | null;
  nextDueAt: string | null;            // ISO
  overdueCount: number;
  totalApplied: number;
  computedAt: string;                  // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// MULTIMEDIA — services/BovineMediaService.ts
// ────────────────────────────────────────────────────────────────────────────

export type BovineMediaType = 'images' | 'documents' | 'videos';

export interface BovineMediaItemResponse {
  id: string;
  url: string;
  storagePath: string | null;
  filename: string;
  mimeType: string;
  size: number;
  thumbnailUrl: string | null;
  uploadedAt: string;           // ISO
  uploadedBy: string;
  caption?: string | null;
}

export interface BovineMediaListResponse {
  bovineId: string;
  images: BovineMediaItemResponse[];
  documents: BovineMediaItemResponse[];
  videos: BovineMediaItemResponse[];
  totals: {
    images: number;
    documents: number;
    videos: number;
    all: number;
  };
}

export interface BovineMediaUploadResponse {
  id: string;
  bovineId: string;
  mediaType: BovineMediaType;
  url: string;
  storagePath: string;
  thumbnailUrl: string | null;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

// ────────────────────────────────────────────────────────────────────────────
// MAPA — services/BovineGeoService.ts (extensión MapMarkers)
// ────────────────────────────────────────────────────────────────────────────

export interface BovineMapMarkerResponse {
  bovineId: string;
  earTag?: string;
  /** Nombre amistoso del bovino (ej: "Mancha"). Mostrado en el tooltip de
   *  hover sobre el marker en el mapa para identificación rápida. */
  name?: string;
  /** Location actual (stay activa). El frontend agrupa los bovinos en burbujas
   *  por potrero en el mapa. `null` cuando el bovino no tiene potrero asignado
   *  (se muestra como marker huérfano "Sin potrero asignado"). */
  locationId?: string | null;
  lat: number;
  lng: number;
  /** Hex color string (deriva de healthStatus o vaccinationStatus). */
  color: string;
  healthStatus: HealthStatus;
  breed?: string;
  ageMonths?: number;
  diagnosis?: string;
}

export interface BovineMapClusterResponse {
  lat: number;
  lng: number;
  count: number;
  /** Color del status dominante en el cluster. */
  dominantColor: string;
}

export interface MapMarkersFilters {
  /** Multi-rancho. Null = sin restricción (SUPER_ADMIN sin rancho elegido). */
  ranchIds?: string[] | null;
  healthStatus?: HealthStatus[];
  breeds?: string[];
  cattleTypes?: CattleType[];
  genders?: GenderType[];
  ageRange?: { min: number; max: number };
  diseases?: string[];
  vaccinationStatus?: VaccinationStatus;
  /** Filtro por ubicación actual (stay activa). */
  locationId?: string;
}

export interface MapMarkersOptions {
  bbox?: { north: number; south: number; east: number; west: number };
  /** Zoom Leaflet (0-22). <10 fuerza clusters. */
  zoom?: number;
  /** Si > maxMarkers, devuelve clusters. Default 5000. */
  maxMarkers?: number;
  /** Tamaño del grid (grados). Default según zoom. */
  gridSize?: number;
}

/**
 * Discriminated union — el backend decide markers vs clusters según count/zoom.
 * Frontend hace switch sobre `result.mode`.
 */
export type BovineMapMarkersResponse =
  | { mode: 'markers';  total: number; items: BovineMapMarkerResponse[] }
  | { mode: 'clusters'; total: number; items: BovineMapClusterResponse[] };

// ────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE FILTROS — services/BovineFiltersService.ts
// ────────────────────────────────────────────────────────────────────────────

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

export interface BovineFiltersOptionsResponse {
  cattleTypes: FilterOption<CattleType>[];
  genders: FilterOption<GenderType>[];
  healthStatuses: FilterOption<HealthStatus>[];
  vaccinationStatuses: FilterOption<VaccinationStatus>[];
  vaccineTypes: FilterOption<VaccineType>[];
  applicationRoutes: FilterOption<ApplicationRoute>[];
  /** Lista dinámica desde BD (no enum). */
  breeds: string[];
  computedAt: string;           // ISO
  ttlSeconds: number;
}

// ────────────────────────────────────────────────────────────────────────────
// CRUD INPUTS — services/BovineService.ts
// ────────────────────────────────────────────────────────────────────────────

export interface CreateBovineInput {
  earTag: string;
  name?: string;
  cattleType: CattleType;
  breed: string;
  gender: GenderType;
  /** ISO date string. */
  birthDate: string;
  weight?: number;
  location: LocationData;
  healthStatus?: HealthStatus;
  vaccinationStatus?: VaccinationStatus;
  notes?: string;
  ranchId?: string;
  ownerId?: string;
  physicalMetrics?: Record<string, unknown>;
  reproductiveInfo?: Record<string, unknown>;
  trackingConfig?: Record<string, unknown>;
  motherId?: string;
  fatherId?: string;
  acquisitionDate?: string;     // ISO
  acquisitionPrice?: number;
}

export interface UpdateBovineInput extends Partial<CreateBovineInput> {
  id: string;
}

// ────────────────────────────────────────────────────────────────────────────
// MOVE / BULK MOVE
// ────────────────────────────────────────────────────────────────────────────

/**
 * Reason for a location movement (entry/exit event).
 * Mirrors backend `MovementReason` enum. `CREATION` is the default reason used
 * the first time a bovine is registered at a location (initial assignment).
 */
export type MovementReason =
  | 'CREATION'
  | 'GRAZING'
  | 'MEDICAL'
  | 'QUARANTINE'
  | 'BREEDING'
  | 'TRANSFER'
  | 'SALE'
  | 'OTHER';

export const MovementReason = {
  CREATION:   'CREATION',
  GRAZING:    'GRAZING',
  MEDICAL:    'MEDICAL',
  QUARANTINE: 'QUARANTINE',
  BREEDING:   'BREEDING',
  TRANSFER:   'TRANSFER',
  SALE:       'SALE',
  OTHER:      'OTHER',
} as const;

/**
 * How the movement was triggered. Mirrors backend `MovementType` enum (3 valores).
 * `MANUAL` es el default — el usuario lo capturó desde la UI.
 *   MANUAL    — capturado a mano
 *   AUTOMATED — derivado de un evento automático del sistema
 *   SCHEDULED — generado por una tarea programada (cron / scheduler)
 */
export type MovementType = 'MANUAL' | 'AUTOMATED' | 'SCHEDULED';

export const MovementType = {
  MANUAL:    'MANUAL',
  AUTOMATED: 'AUTOMATED',
  SCHEDULED: 'SCHEDULED',
} as const;

export interface MoveBovineInput {
  locationId: string;
  reason?: MovementReason | string;
  /** When did the bovine physically enter the location. Defaults to "now" on the backend. */
  enteredAt?: string;
  /** How the movement was triggered. Defaults to MANUAL. */
  movementType?: MovementType | string;
  /** Free-form notes about the entry. */
  notes?: string;
}

export interface BulkMoveInput {
  bovineIds: string[];
  locationId: string;
  reason?: MovementReason | string;
  /** How the movement was triggered. Defaults to MANUAL on the backend. */
  movementType?: MovementType | string;
  /** Free-form notes shared by all bovines in this bulk operation. */
  notes?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// END OF DTOs
// ────────────────────────────────────────────────────────────────────────────
