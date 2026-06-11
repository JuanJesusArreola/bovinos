/**
 * DTOs del módulo de Enfermedades (Fase 1 del backend).
 *
 * Mirrors:
 *   - Backend `Disease`            → `DiseaseResponse`
 *   - Backend `Symptom`            → `SymptomResponse`
 *   - Backend `TransmissionMethod` → `TransmissionMethodResponse`
 *
 * Endpoints relacionados:
 *   - GET    /api/diseases                     → DiseaseListResponse
 *   - GET    /api/diseases/:id                 → DiseaseDetailResponse
 *   - POST   /api/diseases                     → CreateDiseaseInput
 *   - GET    /api/diseases/:id/symptoms        → SymptomResponse[]
 *   - GET    /api/diseases/:id/transmission    → TransmissionMethodResponse[]
 */

// ── Enums ───────────────────────────────────────────────────────────────────

export type DiseaseCategory =
  | 'BACTERIAL' | 'VIRAL' | 'PARASITIC' | 'FUNGAL'
  | 'METABOLIC' | 'GENETIC' | 'OTHER';

export const DiseaseCategory = {
  BACTERIAL:  'BACTERIAL',
  VIRAL:      'VIRAL',
  PARASITIC:  'PARASITIC',
  FUNGAL:     'FUNGAL',
  METABOLIC:  'METABOLIC',
  GENETIC:    'GENETIC',
  OTHER:      'OTHER',
} as const;

