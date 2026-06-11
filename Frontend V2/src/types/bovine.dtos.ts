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

/**
 * Clasificacion etaria derivada (Backend B-05).
 * Calculada por el backend desde `birthDate` + `gender` con los umbrales
 * unificados en `bovine.constants.ts`:
 *   - CALF  : edad < 12 meses
 *   - YOUNG : 12-23 meses
 *   - ADULT : >= 24 meses
 * El label es "gendered" (Becerro/Becerra/Novillo/Vaquilla/Toro/Vaca).
 */
export type BovineClassification = 'CALF' | 'YOUNG' | 'ADULT';

export const BovineClassification = {
  CALF:  'CALF',
  YOUNG: 'YOUNG',
  ADULT: 'ADULT',
} as const;

/**
 * Presets de edad aceptados por `GET /api/bovines?ageGroup=...` (Backend B-02).
 * Resuelven a rangos de meses server-side:
 *   - calf  : 0-12 meses
 *   - young : 12-24 meses
 *   - adult : >= 24 meses
 * El listado de opciones (con labels y rangos) llega en
 * `BovineFiltersOptionsResponse.ageGroups`.
 */
export type AgeGroup = 'calf' | 'young' | 'adult';

export const AgeGroup = {
  CALF:  'calf',
  YOUNG: 'young',
  ADULT: 'adult',
} as const;

export enum VaccineType {
  // ── Originales (16) ──────────────────────────────────────────────────
  BRUCELLOSIS         = 'BRUCELLOSIS',
  FOOT_AND_MOUTH      = 'FOOT_AND_MOUTH',
  ANTHRAX             = 'ANTHRAX',
  RABIES              = 'RABIES',
  BLACKLEG            = 'BLACKLEG',
  IBR                 = 'IBR',
  BVD                 = 'BVD',
  LEPTOSPIROSIS       = 'LEPTOSPIROSIS',
  CLOSTRIDIAL         = 'CLOSTRIDIAL',
  PASTEURELLA         = 'PASTEURELLA',
  TUBERCULOSIS        = 'TUBERCULOSIS',
  TETANUS             = 'TETANUS',
  VIRAL_DIARRHEA      = 'VIRAL_DIARRHEA',
  PARAINFLUENZA       = 'PARAINFLUENZA',
  RSV                 = 'RSV',
  OTHER               = 'OTHER',
  // ── Anadidos (12) - alineado con catalogo VaccineDiseaseProtection ──
  RESPIRATORY_COMPLEX = 'RESPIRATORY_COMPLEX', // IBR-BVD-PI3-BRSV
  CAMPYLOBACTER       = 'CAMPYLOBACTER',       // Vibriosis
  TRICHOMONIASIS      = 'TRICHOMONIASIS',
  PINKEYE             = 'PINKEYE',             // Queratoconjuntivitis
  NEONATAL_DIARRHEA   = 'NEONATAL_DIARRHEA',   // Rota-Corona-E.coli
  SALMONELLA          = 'SALMONELLA',
  FUSOBACTERIUM       = 'FUSOBACTERIUM',       // Foot rot
  LUMPY_SKIN          = 'LUMPY_SKIN',          // Dermatosis nodular contagiosa
  BLUETONGUE          = 'BLUETONGUE',          // Lengua azul
  THEILERIA           = 'THEILERIA',
  BABESIA_ANAPLASMA   = 'BABESIA_ANAPLASMA',
  PARATUBERCULOSIS    = 'PARATUBERCULOSIS',    // Enfermedad de Johne
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
  /**
   * @deprecated Eliminado del backend (columna deprecada en
   * `BovineGeoService`). El campo se marca como opcional para reflejar
   * que ya NO viene en la respuesta. El frontend deriva el color desde
   * el design-system: `getHealthColor(bovine.healthStatus)`.
   *
   * @see `@/design-system/tokens/health.colors.ts → getHealthColor`
   */
  healthColor?: string;
  // ── Vacunacion REMOVIDO (Backend P-02 / F-31) ────────────────────────────
  // Los campos `vaccinationStatus` y `vaccinationStatusLabel` ya no vienen
  // en la respuesta de `GET /api/bovines/:id`. La columna esta dormante en
  // BD y el estado real vive en `bovine_vaccination_status` (tabla derivada).
  // Para mostrar el estado:
  //   - en el detalle del bovino, usar `full.vaccinationStatus.{status,statusLabel}`
  //     que viene del bloque dedicado de `/api/bovines/:id/full`.
  //   - puntual / standalone, llamar `GET /api/bovines/:id/vaccination-status`
  //     via `useBovineVaccinationStatus(id)`.
  // El campo NO se incluye aqui para que TypeScript marque cualquier acceso
  // a `bovine.vaccinationStatus` como error y forzar la migracion.
  /** Eager-loaded LocationData. Backend lo tipa `any` pero la shape es estable. */
  location: LocationData | null;
  qrCode: string;
  isAdult: boolean;
  /**
   * Clasificacion etaria derivada (Backend B-05). Server calcula desde
   * birthDate + umbrales unificados. Marcar opcional para tolerar respuestas
   * de bovinos antiguos serializadas antes del cambio.
   */
  classification?: BovineClassification;
  /**
   * Label "gendered" listo para UI: "Becerra", "Vaquilla", "Toro", etc.
   * Si viene vacio (bovinos legacy), la UI hace fallback a `cattleTypeLabel`.
   */
  classificationLabel?: string;
  /**
   * True si edad >= REPRODUCTIVE_MIN_MONTHS para su sexo
   * (15 hembras, 18 machos). Util para badges y filtros de padres.
   */
  isReproductiveAge?: boolean;
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

