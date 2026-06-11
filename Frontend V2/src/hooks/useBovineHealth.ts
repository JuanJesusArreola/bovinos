/**
 * Hooks de salud por bovino — agregaciones que el backend no expone directamente.
 *
 * Estado del arte de la API backend:
 *   - `GET /health/bovine/:id/history` → array de HealthRecord (existente).
 *   - `GET /health/treatment/withdrawal/:healthId` → array de
 *     `WithdrawalPeriodItem`, pero **por HealthRecord**, no por bovino.
 *
 * El operador del rancho necesita responder UNA pregunta legal crítica:
 *   "¿Puedo enviar a Lola al matadero hoy?"
 *   "¿Puedo aprovechar su leche hoy?"
 *
 * Eso requiere consolidar los withdrawals de TODOS sus tratamientos
 * recientes. Como el backend no expone un endpoint agregado, lo hacemos
 * client-side: traemos su historial, filtramos los que tienen tratamiento,
 * y consultamos withdrawal en paralelo con `Promise.all`.
 *
 * Costo: 1 + N requests donde N = número de registros con tratamiento.
 * En la práctica N suele ser 0-3 (medicamentos típicos: penicilina,
 * oxitetraciclina, ivermectina). Aceptable.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '@/api/health.api';
import type {
  WithdrawalPeriodItem,
  BovineWithdrawalAggregate,
  HealthRecord,
  RecordMedicationDoseInput,
  StartTreatmentInput,
  CompleteTreatmentInput,
  UpdateHealthRecordInput,
  HealthRecordsListFilters,
  UploadLabResultsInput,
  LaboratoryResultItem,
  RanchAbnormalStats,
  BovineAbnormalLabRecord,
  BovineHealthSummary,
  RegisterDiagnosisInput,
  ConfirmDiagnosisInput,
  DiagnosisStatsFilters,
  DiagnosisStatsResponse,
  DiagnosisStatsWithDelta,
} from '@/types/health.types';

// ── Query keys ─────────────────────────────────────────────────────────────

export const bovineHealthKeys = {
  all: ['bovine-health'] as const,
  withdrawalForRecord: (healthId: string) =>
    [...bovineHealthKeys.all, 'withdrawal', 'record', healthId] as const,
  withdrawalForBovine: (bovineId: string) =>
    [...bovineHealthKeys.all, 'withdrawal', 'bovine', bovineId] as const,
  recordsList: (filters: HealthRecordsListFilters) =>
    ['health-records', 'list', filters] as const,
  recordDetail: (id: string) => ['health-records', 'detail', id] as const,
  labAbnormal: (healthId: string) =>
    [...bovineHealthKeys.all, 'lab-abnormal', healthId] as const,
  labAbnormalRanch: (ranchId: string, days: number) =>
    [...bovineHealthKeys.all, 'lab-abnormal-ranch', ranchId, days] as const,
  labAbnormalBovine: (bovineId: string, limit: number) =>
    [...bovineHealthKeys.all, 'lab-abnormal-bovine', bovineId, limit] as const,
  summary: (bovineId: string) =>
    [...bovineHealthKeys.all, 'summary', bovineId] as const,
} as const;

// ── Withdrawal por HealthRecord (passthrough tipado) ───────────────────────

// ── Diagnosis (Capa 2) ────────────────────────────────────────────────────

interface UseDiagnosisMutationOptions {
  bovineId?: string;
}

/**
 * Helper de invalidacion para mutaciones de diagnostico. Reusa el
 * mismo conjunto que las mutaciones de record (capa 1) porque registrar
 * un diagnostico EFECTIVAMENTE modifica el HealthRecord destino: cambia
 * su `diagnosis` JSONB y posiblemente su `diseaseId` FK.
 */
function invalidateDiagnosisCaches(
  qc: ReturnType<typeof useQueryClient>,
  bovineId?: string,
) {
  invalidateHealthRecordCaches(qc, bovineId);
  // Stats de diagnostico - cualquier nuevo o confirmado cambia los
  // conteos del dashboard. Invalidamos por prefijo para cubrir todas
  // las combinaciones de filtros que se hayan cacheado.
  qc.invalidateQueries({ queryKey: ['diagnosis-stats'] });
}

