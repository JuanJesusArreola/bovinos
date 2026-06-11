import { UserRole } from '@/types';
import { getRoleClassName } from '@/design-system/tokens';

// ─── Role hierarchy (higher = more privileges) ────────────────────────────

const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.OWNER]:        6,
  [UserRole.SUPER_ADMIN]:  5,
  [UserRole.RANCH_MANAGER]:4,
  [UserRole.MANAGER]:      3,
  [UserRole.VETERINARIAN]: 2,
  [UserRole.WORKER]:       1,
  [UserRole.VIEWER]:       0,
};

// ─── Actions ──────────────────────────────────────────────────────────────

export type Action =
  // Generic CRUD
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'UPLOAD'
  // Ranch
  | 'MANAGE_RANCH'
  | 'DELETE_RANCH'
  // Bovine
  | 'MANAGE_BOVINE'
  | 'DELETE_BOVINE'
  | 'MOVE_BOVINE'
  /** Visualizar el QR de un bovino (modal, impresión). Disponible a todos los roles autenticados. */
  | 'VIEW_QR'
  /** Regenerar (rotar) el código QR de un bovino. Acción destructiva del valor anterior. */
  | 'REGENERATE_QR'
  // Health / Veterinary
  | 'RECORD_HEALTH'
  | 'MANAGE_HEALTH'
  | 'PRESCRIBE_MEDICATION'
  | 'COMPLETE_TREATMENT'
  // Locations
  | 'MANAGE_LOCATION'
  | 'DELETE_LOCATION'
  // Users
  | 'MANAGE_USERS'
  | 'DELETE_USER'
  // Security
  | 'VIEW_SECURITY'
  | 'RESOLVE_SECURITY'
  // Inventory / Medications
  | 'MANAGE_INVENTORY'
  | 'MANAGE_MEDICATIONS'
  // Reports
  | 'VIEW_REPORTS'
  | 'EXPORT_REPORTS'
  // ─── Disease module (Fases 1-5) ───────────────────────────────────────
  /**
   * Ver el catálogo de enfermedades (lista + detalle, síntomas, transmisión).
   * Es informacional para TODOS los usuarios autenticados — se usa al reportar
   * casos clínicos. NO confundir con `MANAGE_DISEASES`.
   */
  | 'VIEW_DISEASES'
  /** Crear / editar / desactivar entradas del catálogo global. Solo SUPER_ADMIN. */
  | 'MANAGE_DISEASES'
  /**
   * Subir / editar / eliminar imágenes y videos asociados a una enfermedad
   * del catálogo. Más permisivo que `MANAGE_DISEASES` porque enriquecer el
   * catálogo con fotos clínicas es algo que puede hacer cualquier rol
   * clínico/gerencial, no solo el admin que mantiene la taxonomía.
   *
   * Roles permitidos por backend: SUPER_ADMIN, OWNER, MANAGER, RANCH_MANAGER,
   * VETERINARIAN. Espeja `CLINICAL_ROLES` del router.
   */
  | 'MANAGE_DISEASE_MEDIA'
  /** Registrar un caso clínico (diagnosticar un bovino con una enfermedad). */
  | 'RECORD_CASE'
  /** Editar status / severity / notas y agregar síntomas / tratamientos / labs. */
  | 'MANAGE_CASE'
  /** Cerrar un caso (outcome: RECOVERED / DECEASED / TRANSFERRED / UNKNOWN). */
  | 'CLOSE_CASE'
  /** Ver dashboard epidemiológico (snapshots, trend, top-diseases, brotes). */
  | 'VIEW_EPIDEMIOLOGY'
  /** Disparar manualmente el recálculo nocturno de snapshots. Solo SUPER_ADMIN. */
  | 'COMPUTE_EPIDEMIOLOGY'
  /** Ejecutar la detección de contactos epidemiológicos para un caso. */
  | 'DETECT_CONTACTS';

// ─── Resource → minimum role required per action ──────────────────────────

