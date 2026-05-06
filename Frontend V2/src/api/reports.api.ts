import apiClient from './client';
import type { ApiResponse } from '@/types';

export const reportsApi = {
  generate: (data: { type: string; filters?: Record<string, unknown> }) =>
    apiClient.post<ApiResponse<unknown>>('/reports/generate', data),

  export: (data: { type: string; format: 'pdf' | 'excel'; filters?: Record<string, unknown> }) =>
    apiClient.post('/reports/export', data, { responseType: 'blob' }),
};
