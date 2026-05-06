export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OWNER = 'OWNER',
  RANCH_MANAGER = 'RANCH_MANAGER',
  MANAGER = 'MANAGER',
  VETERINARIAN = 'VETERINARIAN',
  WORKER = 'WORKER',
  VIEWER = 'VIEWER',
}

export interface RanchAccess {
  ranchId: string;
  ranchName?: string;
  accessLevel: string;
  isActive: boolean;
}

export interface User {
  id: string;
  userCode?: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  phone?: string;
  role: UserRole;
  roleLabel?: string;
  status?: string;
  avatar?: string;
  isActive: boolean;
  isVerified?: boolean;
  emailVerified: boolean;
  phoneVerified?: boolean;
  verificationScore?: number;
  lastLoginAt?: string;
  ranchAccess?: RanchAccess[];
  createdAt: string;
  updatedAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}