  // Genealogy — populated when mother/father associations are eager-loaded.
  // Backend M5/G-05: `/full` siempre los incluye en `profile`; el endpoint
  // simple `/:id` los incluye solo con `?include=parents`.
  motherId?: string;
  fatherId?: string;
  mother?: BovineParentRef;
  father?: BovineParentRef;
}

/**
 * Shape exacto del mini-objeto madre/padre que el backend devuelve dentro de
 * `BovineResponse.mother` / `.father` (Backend M5 / G-05). NO incluye
 * `healthStatus` ni `ageDisplay` — esos solo estan en el response principal.
 *
 * Si necesitas mas datos del padre, navegar al detalle del padre con su `id`.
 */
export interface BovineParentRef {
  id:      string;
  earTag:  string;
  name?:   string | null;
  gender:  GenderType;
  breed:   string;
}

/**
 * @deprecated Usar `BovineParentRef` para mother/father; o `BovineDetailResponse`
 * cuando se necesite el shape completo. Esta union se mantenia para el shape
 * "minimo" pero generaba campos opcionales fantasma. Migra a `BovineParentRef`.
 */
export type BovineDetailResponseMinimal = BovineParentRef;

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
  /**
   * Rango etario en MESES (Backend B-02). El backend ahora interpreta los
   * valores como meses (antes los confundia con anios). Soporta rangos
   * abiertos: solo `min`, solo `max`, o ambos.
   */
  ageRange?: { min?: number; max?: number };
  /**
   * Preset etario (Backend B-02). Si se envia, el backend lo resuelve a un
   * rango de meses (ver AGE_GROUP_RANGES en backend). Tiene prioridad sobre
   * `ageRange` si ambos llegan; recomendado para presets de UI.
   */
  ageGroup?: AgeGroup;
  /**
   * Backend M5 / G-03: preset para selectores de padres. Resuelve gender +
   * edad reproductiva minima en el servidor (la fuente unica de las reglas).
   *   - `dam`  → FEMALE + edad ≥ 15 meses
   *   - `sire` → MALE   + edad ≥ 18 meses
   */
  purpose?: 'dam' | 'sire';
  /**
   * Backend M5 / G-03: lista de IDs a excluir del resultado. Util para
   * excluir al propio bovino del selector de padres. Se serializa como CSV
   * por el helper `flattenFilters` del api client.
   */
  excludeIds?: string[];
  /**
   * Backend Modulo 8 / F-30: si `true`, devuelve activos + fallecidos /
   * inactivos en el mismo listado. Default (omitido) = solo activos.
   * Tiene prioridad menor que `isActive` y `exitReason` (si esos vienen,
   * el backend respeta esos).
   */
  includeInactive?: boolean;
  /**
   * Backend Modulo 8 / F-30: filtrar por razon de salida del inventario.
   * Util para una vista "solo fallecidos" sin necesidad de marcar el
   * switch + filtrar luego.
   */
  exitReason?: BovineExitReason;
  weightRange?: { min: number; max: number };
  /** Filtro por un solo rancho (ignora `ranchIds` si está presente). */
  ranchId?: string;
  /** Filtro por múltiples ranchos (intersección con permisos del usuario). */
  ranchIds?: string[];
  /** Filtro por ubicación ACTUAL (JOIN BLH con exitedAt IS NULL). */
  locationId?: string;
  /**
   * Filtro por enfermedad activa. Usar UUID (no slug). Fuente: `getActiveDiseases()`
   * (`GET /api/bovines/filters/active-diseases`). El campo `?disease=` (slug)
   * está deprecado en el backend — siempre usar éste.
   */
  diseaseId?: string;
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
 * Tras Backend D-01 la respuesta contiene DOS bloques con datos del bovino:
 *
 *   - `bovine`  : la fila CRUDA del modelo Sequelize + relaciones eager
 *                 (ranch, healthSnapshot). No tiene labels normalizados ni
 *                 clasificacion etaria. Usar SOLO para datos que no estan
 *                 en `profile` (p.ej. `healthSnapshot` anidado).
 *   - `profile` : el mismo shape que `GET /api/bovines/:id` — incluye labels
 *                 en espanol, clasificacion (CALF/YOUNG/ADULT), isAdult,
 *                 ageDisplay, etc. **Esta es la fuente canonica** para todo
 *                 lo que muestra la UI (header, info card, badges).
 *
 * Para el estado de vacunacion usar el bloque dedicado `vaccinationStatus`
 * (derivado/exacto con `statusLabel`), NO `profile.vaccinationStatus` que
 * refleja la columna legacy de la tabla `bovines`.
 */
