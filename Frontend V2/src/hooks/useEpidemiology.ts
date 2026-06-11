/**
 * Hooks de Epidemiología (Fases 4 y 5).
 *
 * ⚠️ Convención del backend para snapshots/trend "globales del rancho"
 * (agregado de TODAS las enfermedades):
 *   - `diseaseId` debe enviarse como la cadena literal `"null"` (NO omitirse).
 *   - Omitir el parámetro significa "no filtrar por enfermedad", lo cual
 *     incluye TODAS las filas (las globales del rancho + cada disease-row).
 *   - Pasar `"null"` (string) restringe al snapshot global del rancho.
 *
 *   `useSnapshots({ ranchId, diseaseId: 'null' })` ← snapshot agregado
 *   `useSnapshots({ ranchId, diseaseId: '<uuid>' })` ← una enfermedad concreta
 *   `useSnapshots({ ranchId })` ← TODAS las filas (raro fuera de debug)
 *
 * Esta peculiaridad viene del backend: usa `diseaseId IS NULL` para los
 * snapshots globales y necesita un valor explícito en la URL para distinguir
 * "global" de "no filtrar". Si lo cambias, rompe la lectura del dashboard.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { epidemiologyApi } from '@/api/epidemiology.api';
import { caseKeys } from './useBovineCases';
import type {
  SnapshotFilters,
  ComputeEpidemiologyInput,
  CreateManualContactInput,
  AlertFilters,
  AlertStatus,
  EpidemiologyHeatmapFilters,
} from '@/types/epidemiology.dtos';

// ── Query keys ──────────────────────────────────────────────────────────────

export const epidemiologyKeys = {
  all: ['epidemiology'] as const,
  snapshots: (filters: SnapshotFilters) =>
    [...epidemiologyKeys.all, 'snapshots', filters] as const,
  latestSnapshots: (filters: Pick<SnapshotFilters, 'ranchId' | 'diseaseId'>) =>
    [...epidemiologyKeys.all, 'snapshots', 'latest', filters] as const,
  topDiseases: (ranchId: string, limit?: number) =>
    [...epidemiologyKeys.all, 'top-diseases', ranchId, limit ?? null] as const,
  trend: (ranchId: string, diseaseId?: string | 'null', days?: number) =>
    [...epidemiologyKeys.all, 'trend', ranchId, diseaseId ?? null, days ?? null] as const,
  outbreak: (ranchId: string, diseaseId: string) =>
    [...epidemiologyKeys.all, 'outbreak', ranchId, diseaseId] as const,
  caseContacts: (caseId: string) =>
    [...epidemiologyKeys.all, 'case-contacts', caseId] as const,
  herdHealth: (ranchId: string) =>
    [...epidemiologyKeys.all, 'herd-health', ranchId] as const,
  alerts: (filters: AlertFilters) =>
    [...epidemiologyKeys.all, 'alerts', filters] as const,
  epiHeatmap: (params: EpidemiologyHeatmapFilters) =>
    [...epidemiologyKeys.all, 'epi-heatmap', params] as const,
} as const;

// ── Snapshots ───────────────────────────────────────────────────────────────

/**
 * Lista paginada de snapshots históricos.
 *
 * Ver el bloque de convenciones arriba: `diseaseId: 'null'` ≠ omitirlo.
 */
export function useSnapshots(filters: SnapshotFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: epidemiologyKeys.snapshots(filters),
    queryFn: async () => {
      const res = await epidemiologyApi.listSnapshots(filters);
      return res.data; // envelope {data, pagination}
    },
    enabled: options?.enabled ?? true,
    // Los snapshots se calculan en cron nocturno → no cambian durante el día.
    staleTime: 30 * 60_000,
  });
}

export function useLatestSnapshots(
  filters: Pick<SnapshotFilters, 'ranchId' | 'diseaseId'> = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: epidemiologyKeys.latestSnapshots(filters),
    queryFn: async () => {
      const res = await epidemiologyApi.getLatestSnapshots(filters);
      return res.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 30 * 60_000,
  });
}

// ── Top diseases (KPI cards / barras) ───────────────────────────────────────

export function useTopDiseases(
  ranchId: string | undefined,
  params: { limit?: number } = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: epidemiologyKeys.topDiseases(ranchId ?? '', params.limit),
    queryFn: async () => {
      const res = await epidemiologyApi.getTopDiseases(ranchId!, params);
      return res.data.data;
    },
    enabled: !!ranchId && (options?.enabled ?? true),
    staleTime: 30 * 60_000,
  });
}

// ── Trend (serie temporal — recharts) ───────────────────────────────────────

export function useEpidemiologyTrend(
  ranchId: string | undefined,
  params: { diseaseId?: string | 'null'; days?: number } = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: epidemiologyKeys.trend(ranchId ?? '', params.diseaseId, params.days),
    queryFn: async () => {
      const res = await epidemiologyApi.getTrend(ranchId!, params);
      return res.data.data;
    },
    enabled: !!ranchId && (options?.enabled ?? true),
    staleTime: 30 * 60_000,
  });
}

