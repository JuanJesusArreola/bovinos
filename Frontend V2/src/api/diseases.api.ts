/**
 * API client del módulo de Enfermedades (Fase 1 del backend).
 *
 * Endpoints:
 *   GET  /api/diseases                  → list paginated
 *   GET  /api/diseases/:id              → detail (incluye síntomas + transmisión)
 *   POST /api/diseases                  → create (solo SUPER_ADMIN)
 *   GET  /api/diseases/:id/symptoms     → síntomas asociados
 *   GET  /api/diseases/:id/transmission → métodos de transmisión asociados
 *
 * Catálogo público para todos los usuarios autenticados (informacional).
 * Crear/editar requiere rol SUPER_ADMIN.
 */

import apiClient from './client';
import { API_URL } from '@/utils/constants';
import type {
  ApiSuccessResponse,
  PaginatedResponse,
  DiseaseListItem,
  DiseaseDetailResponse,
  DiseaseListFilters,
  CreateDiseaseInput,
  UpdateDiseaseInput,
  SymptomResponse,
  TransmissionMethodResponse,
  DiseaseMediaResponse,
  UpdateDiseaseMediaInput,
  AddDiseaseMediaUrlInput,
  UploadDiseaseMediaOptions,
} from '@/types/disease.dtos';

// ─── Normalización defensiva del shape del detalle ──────────────────────────
//
// El backend devuelve el detalle con las relaciones tal como salen de Sequelize:
//   - `aliases`:           [{ id, alias }]            ← objetos, no strings
//   - `diseaseSymptoms`:   [{ id, relevance, symptom: { id, name, ... } }]
//                          ← nested, NO un array plano de `symptoms`
//   - `transmissionMethods`: a veces ausente (eager-load opcional)
//
// El frontend asumía siempre un shape "limpio" plano (string[], SymptomResponse[],
// TransmissionMethodResponse[]). Cuando llegaban undefined o nested, el render
// crasheaba en `disease.symptoms.length` → pantalla en blanco.
//
// Esta función normaliza ambos formatos antes de devolverlos a los consumers,
// de modo que `DiseaseDetailResponse` siga siendo la única SSOT y la UI no
// tenga que conocer la peculiaridad del backend.
function normalizeDiseaseDetail(raw: any): DiseaseDetailResponse {
  if (!raw || typeof raw !== 'object') return raw;

  // ── aliases: [{id, alias}] | string[] | undefined → string[] ────────────
  let aliases: string[] | undefined;
  if (Array.isArray(raw.aliases)) {
    aliases = raw.aliases
      .map((a: any) => (typeof a === 'string' ? a : a?.alias))
      .filter((s: unknown): s is string => typeof s === 'string' && s.length > 0);
  }

  // ── symptoms: aplanar `diseaseSymptoms[].symptom` o respetar si ya viene
  // como `symptoms` plano. Robustez ante ambos formatos por si el backend
  // cambia más adelante.
  let symptoms: SymptomResponse[] = [];
  if (Array.isArray(raw.symptoms)) {
    symptoms = raw.symptoms;
  } else if (Array.isArray(raw.diseaseSymptoms)) {
    symptoms = raw.diseaseSymptoms
      .map((ds: any): SymptomResponse | null => {
        const s = ds?.symptom;
        if (!s || !s.id || !s.name) return null;
        return { id: s.id, name: s.name, description: s.description };
      })
      .filter((s: SymptomResponse | null): s is SymptomResponse => s !== null);
  }

  // ── transmissionMethods: idem — soporta nested (`diseaseTransmissions`)
  // o plano, y default a [] si no viene. El detalle es opcional en el
  // backend actual (eager-load no garantizado), así que aceptamos su
  // ausencia sin romper la UI.
  let transmissionMethods: TransmissionMethodResponse[] = [];
  if (Array.isArray(raw.transmissionMethods)) {
    transmissionMethods = raw.transmissionMethods;
  } else if (Array.isArray(raw.diseaseTransmissions)) {
    transmissionMethods = raw.diseaseTransmissions
      .map((dt: any): TransmissionMethodResponse | null => {
        const t = dt?.transmissionMethod ?? dt?.transmission;
        if (!t || !t.id || !t.name) return null;
        return { id: t.id, name: t.name, route: t.route ?? 'OTHER', description: t.description };
      })
      .filter((t: TransmissionMethodResponse | null): t is TransmissionMethodResponse => t !== null);
  }

  // ── media: array de DiseaseMediaResponse normalizado (URL absoluta,
  // alias de campos del backend → shape esperado por la UI).
  const media: DiseaseMediaResponse[] = Array.isArray(raw.media)
    ? raw.media.map(normalizeDiseaseMedia)
    : [];

  return { ...raw, aliases, symptoms, transmissionMethods, media };
}

