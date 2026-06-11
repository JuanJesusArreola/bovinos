/**
 * Hooks del módulo de Enfermedades (catálogo público + admin).
 *
 * El catálogo es informacional para TODOS los usuarios autenticados — sirve
 * como referencia al reportar casos clínicos. Solo SUPER_ADMIN puede crear /
 * editar entradas.
 *
 * Cache strategy:
 *   - Catálogo cambia muy poco → staleTime 10 min / gcTime 30 min.
 *   - El detalle (con síntomas + transmisión) cachea por slug ó id.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { diseasesApi } from '@/api/diseases.api';
import type {
  DiseaseListFilters,
  CreateDiseaseInput,
  UpdateDiseaseInput,
  UpdateDiseaseMediaInput,
  AddDiseaseMediaUrlInput,
  UploadDiseaseMediaOptions,
} from '@/types/disease.dtos';

// ── Query keys ──────────────────────────────────────────────────────────────

export const diseaseKeys = {
  all: ['diseases'] as const,
  lists: () => [...diseaseKeys.all, 'list'] as const,
  list: (filters: DiseaseListFilters) => [...diseaseKeys.lists(), filters] as const,
  details: () => [...diseaseKeys.all, 'detail'] as const,
  detail: (id: string) => [...diseaseKeys.details(), id] as const,
  bySlug: (slug: string) => [...diseaseKeys.all, 'by-slug', slug] as const,
  symptoms: (id: string) => [...diseaseKeys.all, 'symptoms', id] as const,
  transmission: (id: string) => [...diseaseKeys.all, 'transmission', id] as const,
  media: (id: string) => [...diseaseKeys.all, 'media', id] as const,
  active: () => [...diseaseKeys.all, 'active'] as const,
} as const;

// ── Catálogo paginado ───────────────────────────────────────────────────────

export function useDiseases(filters: DiseaseListFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diseaseKeys.list(filters),
    queryFn: async () => {
      const res = await diseasesApi.list(filters);
      // Devolvemos el envelope completo (data + pagination).
      return res.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
  });
}

/**
 * Lista derivada — solo enfermedades activas, sin paginación visible.
 * Pensado para alimentar `<Select>` de filtros (e.g. MapFiltersPanel) y
 * formularios de "reportar caso". Pide hasta 200 entradas (el catálogo
 * realista nunca llega a eso).
 */
export function useActiveDiseases(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diseaseKeys.active(),
    queryFn: async () => {
      const res = await diseasesApi.list({ limit: 200, page: 1 });
      return res.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
    select: (data) => data.filter((d) => d.isActive),
  });
}

// ── Detalle ─────────────────────────────────────────────────────────────────

export function useDisease(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diseaseKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await diseasesApi.getById(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 10 * 60_000,
  });
}

/**
 * Resolver una enfermedad por slug (URL-friendly).
 * Usado por la página de detalle del catálogo (`/health/diseases/catalogo/:slug`).
 * Devuelve `null` si no existe — la página debe mostrar un 404 amigable.
 */
export function useDiseaseBySlug(slug: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diseaseKeys.bySlug(slug ?? ''),
    queryFn: () => diseasesApi.getBySlug(slug!),
    enabled: !!slug && (options?.enabled ?? true),
    staleTime: 10 * 60_000,
  });
}

export function useDiseaseSymptoms(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diseaseKeys.symptoms(id ?? ''),
    queryFn: async () => {
      const res = await diseasesApi.getSymptoms(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 10 * 60_000,
  });
}

export function useDiseaseTransmission(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diseaseKeys.transmission(id ?? ''),
    queryFn: async () => {
      const res = await diseasesApi.getTransmission(id!);
      return res.data.data;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 10 * 60_000,
  });
}

// ── Mutaciones (SUPER_ADMIN) ────────────────────────────────────────────────

export function useCreateDisease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDiseaseInput) => {
      const res = await diseasesApi.create(data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: diseaseKeys.lists() });
      qc.invalidateQueries({ queryKey: diseaseKeys.active() });
    },
  });
}

export function useUpdateDisease(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateDiseaseInput) => {
      const res = await diseasesApi.update(id, data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: diseaseKeys.detail(id) });
      qc.invalidateQueries({ queryKey: diseaseKeys.lists() });
      qc.invalidateQueries({ queryKey: diseaseKeys.active() });
    },
  });
}

// ── Media (Fase 1b) ─────────────────────────────────────────────────────────
//
// Las mutaciones invalidan TANTO `media(id)` (la query dedicada usada por
// MediaGallery) COMO `detail(id)` y `bySlug` (que llevan `media[]` eager).
// Esto garantiza que el grid inline del detalle se refresque al subir/borrar
// sin esperar al staleTime de 10 min.

function invalidateDiseaseMediaCaches(qc: ReturnType<typeof useQueryClient>, diseaseId: string) {
  qc.invalidateQueries({ queryKey: diseaseKeys.media(diseaseId) });
  qc.invalidateQueries({ queryKey: diseaseKeys.detail(diseaseId) });
  // bySlug cache no se puede invalidar selectivamente sin saber el slug,
  // así que invalidamos la rama entera "by-slug" — barato (1 entrada típica).
  qc.invalidateQueries({ queryKey: [...diseaseKeys.all, 'by-slug'] });
}

export function useDiseaseMedia(diseaseId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diseaseKeys.media(diseaseId ?? ''),
    queryFn: async () => {
      const res = await diseasesApi.listMedia(diseaseId!);
      return res.data.data;
    },
    enabled: !!diseaseId && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}

type UploadDiseaseMediaVars =
  & { file: File; caption?: string }
  & UploadDiseaseMediaOptions;

export function useUploadDiseaseMedia(diseaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: UploadDiseaseMediaVars) => {
      const { file, ...opts } = vars;
      const res = await diseasesApi.uploadMedia(diseaseId, file, opts);
      return res.data.data;
    },
    onSuccess: () => invalidateDiseaseMediaCaches(qc, diseaseId),
  });
}

export function useAddDiseaseMediaUrl(diseaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddDiseaseMediaUrlInput) => {
      const res = await diseasesApi.addMediaUrl(diseaseId, data);
      return res.data.data;
    },
    onSuccess: () => invalidateDiseaseMediaCaches(qc, diseaseId),
  });
}

export function useUpdateDiseaseMedia(diseaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mediaId, data }: { mediaId: string; data: UpdateDiseaseMediaInput }) => {
      const res = await diseasesApi.updateMedia(diseaseId, mediaId, data);
      return res.data.data;
    },
    onSuccess: () => invalidateDiseaseMediaCaches(qc, diseaseId),
  });
}

export function useDeleteDiseaseMedia(diseaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const res = await diseasesApi.deleteMedia(diseaseId, mediaId);
      return res.data.data;
    },
    onSuccess: () => invalidateDiseaseMediaCaches(qc, diseaseId),
  });
}
