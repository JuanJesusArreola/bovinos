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

export const healthApi = {
  // ── Records CRUD ─────────────────────────────────────────────────────
  getHistory: (bovineId: string) =>
    apiClient.get<ApiResponse<HealthRecord[]>>(`/health/bovine/${bovineId}/history`),

  getSummary: (bovineId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/health/bovine/${bovineId}/summary`),

  getRecord: (id: string) =>
    apiClient.get<ApiResponse<HealthRecord>>(`/health/records/${id}`),

  createRecord: (data: HealthCheckFormData) =>
    apiClient.post<ApiResponse<HealthRecord>>('/health/records', data),

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
  recordDiagnosis: (data: DiagnosisData & { healthRecordId: string }) =>
    apiClient.post<ApiResponse<unknown>>('/health/diagnosis/record', data),

  confirmDiagnosis: (data: { diagnosisId: string }) =>
    apiClient.post<ApiResponse<unknown>>('/health/diagnosis/confirm', data),

  getDiagnosisStats: () =>
    apiClient.get<ApiResponse<unknown>>('/health/diagnosis/stats'),

  // ── Treatment ────────────────────────────────────────────────────────
  startTreatment: (data: TreatmentData & { healthRecordId: string }) =>
    apiClient.post<ApiResponse<unknown>>('/health/treatment/start', data),

  recordMedication: (data: unknown) =>
    apiClient.post<ApiResponse<unknown>>('/health/treatment/medication/record', data),

  completeTreatment: (data: { treatmentId: string }) =>
    apiClient.post<ApiResponse<unknown>>('/health/treatment/complete', data),

  getWithdrawalPeriods: (healthId: string) =>
    apiClient.get<ApiResponse<unknown>>(`/health/treatment/withdrawal/${healthId}`),

  // ── Laboratory ───────────────────────────────────────────────────────
  addLabResults: (data: Partial<LaboratoryResult>) =>
    apiClient.post<ApiResponse<LaboratoryResult>>('/health/laboratory/results', data),

  getAbnormalByHealth: (healthId: string) =>
    apiClient.get<ApiResponse<LaboratoryResult[]>>(`/health/laboratory/abnormal/${healthId}`),

  getAbnormalByBovine: (bovineId: string) =>
    apiClient.get<ApiResponse<LaboratoryResult[]>>(`/health/laboratory/bovine/${bovineId}/abnormal`),

  getAbnormalByRanch: (ranchId: string) =>
    apiClient.get<ApiResponse<LaboratoryResult[]>>(`/health/laboratory/ranch/${ranchId}/abnormal`),
};