export interface BovineFullResponse {
  /**
   * @deprecated Usar `profile` para datos visibles. `bovine` queda para acceder
   * a relaciones crudas que `profile` no expone (p.ej. `healthSnapshot` con
   * `activeCaseId` / `activeDiseaseId`). Tipado como BovineDetailResponse por
   * compat — los campos son los mismos.
   */
  bovine: BovineDetailResponse;
  /**
   * Profile normalizado del bovino (Backend D-01) — fuente canonica para
   * todo lo que la UI renderice. Se garantiza presente en cada respuesta.
   */
  profile: BovineDetailResponse;
  media: BovineMediaListResponse;
  currentLocation: BovineCurrentLocationResponse;
  vaccinationStatus: VaccinationStatusResponse;
  recentVaccinations: VaccinationResponse[];   // últimas 5
  recentHealthRecords: BovineRecentHealthRecord[]; // últimos 10
  recentMovements: BovineRecentMovement[];     // últimos 20
  /**
   * Backend X-03 / Modulo 8: bloque de muerte. `null` si el bovino esta
   * vivo. Cuando el bovino esta DECEASED, contiene fecha, causa con label
   * en espanol, link al caso clinico (si cause=DISEASE) y resultados de
   * necropsia. Se invalida automaticamente al registrar la muerte.
   */
  death: BovineDeathRecord | null;
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
  /**
   * Override de la duracion de inmunidad en dias. Si se omite, el backend
   * usa el valor por defecto del catalogo VaccineDiseaseProtection segun
   * `vaccineType`. Util cuando el VET sabe que un lote especifico tiene
   * proteccion distinta a la documentada (e.g. concentracion ajustada).
   * Rango valido: 0-3650.
   */
  immunityDurationDays?: number;
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
  /**
   * Label en espanol del tipo de vacuna (Backend V-06). Viene desde
   * `constants/vaccination.labels.ts` del backend. Marcar opcional para
   * tolerar respuestas serializadas antes de V-06; la UI hace fallback al
   * enum si no llega.
   */
  vaccineTypeLabel?: string;
  vaccineName: string | null;
  manufacturer: string | null;
  batchNumber: string | null;
  doseNumber: number;
  doseAmountMl: number | null;
  applicationRoute: ApplicationRoute | null;
  /**
   * Label en espanol de la via de aplicacion (Backend V-06). Idem nota
   * de vaccineTypeLabel.
   */
  applicationRouteLabel?: string;
  applicationDate: string;      // ISO
  nextDueDate: string | null;   // ISO
  applicatorId: string;
  applicatorName: string | null;
  withdrawalPeriodDays: number | null;
  /**
   * Override de la duracion de inmunidad. `null` cuando se uso el default
   * del catalogo VaccineDiseaseProtection (caso comun).
   */
  immunityDurationDays: number | null;
  notes: string | null;
  createdAt: string;            // ISO
}