// ── Outbreak (timeline + summary) ───────────────────────────────────────────

export function useOutbreak(
  ranchId: string | undefined,
  diseaseId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: epidemiologyKeys.outbreak(ranchId ?? '', diseaseId ?? ''),
    queryFn: async () => {
      const res = await epidemiologyApi.getOutbreak(ranchId!, diseaseId!);
      return res.data.data;
    },
    enabled: !!ranchId && !!diseaseId && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}

// ── Contact tracing ─────────────────────────────────────────────────────────

export function useCaseContacts(caseId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: epidemiologyKeys.caseContacts(caseId ?? ''),
    queryFn: async () => {
      const res = await epidemiologyApi.getCaseContacts(caseId!);
      return res.data.data;
    },
    enabled: !!caseId && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

/**
 * Detección automática de contactos (Fase 5).
 *
 * El endpoint es **idempotente**: re-ejecutarlo no duplica enlaces — sólo
 * crea los nuevos. La respuesta incluye:
 *   - `total`     número total de candidatos detectados (incluye repetidos).
 *   - `newLinks`  contactos efectivamente persistidos por primera vez.
 *   - cada item con `isNew: boolean`.
 *
 * Por eso esta mutación se expone con un nombre descriptivo (`isDetecting`)
 * y la UI debería mostrar un toast diferenciado:
 *   - `newLinks > 0` → "Se añadieron N nuevos contactos al grafo"
 *   - `newLinks === 0` → "No se detectaron contactos nuevos"
 */
export function useDetectCaseContacts(caseId: string) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await epidemiologyApi.detectContacts(caseId);
      return res.data; // DetectContactsResult (no envelope, ver dtos)
    },
    onSuccess: (result) => {
      // Sólo re-fetch del grafo si efectivamente cambió.
      if (result.newLinks > 0) {
        qc.invalidateQueries({ queryKey: epidemiologyKeys.caseContacts(caseId) });
        qc.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      }
    },
  });
  return {
    ...mutation,
    /** Alias semántico — `isPending` es genérico; aquí es claro qué se hace. */
    isDetecting: mutation.isPending,
  };
}

// ── Compute manual (SUPER_ADMIN) ────────────────────────────────────────────

export function useComputeEpidemiology() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ComputeEpidemiologyInput = {}) => {
      const res = await epidemiologyApi.compute(data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: epidemiologyKeys.all });
    },
  });
}

// ── Backend E-02 / Modulo 10: Herd Health Index ────────────────────────────

/**
 * F-36: indice ejecutivo de salud del hato (score 0-100, desglose por
 * status, cobertura vacunal). Pensado para el hero KPI del dashboard.
 *
 * Cache 5 min — el endpoint pega contra la tabla derivada
 * `bovine_vaccination_status` que se actualiza al aplicar vacunas, y los
 * conteos por status cambian con cada caso clinico abierto o cerrado.
 * Para verlo refrescado tras una mutacion clinica, invalidar la key
 * `epidemiologyKeys.herdHealth(ranchId)` o todo `epidemiologyKeys.all`.
 */
export function useHerdHealthIndex(
  ranchId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: epidemiologyKeys.herdHealth(ranchId ?? ''),
    queryFn: async () => {
      const res = await epidemiologyApi.getHerdHealthIndex(ranchId!);
      return res.data.data;
    },
    enabled: !!ranchId && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}

// ── Backend E-07 / Modulo 10: contactos manuales ────────────────────────────

/**
 * F-37: captura manual de contacto. Backend deduplica por
 * (sourceCaseId, target, contactType); si el contacto ya existia, devuelve
 * el mismo registro sin error. Tras crear, invalidamos los contactos del
 * caso fuente para que el grafo refleje el nuevo nodo.
 */
export function useCreateManualContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateManualContactInput) => {
      const res = await epidemiologyApi.createManualContact(data);
      return res.data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: epidemiologyKeys.caseContacts(vars.sourceCaseId) });
      qc.invalidateQueries({ queryKey: caseKeys.detail(vars.sourceCaseId) });
    },
  });
}

// ── Alertas epidemiológicas (NEW-3) ─────────────────────────────────────────

export function useEpidemiologyAlerts(
  filters: AlertFilters = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: epidemiologyKeys.alerts(filters),
    queryFn: async () => {
      const res = await epidemiologyApi.getAlerts(filters);
      return res.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60_000,
  });
}

export function useUpdateEpidemiologyAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AlertStatus }) => {
      const res = await epidemiologyApi.updateAlert(id, { status });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...epidemiologyKeys.all, 'alerts'] });
    },
  });
}

// ── Heatmap epidemiológico (NEW-2) ───────────────────────────────────────────

export function useEpidemiologyHeatmap(
  params: EpidemiologyHeatmapFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: epidemiologyKeys.epiHeatmap(params),
    queryFn: async () => {
      const res = await epidemiologyApi.getEpidemiologyHeatmap(params);
      return res.data.data;
    },
    enabled: (options?.enabled ?? true) && !!params.ranchId,
    staleTime: 5 * 60_000,
  });
}