/**
 * Registra o actualiza el bloque diagnosis de un HealthRecord.
 *
 * Caso de uso tipico:
 *   - Visita inicial: VET captura sintomas + vitales SIN diagnostico
 *     firme. El form de "Nuevo registro" deja diagnosis vacio.
 *   - Llegan resultados de lab.
 *   - VET vuelve al record y llama a esta mutacion con diagnosis
 *     completo + diseaseId del catalogo.
 *
 * Es idempotente desde la UI: llamarlo varias veces sobreescribe el
 * diagnosis (no acumula). Util si el VET necesita corregir.
 */
export function useRegisterDiagnosis(options?: UseDiagnosisMutationOptions) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegisterDiagnosisInput) => {
      const res = await healthApi.recordDiagnosis(data);
      return res.data;
    },
    onSuccess: () => invalidateDiagnosisCaches(qc, options?.bovineId),
  });
}

/**
 * Estadisticas agregadas de diagnosticos para el rango actual.
 * NO incluye comparativa con periodo anterior - para eso usar
 * `useDiagnosisStatsWithDelta` que hace 2 fetches en paralelo.
 *
 * Query key incluye los filtros completos para que la cache sea
 * granular por (ranch, rango). Cualquier mutacion de diagnosis
 * (record/confirm) invalida toda la rama `diagnosis-stats`.
 */
export function useDiagnosisStats(
  filters: DiagnosisStatsFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['diagnosis-stats', filters],
    queryFn: async (): Promise<DiagnosisStatsResponse | null> => {
      const res = await healthApi.getDiagnosisStats(filters);
      const data = (res as any)?.data?.data;
      return data && typeof data === 'object'
        ? data as DiagnosisStatsResponse
        : null;
    },
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

/**
 * Calcula el rango anterior de la misma duracion. Si `startDate`/`endDate`
 * no estan presentes, devuelve undefined (no podemos calcular delta sin
 * ventana definida).
 *
 * Ejemplo: rango actual 2026-05-01 a 2026-05-30 (30 dias) →
 *          rango previo  2026-04-01 a 2026-04-30 (30 dias).
 *
 * La inclusividad sigue convencion del backend: las fechas son extremos
 * inclusivos del dia. Calculamos en UTC para evitar surprises de TZ.
 */
function computePreviousRange(
  startDate?: string,
  endDate?: string,
): { startDate: string; endDate: string } | undefined {
  if (!startDate || !endDate) return undefined;
  const start = new Date(startDate + 'T00:00:00Z');
  const end   = new Date(endDate + 'T00:00:00Z');
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return undefined;
  }
  // Duracion del rango actual en milisegundos. Sumamos 1 dia para que
  // end-start represente el numero real de dias incluidos (rango inclusivo).
  const dayMs = 24 * 60 * 60 * 1000;
  const durationDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  // Rango previo termina un dia ANTES de que empiece el actual.
  const prevEnd   = new Date(start.getTime() - dayMs);
  const prevStart = new Date(prevEnd.getTime() - (durationDays - 1) * dayMs);
  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate:   prevEnd.toISOString().slice(0, 10),
  };
}

/**
 * Stats del periodo actual + periodo anterior, en paralelo. Si el
 * anterior falla (e.g. 5xx), devuelve `previous: null` y el dashboard
 * simplemente oculta los deltas (no rompe).
 *
 * Requiere `startDate` y `endDate` definidos. Sin ellos el rango previo
 * no se puede calcular y devuelve `previous: null` directamente.
 */
