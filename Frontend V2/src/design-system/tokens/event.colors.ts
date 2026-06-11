/**
 * Tipos de evento ganadero — colores + etiquetas.
 *
 * Espejea el enum canónico `EventType` de `types/event.types.ts` (que a su
 * vez refleja el enum del backend). Antes este token tenía keys en
 * MINÚSCULAS desalineadas con el enum y faltaban 5 valores; se normalizó
 * a MAYÚSCULAS para mantener consistencia con el resto del design-system.
 *
 * Para retro-compatibilidad con código que aún pase minúsculas (legacy),
 * los helpers normalizan internamente vía `toUpperCase()` antes del lookup.
 * Si pasas `'vaccination'` o `'VACCINATION'` obtienes el mismo resultado.
 */

export const EVENT_COLORS = {
  VACCINATION:     '#10b981',  // verde — preventivo
  DEWORMING:       '#84cc16',  // lima — preventivo (similar a vacunación)
  CHECKUP:         '#3b82f6',  // azul — revisión rutinaria
  TREATMENT:       '#f59e0b',  // amber — intervención por enfermedad
  BREEDING:        '#ec4899',  // rosa — reproductivo
  PREGNANCY_CHECK: '#a855f7',  // púrpura — reproductivo
  BIRTH:           '#8b5cf6',  // violeta — reproductivo (alta)
  WEANING:         '#0ea5e9',  // sky — transición
  WEIGHING:        '#14b8a6',  // teal — medición
  TRANSFER:        '#f97316',  // naranja — movimiento
  SALE:            '#dc2626',  // rojo — salida del inventario
  OTHER:           '#6b7280',  // gris — categoría no clasificada
} as const;

export const EVENT_LABELS = {
  VACCINATION:     'Vacunación',
  DEWORMING:       'Desparasitación',
  CHECKUP:         'Revisión',
  TREATMENT:       'Tratamiento',
  BREEDING:        'Reproducción',
  PREGNANCY_CHECK: 'Chequeo de gestación',
  BIRTH:           'Nacimiento',
  WEANING:         'Destete',
  WEIGHING:        'Pesaje',
  TRANSFER:        'Traslado',
  SALE:            'Venta',
  OTHER:           'Otro',
} as const;

/**
 * Clases Tailwind para Badges/chips de tipo de evento (light + dark).
 * Alineadas con el color hex correspondiente.
 */
export const EVENT_BADGE_CLASSES = {
  VACCINATION:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DEWORMING:       'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
  CHECKUP:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TREATMENT:       'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  BREEDING:        'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  PREGNANCY_CHECK: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  BIRTH:           'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  WEANING:         'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  WEIGHING:        'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  TRANSFER:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  SALE:            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  OTHER:           'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
} as const;

export type EventTypeKey = keyof typeof EVENT_COLORS;

/**
 * Mapa de aliases legacy → keys canónicos. Permite que código antiguo que
 * envíe valores deprecados siga funcionando sin romper la UI.
 *
 * @deprecated `illness` / `ILLNESS` / `DISEASE` como tipos de evento:
 *   La enfermedad de un bovino ya NO se modela como un evento aislado en la
 *   línea de tiempo. La fuente de verdad pasó a ser el módulo de **Casos
 *   Clínicos** (`BovineDiseaseCase`, ver `types/bovineCase.dtos.ts`), que
 *   representa el ciclo completo SUSPECTED → CONFIRMED → RECOVERING →
 *   RECOVERED/DECEASED/DISCARDED, con sub-colecciones de síntomas,
 *   tratamientos y laboratorios.
 *
 *   - Para LISTAR enfermedades activas de un bovino → `useBovineCases({ bovineId })`.
 *   - Para REPORTAR una nueva enfermedad → `useCreateBovineCase({...})`.
 *   - Para mostrar el detalle clínico → `/health/cases/:id` (Sprint 3+).
 *   - El token visual `CASE_STATUS_COLORS` reemplaza a este alias.
 *
 *   Estos aliases permanecen SOLO para que datos históricos serializados
 *   con `type: 'illness'` (timeline antigua, exports legacy) sigan
 *   renderizándose en color amber (TREATMENT) sin romper la pantalla. Si
 *   detectas un módulo NUEVO que aún escribe `illness`, migrarlo al módulo
 *   de casos clínicos es la solución correcta — no añadir más callers aquí.
 */
const EVENT_TYPE_LEGACY_ALIAS: Record<string, EventTypeKey> = {
  // Casing antiguo → mayúsculas (ya cubierto por `toUpperCase()`, pero
  // explícito para claridad).
  vaccination: 'VACCINATION',
  treatment:   'TREATMENT',
  breeding:    'BREEDING',
  birth:       'BIRTH',
  checkup:     'CHECKUP',
  other:       'OTHER',
  // @deprecated — ver JSDoc de EVENT_TYPE_LEGACY_ALIAS. Usa el módulo de
  // Casos Clínicos (BovineDiseaseCase) para nuevos features.
  illness:     'TREATMENT',
  ILLNESS:     'TREATMENT',
  DISEASE:     'TREATMENT',
};

// ── Helpers defensivos ────────────────────────────────────────────────────

/**
 * Resuelve un input arbitrario al key canónico (MAYÚSCULAS). Acepta:
 *   - `'VACCINATION'` (canónico)            → 'VACCINATION'
 *   - `'vaccination'` (legacy lowercase)    → 'VACCINATION'
 *   - `'illness'`     (legacy, ya no existe) → 'TREATMENT'
 *   - `null` / `undefined`                  → null (deja decidir al caller)
 */
function resolveEventKey(input: string | undefined | null): EventTypeKey | null {
  if (!input) return null;
  const upper = input.toUpperCase();
  if (upper in EVENT_COLORS) return upper as EventTypeKey;
  // Probar aliases legacy con casing original Y normalizado.
  return EVENT_TYPE_LEGACY_ALIAS[input] ?? EVENT_TYPE_LEGACY_ALIAS[input.toLowerCase()] ?? null;
}

/** Devuelve el color hex del tipo de evento, fallback OTHER. */
export function getEventColor(type: string | undefined | null): string {
  const k = resolveEventKey(type);
  return k ? EVENT_COLORS[k] : EVENT_COLORS.OTHER;
}

/** Devuelve la etiqueta localizada del tipo de evento. */
export function getEventLabel(type: string | undefined | null): string {
  const k = resolveEventKey(type);
  return k ? EVENT_LABELS[k] : EVENT_LABELS.OTHER;
}

/** Devuelve las clases Tailwind del badge (light + dark). */
export function getEventBadgeClass(type: string | undefined | null): string {
  const k = resolveEventKey(type);
  return k ? EVENT_BADGE_CLASSES[k] : EVENT_BADGE_CLASSES.OTHER;
}