/**
 * PATCH /api/vaccinations/:vaccinationId (Backend V-04).
 *
 * Cuerpo parcial — solo enviar los campos que cambian. El backend:
 *   - Revalida duplicado (mismo bovino + tipo + fecha) si cambia `vaccineType`
 *     o `applicationDate` → 409 VACCINATION_DUPLICATE.
 *   - Valida `nextDueDate > applicationDate` cuando ambas vienen o cuando
 *     se actualiza una sola y la otra ya estaba persistida.
 *   - Recalcula `BovineVaccinationStatus` e invalida el cache compuesto.
 *
 * No se permite cambiar `bovineId` ni `applicatorId` desde este endpoint;
 * para eso usar borrar + recrear.
 */
export interface UpdateVaccinationInput {
  vaccineType?:          VaccineType;
  vaccineName?:          string;
  manufacturer?:         string;
  batchNumber?:          string;
  doseNumber?:           number;
  doseAmountMl?:         number;
  applicationRoute?:     ApplicationRoute;
  applicationDate?:      string;      // ISO
  nextDueDate?:          string | null;
  withdrawalPeriodDays?: number;
  immunityDurationDays?: number | null;
  notes?:                string;
  metadata?:             Record<string, unknown>;
}

export interface VaccinationListResponse {
  total: number;
  limit: number;
  offset: number;
  items: VaccinationResponse[];
}

// ────────────────────────────────────────────────────────────────────────────
// VACUNACIÓN — proteccion por enfermedad
// Endpoint: GET /api/bovines/:id/protection
//
// Snapshot derivado: cruza las vacunas aplicadas del bovino contra el
// catalogo VaccineDiseaseProtection y devuelve por cada enfermedad
// cubierta los dias hasta que expira la inmunidad.
//
// La UI lo usa para mostrar "Lola esta protegida contra Aftosa hasta
// 26/11 (181 dias)" y para alertar de protecciones por vencer.
// ────────────────────────────────────────────────────────────────────────────

export interface BovineProtectionItem {
  diseaseId:           string;
  diseaseName:         string;
  diseaseSlug:         string;
  /** Tipos aplicados que cubren la enfermedad (1 o mas). */
  vaccineTypes:        VaccineType[];
  /** Cantidad de aplicaciones que cubren esta enfermedad. */
  dosesApplied:        number;
  /** Dosis recomendadas para inmunidad completa (del catalogo). */
  dosesForImmunity:    number;
  /** ISO de la ultima aplicacion relevante. */
  lastApplicationDate: string;
  /** Dias de inmunidad declarados (override del bovino o del catalogo). */
  immunityDurationDays: number;
  /** ISO calculado = lastApplicationDate + immunityDurationDays. */
  protectedUntil:      string;
  /** True si protectedUntil >= hoy. */
  isProtected:         boolean;
  /** Negativo si ya vencio. */
  daysUntilExpiry:     number;
}