export function useDiagnosisStatsWithDelta(
  filters: DiagnosisStatsFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['diagnosis-stats', 'with-delta', filters],
    queryFn: async (): Promise<DiagnosisStatsWithDelta | null> => {
      const prevRange = computePreviousRange(filters.startDate, filters.endDate);

      const [currentRes, prevRes] = await Promise.allSettled([
        healthApi.getDiagnosisStats(filters),
        prevRange
          ? healthApi.getDiagnosisStats({
              ranchId: filters.ranchId,
              startDate: prevRange.startDate,
              endDate: prevRange.endDate,
            })
          : Promise.resolve(null),
      ]);

      const current = currentRes.status === 'fulfilled'
        ? ((currentRes.value as any)?.data?.data ?? null)
        : null;
      if (!current) return null;

      const previous = prevRes.status === 'fulfilled' && prevRes.value
        ? ((prevRes.value as any)?.data?.data ?? null)
        : null;

      return { current, previous };
    },
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

/**
 * Confirma un diagnostico presuntivo. Anade confirmedAt + confirmedBy.
 *
 * NO permite re-confirmar: si ya esta confirmado, el backend rechaza
 * con 409 (depende de la version del backend) o lo deja igual. La UI
 * normalmente OCULTA el boton "Confirmar" cuando diagnosis.confirmedAt
 * ya existe; este hook es defensa de segundo nivel.
 */
export function useConfirmDiagnosis(options?: UseDiagnosisMutationOptions) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ConfirmDiagnosisInput) => {
      const res = await healthApi.confirmDiagnosis(data);
      return res.data;
    },
    onSuccess: () => invalidateDiagnosisCaches(qc, options?.bovineId),
  });
}

// ── Laboratory (Capa 4) ───────────────────────────────────────────────────

interface UseLabMutationOptions {
  bovineId?: string;
}

/**
 * Sube resultados de laboratorio. Tras exito invalida:
 *   - Historial del bovino (`laboratoryResults` del record cambio).
 *   - Lista de anormales del record (filtro derivado).
 */
export function useUploadLabResults(options?: UseLabMutationOptions) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UploadLabResultsInput) => {
      const res = await healthApi.addLabResults(data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: bovineHealthKeys.labAbnormal(variables.healthId) });
      if (options?.bovineId) {
        qc.invalidateQueries({ queryKey: ['bovine-health', options.bovineId] });
        qc.invalidateQueries({ queryKey: ['bovine-health-history', options.bovineId] });
        // Tendencia de anormales del bovino tambien debe refrescarse
        // independientemente del limit usado en el query.
        qc.invalidateQueries({
          queryKey: [...bovineHealthKeys.all, 'lab-abnormal-bovine', options.bovineId],
        });
      }
      // Invalidamos TODOS los caches de vigilancia por rancho (sin importar
      // ventana de dias) porque cualquier upload puede afectar el agregado.
      qc.invalidateQueries({
        queryKey: [...bovineHealthKeys.all, 'lab-abnormal-ranch'],
      });
    },
  });
}

/**
 * Snapshot agregado del estado de salud del bovino. Cache de 60s -
 * cuando el VET realiza una mutacion en otro hook (registrar consulta,
 * editar record, cerrar caso, subir lab), el helper de invalidacion
 * limpia esta cache para que el header se actualice instantaneamente.
 */