export type DiseaseSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export const DiseaseSeverity = {
  LOW:      'LOW',
  MODERATE: 'MODERATE',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

/** Ruta de transmisión de la enfermedad. */
export type TransmissionRoute =
  | 'DIRECT' | 'AIRBORNE' | 'WATERBORNE' | 'VECTOR'
  | 'FOMITE' | 'VERTICAL' | 'SEXUAL' | 'OTHER';

// ── Sub-types ───────────────────────────────────────────────────────────────

export interface SymptomResponse {
  id:           string;
  name:         string;
  description?: string;
}

export interface TransmissionMethodResponse {
  id:           string;
  name:         string;
  route:        TransmissionRoute | string;
  description?: string;
}

// ── Media (Fase 1b) ─────────────────────────────────────────────────────────
//
// Endpoints:
//   POST   /api/diseases/:diseaseId/media           (multipart, campo "file")
//   POST   /api/diseases/:diseaseId/media/url       (registrar URL externa)
//   GET    /api/diseases/:diseaseId/media           (listar)
//   PATCH  /api/diseases/:diseaseId/media/:id       (editar metadatos)
//   DELETE /api/diseases/:diseaseId/media/:id       (eliminar + archivo físico)
//
// `GET /api/diseases/:slug` y `/with-symptoms` ya incluyen `media[]` eager-
// loaded, así que la página de detalle puede pintar el grid sin fetch extra.
// El GET dedicado se usa al gestionar (modal CRUD).

export type DiseaseMediaType = 'IMAGE' | 'VIDEO';

export interface DiseaseMediaResponse {
  id:            string;
  diseaseId?:    string;
  /** Si la imagen ilustra un síntoma concreto del catálogo. */
  symptomId?:    string | null;
  symptomName?:  string | null;
  /**
   * URL de visualización. Si fue subida a R2 → absoluta (`https://pub-xxx.r2.dev/...`).
   * Para entradas antiguas en disco local viene como path relativo
   * (`/files/diseases/uuid.png`); el adapter en `diseases.api.ts` la
   * resuelve a absoluta usando el origen de `API_URL`.
   */
  url:           string;
  thumbnailUrl?: string | null;
  /** `null` para entradas externas (sin archivo en R2). */
  storagePath?:  string | null;
  /** Enum semántico del backend. `mimeType` da más detalle cuando existe. */
  mediaType?:    DiseaseMediaType | string;
  mimeType:      string;
  /** Backend lo llama `sizeBytes`. Mantenemos `size` como alias en el adapter. */
  size?:         number | null;
  sizeBytes?:    number | null;
  filename?:     string | null;
  title?:        string | null;
  /**
   * Texto descriptivo. Backend de diseases lo expone como `description`;
   * el adapter también lo copia a `caption` para que `MediaGallery`
   * (bovine/ranch convention) funcione sin tocarlo.
   */
  description?:  string | null;
  caption?:      string | null;
  /** Orden de visualización. Backend devuelve siempre el listado ordenado. */
  displayOrder?: number;
  /** "Es imagen de referencia oficial" (e.g. SENASICA / FAO). */
  isReference?:  boolean;
  /** Fuente bibliográfica (texto libre). */
  source?:       string | null;
  /** Backend lo expone como `createdAt`. Alias `uploadedAt` también disponible. */
  createdAt?:    string;
  uploadedAt?:   string;
  uploadedBy?:   string | null;
}

/**
 * Campos editables vía PATCH /diseases/:diseaseId/media/:mediaId.
 * El archivo en sí NO se cambia desde este endpoint — solo metadatos.
 */
export interface UpdateDiseaseMediaInput {
  title?:        string | null;
  description?:  string | null;
  displayOrder?: number;
  isReference?:  boolean;
  source?:       string | null;
  /** `null` desvincula la imagen del síntoma actual. */
  symptomId?:    string | null;
}

/**
 * Body para registrar una URL externa (POST /diseases/:diseaseId/media/url).
 *
 * ⚠️ El campo obligatorio se llama `externalUrl` (NO `url`) — convención del
 * backend para distinguir explícitamente este flujo del upload multipart.
 */
export interface AddDiseaseMediaUrlInput {
  externalUrl:   string;
  thumbnailUrl?: string;
  title?:        string;
  description?:  string;
  mediaType?:    DiseaseMediaType;
  /** Opcional — backend lo infiere de la extensión si no se pasa. */
  mimeType?:     string;
  isReference?:  boolean;
  source?:       string;
  displayOrder?: number;
  symptomId?:    string;
}

/**
 * Campos opcionales que el upload multipart acepta como form fields,
 * además del archivo en sí. Cada uno se envía si está presente.
 */
export interface UploadDiseaseMediaOptions {
  title?:        string;
  description?:  string;
  isReference?:  boolean;
  source?:       string;
  displayOrder?: number;
  symptomId?:    string;
}

// ── List response (lite, sin nested data) ───────────────────────────────────

export interface DiseaseListItem {
  id:                     string;
  name:                   string;
  slug:                   string;
  description?:           string;
  category:               DiseaseCategory;
  severity:               DiseaseSeverity;
  isContagious:           boolean;
  isZoonotic:             boolean;
  defaultQuarantineDays?: number;
  incubationDaysMin?:     number;
  incubationDaysMax?:     number;
  recommendedAction?:     string;
  affectedSystems?:       string[];
  isActive:               boolean;
}

// ── Detail response (con síntomas + transmisión eager-loaded) ───────────────

export interface DiseaseDetailResponse extends DiseaseListItem {
  symptoms:             SymptomResponse[];
  transmissionMethods:  TransmissionMethodResponse[];
  aliases?:             string[];
  /** Imágenes/videos del catálogo. Eager-loaded en `/:slug` y `/with-symptoms`. */
  media?:               DiseaseMediaResponse[];
}

// ── Filtros del listado ─────────────────────────────────────────────────────

export interface DiseaseListFilters {
  search?:        string;
  category?:      DiseaseCategory;
  severity?:      DiseaseSeverity;
  isContagious?:  boolean;
  isZoonotic?:    boolean;
  page?:          number;
  limit?:         number;
}

// ── Create / Update input ───────────────────────────────────────────────────

export interface CreateDiseaseInput {
  name:                   string;
  description?:           string;
  category:               DiseaseCategory;
  severity:               DiseaseSeverity;
  isContagious:           boolean;
  isZoonotic:             boolean;
  defaultQuarantineDays?: number;
  incubationDaysMin?:     number;
  incubationDaysMax?:     number;
  recommendedAction?:     string;
  affectedSystems?:       string[];
  aliases?:               string[];
  /** IDs de síntomas y transmisión del catálogo global a asociar. */
  symptomIds?:            string[];
  transmissionMethodIds?: string[];
}

export type UpdateDiseaseInput = Partial<CreateDiseaseInput>;

// ── Envelope estándar ───────────────────────────────────────────────────────

export interface ApiPagination {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext?:   boolean;
  hasPrev?:   boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data:    T;
}

export interface PaginatedResponse<T> {
  success:    true;
  data:       T[];
  pagination: ApiPagination;
}
