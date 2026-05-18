import { UserRole } from '@/types';

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
  | 'EXPORT_REPORTS';

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
  MANAGE_USERS: [UserRole.SUPER_ADMIN, UserRole.OWNER],
  DELETE_USER:  [UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Security
  VIEW_SECURITY:    [UserRole.SUPER_ADMIN, UserRole.OWNER],
  RESOLVE_SECURITY: [UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Inventory / Medications
  MANAGE_INVENTORY:   [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  MANAGE_MEDICATIONS: [UserRole.VETERINARIAN, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],

  // Reports
  VIEW_REPORTS:   [UserRole.MANAGER, UserRole.VETERINARIAN, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
  EXPORT_REPORTS: [UserRole.MANAGER, UserRole.RANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.OWNER],
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

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]:   'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    [UserRole.OWNER]:         'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    [UserRole.RANCH_MANAGER]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    [UserRole.MANAGER]:       'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    [UserRole.VETERINARIAN]:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    [UserRole.WORKER]:        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    [UserRole.VIEWER]:        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}