export function useBovineHealthSummary(
  bovineId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bovineHealthKeys.summary(bovineId ?? ''),
    queryFn: async (): Promise<BovineHealthSummary | null> => {
      const res = await healthApi.getSummary(bovineId!);
      const data = (res as any)?.data?.data;
      return data && typeof data === 'object'
        ? data as BovineHealthSummary
        : null;
    },
    enabled: !!bovineId && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

/**
 * Historial de resultados anormales del bovino para visualizar tendencia
 * de recuperacion. Se monta en BovineHealthTab como Card colapsable.
 *
 * El backend devuelve solo records con AL MENOS un anormal, asi que un
 * payload vacio significa "este bovino no tiene resultados fuera de
 * rango en su historial" - render como mensaje positivo (no alarma).
 */
export function useBovineAbnormalLabHistory(
  bovineId: string | undefined,
  limit: number = 10,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bovineHealthKeys.labAbnormalBovine(bovineId ?? '', limit),
    queryFn: async (): Promise<BovineAbnormalLabRecord[]> => {
      const res = await healthApi.getAbnormalByBovine(bovineId!, { limit });
      const data = (res as any)?.data?.data ?? [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!bovineId && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

/**
 * Vigilancia epidemiologica por rancho - resultados anormales
 * agregados en la ventana de tiempo. Se usa en el dashboard de
 * `/health/epidemiology` como widget de alerta temprana.
 */
export function useRanchAbnormalLab(
  ranchId: string | undefined,
  days: number = 30,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bovineHealthKeys.labAbnormalRanch(ranchId ?? '', days),
    queryFn: async (): Promise<RanchAbnormalStats | null> => {
      const res = await healthApi.getAbnormalByRanch(ranchId!, { days });
      // Defensive: el backend puede devolver `null`/`undefined` si el rancho
      // no tiene resultados en la ventana; mejor `null` consistente.
      const data = (res as any)?.data?.data;
      return data && typeof data === 'object' ? data as RanchAbnormalStats : null;
    },
    enabled: !!ranchId && (options?.enabled ?? true),
    // Los datos se calculan a partir de los lab results del rancho.
    // 5 min de frescura - cualquier upload nuevo invalida el cache
    // si lo conectamos (lo dejamos para futuro: invalidar al subir lab).
    staleTime: 5 * 60_000,
  });
}

/**
 * Trae solo los resultados ABNORMAL/CRITICAL de un HealthRecord. Util
 * para una vista "alertas clinicas" que oculte los NORMAL.
 */
export function useAbnormalLabResults(
  healthId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bovineHealthKeys.labAbnormal(healthId ?? ''),
    queryFn: async (): Promise<LaboratoryResultItem[]> => {
      const res = await healthApi.getAbnormalByHealth(healthId!);
      const data = (res as any)?.data?.data ?? [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!healthId && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

// ── Listado paginado global de HealthRecords (Capa 1, mejora 3) ──────────

/**
 * Trae HealthRecords con filtros multi y paginacion del backend.
 *
 * Recomendaciones:
 *   - Pasa siempre `ranchId` para alcance correcto (sin el, en el
 *     backend "trae todo lo accesible al usuario", que para un VET
 *     en un solo rancho equivale a lo mismo pero para SUPER_ADMIN
 *     puede ser cross-ranch y costoso).
 *   - El componente que llama controla la paginacion y los filtros
 *     via setState; el queryKey los memoriza para que cambiar la
 *     pagina refresque automaticamente.
 *
 * Devuelve el envelope tal como sale del backend (data + pagination)
 * para que la UI pueda renderizar ambos.
 */
export function useHealthRecordsList(
  filters: HealthRecordsListFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bovineHealthKeys.recordsList(filters),
    queryFn: async () => {
      const res = await healthApi.listRecords(filters);
      return res.data; // envelope completo: { success, data, pagination }
    },
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    placeholderData: (prev) => prev, // mantiene la UI estable al paginar
  });
}

// ── Detalle de un HealthRecord ────────────────────────────────────────────

export function useHealthRecord(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bovineHealthKeys.recordDetail(id ?? ''),
    queryFn: async () => {
      const res = await healthApi.getRecord(id!);
      const data = (res as any)?.data?.data ?? null;
      return data as HealthRecord | null;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

// ── PATCH y DELETE de HealthRecord (Capa 1) ───────────────────────────────
//
// Helper de invalidacion compartido para no duplicar logica entre update
// y delete. Cambios en un record afectan:
//   - El historial del bovino (lista de records cambia o un item es nuevo).
//   - El banner de retiro (si cambio `treatment.medications` o se borro
//     un record con dosis activas).
//   - Stats del hato (overallHealthStatus puede afectar el conteo SICK
//     vs HEALTHY).
//   - La cache del record individual si alguien lo abrio aparte.

function invalidateHealthRecordCaches(
  qc: ReturnType<typeof useQueryClient>,
  bovineId?: string,
  healthId?: string,
) {
  if (bovineId) {
    qc.invalidateQueries({ queryKey: ['bovine-health', bovineId] });
    qc.invalidateQueries({ queryKey: ['bovine-health-history', bovineId] });
    qc.invalidateQueries({ queryKey: bovineHealthKeys.withdrawalForBovine(bovineId) });
    qc.invalidateQueries({ queryKey: bovineHealthKeys.summary(bovineId) });
  }
  if (healthId) {
    // Detalle del record (pagina /health/records/:id).
    qc.invalidateQueries({ queryKey: bovineHealthKeys.recordDetail(healthId) });
  }
  // Listado paginado del rancho.
  qc.invalidateQueries({ queryKey: ['health-records', 'list'] });
  // Stats del hato (HealthListPage los muestra como KPIs).
  qc.invalidateQueries({ queryKey: ['herd-health-stats'] });
}

interface UseHealthRecordMutationOptions {
  /** Necesario para invalidar caches del bovino afectado. */
  bovineId?: string;
}

/**
 * PATCH /api/health/records/:id. Recibe `{ id, data }` en mutate().
 *
 * Solo se pueden editar campos clinicos. El backend rechaza intentos de
 * modificar bovineId / recordType / recordDate / createdBy. Si el caller
 * envia esos campos por error, el response sera 400.
 */
export function useUpdateHealthRecord(options?: UseHealthRecordMutationOptions) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateHealthRecordInput }) => {
      const res = await healthApi.updateRecord(id, data);
      return res.data;
    },
    onSuccess: (_data, vars) => invalidateHealthRecordCaches(qc, options?.bovineId, vars.id),
  });
}