const PERMISSIONS: Record<Action, UserRole[]> = {
  // VIEW — todos pueden ver
  VIEW: [UserRole.VIEWER, UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // CRUD genérico
  CREATE:  [UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  EDIT:    [UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  DELETE:  [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  UPLOAD:  [UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Ranch
  MANAGE_RANCH: [UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  DELETE_RANCH: [UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Bovine
  MANAGE_BOVINE: [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  DELETE_BOVINE: [UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  MOVE_BOVINE:   [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  // VIEW_QR — cualquier usuario autenticado puede ver/imprimir el QR (lectura
  // en campo, escaneo de identificación). NO permite regenerarlo.
  VIEW_QR:       [UserRole.VIEWER, UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  // REGENERATE_QR — solo gestores. Rotar el código invalida QRs físicos ya
  // impresos y se considera una acción de "control" del rancho.
  REGENERATE_QR: [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Health / Veterinary
  RECORD_HEALTH:       [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  MANAGE_HEALTH:       [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  PRESCRIBE_MEDICATION:[UserRole.VETERINARIAN, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  COMPLETE_TREATMENT:  [UserRole.VETERINARIAN, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Locations
  MANAGE_LOCATION: [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  DELETE_LOCATION: [UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Users
  MANAGE_USERS: [UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  DELETE_USER:  [UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Security
  VIEW_SECURITY:    [UserRole.SUPER_ADMIN, UserRole.OWNER],
  RESOLVE_SECURITY: [UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Inventory / Medications
  MANAGE_INVENTORY:   [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  MANAGE_MEDICATIONS: [UserRole.VETERINARIAN, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Reports
  VIEW_REPORTS:   [UserRole.MANAGER, UserRole.VETERINARIAN, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  EXPORT_REPORTS: [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // ─── Disease module ──────────────────────────────────────────────────
  // Catálogo: lectura abierta a todos los roles (incluye VIEWER) como
  // material de referencia al diagnosticar. Edición restringida a SUPER_ADMIN
  // porque el catálogo es global multi-rancho.
  VIEW_DISEASES:   [UserRole.VIEWER, UserRole.WORKER, UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  MANAGE_DISEASES: [UserRole.SUPER_ADMIN, UserRole.OWNER],
  MANAGE_DISEASE_MEDIA: [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Casos clínicos: alineados con RECORD_HEALTH / MANAGE_HEALTH. Veterinario
  // y arriba pueden registrar y manejar. Cierre con outcome también requiere
  // criterio clínico → mismo nivel.
  RECORD_CASE: [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  MANAGE_CASE: [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  CLOSE_CASE:  [UserRole.VETERINARIAN, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Epidemiología: lectura igualada a VIEW_REPORTS (dashboard ejecutivo).
  // Detección de contactos requiere mismo nivel que registrar caso.
  // Trigger manual de recálculo es operación de mantenimiento (SUPER_ADMIN).
  VIEW_EPIDEMIOLOGY:    [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  DETECT_CONTACTS:      [UserRole.VETERINARIAN, UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  COMPUTE_EPIDEMIOLOGY: [UserRole.SUPER_ADMIN, UserRole.OWNER],
};

// ─── Core helpers ─────────────────────────────────────────────────────────

/** Comprueba si el rol tiene nivel igual o superior al mínimo requerido */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

/** Comprueba si el rol está en la lista dada */
export function hasAnyRole(userRole: UserRole, roles: UserRole[]): boolean {
  return roles.includes(userRole);
}

// ─── canUser — función principal ──────────────────────────────────────────

/**
 * Devuelve `true` si `userRole` puede ejecutar `action`.
 *
 * Uso:
 *   canUser(UserRole.VETERINARIAN, 'RECORD_HEALTH') // true
 *   canUser(UserRole.VIEWER, 'DELETE_BOVINE')        // false
 */
export function canUser(userRole: UserRole | null | undefined, action: Action): boolean {
  if (!userRole) return false;
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.includes(userRole);
}

// ─── Shortcuts (semántica de negocio) ────────────────────────────────────

export function canManageUsers(role: UserRole): boolean {
  return canUser(role, 'MANAGE_USERS');
}

export function canManageBovines(role: UserRole): boolean {
  return canUser(role, 'MANAGE_BOVINE');
}

export function canRecordHealth(role: UserRole): boolean {
  return canUser(role, 'RECORD_HEALTH');
}

export function canManageMedications(role: UserRole): boolean {
  return canUser(role, 'MANAGE_MEDICATIONS');
}

export function canManageRanch(role: UserRole): boolean {
  return canUser(role, 'MANAGE_RANCH');
}

export function canDeleteRanch(role: UserRole): boolean {
  return canUser(role, 'DELETE_RANCH');
}

export function canViewReports(role: UserRole): boolean {
  return canUser(role, 'VIEW_REPORTS');
}

export function canExportReports(role: UserRole): boolean {
  return canUser(role, 'EXPORT_REPORTS');
}

// ─── Disease module shortcuts ────────────────────────────────────────────

export function canManageDiseases(role: UserRole): boolean {
  return canUser(role, 'MANAGE_DISEASES');
}

export function canRecordCase(role: UserRole): boolean {
  return canUser(role, 'RECORD_CASE');
}

export function canCloseCase(role: UserRole): boolean {
  return canUser(role, 'CLOSE_CASE');
}

export function canViewEpidemiology(role: UserRole): boolean {
  return canUser(role, 'VIEW_EPIDEMIOLOGY');
}

export function canComputeEpidemiology(role: UserRole): boolean {
  return canUser(role, 'COMPUTE_EPIDEMIOLOGY');
}

export function canDetectContacts(role: UserRole): boolean {
  return canUser(role, 'DETECT_CONTACTS');
}

// ─── Labels & colors ──────────────────────────────────────────────────────

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]:   'Super Administrador',
    [UserRole.OWNER]:         'Propietario',
    [UserRole.RANCH_MANAGER]: 'Admin de Rancho',
    [UserRole.MANAGER]:       'Gerente',
    [UserRole.VETERINARIAN]:  'Veterinario',
    [UserRole.WORKER]:        'Trabajador',
    [UserRole.VIEWER]:        'Visitante',
  };
  return labels[role] || role;
}

/**
 * Devuelve el className completo (light + dark) para mostrar un rol como
 * badge / chip. La definición vive en el design-system (single source of
 * truth) — esta función es solo un thin wrapper que conserva el nombre
 * histórico `getRoleColor` para no romper a los callers existentes.
 *
 * @see USER_ROLE_COLORS en `src/design-system/tokens/user-role.colors.ts`
 */
export function getRoleColor(role: UserRole): string {
  return getRoleClassName(role);
}
