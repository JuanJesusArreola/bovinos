/**
 * Tipos de ubicación — colores + etiquetas + clases.
 *
 * Espejea EL ENUM COMPLETO `LocationType` de `types/location.types.ts`
 * (26 valores). Antes solo cubría 9 tipos básicos; los restantes caían a
 * fallback gris en la UI. Ahora cada tipo tiene su color/badge/dot
 * semánticamente coherente.
 *
 * Agrupación visual (paleta):
 *   • Operación ganadera   → verdes / amber / naranja
 *   • Recursos hídricos    → cyan / sky
 *   • Salud animal         → púrpura / violeta / rojo
 *   • Reproducción         → rosa
 *   • Administración       → indigo / teal
 *   • Logística            → slate / zinc / gray
 *   • Procesamiento        → red intenso
 *   • Manejo de residuos   → stone (marrón-piedra)
 *   • Seguridad / Acceso   → azul / cyan oscuro
 *   • Riesgo / Restricción → naranja / rojo oscuro
 *   • Zona segura          → verde
 *   • Misc                 → gris
 */

export const LOCATION_TYPE_COLORS = {
  // Operación ganadera
  PASTURE:           '#10b981',  // emerald — pradera
  CORRAL:            '#f59e0b',  // amber — corral
  BARN:              '#f97316',  // naranja — establo
  MILKING_PARLOR:    '#3b82f6',  // azul — ordeño (asociado a agua/lácteo)
  FEED_AREA:         '#84cc16',  // lima — alimentación

  // Recursos hídricos
  WATER_SOURCE:      '#06b6d4',  // cyan — fuente de agua

  // Salud animal
  VETERINARY_CLINIC: '#a855f7',  // púrpura — clínica
  QUARANTINE_AREA:   '#ef4444',  // rojo — aislamiento sanitario
  LABORATORY:        '#8b5cf6',  // violeta — laboratorio

  // Reproducción
  BREEDING_CENTER:   '#ec4899',  // rosa — reproductivo

  // Administración
  OFFICE:            '#6366f1',  // indigo — oficina administrativa
  RESIDENTIAL:       '#14b8a6',  // teal — vivienda (caseta)

  // Logística
  LOADING_AREA:      '#64748b',  // slate — área de carga
  STORAGE:           '#6b7280',  // gray — almacén
  EQUIPMENT_SHED:    '#71717a',  // zinc — cobertizo de equipos
  ROUTE:             '#94a3b8',  // slate-400 — camino interno

  // Procesamiento industrial
  PROCESSING_PLANT:  '#dc2626',  // rojo-600 — planta industrial

  // Manejo de residuos
  WASTE_MANAGEMENT:  '#78716c',  // stone — residuos / composta

  // Seguridad y acceso
  ENTRANCE_GATE:     '#0ea5e9',  // sky — portón de entrada
  SECURITY_POST:     '#1d4ed8',  // azul-700 — puesto de seguridad
  CHECKPOINT:        '#0891b2',  // cyan-700 — punto de control

  // Riesgo / Restricción
  EMERGENCY_POINT:   '#b91c1c',  // rojo-700 — punto de emergencia
  RESTRICTED_AREA:   '#ea580c',  // naranja-600 — área restringida
  DANGER_ZONE:       '#991b1b',  // rojo-800 — zona peligrosa

  // Zona segura
  SAFE_ZONE:         '#22c55e',  // verde — zona segura

  // Misc
  OTHER:             '#9ca3af',  // gray-400 — otros
} as const;

export const LOCATION_TYPE_LABELS = {
  PASTURE:           'Potrero',
  CORRAL:            'Corral',
  BARN:              'Establo',
  MILKING_PARLOR:    'Sala de ordeño',
  FEED_AREA:         'Área de alimentación',
  WATER_SOURCE:      'Fuente de agua',
  VETERINARY_CLINIC: 'Clínica veterinaria',
  QUARANTINE_AREA:   'Área de cuarentena',
  LABORATORY:        'Laboratorio',
  BREEDING_CENTER:   'Centro de reproducción',
  OFFICE:            'Oficina',
  RESIDENTIAL:       'Vivienda',
  LOADING_AREA:      'Área de carga',
  STORAGE:           'Almacén',
  EQUIPMENT_SHED:    'Cobertizo de equipos',
  ROUTE:             'Camino',
  PROCESSING_PLANT:  'Planta de procesamiento',
  WASTE_MANAGEMENT:  'Manejo de residuos',
  ENTRANCE_GATE:     'Portón de entrada',
  SECURITY_POST:     'Puesto de seguridad',
  CHECKPOINT:        'Punto de control',
  EMERGENCY_POINT:   'Punto de emergencia',
  RESTRICTED_AREA:   'Área restringida',
  DANGER_ZONE:       'Zona peligrosa',
  SAFE_ZONE:         'Zona segura',
  OTHER:             'Otro',
} as const;

/**
 * Clases Tailwind para Badges/chips (light + dark). Coordinadas con los
 * hex de `LOCATION_TYPE_COLORS` — si cambias uno, cambia el otro.
 */
