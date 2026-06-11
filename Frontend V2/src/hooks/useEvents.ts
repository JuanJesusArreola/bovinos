/**
 * Hooks del modulo de Eventos.
 *
 * Solo cubre lo necesario para EventsListPage por ahora: listado paginado
 * con filtros y mutaciones de status (start/complete/cancel/postpone).
 * El resto del CRUD se cabela cuando exista el form de creacion/edicion.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '@/api/events.api';
import type { EventsListFilters } from '@/types/event.types';
import type { EventFormData } from '@/types';

export const eventKeys = {
  all: ['events'] as const,
  list: (filters: EventsListFilters) => [...eventKeys.all, 'list', filters] as const,
  detail: (id: string) => [...eventKeys.all, 'detail', id] as const,
  byBovine: (bovineId: string) => [...eventKeys.all, 'by-bovine', bovineId] as const,
} as const;

export function useEventsList(
  filters: EventsListFilters,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: async () => {
      const res = await eventsApi.listFiltered(filters);
      return res.data; // envelope { success, data, pagination }
    },
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: eventKeys.all });
}

export function useCompleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await eventsApi.complete(id);
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCancelEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await eventsApi.cancel(id);
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useStartEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await eventsApi.start(id);
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/**
 * Crea un evento manualmente. El backend siempre setea `createdBy` con
 * el usuario autenticado del token; el frontend no necesita enviarlo.
 */
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: EventFormData & { ranchId?: string }) => {
      const res = await eventsApi.create(data);
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
