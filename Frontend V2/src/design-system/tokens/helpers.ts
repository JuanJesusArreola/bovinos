/**
 * Helpers genéricos del design-system.
 *
 * Los getters específicos por dominio viven en cada `*.colors.ts`
 * (`getHealthColor`, `getMovementReasonLabel`, etc.) — patrón de cohesión.
 *
 * Este archivo SOLO contiene utilidades reutilizables que aplican a
 * cualquier diccionario de tokens (lookup con fallback, normalización,
 * composición de clases dark/light). El objetivo es eliminar boilerplate
 * cuando se construye un nuevo helper de dominio.
 */

/**
 * Lookup genérico contra un map con fallback. Maneja undefined/null/keys
 * desconocidos sin lanzar excepción. Útil cuando no se quiere escribir un
 * helper dedicado para un dominio chico.
 *
 * @example
 *   const color = safeLookup(HEALTH_COLORS, status, HEALTH_COLORS.UNKNOWN);
 *   const label = safeLookup(MY_LABELS, key, 'Sin etiqueta');
 */
export function safeLookup<T>(
  map: Record<string, T>,
  key: string | undefined | null,
  fallback: T,
): T {
  if (!key) return fallback;
  return map[key] ?? fallback;
}

/**
 * Lookup case-insensitive (normaliza a UPPERCASE antes de buscar). Útil
 * cuando el backend envía claves con casing inconsistente.
 *
 * @example
 *   getCI({ HEALTHY: '#22c55e' }, 'healthy', '#6b7280') → '#22c55e'
 *   getCI({ HEALTHY: '#22c55e' }, 'Healthy', '#6b7280') → '#22c55e'
 */
export function getCI<T>(
  map: Record<string, T>,
  key: string | undefined | null,
  fallback: T,
): T {
  if (!key) return fallback;
  return map[key.toUpperCase()] ?? map[key] ?? fallback;
}

/**
 * Compone un único `className` desde una "tupla" de pares
 * `[light, dark]` de Tailwind, omitiendo valores vacíos. Útil cuando el
 * token guarda light y dark separados (como `USER_ROLE_COLORS`).
 *
 * @example
 *   composeLightDark([
 *     ['bg-blue-100', 'dark:bg-blue-900/30'],
 *     ['text-blue-800', 'dark:text-blue-400'],
 *   ])
 *   // → 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
 */
export function composeLightDark(pairs: Array<[string, string]>): string {
  return pairs.flat().filter(Boolean).join(' ');
}

/**
 * Genera un CSS `linear-gradient` horizontal desde un mapa stop→color.
 * Usado por la leyenda del heatmap (mismo gradient que leaflet.heat).
 *
 * @example
 *   buildLinearGradient(HEATMAP_GRADIENT)
 *   // → 'linear-gradient(90deg, #3b82f6 10%, #22c55e 30%, ...)'
 */
export function buildLinearGradient(
  stops: Record<number, string>,
  direction: string = '90deg',
): string {
  const entries = Object.entries(stops)
    .map(([k, color]) => [Number(k), color] as [number, string])
    .sort(([a], [b]) => a - b)
    .map(([stop, color]) => `${color} ${stop * 100}%`)
    .join(', ');
  return `linear-gradient(${direction}, ${entries})`;
}

/**
 * Determina si un color hex es "claro" u "oscuro". Útil para elegir el
 * color del texto sobre un fondo dinámico (negro sobre amarillo, blanco
 * sobre rojo oscuro). Usa la fórmula de luminosidad percibida (YIQ).
 *
 * @example
 *   isLightColor('#facc15') → true   (texto negro encima)
 *   isLightColor('#ef4444') → false  (texto blanco encima)
 */
export function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Fórmula YIQ — equivalente a brightness percibido.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128;
}

/** Devuelve `'black' | 'white'` según el contraste con el color de fondo. */
export function getContrastTextColor(bg: string): '#000' | '#fff' {
  return isLightColor(bg) ? '#000' : '#fff';
}
