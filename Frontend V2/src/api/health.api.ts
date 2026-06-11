import apiClient from './client';
import type {
  ApiResponse,
  HealthRecord,
  HealthCheckFormData,
  HealthStats,
  HealthTimeline,
  DiagnosisData,
  TreatmentData,
  LaboratoryResult,
} from '@/types';
import type {
  WithdrawalPeriodItem,
  RecordMedicationDoseInput,
  RecordMedicationDoseResponse,
  StartTreatmentInput,
  StartTreatmentResponse,
  CompleteTreatmentInput,
  CompleteTreatmentResponse,
  UpdateHealthRecordInput,
  HealthRecordsListFilters,
  HealthRecordsListEnvelope,
  UploadLabResultsInput,
  UploadLabResultsResponse,
  LaboratoryResultItem,
  RanchAbnormalStats,
  BovineAbnormalLabRecord,
  BovineHealthSummary,
  RegisterDiagnosisInput,
  ConfirmDiagnosisInput,
  DiagnosisStatsFilters,
  DiagnosisStatsResponse,
} from '@/types/health.types';

export const healthApi = {
  // ── Records CRUD ─────────────────────────────────────────────────────
  getHistory: (bovineId: string) =>
    apiClient.get<ApiResponse<HealthRecord[]>>(`/health/bovine/${bovineId}/history`),

  /**
   * Snapshot agregado del estado clinico del bovino. Devuelve estado,
   * conteo de registros por tipo, caso activo (si lo hay), emergencias
   * recientes y seguimientos pendientes.
   *
   * Pensado como hero card de la pestana de salud - vista panoramica
   * antes del historial detallado.
   */
  getSummary: (bovineId: string) =>
    apiClient.get<ApiResponse<BovineHealthSummary>>(`/health/bovine/${bovineId}/summary`),

  getRecord: (id: string) =>
    apiClient.get<ApiResponse<HealthRecord>>(`/health/records/${id}`),

  createRecord: (data: HealthCheckFormData) =>
    apiClient.post<ApiResponse<HealthRecord>>('/health/records', data),

  /**
   * Listado paginado global de HealthRecords con filtros multi.
   *
   * Convencion de serializacion (espeja al backend):
   *   - Arrays se mandan como CSV: `recordType=CLINICAL_EXAM,EMERGENCY`.
   *   - Booleanos van como 'true'/'false' (querystring).
   *   - Strings vacios se omiten para no enviar `search=` superfluo que
   *     genere un filtro vacio en el WHERE.
   *
   * El response trae bovine + disease eager-loaded en cada item para
   * que la UI no haga N+1 al renderizar.
   */
  listRecords: (filters: HealthRecordsListFilters = {}) => {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (filters.ranchId)          params.ranchId = filters.ranchId;
    if (filters.bovineId)         params.bovineId = filters.bovineId;
    if (filters.diseaseId)        params.diseaseId = filters.diseaseId;
    if (filters.veterinarianId)   params.veterinarianId = filters.veterinarianId;
    if (filters.search?.trim())   params.search = filters.search.trim();
    if (filters.startDate)        params.startDate = filters.startDate;
    if (filters.endDate)          params.endDate = filters.endDate;
    if (filters.sortBy)           params.sortBy = filters.sortBy;
    if (filters.sortOrder)        params.sortOrder = filters.sortOrder;
    if (filters.page != null)     params.page = filters.page;
    if (filters.limit != null)    params.limit = filters.limit;
    if (filters.isEmergency != null)        params.isEmergency = filters.isEmergency;
    if (filters.followUpRequired != null)   params.followUpRequired = filters.followUpRequired;
    if (filters.diagnosisConfirmed != null) params.diagnosisConfirmed = filters.diagnosisConfirmed;
    if (filters.recordType?.length)
      params.recordType = filters.recordType.join(',');
    if (filters.overallHealthStatus?.length)
      params.overallHealthStatus = filters.overallHealthStatus.join(',');
    // Nota: NO usamos ApiResponse<T> aqui porque el endpoint expone
    // `pagination` a la raiz del response (paralela a `data`), no
    // anidada. El envelope tiene su propio tipo arriba.
    return apiClient.get<HealthRecordsListEnvelope>('/health/records', { params });
  },

  /**
   * Actualiza campos clinicos editables de un HealthRecord existente.
   * El backend RECHAZA modificar bovineId, recordType, recordDate y
   * createdBy. Para corregir esos hay que eliminar y crear de nuevo.
   *
   * Para desvincular `diseaseId`, enviar `null` explicito (no omitir).
   */
  updateRecord: (id: string, data: UpdateHealthRecordInput) =>
    apiClient.patch<ApiResponse<HealthRecord>>(`/health/records/${id}`, data),

  /**
   * Soft delete (paranoid: true en Sequelize). El registro deja de
   * aparecer en queries normales pero queda en BD con `deletedAt`
   * para auditoria. NO se puede deshacer desde la UI; se requeriria
   * un endpoint de "restore" que aun no existe.
   */
  deleteRecord: (id: string) =>
    apiClient.delete<ApiResponse<{ id: string }>>(`/health/records/${id}`),

  // ── Bovine health endpoints ──────────────────────────────────────────
  checkHealth: (data: HealthCheckFormData) =>
    apiClient.post<ApiResponse<unknown>>('/bovines/health/check', data),

  needsCheck: (bovineId: string) =>
    apiClient.get<ApiResponse<{ needsCheck: boolean }>>(`/bovines/${bovineId}/health/needs-check`),

  updateStatus: (bovineId: string, data: { status: string; notes?: string }) =>
    apiClient.put<ApiResponse<unknown>>(`/bovines/${bovineId}/health/status`, data),

  getHealthHistory: (bovineId: string) =>
    apiClient.get<ApiResponse<HealthRecord[]>>(`/bovines/${bovineId}/health/history`),

  getHerdStats: (ranchId: string) =>
    apiClient.get<ApiResponse<HealthStats>>(`/bovines/health/stats/${ranchId}`),

  getTimeline: (bovineId: string) =>
    apiClient.get<ApiResponse<HealthTimeline[]>>(`/bovines/${bovineId}/health/timeline`),

  // ── Diagnosis ────────────────────────────────────────────────────────
  /**
   * Registra o actualiza el bloque JSONB `diagnosis` de un HealthRecord.
   *
   * Pensado para el flujo en el que el VET captura una visita inicial
   * SIN diagnostico firme (solo sintomas + vitales), espera resultados
   * de lab, y vuelve a registrar el diagnostico una vez tiene mas info.
   *
   * `diseaseId` opt-in con tres estados (ver JSDoc de RegisterDiagnosisInput).
   */
  recordDiagnosis: (data: RegisterDiagnosisInput) =>
    apiClient.post<ApiResponse<HealthRecord>>('/health/diagnosis/record', data),

  /**
   * Confirma un diagnostico presuntivo previamente registrado. Anade
   * `confirmedAt` y `confirmedBy` al bloque JSONB. Idempotente desde la
   * UI: si ya esta confirmado, el backend devuelve el record sin cambios
   * o un 409 - el caller lo maneja con un toast.
   */
  confirmDiagnosis: (data: ConfirmDiagnosisInput) =>
    apiClient.post<ApiResponse<HealthRecord>>('/health/diagnosis/confirm', data, { silent: true }),

  /**
   * Estadisticas agregadas de diagnosticos en la ventana especificada.
   * Filtros opcionales: ranchId, startDate, endDate. Si se omite el
   * rango, el backend usa una ventana default (revisar doc).
   *
   * El frontend usa este endpoint dos veces para calcular delta vs
   * periodo anterior: una con el rango actual + otra con el rango
   * inmediatamente previo de la misma duracion.
   */
  getDiagnosisStats: (filters: DiagnosisStatsFilters = {}) => {
    const params: Record<string, string | undefined> = {};
    if (filters.ranchId)   params.ranchId   = filters.ranchId;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate)   params.endDate   = filters.endDate;
    return apiClient.get<ApiResponse<DiagnosisStatsResponse>>(
      '/health/diagnosis/stats',
      { params },
    );
  },

  // ── Treatment ────────────────────────────────────────────────────────
  /**
   * Inicia un tratamiento sobre un HealthRecord existente. Si las
   * medicaciones traen `inventoryItemId`, el backend RESERVA stock
   * (cantidad calculada). Lanza error 400 si no hay stock suficiente
   * antes de modificar el HealthRecord.
   */
  startTreatment: (data: StartTreatmentInput) =>
    apiClient.post<ApiResponse<StartTreatmentResponse>>('/health/treatment/start', data),

  /**
   * Registra UNA dosis efectivamente aplicada de un medicamento dentro
   * de un HealthRecord. El backend hace push del timestamp al array
   * `treatment.medications[medicationIndex].administeredAt`.
   *
   * Idempotencia: el backend NO valida duplicados. Si se llama dos veces
   * seguidas, se registran dos timestamps separados. El UI debe evitar
   * doble-click mostrando loading durante la mutacion.
   */
  recordMedication: (data: RecordMedicationDoseInput) =>
    apiClient.post<ApiResponse<RecordMedicationDoseResponse>>(
      '/health/treatment/medication/record',
      data,
    ),

  /**
   * Completa el tratamiento de un HealthRecord. Marca `status: COMPLETED`,
   * fija `endDate` y `outcome`, calcula stock NO consumido y lo libera
   * de vuelta al inventario.
   *
   * IMPORTANTE: no idempotente. Si ya esta COMPLETED, el backend rechaza.
   */
  completeTreatment: (data: CompleteTreatmentInput) =>
    apiClient.post<ApiResponse<CompleteTreatmentResponse>>('/health/treatment/complete', data),

  /**
   * Períodos de retiro vigentes para los medicamentos del HealthRecord.
   * Cada item indica si ya pasó la ventana (`isWithdrawn: true`) o cuántos
   * días faltan. Si TODOS están `isWithdrawn: true`, el animal es apto
   * para sacrificio / aprovechamiento de leche.
   */
  getWithdrawalPeriods: (healthId: string) =>
    apiClient.get<ApiResponse<WithdrawalPeriodItem[]>>(`/health/treatment/withdrawal/${healthId}`),

  // ── Laboratory ───────────────────────────────────────────────────────
  /**
   * Sube N resultados de laboratorio en una sola llamada. El backend
   * calcula `interpretation` per-item (NORMAL/ABNORMAL/CRITICAL) en base
   * a `value` vs `referenceRange`. Devuelve el HealthRecord actualizado
   * con `laboratoryResults[]` extendido.
   *
   * Si ya habia resultados previos, los nuevos se anaden (no se
   * reemplazan). Para corregir un resultado mal capturado, hoy hay que
   * editar el HealthRecord entero via PATCH (no hay endpoint para
   * actualizar UN resultado en aislado).
   */
  addLabResults: (data: UploadLabResultsInput) =>
    apiClient.post<ApiResponse<UploadLabResultsResponse>>(
      '/health/laboratory/results',
      data,
    ),

  /**
   * Solo los resultados ABNORMAL/CRITICAL de un HealthRecord. Util para
   * pantallas que solo quieren mostrar lo que requiere atencion clinica
   * sin renderizar 30 parametros NORMAL.
   */
  getAbnormalByHealth: (healthId: string) =>
    apiClient.get<ApiResponse<LaboratoryResultItem[]>>(
      `/health/laboratory/abnormal/${healthId}`,
    ),

  /**
   * Historial de resultados anormales del bovino agrupados por record.
   * Util para visualizar tendencia de recuperacion de un parametro a
   * lo largo del tiempo: si Hematocrito aparece como CRITICAL en visita
   * 1, ABNORMAL en visita 2, y NO aparece en visita 3, indica recuperacion
   * (ya esta dentro de rango).
   *
   * @param bovineId UUID del bovino.
   * @param params.limit Cantidad maxima de records a devolver. Default
   *                     backend razonable (5-10). Mas alto = mas
   *                     historia, payload mas pesado.
   */
  getAbnormalByBovine: (bovineId: string, params?: { limit?: number }) =>
    apiClient.get<ApiResponse<BovineAbnormalLabRecord[]>>(
      `/health/laboratory/bovine/${bovineId}/abnormal`,
      { params },
    ),

  /**
   * Estadisticas agregadas por rancho de parametros anormales en la
   * ventana de `days` dias. Es la vista de vigilancia epidemiologica
   * tipica: detectar patrones tempranos antes de tener casos clinicos
   * abiertos (e.g. Hematocrito + Hemoglobina bajos -> sospecha de
   * Anaplasmosis aunque ningun VET haya diagnosticado todavia).
   *
   * @param ranchId UUID del rancho.
   * @param params.days Ventana de tiempo. Default backend = 30.
   */
  getAbnormalByRanch: (ranchId: string, params?: { days?: number }) =>
    apiClient.get<ApiResponse<RanchAbnormalStats>>(
      `/health/laboratory/ranch/${ranchId}/abnormal`,
      { params },
    ),
};
