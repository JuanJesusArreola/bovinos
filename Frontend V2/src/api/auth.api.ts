import apiClient from './client';
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  User,
} from '@/types';

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data),

  register: (data: RegisterRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/register', data),

  refreshToken: (refreshToken: string) =>
    apiClient.post<ApiResponse<{ token: string; refreshToken: string }>>('/auth/refresh-token', { refreshToken }),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/forgot-password', data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/reset-password', data),

  verifyEmail: (token: string) =>
    apiClient.get<ApiResponse<{ message: string }>>(`/auth/verify-email?token=${token}`),

  resendVerification: (email: string) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/resend-verification', { email }),

  logout: () =>
    apiClient.post<ApiResponse<null>>('/auth/logout'),

  changePassword: (data: ChangePasswordRequest) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/change-password', data),

  getProfile: () =>
    apiClient.get<ApiResponse<User>>('/users/profile'),

  updateProfile: (data: Partial<User>) =>
    apiClient.put<ApiResponse<User>>('/users/profile', data),
};