// ────────────────────────────────────────────────────────────────────────────
// VACUNACIÓN — estado derivado — services/BovineVaccinationStatusService.ts
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// CALENDARIO SUGERIDO (Backend V-05 / Modulo 11)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Estado de cada vacuna del calendario sugerido para un bovino:
 *   - APPLIED_CURRENT : aplicada y vigente (con nextDueDate futura)
 *   - OVERDUE         : aplicada pero vencida (paso la frecuencia)
 *   - MISSING         : le toca por edad/sexo/raza pero no se ha aplicado
 *   - ONE_TIME_DONE   : dosis unica ya aplicada (no requiere refuerzo)
 */
export type SuggestedItemStatus =
  | 'APPLIED_CURRENT'
  | 'OVERDUE'
  | 'MISSING'
  | 'ONE_TIME_DONE';

export const SuggestedItemStatus = {
  APPLIED_CURRENT: 'APPLIED_CURRENT',
  OVERDUE:         'OVERDUE',
  MISSING:         'MISSING',
  ONE_TIME_DONE:   'ONE_TIME_DONE',
} as const;

/**
 * Item del calendario sugerido devuelto por
 * `GET /api/bovines/:id/vaccination-schedule` (Backend V-05).
 *
 * Cada item = una vacuna que aplica al bovino segun calendario base
 * (filtrado por edad + sexo + raza). El array completo refleja TODO lo
 * que le toca; si esta vacio, no hay calendario aplicable a ese perfil
 * (ej: macho recien nacido sin entradas en `vaccination_schedules`).
 *
 * `frequencyMonths === null` ⟺ dosis unica → status siempre sera
 * `MISSING` o `ONE_TIME_DONE`, nunca `OVERDUE` / `APPLIED_CURRENT`.
 */
export interface SuggestedScheduleItem {
  /** UUID de la fila de `vaccination_schedules` que origino este item. */
  scheduleId:           string;
  vaccineType:          VaccineType;
  vaccineTypeLabel:     string | null;
  isRequired:           boolean;
  /** Frecuencia de refuerzo en meses. `null` = dosis unica. */
  frequencyMonths:      number | null;
  status:               SuggestedItemStatus;
  /** ISO date de la ultima aplicacion registrada. `null` si nunca se aplico. */
  lastApplicationDate:  string | null;
  /** ISO date de cuando le toca la proxima dosis. `null` para dosis unicas
   *  ya aplicadas o para vacunas que aun no se han aplicado por primera vez. */
  nextDueDate:          string | null;
  notes:                string | null;
}

export interface VaccinationStatusResponse {
  bovineId: string;
  status: VaccinationStatus;
  /**
   * Label en espanol del status (Backend V-06): "Al dia", "Vencida",
   * "Pendiente", "Sin vacunas". Marcar opcional para tolerar respuestas
   * legacy; fallback en frontend cuando no llega.
   */
  statusLabel?: string;
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
  /**
   * @deprecated Eliminado del backend (columna deprecada en
   * `BovineGeoService`). El campo se marca como opcional para reflejar
   * que ya NO viene en la respuesta. El frontend deriva el color desde
   * el design-system: `getHealthColor(marker.healthStatus)`.
   *
   * @see `@/design-system/tokens/health.colors.ts → getHealthColor`
   */
  color?: string;
  healthStatus: HealthStatus;
  breed?: string;
  ageMonths?: number;
  diagnosis?: string;
}