export const LOCATION_TYPE_BADGE_CLASSES = {
  // Operación ganadera
  PASTURE:           'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CORRAL:            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  BARN:              'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MILKING_PARLOR:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FEED_AREA:         'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',

  // Recursos hídricos
  WATER_SOURCE:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',

  // Salud animal
  VETERINARY_CLINIC: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  QUARANTINE_AREA:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  LABORATORY:        'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',

  // Reproducción
  BREEDING_CENTER:   'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',

  // Administración
  OFFICE:            'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  RESIDENTIAL:       'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',

  // Logística
  LOADING_AREA:      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  STORAGE:           'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  EQUIPMENT_SHED:    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
  ROUTE:             'bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',

  // Procesamiento industrial
  PROCESSING_PLANT:  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',

  // Manejo de residuos
  WASTE_MANAGEMENT:  'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-400',

  // Seguridad y acceso
  ENTRANCE_GATE:     'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SECURITY_POST:     'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400',
  CHECKPOINT:        'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-400',

  // Riesgo / Restricción
  EMERGENCY_POINT:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
  RESTRICTED_AREA:   'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400',
  DANGER_ZONE:       'bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-300',

  // Zona segura
  SAFE_ZONE:         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',

  // Misc
  OTHER:             'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
} as const;

/**
 * Clases Tailwind para los "dots" de timeline (puntos sólidos pequeños).
 * Equivalente al BG-only de cada tipo de ubicación.
 */
export const LOCATION_TYPE_DOT_CLASSES = {
  PASTURE:           'bg-emerald-500',
  CORRAL:            'bg-amber-500',
  BARN:              'bg-orange-500',
  MILKING_PARLOR:    'bg-blue-500',
  FEED_AREA:         'bg-lime-500',
  WATER_SOURCE:      'bg-cyan-500',
  VETERINARY_CLINIC: 'bg-purple-500',
  QUARANTINE_AREA:   'bg-red-500',
  LABORATORY:        'bg-violet-500',
  BREEDING_CENTER:   'bg-pink-500',
  OFFICE:            'bg-indigo-500',
  RESIDENTIAL:       'bg-teal-500',
  LOADING_AREA:      'bg-slate-500',
  STORAGE:           'bg-gray-500',
  EQUIPMENT_SHED:    'bg-zinc-500',
  ROUTE:             'bg-slate-400',
  PROCESSING_PLANT:  'bg-red-600',
  WASTE_MANAGEMENT:  'bg-stone-500',
  ENTRANCE_GATE:     'bg-sky-500',
  SECURITY_POST:     'bg-blue-700',
  CHECKPOINT:        'bg-cyan-700',
  EMERGENCY_POINT:   'bg-red-700',
  RESTRICTED_AREA:   'bg-orange-600',
  DANGER_ZONE:       'bg-red-800',
  SAFE_ZONE:         'bg-green-500',
  OTHER:             'bg-gray-400',
} as const;

/** Renombrado a *Key para no colisionar con el enum `LocationType` de
 *  `types/location.types.ts`. */
export type LocationTypeKey = keyof typeof LOCATION_TYPE_COLORS;

/** Fallback usado cuando llega un tipo desconocido (datos legacy). */
export const LOCATION_TYPE_FALLBACK = {
  label:        'Ubicación',
  badgeClasses: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  dotClasses:   'bg-gray-400',
  color:        LOCATION_TYPE_COLORS.OTHER,
} as const;

// ── Helpers defensivos ────────────────────────────────────────────────────

/** Devuelve el color hex del tipo de ubicación, fallback gris (OTHER). */
export function getLocationTypeColor(type: string | undefined | null): string {
  if (!type) return LOCATION_TYPE_FALLBACK.color;
  return (LOCATION_TYPE_COLORS as Record<string, string>)[type] ?? LOCATION_TYPE_FALLBACK.color;
}

/** Devuelve la etiqueta localizada del tipo de ubicación. */
export function getLocationTypeLabel(type: string | undefined | null): string {
  if (!type) return LOCATION_TYPE_FALLBACK.label;
  return (LOCATION_TYPE_LABELS as Record<string, string>)[type] ?? LOCATION_TYPE_FALLBACK.label;
}

/** Devuelve la clase Tailwind del badge (light + dark). */
export function getLocationTypeBadgeClass(type: string | undefined | null): string {
  if (!type) return LOCATION_TYPE_FALLBACK.badgeClasses;
  return (LOCATION_TYPE_BADGE_CLASSES as Record<string, string>)[type] ?? LOCATION_TYPE_FALLBACK.badgeClasses;
}

/** Devuelve la clase Tailwind del dot (background-only) — timelines. */
export function getLocationTypeDotClass(type: string | undefined | null): string {
  if (!type) return LOCATION_TYPE_FALLBACK.dotClasses;
  return (LOCATION_TYPE_DOT_CLASSES as Record<string, string>)[type] ?? LOCATION_TYPE_FALLBACK.dotClasses;
}
