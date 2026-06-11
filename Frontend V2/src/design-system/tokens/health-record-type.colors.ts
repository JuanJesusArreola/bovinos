/**
 * Tipos de registro de salud — colores + labels + clases.
 *
 * Espejea el enum `HealthRecordType` del backend (`Backend/src/models/Health`).
 * Antes vivía duplicado como `RECORD_TYPE_CONFIG` en `BovineHealthTab.tsx`.
 */

export const HEALTH_RECORD_TYPE_COLORS = {
  ROUTINE_CHECKUP:       '#10b981',
  EMERGENCY_VISIT:       '#ef4444',
  FOLLOW_UP:             '#0ea5e9',
  VACCINATION:           '#3b82f6',
  TREATMENT:             '#f59e0b',
  SURGERY:               '#f43f5e',
  LABORATORY_TEST:       '#a855f7',
  PHYSICAL_EXAM:         '#14b8a6',
  REPRODUCTIVE_EXAM:     '#ec4899',
  QUARANTINE_ASSESSMENT: '#f97316',
  NECROPSY:              '#475569',
  PRE_TRANSPORT_EXAM:    '#64748b',
  NUTRITION_ASSESSMENT:  '#84cc16',
  BEHAVIORAL_ASSESSMENT: '#6366f1',
  OTHER:                 '#9ca3af',
} as const;

export const HEALTH_RECORD_TYPE_LABELS = {
  ROUTINE_CHECKUP:       'Revisión Rutinaria',
  EMERGENCY_VISIT:       'Emergencia',
  FOLLOW_UP:             'Seguimiento',
  VACCINATION:           'Vacunación',
  TREATMENT:             'Tratamiento',
  SURGERY:               'Cirugía',
  LABORATORY_TEST:       'Laboratorio',
  PHYSICAL_EXAM:         'Examen Físico',
  REPRODUCTIVE_EXAM:     'Examen Reproductivo',
  QUARANTINE_ASSESSMENT: 'Cuarentena',
  NECROPSY:              'Necropsia',
  PRE_TRANSPORT_EXAM:    'Pre-Transporte',
  NUTRITION_ASSESSMENT:  'Nutricional',
  BEHAVIORAL_ASSESSMENT: 'Conductual',
  OTHER:                 'Otro',
} as const;

/** Clase Tailwind para el "dot" del timeline (solo background). */
export const HEALTH_RECORD_TYPE_DOT_CLASSES = {
  ROUTINE_CHECKUP:       'bg-emerald-500',
  EMERGENCY_VISIT:       'bg-red-500',
  FOLLOW_UP:             'bg-sky-500',
  VACCINATION:           'bg-blue-500',
  TREATMENT:             'bg-amber-500',
  SURGERY:               'bg-rose-500',
  LABORATORY_TEST:       'bg-purple-500',
  PHYSICAL_EXAM:         'bg-teal-500',
  REPRODUCTIVE_EXAM:     'bg-pink-500',
  QUARANTINE_ASSESSMENT: 'bg-orange-500',
  NECROPSY:              'bg-slate-600',
  PRE_TRANSPORT_EXAM:    'bg-slate-500',
  NUTRITION_ASSESSMENT:  'bg-lime-500',
  BEHAVIORAL_ASSESSMENT: 'bg-indigo-500',
  OTHER:                 'bg-gray-400',
} as const;

/** Clases Tailwind completas (light + dark) para Badges de tipo de registro. */
export const HEALTH_RECORD_TYPE_BADGE_CLASSES = {
  ROUTINE_CHECKUP:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  EMERGENCY_VISIT:       'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  FOLLOW_UP:             'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  VACCINATION:           'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  TREATMENT:             'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  SURGERY:               'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  LABORATORY_TEST:       'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  PHYSICAL_EXAM:         'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  REPRODUCTIVE_EXAM:     'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  QUARANTINE_ASSESSMENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  NECROPSY:              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  PRE_TRANSPORT_EXAM:    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  NUTRITION_ASSESSMENT:  'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
  BEHAVIORAL_ASSESSMENT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  OTHER:                 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
} as const;

/**
 * Keys del token. Diferente del enum `HealthRecordType` que vive en
 * `health.types.ts` (ese es el enum del dominio; este es el subset
 * con representación visual). Suelen coincidir pero se mantienen
 * separados para que el design-system no dependa del módulo de tipos.
 */
export type HealthRecordTypeKey = keyof typeof HEALTH_RECORD_TYPE_COLORS;

// ── Helpers defensivos ────────────────────────────────────────────────────

/** Devuelve el color hex del tipo de registro, con fallback a OTHER. */
export function getHealthRecordTypeColor(type: string | undefined | null): string {
  if (!type) return HEALTH_RECORD_TYPE_COLORS.OTHER;
  return (HEALTH_RECORD_TYPE_COLORS as Record<string, string>)[type] ?? HEALTH_RECORD_TYPE_COLORS.OTHER;
}

/** Devuelve la etiqueta localizada del tipo de registro. */
export function getHealthRecordTypeLabel(type: string | undefined | null): string {
  if (!type) return HEALTH_RECORD_TYPE_LABELS.OTHER;
  return (HEALTH_RECORD_TYPE_LABELS as Record<string, string>)[type] ?? HEALTH_RECORD_TYPE_LABELS.OTHER;
}

/** Devuelve la clase Tailwind del dot (background-only) — para timelines. */
export function getHealthRecordTypeDotClass(type: string | undefined | null): string {
  if (!type) return HEALTH_RECORD_TYPE_DOT_CLASSES.OTHER;
  return (HEALTH_RECORD_TYPE_DOT_CLASSES as Record<string, string>)[type] ?? HEALTH_RECORD_TYPE_DOT_CLASSES.OTHER;
}

/** Devuelve las clases Tailwind completas del badge (light + dark). */
export function getHealthRecordTypeBadgeClass(type: string | undefined | null): string {
  if (!type) return HEALTH_RECORD_TYPE_BADGE_CLASSES.OTHER;
  return (HEALTH_RECORD_TYPE_BADGE_CLASSES as Record<string, string>)[type] ?? HEALTH_RECORD_TYPE_BADGE_CLASSES.OTHER;
}