/**
 * DELETE /api/health/records/:id (soft delete).
 *
 * IMPORTANTE: la accion es ireversible desde la UI. El record queda en
 * BD con deletedAt para auditoria, pero no aparece en queries normales.
 * El componente que llama DEBE confirmar al usuario antes de disparar
 * esta mutacion.
 */
export function useDeleteHealthRecord(options?: UseHealthRecordMutationOptions) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await healthApi.deleteRecord(id);
      return res.data;
    },
    onSuccess: (_data, id) => invalidateHealthRecordCaches(qc, options?.bovineId, id),
  });
}

// ── Iniciar tratamiento (Capa 3 - Treatment) ──────────────────────────────

interface UseTreatmentMutationOptions {
  /**
   * Bovino al que pertenece el HealthRecord. Necesario para refrescar
   * las caches del bovino tras mutar el tratamiento.
   */
  bovineId?: string;
}

/**
 * Helper compartido para invalidar todas las caches afectadas por una
 * mutacion sobre el tratamiento de un HealthRecord. Las llamamos en
 * onSuccess de start / complete / recordDose.
 *
 * Lo que cambia tras un start/complete:
 *   - Historial de salud del bovino (status del treatment de ese record).
 *   - Withdrawal del record (cambia el countdown).
 *   - Withdrawal agregado del bovino (banner legal del header).
 *   - Caches del inventario (start reserva, complete libera).
 *
 * Las dos primeras dependen del healthId concreto; las dos ultimas son
 * generales y se invalidan por prefijo.
 */
function invalidateTreatmentCaches(
  qc: ReturnType<typeof useQueryClient>,
  healthId: string,
  bovineId?: string,
) {
  qc.invalidateQueries({ queryKey: bovineHealthKeys.withdrawalForRecord(healthId) });
  if (bovineId) {
    qc.invalidateQueries({ queryKey: bovineHealthKeys.withdrawalForBovine(bovineId) });
    qc.invalidateQueries({ queryKey: ['bovine-health-history', bovineId] });
    qc.invalidateQueries({ queryKey: ['bovine-health', bovineId] });
  }
  // Inventario: start reserva, complete libera. Invalidamos por prefijo.
  qc.invalidateQueries({ queryKey: ['inventory'] });
}

