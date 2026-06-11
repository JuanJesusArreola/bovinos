/**
 * Razones de movimiento entre potreros — colores + labels + clases.
 *
 * Espejea el enum canónico `MovementReason` de `types/bovine.dtos.ts`
 * (8 valores oficiales). Antes vivía duplicado como `REASON_LABELS` en:
 *   - `BovineLocationHistoryTab.tsx`  (9 valores legacy, fuera de sync)
 *   - `LocationDetailPage.tsx`        (6 valores, parcial)
 *   - `BovineFormPage.tsx`            (`entryReasonOptions` con label largo)
 *
 * Este token unifica todo bajo los 8 valores canónicos del backend.
 */

export const MOVEMENT_REASON_LABELS = {
  CREATION:   'Asignación inicial',
  GRAZING:    'Pastoreo',
  MEDICAL:    'Atención médica',
  QUARANTINE: 'Cuarentena',
  BREEDING:   'Reproducción',
  TRANSFER:   'Traslado',
  SALE:       'Venta',
  OTHER:      'Otro',
} as const;

/** Color hex representativo de la razón (para badges, dots, charts). */
export const MOVEMENT_REASON_COLORS = {
  CREATION:   '#22c55e',  // verde — alta inicial (positivo)
  GRAZING:    '#10b981',  // emerald — actividad normal
  MEDICAL:    '#3b82f6',  // azul — intervención clínica
  QUARANTINE: '#a855f7',  // púrpura — aislamiento
  BREEDING:   '#ec4899',  // rosa — reproductivo
  TRANSFER:   '#f59e0b',  // amber — cambio operacional
  SALE:       '#f97316',  // naranja — salida comercial
  OTHER:      '#6b7280',  // gris — categoría no especificada
} as const;

/** Clases Tailwind para Badges/chips de razón de movimiento. */
export const MOVEMENT_REASON_BADGE_CLASSES = {
  CREATION:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  GRAZING:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  MEDICAL:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  QUARANTINE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  BREEDING:   'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  TRANSFER:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  SALE:       'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  OTHER:      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
} as const;

/**
 * Tipo de movimiento — cómo se originó el evento.
 * Espejea `MovementType` de `types/bovine.dtos.ts` (3 valores oficiales).
 */
export const MOVEMENT_TYPE_LABELS = {
  MANUAL:    'Manual',
  AUTOMATED: 'Automatizado',
  SCHEDULED: 'Programado',
} as const;

export const MOVEMENT_TYPE_BADGE_CLASSES = {
  MANUAL:    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  AUTOMATED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  SCHEDULED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
} as const;

export type MovementReasonKey = keyof typeof MOVEMENT_REASON_LABELS;
export type MovementTypeKey   = keyof typeof MOVEMENT_TYPE_LABELS;

/** Fallback usado cuando llega una razón legacy desconocida (ROUTINE, FEEDING, etc.). */
export const MOVEMENT_REASON_FALLBACK = {
  label:        'Otro',
  color:        MOVEMENT_REASON_COLORS.OTHER,
  badgeClasses: MOVEMENT_REASON_BADGE_CLASSES.OTHER,
} as const;

/**
 * Mapeo de razones legacy → canónicas. Permite migrar datos viejos sin
 * mostrar "undefined" o mantener strings sueltos en la UI.
 */
export const MOVEMENT_REASON_LEGACY_ALIAS: Record<string, MovementReasonKey> = {
  HEALTH:      'MEDICAL',
  ROUTINE:     'GRAZING',
  SALE_PREP:   'SALE',
  FEEDING:     'GRAZING',
  MAINTENANCE: 'OTHER',
  TRANSPORT:   'TRANSFER',
};

/**
 * Resuelve label de razón con soporte de aliases legacy y fallback.
 * @example
 *   getMovementReasonLabel('HEALTH')      → 'Atención médica'  (vía alias → MEDICAL)
 *   getMovementReasonLabel('GRAZING')     → 'Pastoreo'
 *   getMovementReasonLabel('UNKNOWN_XYZ') → 'Otro'             (fallback)
 *   getMovementReasonLabel(null)          → 'Otro'
 */
export function getMovementReasonLabel(reason: string | undefined | null): string {
  if (!reason) return MOVEMENT_REASON_FALLBACK.label;
  const canonical = MOVEMENT_REASON_LEGACY_ALIAS[reason] ?? (reason as MovementReasonKey);
  return MOVEMENT_REASON_LABELS[canonical] ?? MOVEMENT_REASON_FALLBACK.label;
}