export interface BovineMapClusterResponse {
  lat: number;
  lng: number;
  count: number;
  /**
   * Color del estado dominante en el cluster.
   *
   * NO está deprecado — este campo SÍ tiene justificación server-side:
   * calcular el color dominante requiere conocer el breakdown completo
   * (`{ HEALTHY: 95, SICK: 12, ... }`), y esa info solo la tiene el
   * backend al agrupar. Devolverla cruda al cliente sería más payload
   * que un hex string.
   *
   * Para coherencia visual con el resto de la UI, el backend debe leer
   * los hex de los mismos colors que el frontend (idealmente expuestos
   * via un endpoint `GET /api/design-tokens`).
   */
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

/**
 * Opcion de preset etario (Backend B-02). Llega en
 * `BovineFiltersOptionsResponse.ageGroups`. El frontend la usa para armar
 * los botones de "Becerro / Novillo / Adulto" sin hardcodear rangos.
 */
export interface AgeGroupOption {
  value: AgeGroup;
  label: string;
  minMonths: number;
  /** Open-ended cuando es undefined (adultos sin tope). */
  maxMonths?: number;
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
  /**
   * Catálogo global de enfermedades activas.
   *
   * ⚠️ MUY IMPORTANTE — los `value` aquí son **slugs** (e.g. `"mastitis-bovina"`),
   * NO UUIDs. Pensado para alimentar dropdowns de formularios donde el slug es
   * lo que se persiste/lee en URLs (`/health/diseases/catalogo/:slug`).
   *
   * Para FILTRAR queries del backend (e.g. `?diseaseId=<uuid>` en
   * `/bovine-cases` o el filtro del mapa) NO uses estos `value` — usa el
   * endpoint hermano `GET /api/bovines/filters/active-diseases`
   * (`bovinesApi.getActiveDiseases()` / `useRanchActiveDiseases`), cuyos
   * `value` SÍ son UUIDs.
   */
  diseases: FilterOption[];
  /**
   * Presets de edad expuestos por el backend (B-02). Opcional para tolerar
   * builds antiguos del backend; el frontend hace fallback a un set local
   * cuando no llega.
   */
  ageGroups?: AgeGroupOption[];
  computedAt: string;           // ISO
  ttlSeconds: number;
}

// ────────────────────────────────────────────────────────────────────────────
// CRUD INPUTS — services/BovineService.ts
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sintoma observado al abrir un caso clinico (Backend C-01).
 * `symptomId` viene del catalogo de Disease (GET /diseases/:id/symptoms).
 * Si el VET captura el sintoma en formato libre, el flujo correcto es crear
 * el sintoma en el catalogo primero y luego referenciarlo aqui.
 */
export interface InitialCaseSymptomInput {
  symptomId: string;
  /** MILD | MODERATE | SEVERE — coincide con SymptomIntensity. */
  intensity: 'MILD' | 'MODERATE' | 'SEVERE';
  notes?:    string;
}

/**
 * Datos clinicos para abrir un caso al crear un bovino (Backend C-01) o al
 * marcarlo enfermo despues (Backend C-04). El backend valida en C-03:
 *   - `diseaseId`, `severity`, `diagnosedAt` requeridos
 *   - `symptoms[]` opcionales (pueden ser 0..N)
 *   - El caso queda en CONFIRMED por default (o SUSPECTED segun config backend)
 */
export interface InitialCaseInput {
  diseaseId:    string;
  /** LOW | MODERATE | HIGH | CRITICAL — coincide con CaseSeverity. */
  severity:     'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  /** ISO date string. */
  diagnosedAt:  string;
  diagnosedBy?: string;
  notes?:       string;
  symptoms?:    InitialCaseSymptomInput[];
}

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
  /**
   * Backend C-01: si `healthStatus` es enfermo (SICK/RECOVERING/QUARANTINE),
   * el backend exige (C-03) este bloque con los datos clinicos del caso
   * inicial. Si se envia con healthStatus=HEALTHY, el backend lo ignora.
   * Todo ocurre en la misma transaccion: si falla el caso, se revierte el
   * bovino tambien.
   */
  initialCase?: InitialCaseInput;
}