// ─── Helpers de media ───────────────────────────────────────────────────────
//
// El backend de media tiene 3 peculiaridades respecto al shape que asumía
// la UI inicialmente:
//
//   1. `url` viene como path RELATIVO (e.g. `/files/diseases/abc.png`).
//      El <img> lo resolvería contra el origen del frontend (5173) y
//      daría 404. Hay que prefijarlo con el origen del API (5000).
//
//   2. Llama al campo `description`; mi DTO usa `caption` (alineado con
//      bovine/ranch media). Lo aliasamos para que `MediaGallery` y la
//      vista inline lean lo mismo independientemente del entityType.
//
//   3. NO devuelve `mimeType`, sino un enum `mediaType: 'IMAGE'|'VIDEO'|…`.
//      `MediaGallery` decide imagen-vs-documento con `isImageMime(mimeType)`.
//      Mapeamos `mediaType` → un `mimeType` representativo (`image/*` /
//      `video/*`) para que la clasificación siga funcionando sin tocar
//      el componente compartido.

/**
 * Convierte un path relativo del backend (e.g. `/files/...`) a una URL
 * absoluta usando el origen de `API_URL`. URLs ya absolutas (http/https
 * o data/blob) se devuelven tal cual.
 */
function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  // Ya es absoluta (http, https, data:, blob:) — la dejamos.
  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  try {
    // `API_URL` es e.g. `http://localhost:5000/api`. Necesitamos el ORIGIN
    // (`http://localhost:5000`) porque `/files/...` cuelga del root del
    // backend, no del prefijo `/api`.
    const origin = new URL(API_URL).origin;
    return origin + (url.startsWith('/') ? url : `/${url}`);
  } catch {
    return url;
  }
}

/** Mapea el enum `mediaType` del backend a un MIME representativo. */
function mediaTypeToMime(mediaType: unknown, fallbackUrl: string): string {
  if (typeof mediaType === 'string') {
    const up = mediaType.toUpperCase();
    if (up === 'IMAGE' || up === 'PHOTO') return 'image/*';
    if (up === 'VIDEO') return 'video/*';
    if (up === 'AUDIO') return 'audio/*';
    if (up === 'DOCUMENT' || up === 'PDF') return 'application/pdf';
  }
  // Fallback por extensión de la URL.
  if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fallbackUrl)) return 'image/*';
  if (/\.(mp4|webm|mov|avi|mkv)$/i.test(fallbackUrl))       return 'video/*';
  if (/\.pdf$/i.test(fallbackUrl))                          return 'application/pdf';
  return 'application/octet-stream';
}

/**
 * Normaliza UN item de media del backend al shape esperado por la UI.
 *
 * El backend de diseases tiene su propia convención de campos:
 *   - `description` (no `caption`)            → exponemos AMBOS
 *   - `sizeBytes`   (no `size`)               → exponemos AMBOS
 *   - `createdAt`   (no `uploadedAt`)         → exponemos AMBOS
 *   - `mediaType`+`mimeType`                  → garantizamos `mimeType` siempre
 *   - URL puede ser absoluta (R2) o relativa  → resolvemos a absoluta
 *
 * Mantenemos los campos antiguos (`caption`, `size`, `uploadedAt`) como
 * alias para que `MediaGallery` (que sigue convención de bovine/ranch)
 * funcione sin tocar el componente compartido.
 */
function normalizeDiseaseMedia(raw: any): DiseaseMediaResponse {
  if (!raw || typeof raw !== 'object') return raw;
  const url         = resolveMediaUrl(raw.url);
  const thumb       = resolveMediaUrl(raw.thumbnailUrl);
  const mimeType    = raw.mimeType ?? mediaTypeToMime(raw.mediaType, url);
  const description = raw.description ?? raw.caption ?? null;
  const sizeBytes   = raw.sizeBytes ?? raw.size ?? null;
  const createdAt   = raw.createdAt ?? raw.uploadedAt;

  return {
    id:           raw.id,
    diseaseId:    raw.diseaseId,
    symptomId:    raw.symptomId ?? null,
    symptomName:  raw.symptomName ?? null,
    url,
    thumbnailUrl: thumb || null,
    storagePath:  raw.storagePath ?? null,
    mediaType:    raw.mediaType,
    mimeType,
    filename:     raw.filename ?? null,
    size:         sizeBytes,
    sizeBytes,
    title:        raw.title ?? null,
    description,
    caption:      description, // alias para MediaGallery
    displayOrder: raw.displayOrder,
    isReference:  raw.isReference ?? false,
    source:       raw.source ?? null,
    createdAt,
    uploadedAt:   createdAt, // alias
    uploadedBy:   raw.uploadedBy ?? null,
  };
}

