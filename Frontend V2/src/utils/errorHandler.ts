/**
 * Centralized API error handling utilities.
 *
 * Backend always returns:
 *   { success: false, error: "Mensaje en español", code: "CODE_IDENTIFIER", details?: any }
 *
 * Usage:
 *   const msg  = getFriendlyMessage(err);         // text to show user
 *   const code = getErrorCode(err);               // for switch/case UI logic
 *   const fields = getValidationFields(err);      // for form.setError()
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  success: false;
  error: string;
  code?: string;
  details?: {
    fields?: Array<{ field: string; message: string; code?: string }>;
    [key: string]: unknown;
  };
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true when the error has no HTTP response (network failure / offline).
 */
export function isNetworkError(err: unknown): boolean {
  return !!(err && typeof err === 'object' && 'isAxiosError' in err && !(err as any).response);
}

/**
 * Extracts the business error code from a backend error.
 * Returns undefined for network errors or unknown shapes.
 */
export function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const response = (err as any).response;
  return response?.data?.code ?? response?.data?.errors?.[0]?.code;
}

/**
 * Returns a user-facing message in Spanish for any kind of error.
 * Prefers the backend's own `error` field when present.
 */
export function getFriendlyMessage(err: unknown): string {
  if (isNetworkError(err)) return 'Sin conexión. Verifica tu internet e intenta de nuevo.';

  const response = (err as any)?.response;
  if (!response) return 'Error inesperado. Intenta de nuevo.';

  const data: ApiErrorBody | undefined = response.data;
  const status: number = response.status;

  // Use the backend's own human-readable message first
  if (data?.error) return data.error;

  // Fallback by HTTP status
  switch (status) {
    case 400: return 'Los datos enviados son inválidos.';
    case 401: return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    case 403: return 'No tienes permiso para esta acción.';
    case 404: return 'El recurso solicitado no fue encontrado.';
    case 409: return 'Ya existe un registro con esos datos.';
    case 413: return 'El archivo es demasiado grande.';
    case 422: return 'No se puede procesar la solicitud con los datos proporcionados.';
    case 429: return 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
    case 503: return 'Servicio temporalmente no disponible. Intenta más tarde.';
    default:  return status >= 500 ? 'Error del servidor. Intenta de nuevo más tarde.' : 'Algo salió mal.';
  }
}

/**
 * Extracts field-level validation errors from VALIDATION_ERROR responses.
 * Returns a map of { fieldName: errorMessage } ready for form.setError().
 *
 * @example
 * const fields = getValidationFields(err);
 * Object.entries(fields).forEach(([field, msg]) => form.setError(field as any, { message: msg }));
 */
export function getValidationFields(err: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  const errors: unknown = (err as any)?.response?.data?.errors;
  if (!Array.isArray(errors)) return fields;
  for (const e of errors) {
    if (e && typeof e === 'object' && 'field' in e && 'message' in e) {
      fields[(e as any).field] = (e as any).message;
    }
  }
  return fields;
}

/**
 * Backend payload for the POINT_OUTSIDE_RANCH_BOUNDARY error.
 * Returns null when the response is not that specific error.
 */
export interface OutsideRanchBoundaryDetails {
  point: { latitude: number; longitude: number };
  ranchName?: string;
  ranchId?: string;
  boundaryType?: 'CIRCULAR' | 'RECTANGULAR' | 'POLYGON' | 'CORRIDOR' | string;
}

export function getOutsideRanchBoundaryDetails(err: unknown): OutsideRanchBoundaryDetails | null {
  if (getErrorCode(err) !== ErrorCodes.POINT_OUTSIDE_RANCH_BOUNDARY) return null;
  const details = (err as any)?.response?.data?.details;
  if (!details || !details.point) return null;
  return details as OutsideRanchBoundaryDetails;
}

/**
 * Backend payload for the BOUNDARY_LEAVES_LOCATIONS_OUTSIDE error (HTTP 409).
 * Returned by PUT /api/ranches/:id/boundary when the new boundary would leave
 * existing locations outside.
 */
export interface BoundaryConflictDetails {
  boundaryType: 'CIRCULAR' | 'RECTANGULAR' | 'POLYGON' | 'CORRIDOR' | string;
  outsideLocations: Array<{
    id: string;
    name: string;
    locationCode: string;
    coordinates: { latitude: number; longitude: number };
  }>;
}

export function getBoundaryConflictDetails(err: unknown): BoundaryConflictDetails | null {
  if (getErrorCode(err) !== ErrorCodes.BOUNDARY_LEAVES_LOCATIONS_OUTSIDE) return null;
  const details = (err as any)?.response?.data?.details;
  if (!details || !Array.isArray(details.outsideLocations)) return null;
  return details as BoundaryConflictDetails;
}

/**
 * Determines the toast variant to use based on HTTP status.
 */
export function getToastVariant(err: unknown): 'error' | 'warning' | 'info' {
  const status: number = (err as any)?.response?.status ?? 0;
  if (status === 422 || status === 409) return 'warning';
  if (status === 403 || status === 404) return 'info';
  return 'error';
}

