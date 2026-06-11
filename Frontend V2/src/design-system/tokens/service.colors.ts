/**
 * Servicios disponibles en una ubicación (potrero/establo) — colores +
 * labels + clases. Antes vivía como props sueltas en `ServiceChip` de
 * `LocationDetailPage.tsx` con clases dinámicas vía template literals
 * (problemático para el purge de Tailwind).
 *
 * Ahora cada servicio tiene clases LITERALES — Tailwind las detecta y
 * no se quitan en producción.
 */

export const SERVICE_LABELS = {
  ELECTRICITY: 'Electricidad',
  WATER:       'Agua',
  INTERNET:    'Internet',
  ROAD_ACCESS: 'Acceso vial',
} as const;

/** Color hex (para charts u otros consumidores no-Tailwind). */
export const SERVICE_COLORS = {
  ELECTRICITY: '#f59e0b',  // amber — energía
  WATER:       '#0ea5e9',  // sky — fluidos
  INTERNET:    '#3b82f6',  // azul — comunicación
  ROAD_ACCESS: '#6b7280',  // gris — infraestructura neutral
} as const;

/** Clases Tailwind para chips ACTIVOS (servicio disponible). */
export const SERVICE_CHIP_CLASSES_ENABLED = {
  ELECTRICITY: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
  WATER:       'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-900/40',
  INTERNET:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
  ROAD_ACCESS: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-700',
} as const;

/** Clases para chips DESHABILITADOS (mismo estilo para todos — gris atenuado). */
export const SERVICE_CHIP_CLASSES_DISABLED =
  'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800/40 dark:text-gray-500 dark:border-gray-800';

export type ServiceKey = keyof typeof SERVICE_LABELS;

/**
 * Devuelve la clase del chip según el servicio y si está habilitado.
 * Centraliza la lógica que antes hacía template-literal en ServiceChip
 * (`bg-${color}-50` etc., frágil para el purge de Tailwind).
 */
export function getServiceChipClasses(service: ServiceKey, enabled: boolean): string {
  if (!enabled) return SERVICE_CHIP_CLASSES_DISABLED;
  return SERVICE_CHIP_CLASSES_ENABLED[service];
}
