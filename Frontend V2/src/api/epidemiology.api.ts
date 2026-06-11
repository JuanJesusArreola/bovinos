/**
 * API client del módulo de Epidemiología (Fases 4 y 5 del backend).
 *
 * Fase 4 — Snapshots nocturnos (métricas agregadas por rancho × enfermedad):
 *   GET  /api/epidemiology/snapshots             → histórico filtrable
 *   GET  /api/epidemiology/snapshots/latest      → último snapshot por (ranch, disease)
 *   GET  /api/epidemiology/top-diseases/:ranchId → top-N enfermedades activas
 *   GET  /api/epidemiology/trend/:ranchId        → serie temporal para charts
 *   POST /api/epidemiology/compute               → trigger manual (solo SUPER_ADMIN)
 *
 * Fase 5 — Brotes y contact tracing:
 *   GET  /api/epidemiology/outbreak/:ranchId/:diseaseId
 *   POST /api/epidemiology/cases/:caseId/detect-contacts
 *   GET  /api/epidemiology/cases/:caseId/contacts
 *
 * ⚠️ Convención del backend para snapshots "globales" del rancho
 * (es decir, agregados de todas las enfermedades): el filtro `diseaseId`
 * acepta la cadena literal `"null"` — NO se omite el parámetro. Omitirlo
 * significa "no filtrar por enfermedad", mientras que `diseaseId=null`
 * significa "solo el snapshot global del rancho".
 */

import apiClient from './client';
import type {
  ApiSuccessResponse,
  PaginatedResponse,
} from '@/types/disease.dtos';
import type {
  EpidemiologySnapshot,
  SnapshotFilters,
  TopDiseaseItem,
  TrendPoint,
  OutbreakResponse,
  DetectContactsResult,
  CaseContactsResponse,
  ComputeEpidemiologyInput,
  HerdHealthIndex,
  CreateManualContactInput,
  CaseContactLink,
  EpidemiologyAlert,
  AlertFilters,
  AlertStatus,
  EpidemiologyHeatmapCell,
  EpidemiologyHeatmapFilters,
} from '@/types/epidemiology.dtos';

export const epidemiologyApi = {
  // ── Fase 4: snapshots ─────────────────────────────────────────────────────
  listSnapshots: (filters: SnapshotFilters = {}) =>
    apiClient.get<PaginatedResponse<EpidemiologySnapshot>>('/epidemiology/snapshots', {
      params: filters,
    }),

  getLatestSnapshots: (filters: Pick<SnapshotFilters, 'ranchId' | 'diseaseId'> = {}) =>
    apiClient.get<ApiSuccessResponse<EpidemiologySnapshot[]>>('/epidemiology/snapshots/latest', {
      params: filters,
    }),

  getTopDiseases: (ranchId: string, params: { limit?: number } = {}) =>
    apiClient.get<ApiSuccessResponse<TopDiseaseItem[]>>(
      `/epidemiology/top-diseases/${ranchId}`,
      { params },
    ),

  /**
   * Serie temporal para charts (recharts).
   * @param ranchId  UUID del rancho
   * @param params.diseaseId  UUID de enfermedad o `"null"` (string literal) para serie global
   * @param params.days       ventana en días (default backend = 30)
   */
  getTrend: (
    ranchId: string,
    params: { diseaseId?: string | 'null'; days?: number } = {},
  ) =>
    apiClient.get<ApiSuccessResponse<TrendPoint[]>>(`/epidemiology/trend/${ranchId}`, {
      params,
    }),

  /** Trigger manual de recálculo nocturno (solo SUPER_ADMIN). */
  compute: (data: ComputeEpidemiologyInput = {}) =>
    apiClient.post<ApiSuccessResponse<{ processed: number; date: string }>>(
      '/epidemiology/compute',
      data,
    ),

  // ── Fase 5: outbreaks ─────────────────────────────────────────────────────
  getOutbreak: (ranchId: string, diseaseId: string) =>
    apiClient.get<ApiSuccessResponse<OutbreakResponse>>(
      `/epidemiology/outbreak/${ranchId}/${diseaseId}`,
    ),

  // ── Fase 5: contact tracing ───────────────────────────────────────────────
  /**
   * Detecta contactos epidemiológicos para un caso (idempotente).
   * Re-ejecutarlo NO duplica enlaces — sólo crea los nuevos.
   * Cada item devuelto trae `isNew: boolean` para diferenciar.
   */
  detectContacts: (caseId: string) =>
    apiClient.post<DetectContactsResult>(
      `/epidemiology/cases/${caseId}/detect-contacts`,
    ),

  /** Lee la red de contactos persistida de un caso (asSource + asTarget). */
  getCaseContacts: (caseId: string) =>
    apiClient.get<ApiSuccessResponse<CaseContactsResponse>>(
      `/epidemiology/cases/${caseId}/contacts`,
    ),

  // ── Backend E-02 / Modulo 10: Herd Health Index ───────────────────────────
  /**
   * Indice ejecutivo de salud del hato: score 0-100, desglose por status y
   * cobertura vacunal. Pensado como hero KPI del dashboard epidemiologico.
   */
  getHerdHealthIndex: (ranchId: string) =>
    apiClient.get<ApiSuccessResponse<HerdHealthIndex>>(
      `/epidemiology/herd-health/${ranchId}`,
    ),

  // ── Backend E-07 / Modulo 10: contactos manuales ──────────────────────────
  /**
   * Captura manual de un contacto (DIRECT_CONTACT / SHARED_WATER /
   * SHARED_PASTURE) entre un caso fuente y un bovino o caso destino.
   * Util para contactos NO co-localizados que el motor automatico no
   * detecta (ej: contacto en feria ganadera, transporte compartido).
   * Backend marca `detectedBy=MANUAL` y deduplica.
   */
  createManualContact: (data: CreateManualContactInput) =>
    apiClient.post<ApiSuccessResponse<CaseContactLink>>(
      '/epidemiology/contacts',
      data,
    ),

  // ── Alertas epidemiológicas (NEW-3) ──────────────────────────────────────
  getAlerts: (filters: AlertFilters = {}) =>
    apiClient.get<ApiSuccessResponse<EpidemiologyAlert[]>>('/epidemiology/alerts', {
      params: filters,
    }),

  updateAlert: (id: string, data: { status: AlertStatus }) =>
    apiClient.patch<ApiSuccessResponse<EpidemiologyAlert>>(
      `/epidemiology/alerts/${id}`,
      data,
    ),

  // ── Heatmap epidemiológico (NEW-2) ────────────────────────────────────────
  getEpidemiologyHeatmap: (params: EpidemiologyHeatmapFilters) =>
    apiClient.get<ApiSuccessResponse<EpidemiologyHeatmapCell[]>>(
      '/epidemiology/heatmap',
      { params },
    ),
};
