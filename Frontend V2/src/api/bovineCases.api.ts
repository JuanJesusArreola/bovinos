/**
 * API client del módulo de Casos Clínicos (Fase 2 del backend).
 *
 * Ciclo de vida del caso:
 *   SUSPECTED → CONFIRMED → RECOVERING → RECOVERED | DECEASED | DISCARDED
 *
 * Endpoints:
 *   POST   /api/bovine-cases                            → crear caso
 *   GET    /api/bovine-cases                            → listar (filtros + paginación)
 *   GET    /api/bovine-cases/:id                        → detalle (sub-collections eager)
 *   PATCH  /api/bovine-cases/:id                        → actualizar status / severity / notes
 *   POST   /api/bovine-cases/:id/close                  → cerrar con outcome
 *   POST   /api/bovine-cases/:id/symptoms               → añadir síntoma observado
 *   DELETE /api/bovine-cases/:id/symptoms/:symptomId    → quitar síntoma
 *   POST   /api/bovine-cases/:id/treatments             → registrar tratamiento aplicado
 *   POST   /api/bovine-cases/:id/lab-tests              → solicitar laboratorio
 *   PATCH  /api/bovine-cases/lab-tests/:labTestId       → registrar resultado de lab
 */

import apiClient from './client';
import type {
  ApiSuccessResponse,
  PaginatedResponse,
} from '@/types/disease.dtos';
import type {
  BovineCaseListItem,
  BovineCaseDetailResponse,
  BovineCaseFilters,
  CreateBovineCaseInput,
  UpdateBovineCaseInput,
  CloseBovineCaseInput,
  AddCaseSymptomInput,
  AddCaseTreatmentInput,
  AddCaseLabTestInput,
  UpdateLabTestResultInput,
  CaseSymptomResponse,
  CaseTreatmentResponse,
  CaseLabTestResponse,
} from '@/types/bovineCase.dtos';

/**
 * Serializa filtros de array (status, severity) como CSV — convención del backend.
 *   `status: ['CONFIRMED', 'RECOVERING']` → `?status=CONFIRMED,RECOVERING`
 */
function serializeCaseFilters(filters: BovineCaseFilters): Record<string, unknown> {
  const { status, severity, ...rest } = filters;
  return {
    ...rest,
    ...(status?.length   ? { status:   status.join(',') }   : {}),
    ...(severity?.length ? { severity: severity.join(',') } : {}),
  };
}

export const bovineCasesApi = {
  list: (filters: BovineCaseFilters = {}) =>
    apiClient.get<PaginatedResponse<BovineCaseListItem>>('/bovine-cases', {
      params: serializeCaseFilters(filters),
    }),

  getById: (id: string) =>
    apiClient.get<ApiSuccessResponse<BovineCaseDetailResponse>>(`/bovine-cases/${id}`),

  create: (data: CreateBovineCaseInput) =>
    apiClient.post<ApiSuccessResponse<BovineCaseDetailResponse>>('/bovine-cases', data),

  update: (id: string, data: UpdateBovineCaseInput) =>
    apiClient.patch<ApiSuccessResponse<BovineCaseDetailResponse>>(`/bovine-cases/${id}`, data),

  close: (id: string, data: CloseBovineCaseInput) =>
    apiClient.post<ApiSuccessResponse<BovineCaseDetailResponse>>(`/bovine-cases/${id}/close`, data),

  // ── Symptoms ──────────────────────────────────────────────────────────────
  addSymptom: (caseId: string, data: AddCaseSymptomInput) =>
    apiClient.post<ApiSuccessResponse<CaseSymptomResponse>>(
      `/bovine-cases/${caseId}/symptoms`,
      data,
    ),

  removeSymptom: (caseId: string, symptomId: string) =>
    apiClient.delete<ApiSuccessResponse<{ id: string }>>(
      `/bovine-cases/${caseId}/symptoms/${symptomId}`,
    ),

  // ── Treatments ────────────────────────────────────────────────────────────
  addTreatment: (caseId: string, data: AddCaseTreatmentInput) =>
    apiClient.post<ApiSuccessResponse<CaseTreatmentResponse>>(
      `/bovine-cases/${caseId}/treatments`,
      data,
    ),

  // ── Lab tests ─────────────────────────────────────────────────────────────
  addLabTest: (caseId: string, data: AddCaseLabTestInput) =>
    apiClient.post<ApiSuccessResponse<CaseLabTestResponse>>(
      `/bovine-cases/${caseId}/lab-tests`,
      data,
    ),

  /**
   * Registrar el resultado de un lab pendiente.
   * ⚠️ Ojo al path — NO incluye `:caseId`, va directo por `:labTestId`.
   */
  updateLabTestResult: (labTestId: string, data: UpdateLabTestResultInput) =>
    apiClient.patch<ApiSuccessResponse<CaseLabTestResponse>>(
      `/bovine-cases/lab-tests/${labTestId}`,
      data,
    ),
};