/**
 * Backend C-04: payload de `POST /api/bovines/:id/sick` — abre un caso
 * clinico en un bovino existente. El `ranchId` se infiere del bovino, por
 * eso no va en el body.
 */
export type MarkBovineSickInput = InitialCaseInput;

// ────────────────────────────────────────────────────────────────────────────
// MUERTE / BAJA (Backend Modulo 8 — X-01..X-08)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Causa de muerte (Backend X-02). El backend persiste el codigo en
 * `bovine_deaths.cause`; el frontend renderiza `causeLabel` cuando viene
 * embebido en la respuesta.
 */
export type DeathCause =
  | 'DISEASE'
  | 'ACCIDENT'
  | 'PREDATOR_ATTACK'
  | 'DROWNING'
  | 'OLD_AGE'
  | 'SLAUGHTER'
  | 'NATURAL_DISASTER'
  | 'UNKNOWN'
  | 'OTHER';

export const DeathCause = {
  DISEASE:          'DISEASE',
  ACCIDENT:         'ACCIDENT',
  PREDATOR_ATTACK:  'PREDATOR_ATTACK',
  DROWNING:         'DROWNING',
  OLD_AGE:          'OLD_AGE',
  SLAUGHTER:        'SLAUGHTER',
  NATURAL_DISASTER: 'NATURAL_DISASTER',
  UNKNOWN:          'UNKNOWN',
  OTHER:            'OTHER',
} as const;

/**
 * Razon de salida del inventario activo (Backend X-04). Permite distinguir
 * muerte de venta, transferencia, sacrificio sanitario o soft-delete por
 * error humano. El frontend mira esto para decidir si mostrar el banner
 * "Fallecido" (solo cuando `exitReason === 'DECEASED'`).
 */
export type BovineExitReason =
  | 'DECEASED'
  | 'SOLD'
  | 'TRANSFERRED'
  | 'CULLED'
  | 'DELETED_ERROR';

/**
 * Bloque `death` que el backend embebe en `BovineFullResponse` cuando el
 * bovino esta fallecido. Si esta vivo el campo viene `null`. Backend trae
 * `causeLabel` ya en espanol (death.labels.ts).
 */
export interface BovineDeathRecord {
  deathDate:          string;             // ISO
  cause:              DeathCause;
  causeLabel:         string;             // ya traducido
  diseaseId:          string | null;
  diseaseCaseId:      string | null;      // link al caso si cause=DISEASE
  locationId:         string | null;
  weightAtDeath:      number | null;
  slaughterValue:     number | null;      // solo si cause=SLAUGHTER
  necropsyPerformed:  boolean;
  necropsyResults:    string | null;
  notes:              string | null;
}

/**
 * Payload del `POST /api/bovines/:id/decease` (Backend X-03). Errores
 * comunes que la UI debe manejar:
 *   - 409 ALREADY_DECEASED       → el bovino ya esta fallecido
 *   - 400 MISSING_DEATH_CAUSE    → falta `cause`
 *   - 400 INVALID_DEATH_DATE     → fecha futura o anterior a nacimiento
 */
export interface DeceaseBovineInput {
  cause:              DeathCause;
  deathDate:          string;             // ISO date "YYYY-MM-DD" o ISO datetime
  weightAtDeath?:     number;
  /** Solo se incluye cuando `cause === 'SLAUGHTER'`. */
  slaughterValue?:    number;
  necropsyPerformed?: boolean;
  necropsyResults?:   string;
  notes?:             string;
  /** Si cause=DISEASE, link al caso clinico que termino en muerte. */
  diseaseCaseId?:     string;
  /** Ubicacion donde ocurrio (default = potrero actual del bovino). */
  locationId?:        string;
}

// ── Reporte de mortalidad (Backend X-07) ────────────────────────────────────

export type MortalityGroupBy = 'cause' | 'month' | 'location';