export function useStartTreatment(options?: UseTreatmentMutationOptions) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StartTreatmentInput) => {
      const res = await healthApi.startTreatment(data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      invalidateTreatmentCaches(qc, variables.healthId, options?.bovineId);
    },
  });
}

export function useCompleteTreatment(options?: UseTreatmentMutationOptions) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CompleteTreatmentInput) => {
      const res = await healthApi.completeTreatment(data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      invalidateTreatmentCaches(qc, variables.healthId, options?.bovineId);
    },
  });
}

// ── Registrar dosis aplicada (Capa 3 - Treatment) ─────────────────────────

interface UseRecordMedicationDoseOptions {
  /**
   * Bovino al que pertenece el HealthRecord. Necesario para invalidar
   * las caches de salud del bovino (historial, withdrawal agregado).
   * Si no se pasa, solo invalidamos lo del record.
   */
  bovineId?: string;
}

/**
 * Mutacion para registrar una dosis aplicada de un medicamento.
 *
 * Invalidaciones tras exito:
 *   - Historial de salud del bovino (la lista de records cambia porque
 *     el record afectado ahora tiene administeredAt actualizado).
 *   - Withdrawal del record especifico (la ultima dosis acaba de moverse,
 *     reiniciando el countdown del periodo de retiro).
 *   - Withdrawal agregado del bovino (el banner legal puede haber
 *     cambiado: nueva fecha de "apto para consumo").
 *
 * El componente que llama recibe `{ healthId, medicationIndex,
 * administeredAt?, notes? }` en `mutate()`.
 */
export function useRecordMedicationDose(options?: UseRecordMedicationDoseOptions) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecordMedicationDoseInput) => {
      const res = await healthApi.recordMedication(data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      // Withdrawal del record afectado se recalcula con la nueva fecha.
      qc.invalidateQueries({
        queryKey: bovineHealthKeys.withdrawalForRecord(variables.healthId),
      });
      if (options?.bovineId) {
        // El banner del header del bovino debe reflejar la nueva fecha.
        qc.invalidateQueries({
          queryKey: bovineHealthKeys.withdrawalForBovine(options.bovineId),
        });
        // Historial del bovino tiene el record con administeredAt extendido.
        qc.invalidateQueries({ queryKey: ['bovine-health-history', options.bovineId] });
      }
    },
  });
}

export function useHealthRecordWithdrawal(
  healthId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: bovineHealthKeys.withdrawalForRecord(healthId ?? ''),
    queryFn: async (): Promise<WithdrawalPeriodItem[]> => {
      const res = await healthApi.getWithdrawalPeriods(healthId!);
      // La API expone `data: unknown` históricamente; aquí lo tipamos.
      const data = (res as any)?.data?.data ?? (res as any)?.data ?? [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!healthId && (options?.enabled ?? true),
    // Withdrawal NO cambia segundo a segundo (la única variable es el reloj),
    // pero queremos refrescar al volver a la pestaña por si pasó un día.
    staleTime: 5 * 60_000,
  });
}

// ── Withdrawal agregado por bovino ─────────────────────────────────────────

interface UseBovineWithdrawalStatusOptions {
  enabled?: boolean;
  /** Ventana de historial a inspeccionar. Default 180 días — los períodos
   *  de retiro típicos no exceden 60-90 días; 180 cubre incluso retiros
   *  largos por antibióticos de acción prolongada. */
  lookbackDays?: number;
}

/**
 * ¿Está este bovino actualmente en período de retiro?
 *
 * Implementación:
 *   1. Trae `/health/bovine/:id/history` (limitado a `lookbackDays`).
 *   2. Filtra los HealthRecords que tienen `treatment.medications`
 *      con `withdrawalPeriod` definido (los demás no pueden generar
 *      retiro).
 *   3. Para cada uno hace `GET /treatment/withdrawal/:healthId` en
 *      paralelo (`Promise.all`).
 *   4. Aplana, separa entre `active` (isWithdrawn:false) y
 *      `recentlyCleared` (isWithdrawn:true en últimos 90 días).
 *   5. Devuelve agregado con `hasActiveWithdrawal` listo para el banner.
 *
 * NO cachea los withdrawals individuales por record — el agregado vive en
 * su propia query key para evitar inconsistencias si el operador acaba
 * de aplicar una dosis (que reabre la ventana).
 */
