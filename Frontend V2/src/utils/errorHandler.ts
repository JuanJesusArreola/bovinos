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

// ─── Bovine-module errors (Phase F9) ───────────────────────────────────────

/**
 * BOVINE_HAS_ACTIVE_RECORDS — DELETE blocked because related records exist.
 * Backend returns `details.records[]` (or `details.activeRecords[]`) with
 * the entries that need to be closed first.
 */
export interface BovineHasActiveRecordsDetails {
  records?: Array<{
    type?: string;
    recordType?: string;
    id?: string;
  }>;
  activeRecords?: Array<{ type?: string; recordType?: string; id?: string }>;
}

export function getBovineActiveRecords(err: unknown): string[] {
  if (getErrorCode(err) !== ErrorCodes.BOVINE_HAS_ACTIVE_RECORDS) return [];
  const d = (err as any)?.response?.data?.details as BovineHasActiveRecordsDetails | undefined;
  const list = (d?.records ?? d?.activeRecords ?? []) as Array<{
    type?: string;
    recordType?: string;
    id?: string;
  }>;
  return list
    .map((r) => r.type ?? r.recordType ?? r.id ?? '')
    .filter(Boolean);
}

/**
 * BOVINE_DUPLICATE_EAR_TAG — backend rejected an ear tag already used.
 * `details.earTag` carries the conflicting value.
 */
export function getBovineDuplicateEarTag(err: unknown): string | null {
  if (getErrorCode(err) !== ErrorCodes.BOVINE_DUPLICATE_EAR_TAG) return null;
  return ((err as any)?.response?.data?.details?.earTag as string) ?? null;
}

/**
 * BOVINE_LOCATION_FULL — destination location has no capacity.
 * `details.location` may carry `{ id, name, maxAnimals, currentAnimals }`.
 */
export interface BovineLocationFullDetails {
  location?: {
    id?: string;
    name?: string;
    maxAnimals?: number;
    currentAnimals?: number;
  };
}

export function getBovineLocationFullDetails(err: unknown): BovineLocationFullDetails | null {
  if (getErrorCode(err) !== ErrorCodes.BOVINE_LOCATION_FULL) return null;
  return ((err as any)?.response?.data?.details as BovineLocationFullDetails) ?? null;
}

/**
 * RANCH_MISMATCH — operation tried to mix entities from different ranches.
 * `details.expectedRanchId` and `details.actualRanchId` (or similar names).
 */
export interface RanchMismatchDetails {
  expectedRanchId?: string;
  actualRanchId?: string;
  expectedRanchName?: string;
  actualRanchName?: string;
}

export function getRanchMismatchDetails(err: unknown): RanchMismatchDetails | null {
  if (getErrorCode(err) !== ErrorCodes.RANCH_MISMATCH) return null;
  return ((err as any)?.response?.data?.details as RanchMismatchDetails) ?? null;
}

/**
 * FILE_TOO_LARGE — backend rejected the upload.
 * `details.maxSize` (bytes) and `details.actualSize` (bytes) may be present.
 */
export interface FileTooLargeDetails {
  maxSize?: number;
  actualSize?: number;
  mediaType?: string;
}

export function getFileTooLargeDetails(err: unknown): FileTooLargeDetails | null {
  if (getErrorCode(err) !== ErrorCodes.FILE_TOO_LARGE) return null;
  return ((err as any)?.response?.data?.details as FileTooLargeDetails) ?? null;
}

/**
 * FILE_INVALID_TYPE — backend rejected the MIME type.
 * `details.allowedTypes` (string[]) and `details.actualType` (string) may be present.
 */
export interface FileInvalidTypeDetails {
  allowedTypes?: string[];
  actualType?: string;
  mediaType?: string;
}

export function getFileInvalidTypeDetails(err: unknown): FileInvalidTypeDetails | null {
  if (getErrorCode(err) !== ErrorCodes.FILE_INVALID_TYPE) return null;
  return ((err as any)?.response?.data?.details as FileInvalidTypeDetails) ?? null;
}

/**
 * Unified helper that returns a user-facing message for the most common
 * bovine-module errors. Falls back to `getFriendlyMessage` for everything else.
 * Use this in mutation `onError` handlers to keep them small.
 */
export function getBovineErrorMessage(err: unknown): string {
  const code = getErrorCode(err);

  if (code === ErrorCodes.BOVINE_NOT_FOUND) {
    return 'No se encontró el bovino. Es posible que haya sido eliminado.';
  }
  if (code === ErrorCodes.BOVINE_DUPLICATE_EAR_TAG) {
    const tag = getBovineDuplicateEarTag(err);
    return tag
      ? `El arete "${tag}" ya está asignado a otro bovino.`
      : 'El arete ya está asignado a otro bovino.';
  }
  if (code === ErrorCodes.BOVINE_INVALID_AGE_FOR_TYPE) {
    return 'La edad del bovino no es compatible con el tipo de ganado seleccionado.';
  }
  if (code === ErrorCodes.BOVINE_INVALID_GENDER_FOR_TYPE) {
    return 'El sexo del bovino no es compatible con el tipo de ganado seleccionado.';
  }
  if (code === ErrorCodes.BOVINE_INVALID_PARENT) {
    return 'El padre o madre indicado no es válido (debe ser un bovino existente y compatible).';
  }
  if (code === ErrorCodes.BOVINE_SELF_PARENT) {
    return 'Un bovino no puede ser su propio padre o madre.';
  }
  if (code === ErrorCodes.BOVINE_LOCATION_FULL) {
    const d = getBovineLocationFullDetails(err);
    if (d?.location?.name && d.location.maxAnimals != null) {
      return `El potrero "${d.location.name}" alcanzó su capacidad máxima (${d.location.currentAnimals ?? '?'}/${d.location.maxAnimals}).`;
    }
    return 'El potrero seleccionado alcanzó su capacidad máxima.';
  }
  if (code === ErrorCodes.BOVINE_HAS_ACTIVE_RECORDS) {
    const records = getBovineActiveRecords(err);
    return records.length
      ? `No se puede eliminar porque tiene ${records.length} registro${records.length !== 1 ? 's' : ''} activo${records.length !== 1 ? 's' : ''}: ${records.join(', ')}.`
      : 'No se puede eliminar porque tiene registros activos. Ciérralos primero.';
  }
  if (code === ErrorCodes.RANCH_MISMATCH) {
    const d = getRanchMismatchDetails(err);
    if (d?.expectedRanchName && d.actualRanchName) {
      return `Solo puedes mover el bovino dentro del mismo rancho ("${d.expectedRanchName}"). El destino pertenece a "${d.actualRanchName}".`;
    }
    return 'El destino pertenece a un rancho diferente. Solo puedes mover dentro del mismo rancho.';
  }
  if (code === ErrorCodes.FILE_TOO_LARGE) {
    const d = getFileTooLargeDetails(err);
    if (d?.maxSize) {
      const mb = (d.maxSize / 1_048_576).toFixed(1);
      return `El archivo excede el tamaño máximo permitido (${mb} MB).`;
    }
    return 'El archivo excede el tamaño máximo permitido.';
  }
  if (code === ErrorCodes.FILE_INVALID_TYPE) {
    const d = getFileInvalidTypeDetails(err);
    if (d?.allowedTypes && d.allowedTypes.length > 0) {
      return `Tipo de archivo no permitido. Acepta: ${d.allowedTypes.join(', ')}.`;
    }
    return 'Tipo de archivo no permitido para esta categoría.';
  }

  return getFriendlyMessage(err);
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
