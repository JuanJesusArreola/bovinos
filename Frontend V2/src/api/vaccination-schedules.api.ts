import apiClient from './client';
import type { ApiSuccessResponse } from '@/types/bovine.dtos';
import type {
  VaccinationScheduleEntry,
  CreateVaccinationScheduleInput,
  UpdateVaccinationScheduleInput,
} from '@/types/bovine.dtos';

export const vaccinationSchedulesApi = {
  /** GET /api/vaccination-schedules — lista completa del catálogo base. */
  list: () =>
    apiClient.get<ApiSuccessResponse<VaccinationScheduleEntry[]>>('/vaccination-schedules'),

  /** POST /api/vaccination-schedules — crea una nueva entrada (OWNER/VET). */
  create: (data: CreateVaccinationScheduleInput) =>
    apiClient.post<ApiSuccessResponse<VaccinationScheduleEntry>>('/vaccination-schedules', data),

  /** PATCH /api/vaccination-schedules/:id — actualiza parcialmente (OWNER/VET). */
  update: (id: string, data: UpdateVaccinationScheduleInput) =>
    apiClient.patch<ApiSuccessResponse<VaccinationScheduleEntry>>(
      `/vaccination-schedules/${id}`,
      data,
    ),

  /** DELETE /api/vaccination-schedules/:id — elimina la entrada (OWNER/VET). */
  delete: (id: string) =>
    apiClient.delete<ApiSuccessResponse<null>>(`/vaccination-schedules/${id}`),
};