export function useBovineWithdrawalStatus(
  bovineId: string | undefined,
  options?: UseBovineWithdrawalStatusOptions,
) {
  const lookbackDays = options?.lookbackDays ?? 180;

  return useQuery({
    queryKey: [...bovineHealthKeys.withdrawalForBovine(bovineId ?? ''), lookbackDays],
    queryFn: async (): Promise<BovineWithdrawalAggregate> => {
      // 1. Historial reciente.
      const histRes = await healthApi.getHistory(bovineId!);
      const records: HealthRecord[] = (histRes as any)?.data?.data ?? [];
      const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
      const recent = records.filter((r) => {
        const t = new Date(r.recordDate ?? (r as any).createdAt ?? 0).getTime();
        return t >= cutoff;
      });

      // 2. Filtrar los que tienen medicamentos con withdrawalPeriod.
      const candidateIds = recent
        .filter((r) => {
          const meds = (r as any)?.treatment?.medications;
          if (!Array.isArray(meds)) return false;
          return meds.some((m: any) =>
            (m?.withdrawalPeriod != null && m.withdrawalPeriod > 0) ||
            (m?.withdrawalPeriodDays != null && m.withdrawalPeriodDays > 0)
          );
        })
        .map((r) => r.id)
        .filter(Boolean);

      if (candidateIds.length === 0) {
        return {
          hasActiveWithdrawal: false,
          activeCount:         0,
          nextEndsAt:          null,
          finalClearedAt:      null,
          active:              [],
          recentlyCleared:     [],
        };
      }

      // 3. Consultar withdrawal por record en paralelo. Si alguno falla,
      //    lo ignoramos en silencio (no podemos romper el resto por un 500).
      const results = await Promise.all(
        candidateIds.map(async (id): Promise<WithdrawalPeriodItem[]> => {
          try {
            const res = await healthApi.getWithdrawalPeriods(id);
            const data = (res as any)?.data?.data ?? [];
            return Array.isArray(data) ? data : [];
          } catch {
            return [];
          }
        }),
      );

      // 4. Aplanar + clasificar.
      const all: WithdrawalPeriodItem[] = results.flat();
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const active: WithdrawalPeriodItem[] = [];
      const recentlyCleared: WithdrawalPeriodItem[] = [];
      for (const w of all) {
        if (!w?.medicationName) continue;
        if (!w.isWithdrawn) {
          active.push(w);
        } else if (new Date(w.withdrawalEndDate).getTime() >= ninetyDaysAgo) {
          recentlyCleared.push(w);
        }
      }

      // 5. nextEndsAt = la fecha más PRÓXIMA en que un retiro termina.
      //    finalClearedAt = la más LEJANA (cuándo el animal queda
      //    completamente libre). Esa segunda es la que importa
      //    operacionalmente porque hasta ella NO se puede aprovechar.
      const activeDates = active
        .map((w) => new Date(w.withdrawalEndDate).getTime())
        .filter((t) => Number.isFinite(t));
      const nextEndsAt =
        activeDates.length > 0
          ? new Date(Math.min(...activeDates)).toISOString()
          : null;
      const finalClearedAt =
        activeDates.length > 0
          ? new Date(Math.max(...activeDates)).toISOString()
          : null;

      return {
        hasActiveWithdrawal: active.length > 0,
        activeCount:         active.length,
        nextEndsAt,
        finalClearedAt,
        active,
        recentlyCleared,
      };
    },
    enabled: !!bovineId && (options?.enabled ?? true),
    // Frescura razonable — operador puede recargar la pestaña para forzar.
    staleTime: 5 * 60_000,
  });
}