export interface MortalityGroupItem {
  /** Codigo crudo del grupo: cause string, YYYY-MM, o locationId. */
  key:        string;
  /** Label legible. Para `cause` ya viene en espanol; para `location`
   *  trae el nombre del potrero; para `month` viene formateado. */
  label:      string;
  count:      number;
  percentage: number;
}

export interface MortalityReport {
  total:    number;
  groupBy:  MortalityGroupBy;
  groups:   MortalityGroupItem[];
  /** Rango efectivo que el backend uso (echo de los query params). */
  from?:    string;
  to?:      string;
}

export interface MortalityReportFilters {
  /** YYYY-MM-DD. Default backend: hace 12 meses. */
  from?:    string;
  /** YYYY-MM-DD. Default backend: hoy. */
  to?:      string;
  /** Default backend: 'cause'. */
  groupBy?: MortalityGroupBy;
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
  /**
   * Backend L-01: si el potrero destino esta lleno (`currentOccupancy >= maxAnimals`)
   * el backend devuelve 409 BOVINE_LOCATION_FULL. Reenviar con `forceOverride: true`
   * lo omite — uso reservado para casos clinicos (cuarentena, parto, decomiso) donde
   * la capacidad debe excederse temporalmente. La accion queda en el log del backend.
   */
  forceOverride?: boolean;
}

/**
 * Envelope de respuesta del `PATCH /api/bovines/:id/location` (Backend L-04).
 *
 * El backend agrega dos flags top-level junto al envelope estandar:
 *   - `wasNoOp`         : true cuando el destino coincidia con la estancia activa
 *                          (no se creo registro, GPS si se actualizo si vino).
 *   - `locationChanged` : true cuando si hubo cambio real de potrero. Util para
 *                          decidir si invalidar caches de ubicacion / mapa.
 *
 * Cuando se consume desde axios, los flags llegan en `res.data.wasNoOp` y
 * `res.data.locationChanged` (axios envuelve el body http en `res.data`).
 */
export interface MoveBovineResponse extends ApiSuccessResponse<BovineDetailResponse> {
  wasNoOp: boolean;
  locationChanged: boolean;
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
// RISK SCORE (E-05 — GET /api/bovines/:id/risk-score)
// ────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BovineRiskFactor {
  factor: string;
  points: number;
}

export interface BovineRiskScore {
  bovineId:  string;
  riskScore: number;
  level:     RiskLevel;
  factors:   BovineRiskFactor[];
}

// ────────────────────────────────────────────────────────────────────────────
// VACCINATION SCHEDULE CATALOG (Módulo 11 — GET/POST/PATCH/DELETE /api/vaccination-schedules)
// ────────────────────────────────────────────────────────────────────────────

/** Una entrada del calendario base de vacunación. */
export interface VaccinationScheduleEntry {
  id: string;
  vaccineType: VaccineType;
  /** Edad mínima (meses) a partir de la cual aplica. */
  fromAgeMonths: number;
  /** Edad máxima (meses); null = sin tope. */
  toAgeMonths?: number | null;
  /** Frecuencia de revacunación en meses; null/0 = dosis única. */
  frequencyMonths?: number | null;
  /** Si es obligatoria (afecta cálculo de PENDING) o solo recomendada. */
  isRequired: boolean;
  /** Sexo al que aplica; null = ambos. */
  genderFilter?: string | null;
  /** Raza a la que aplica (texto libre); null = todas. */
  breedFilter?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaccinationScheduleInput {
  vaccineType: VaccineType;
  fromAgeMonths: number;
  toAgeMonths?: number | null;
  frequencyMonths?: number | null;
  isRequired?: boolean;
  genderFilter?: string | null;
  breedFilter?: string | null;
  notes?: string | null;
}

export interface UpdateVaccinationScheduleInput {
  vaccineType?: VaccineType;
  fromAgeMonths?: number;
  toAgeMonths?: number | null;
  frequencyMonths?: number | null;
  isRequired?: boolean;
  genderFilter?: string | null;
  breedFilter?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// END OF DTOs
// ────────────────────────────────────────────────────────────────────────────
