import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL, TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '@/utils/constants';

// ─── Extend Axios config to support `silent` flag ─────────────────────────────
// When silent=true, the interceptor will NOT show a generic toast.
// Use this in mutations that handle their own error UI (e.g. form field errors).
declare module 'axios' {
  interface AxiosRequestConfig {
    silent?: boolean;
  }
}

// ─── Global toast bridge ──────────────────────────────────────────────────────
// The interceptor lives outside React, so we can't call useToast() here.
// Components can register a toast function via setGlobalToast() at app startup.
type ToastFn = (title: string, message?: string) => void;
let _globalToastError: ToastFn | null = null;
let _globalToastWarning: ToastFn | null = null;

export function setGlobalToast(error: ToastFn, warning: ToastFn) {
  _globalToastError   = error;
  _globalToastWarning = warning;
}

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

// Request interceptor — attach token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });

        const newToken = data.data?.token || data.token;
        const newRefresh = data.data?.refreshToken || data.refreshToken;

        localStorage.setItem(TOKEN_KEY, newToken);
        if (newRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Network error (no response at all) ───────────────────────────────
    if (!error.response) {
      if (!originalRequest.silent) {
        _globalToastError?.('Sin conexión', 'Verifica tu internet e intenta de nuevo.');
      }
      return Promise.reject(error);
    }

    const status = error.response.status;

    // ── Rate limit ────────────────────────────────────────────────────────
    if (status === 429) {
      _globalToastWarning?.('Demasiadas solicitudes', 'Espera un momento e intenta de nuevo.');
      return Promise.reject(error);
    }

    // ── Service unavailable ───────────────────────────────────────────────
    if (status === 503) {
      _globalToastError?.('Servicio no disponible', 'El servidor está temporalmente fuera. Intenta más tarde.');
      return Promise.reject(error);
    }

    // ── Generic toast for non-silent, non-401 errors ──────────────────────
    // Mutations that handle field-level errors should pass { silent: true }.
    if (!originalRequest.silent && status !== 401) {
      const data = error.response.data as any;
      const msg  = data?.error ?? 'Algo salió mal. Intenta de nuevo.';
      if (status === 422 || status === 409) {
        _globalToastWarning?.('Aviso', msg);
      } else {
        _globalToastError?.('Error', msg);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