export const diseasesApi = {
  list: (filters: DiseaseListFilters = {}) =>
    apiClient.get<PaginatedResponse<DiseaseListItem>>('/diseases', { params: filters }),

  getById: async (id: string) => {
    const res = await apiClient.get<ApiSuccessResponse<DiseaseDetailResponse>>(`/diseases/${id}`);
    return { ...res, data: { ...res.data, data: normalizeDiseaseDetail(res.data.data) } };
  },

  create: async (data: CreateDiseaseInput) => {
    const res = await apiClient.post<ApiSuccessResponse<DiseaseDetailResponse>>('/diseases', data);
    return { ...res, data: { ...res.data, data: normalizeDiseaseDetail(res.data.data) } };
  },

  update: async (id: string, data: UpdateDiseaseInput) => {
    const res = await apiClient.patch<ApiSuccessResponse<DiseaseDetailResponse>>(`/diseases/${id}`, data);
    return { ...res, data: { ...res.data, data: normalizeDiseaseDetail(res.data.data) } };
  },

  getSymptoms: (id: string) =>
    apiClient.get<ApiSuccessResponse<SymptomResponse[]>>(`/diseases/${id}/symptoms`),

  getTransmission: (id: string) =>
    apiClient.get<ApiSuccessResponse<TransmissionMethodResponse[]>>(`/diseases/${id}/transmission`),

  /**
   * Resolver una entrada por slug.
   *
   * Implementación defensiva: el backend documentado expone `/diseases/:id`
   * con UUID; no consta una ruta `/by-slug/:slug` oficial. En vez de asumir
   * que `:id` acepta slugs (depende del middleware), hacemos un `list` con
   * `search=slug, limit=5` y filtramos por `slug` exacto en cliente.
   *
   * Si más adelante el backend expone `/diseases/by-slug/:slug`, podemos
   * cambiar esta función por una sola llamada sin tocar los hooks que la
   * consumen — `useDiseaseBySlug` seguirá funcionando igual.
   */
  getBySlug: async (slug: string) => {
    const res = await apiClient.get<PaginatedResponse<DiseaseListItem>>('/diseases', {
      params: { search: slug, limit: 5, page: 1 },
    });
    const match = res.data.data.find((d) => d.slug === slug);
    if (!match) return null;
    // El `list` devuelve `DiseaseListItem` (sin symptoms/transmission),
    // por eso encadenamos un getById para traer el detalle completo.
    const detail = await apiClient.get<ApiSuccessResponse<DiseaseDetailResponse>>(
      `/diseases/${match.id}`,
    );
    // Aplicamos el normalizador igual que en `getById` — el shape crudo
    // tiene `diseaseSymptoms[].symptom` y `aliases[{alias}]`.
    return normalizeDiseaseDetail(detail.data.data);
  },

  // ── Media (Fase 1b) ───────────────────────────────────────────────────────

  /** Lista las media asociadas a una enfermedad — URLs ya absolutas. */
  listMedia: async (diseaseId: string) => {
    const res = await apiClient.get<ApiSuccessResponse<DiseaseMediaResponse[]>>(
      `/diseases/${diseaseId}/media`,
    );
    const items = Array.isArray(res.data.data) ? res.data.data.map(normalizeDiseaseMedia) : [];
    return { ...res, data: { ...res.data, data: items } };
  },

  /**
   * Subir un archivo (imagen/video). Multipart form-data con campo `"file"`.
   * Resto de campos van como form fields adicionales. Validaciones del
   * backend: máx 50 MB, solo tipos permitidos (image/* y video/* comunes).
   *
   * Compat: aceptamos `caption` (convención antigua de MediaGallery) además
   * de `description` y los unificamos en el field `description` que es lo
   * que el backend espera.
   */
  uploadMedia: async (
    diseaseId: string,
    file: File,
    opts?: UploadDiseaseMediaOptions & { caption?: string },
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts?.title)        fd.append('title',        opts.title);
    // `caption` o `description` → campo `description` del backend.
    const desc = opts?.description ?? opts?.caption;
    if (desc)               fd.append('description',  desc);
    if (opts?.isReference != null) fd.append('isReference', String(opts.isReference));
    if (opts?.source)       fd.append('source',       opts.source);
    if (opts?.displayOrder != null) fd.append('displayOrder', String(opts.displayOrder));
    if (opts?.symptomId)    fd.append('symptomId',    opts.symptomId);

    const res = await apiClient.post<ApiSuccessResponse<DiseaseMediaResponse>>(
      `/diseases/${diseaseId}/media`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return { ...res, data: { ...res.data, data: normalizeDiseaseMedia(res.data.data) } };
  },

  /** Registra una URL externa como media (sin upload de archivo). */
  addMediaUrl: async (diseaseId: string, data: AddDiseaseMediaUrlInput) => {
    const res = await apiClient.post<ApiSuccessResponse<DiseaseMediaResponse>>(
      `/diseases/${diseaseId}/media/url`,
      data,
    );
    return { ...res, data: { ...res.data, data: normalizeDiseaseMedia(res.data.data) } };
  },

  /** Editar metadatos (title/caption). NO cambia el archivo en sí. */
  updateMedia: async (diseaseId: string, mediaId: string, data: UpdateDiseaseMediaInput) => {
    const res = await apiClient.patch<ApiSuccessResponse<DiseaseMediaResponse>>(
      `/diseases/${diseaseId}/media/${mediaId}`,
      data,
    );
    return { ...res, data: { ...res.data, data: normalizeDiseaseMedia(res.data.data) } };
  },

  /** Elimina la entrada + archivo físico si lo tenía. */
  deleteMedia: (diseaseId: string, mediaId: string) =>
    apiClient.delete<ApiSuccessResponse<{ removed: boolean }>>(
      `/diseases/${diseaseId}/media/${mediaId}`,
    ),
};
