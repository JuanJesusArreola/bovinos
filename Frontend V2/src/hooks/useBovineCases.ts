/**
 * Hooks del módulo de Casos Clínicos.
 *
 * Reglas de invalidación:
 *   - Toda mutación sobre un caso invalida `caseKeys.detail(id)` + lists +
 *     epidemiology (snapshots y outbreaks dependen del estado clínico).
 *   - El bovino afectado también ve su detalle invalidado (la pestaña de
 *     salud muestra sus casos clínicos abiertos).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { bovineCasesApi } from '@/api/bovineCases.api';
import { bovineKeys } from './useBovines';
import type {
  BovineCaseFilters,
  CreateBovineCaseInput,
  UpdateBovineCaseInput,
  CloseBovineCaseInput,
  AddCaseSymptomInput,
  AddCaseTreatmentInput,
  AddCaseLabTestInput,
  UpdateLabTestResultInput,
} from '@/types/bovineCase.dtos';

// ── Query keys ──────────────────────────────────────────────────────────────

export const caseKeys = {
  all: ['bovine-cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters: BovineCaseFilters) => [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
} as const;

/**
 * Caches que dependen del estado clínico del rebaño (snapshots,
 * top-diseases, trend, outbreaks). Cualquier mutación de un caso debería
 * invalidarlas para que los dashboards reflejen el cambio inmediatamente.
 */
function invalidateEpidemiologyCaches(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['epidemiology'] });
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useBovineCases(filters: BovineCaseFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: caseKeys.list(filters),
    queryFn: async () => {
      const res = await bovineCasesApi.list(filters);
      return res.data; // envelope {data, pagination}
    },
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useBovineCase(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: caseKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await bovineCasesApi.getById(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

// ── Helpers de invalidación compartidos ─────────────────────────────────────

function invalidateAfterCaseMutation(qc: QueryClient, caseId: string, bovineId?: string) {
  qc.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
  qc.invalidateQueries({ queryKey: caseKeys.lists() });
  if (bovineId) {
    qc.invalidateQueries({ queryKey: bovineKeys.full(bovineId) });
    qc.invalidateQueries({ queryKey: bovineKeys.detail(bovineId) });
  }
  // Listados del modulo de bovinos: cuando el backend deriva
  // `bovine.healthStatus` a partir del caso (Opcion 1 acordada con backend),
  // crear/cerrar un caso cambia el chip "Saludable/Enfermo" en la lista
  // de bovinos y los KPIs del hato. Sin estas invalidaciones la UI no
  // reflejaria el cambio hasta el siguiente refetch (60s).
  qc.invalidateQueries({ queryKey: bovineKeys.lists() });
  // KPIs del header de /health.
  qc.invalidateQueries({ queryKey: ['herd-health-stats'] });
  // Banner de retiro (puede cambiar si el caso cierra y se libera al
  // animal del estado clinico activo).
  qc.invalidateQueries({ queryKey: ['bovine-health'] });
  invalidateEpidemiologyCaches(qc);
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export function useCreateBovineCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBovineCaseInput) => {
      const res = await bovineCasesApi.create(data);
      return res.data.data;
    },
    onSuccess: (caseDto) => {
      invalidateAfterCaseMutation(qc, caseDto.id, caseDto.bovineId);
    },
  });
}

export function useUpdateBovineCase(id: string, bovineId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateBovineCaseInput) => {
      const res = await bovineCasesApi.update(id, data);
      return res.data.data;
    },
    onSuccess: (caseDto) => {
      invalidateAfterCaseMutation(qc, id, bovineId ?? caseDto.bovineId);
    },
  });
}

export function useCloseBovineCase(id: string, bovineId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CloseBovineCaseInput) => {
      const res = await bovineCasesApi.close(id, data);
      return res.data.data;
    },
    onSuccess: (caseDto) => {
      invalidateAfterCaseMutation(qc, id, bovineId ?? caseDto.bovineId);
    },
  });
}

// ── Symptoms ────────────────────────────────────────────────────────────────

export function useAddCaseSymptom(caseId: string, bovineId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddCaseSymptomInput) => {
      const res = await bovineCasesApi.addSymptom(caseId, data);
      return res.data.data;
    },
    onSuccess: () => invalidateAfterCaseMutation(qc, caseId, bovineId),
  });
}

export function useRemoveCaseSymptom(caseId: string, bovineId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (symptomId: string) => {
      const res = await bovineCasesApi.removeSymptom(caseId, symptomId);
      return res.data.data;
    },
    onSuccess: () => invalidateAfterCaseMutation(qc, caseId, bovineId),
  });
}

// ── Treatments ──────────────────────────────────────────────────────────────

export function useAddCaseTreatment(caseId: string, bovineId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddCaseTreatmentInput) => {
      const res = await bovineCasesApi.addTreatment(caseId, data);
      return res.data.data;
    },
    onSuccess: () => invalidateAfterCaseMutation(qc, caseId, bovineId),
  });
}

// ── Lab tests ───────────────────────────────────────────────────────────────

export function useAddCaseLabTest(caseId: string, bovineId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddCaseLabTestInput) => {
      const res = await bovineCasesApi.addLabTest(caseId, data);
      return res.data.data;
    },
    onSuccess: () => invalidateAfterCaseMutation(qc, caseId, bovineId),
  });
}

/**
 * Registrar resultado de un laboratorio.
 * @param caseId  Necesario para invalidar el detalle del caso al que pertenece.
 */
export function useUpdateLabTestResult(caseId: string, bovineId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ labTestId, data }: { labTestId: string; data: UpdateLabTestResultInput }) => {
      const res = await bovineCasesApi.updateLabTestResult(labTestId, data);
      return res.data.data;
    },
    onSuccess: () => invalidateAfterCaseMutation(qc, caseId, bovineId),
  });
}
