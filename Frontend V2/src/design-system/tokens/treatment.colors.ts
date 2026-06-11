export const TREATMENT_STATUS_COLORS = {
  ACTIVE: '#22c55e',
  COMPLETED: '#6b7280',
  SUSPENDED: '#f59e0b',
  FAILED: '#ef4444',
  CANCELLED: '#6b7280',
} as const;

export const TREATMENT_STATUS_LABELS = {
  ACTIVE: 'En curso',
  COMPLETED: 'Completado',
  SUSPENDED: 'Suspendido',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
} as const;

/** Clases Tailwind para Badges de estado de tratamiento. */
export const TREATMENT_STATUS_BADGE_CLASSES = {
  ACTIVE:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  COMPLETED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  FAILED:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
} as const;

/**
 * Vías de administración de medicamentos — labels + clases.
 * Antes vivía duplicado en `BovineTreatmentsTab.tsx` como `ROUTE_CONFIG`.
 */
export const ADMIN_ROUTE_LABELS = {
  ORAL:          'Oral',
  INJECTABLE:    'Inyectable',
  INTRAMUSCULAR: 'IM',
  INTRAVENOUS:   'IV',
  SUBCUTANEOUS:  'SC',
  TOPICAL:       'Tópico',
} as const;

export const ADMIN_ROUTE_BADGE_CLASSES = {
  ORAL:          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INJECTABLE:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  INTRAMUSCULAR: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  INTRAVENOUS:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SUBCUTANEOUS:  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  TOPICAL:       'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
} as const;

/** Renombrado a *Key para no colisionar con el enum `TreatmentStatus` de
 *  `types/health.types.ts`. */
export type TreatmentStatusKey = keyof typeof TREATMENT_STATUS_COLORS;
export type AdminRouteKey = keyof typeof ADMIN_ROUTE_LABELS;

// ── Helpers defensivos ────────────────────────────────────────────────────

/** Color hex del estado del tratamiento, fallback gris (COMPLETED). */
export function getTreatmentStatusColor(status: string | undefined | null): string {
  if (!status) return TREATMENT_STATUS_COLORS.COMPLETED;
  return (TREATMENT_STATUS_COLORS as Record<string, string>)[status] ?? TREATMENT_STATUS_COLORS.COMPLETED;
}

/** Etiqueta localizada del estado de tratamiento. */
export function getTreatmentStatusLabel(status: string | undefined | null): string {
  if (!status) return TREATMENT_STATUS_LABELS.COMPLETED;
  return (TREATMENT_STATUS_LABELS as Record<string, string>)[status] ?? TREATMENT_STATUS_LABELS.COMPLETED;
}

/** Clases Tailwind del badge del estado de tratamiento. */
export function getTreatmentStatusBadgeClass(status: string | undefined | null): string {
  if (!status) return TREATMENT_STATUS_BADGE_CLASSES.COMPLETED;
  return (TREATMENT_STATUS_BADGE_CLASSES as Record<string, string>)[status] ?? TREATMENT_STATUS_BADGE_CLASSES.COMPLETED;
}

/** Etiqueta corta de la vía de administración (ORAL/IM/IV/SC/Tópico). */
export function getAdminRouteLabel(route: string | undefined | null): string {
  if (!route) return ADMIN_ROUTE_LABELS.ORAL;
  return (ADMIN_ROUTE_LABELS as Record<string, string>)[route] ?? route.replace(/_/g, ' ');
}

/** Clases Tailwind del badge de la vía de administración. */
export function getAdminRouteBadgeClass(route: string | undefined | null): string {
  if (!route) return ADMIN_ROUTE_BADGE_CLASSES.ORAL;
  return (ADMIN_ROUTE_BADGE_CLASSES as Record<string, string>)[route]
    ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}