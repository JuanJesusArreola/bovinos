import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vaccinationSchedulesApi } from '@/api/vaccination-schedules.api';
import type {
  CreateVaccinationScheduleInput,
  UpdateVaccinationScheduleInput,
} from '@/types/bovine.dtos';

export const vaccinationScheduleKeys = {
  all: ['vaccination-schedules'] as const,
  list: () => [...vaccinationScheduleKeys.all, 'list'] as const,
} as const;

export function useVaccinationSchedules() {
  return useQuery({
    queryKey: vaccinationScheduleKeys.list(),
    queryFn: async () => {
      const res = await vaccinationSchedulesApi.list();
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateVaccinationSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVaccinationScheduleInput) =>
      vaccinationSchedulesApi.create(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vaccinationScheduleKeys.all });
    },
  });
}

export function useUpdateVaccinationSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVaccinationScheduleInput }) =>
      vaccinationSchedulesApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vaccinationScheduleKeys.all });
    },
  });
}

export function useDeleteVaccinationSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaccinationSchedulesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vaccinationScheduleKeys.all });
    },
  });
}