// ─── Error code constants ─────────────────────────────────────────────────────
// Use these in switch/case to avoid magic strings.

export const ErrorCodes = {
  // Auth
  AUTH_INVALID_CREDENTIALS:   'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED:         'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID:         'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_REVOKED:         'AUTH_TOKEN_REVOKED',
  AUTH_ACCOUNT_LOCKED:        'AUTH_ACCOUNT_LOCKED',
  AUTH_EMAIL_NOT_VERIFIED:    'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_ACCOUNT_INACTIVE:      'AUTH_ACCOUNT_INACTIVE',

  // Users
  USER_EMAIL_EXISTS:          'USER_EMAIL_EXISTS',
  USER_USERNAME_EXISTS:       'USER_USERNAME_EXISTS',
  USER_WEAK_PASSWORD:         'USER_WEAK_PASSWORD',
  USER_PASSWORD_MISMATCH:     'USER_PASSWORD_MISMATCH',
  INSUFFICIENT_PERMISSIONS:   'INSUFFICIENT_PERMISSIONS',
  ROLE_HIERARCHY_VIOLATION:   'ROLE_HIERARCHY_VIOLATION',

  // Bovines
  BOVINE_NOT_FOUND:           'BOVINE_NOT_FOUND',
  BOVINE_DUPLICATE_EAR_TAG:   'BOVINE_DUPLICATE_EAR_TAG',
  BOVINE_INVALID_AGE_FOR_TYPE:'BOVINE_INVALID_AGE_FOR_TYPE',
  BOVINE_INVALID_GENDER_FOR_TYPE: 'BOVINE_INVALID_GENDER_FOR_TYPE',
  BOVINE_LOCATION_FULL:       'BOVINE_LOCATION_FULL',
  BOVINE_INVALID_PARENT:      'BOVINE_INVALID_PARENT',
  BOVINE_SELF_PARENT:         'BOVINE_SELF_PARENT',
  BOVINE_HAS_ACTIVE_RECORDS:  'BOVINE_HAS_ACTIVE_RECORDS',
  RANCH_MISMATCH:             'RANCH_MISMATCH',

  // Locations
  LOCATION_NOT_FOUND:         'LOCATION_NOT_FOUND',
  LOCATION_DUPLICATE_NAME:    'LOCATION_DUPLICATE_NAME',
  LOCATION_CAPACITY_EXCEEDED: 'LOCATION_CAPACITY_EXCEEDED',
  LOCATION_HAS_CHILDREN:      'LOCATION_HAS_CHILDREN',
  LOCATION_HAS_BOVINES:       'LOCATION_HAS_BOVINES',
  LOCATION_PARENT_CYCLE:      'LOCATION_PARENT_CYCLE',
  LOCATION_DIFFERENT_RANCH:   'LOCATION_DIFFERENT_RANCH',
  POINT_OUTSIDE_RANCH_BOUNDARY: 'POINT_OUTSIDE_RANCH_BOUNDARY',

  // Health
  HEALTH_NOT_FOUND:           'HEALTH_NOT_FOUND',
  TREATMENT_ALREADY_ACTIVE:   'TREATMENT_ALREADY_ACTIVE',
  TREATMENT_NOT_ACTIVE:       'TREATMENT_NOT_ACTIVE',
  WITHDRAWAL_PERIOD_ACTIVE:   'WITHDRAWAL_PERIOD_ACTIVE',
  VACCINATION_TOO_SOON:       'VACCINATION_TOO_SOON',
  MEDICATION_OUT_OF_STOCK:    'MEDICATION_OUT_OF_STOCK',
  MEDICATION_EXPIRED:         'MEDICATION_EXPIRED',
  DIAGNOSIS_REQUIRES_SYMPTOMS:'DIAGNOSIS_REQUIRES_SYMPTOMS',

  // Ranch
  RANCH_NOT_FOUND:            'RANCH_NOT_FOUND',
  RANCH_HAS_BOVINES:          'RANCH_HAS_BOVINES',
  RANCH_HAS_LOCATIONS:        'RANCH_HAS_LOCATIONS',
  BOUNDARY_LEAVES_LOCATIONS_OUTSIDE: 'BOUNDARY_LEAVES_LOCATIONS_OUTSIDE',
  RELATION_CROSS_RANCH:       'RELATION_CROSS_RANCH',
  INVALID_BOUNDARY_POLYGON:   'INVALID_BOUNDARY_POLYGON',
  INVALID_BOUNDARY_CIRCULAR:  'INVALID_BOUNDARY_CIRCULAR',
  INVALID_BOUNDARY_RECTANGULAR: 'INVALID_BOUNDARY_RECTANGULAR',
  INVALID_BOUNDARY_CORRIDOR:  'INVALID_BOUNDARY_CORRIDOR',

  // Validation
  VALIDATION_ERROR:           'VALIDATION_ERROR',

  // Files
  FILE_TOO_LARGE:             'FILE_TOO_LARGE',
  FILE_INVALID_TYPE:          'FILE_INVALID_TYPE',
  FILE_UPLOAD_FAILED:         'FILE_UPLOAD_FAILED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
