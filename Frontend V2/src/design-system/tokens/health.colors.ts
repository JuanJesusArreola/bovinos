export const HEALTH_COLORS = {
  HEALTHY: '#22c55e',
  SICK: '#f59e0b',
  RECOVERING: '#3b82f6',
  QUARANTINE: '#a855f7',
  DECEASED: '#ef4444',
  UNKNOWN: '#6b7280',
} as const;

export const HEALTH_LABELS = {
  HEALTHY: 'Saludable',
  SICK: 'Enfermo',
  RECOVERING: 'En recuperación',
  QUARANTINE: 'En cuarentena',
  DECEASED: 'Fallecido',
  UNKNOWN: 'Desconocido',
} as const;

export const HEALTH_BADGE_VARIANTS = {
  HEALTHY: 'success',
  SICK: 'warning',
  RECOVERING: 'info',
  QUARANTINE: 'danger',
  DECEASED: 'danger',
  UNKNOWN: 'default',
} as const;

/**
 * Keys del token. Renombrado a `HealthStatusKey` para evitar colisión con
 * el enum `HealthStatus` de `types/bovine.dtos.ts` — ese es el enum del
 * dominio, este es el subset con representación visual.
 */
export type HealthStatusKey = keyof typeof HEALTH_COLORS;

// ── Helpers defensivos ────────────────────────────────────────────────────

/**
 * Devuelve el color hex del estado de salud con fallback a UNKNOWN.
 * Maneja undefined/null/keys desconocidos sin lanzar excepción.
 * @example
 *   <CircleMarker pathOptions={{ fillColor: getHealthColor(b.healthStatus) }} />
 *   // → '#22c55e' para HEALTHY, '#6b7280' para null/'OTRO'/undefined
 */
export function getHealthColor(status: string | undefined | null): string {
  if (!status) return HEALTH_COLORS.UNKNOWN;
  return (HEALTH_COLORS as Record<string, string>)[status] ?? HEALTH_COLORS.UNKNOWN;
}

/**
 * Devuelve la etiqueta localizada (es-MX) del estado de salud.
 * @example
 *   getHealthLabel('SICK')      → 'Enfermo'
 *   getHealthLabel(undefined)   → 'Desconocido'
 */
export function getHealthLabel(status: string | undefined | null): string {
  if (!status) return HEALTH_LABELS.UNKNOWN;
  return (HEALTH_LABELS as Record<string, string>)[status] ?? HEALTH_LABELS.UNKNOWN;
}

/**
 * Devuelve la variante del componente Badge (success/warning/info/danger/default)
 * apropiada para mostrar el estado de salud. Útil para `<Badge variant={...}>`.
 * @example
 *   <Badge variant={getHealthBadgeVariant(bovine.healthStatus)}>
 *     {getHealthLabel(bovine.healthStatus)}
 *   </Badge>
 */
export function getHealthBadgeVariant(
  status: string | undefined | null,
): 'success' | 'warning' | 'info' | 'danger' | 'default' {
  if (!status) return HEALTH_BADGE_VARIANTS.UNKNOWN;
  return (HEALTH_BADGE_VARIANTS as Record<string, 'success' | 'warning' | 'info' | 'danger' | 'default'>)[status]
    ?? HEALTH_BADGE_VARIANTS.UNKNOWN;
}