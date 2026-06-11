export const VACCINATION_STATUS_COLORS = {
  UP_TO_DATE: '#22c55e',
  PENDING: '#3b82f6',
  OVERDUE: '#ef4444',
  NO_RECORDS: '#6b7280',
  NONE: '#6b7280',
} as const;

export const VACCINATION_STATUS_LABELS = {
  UP_TO_DATE: 'Al día',
  PENDING: 'Pendiente',
  OVERDUE: 'Atrasada',
  NO_RECORDS: 'Sin registros',
  NONE: 'Sin vacunas',
} as const;

/** Renombrado a *Key para no colisionar con el enum `VaccinationStatus` de
 *  `types/bovine.dtos.ts`. */
export type VaccinationStatusKey = keyof typeof VACCINATION_STATUS_COLORS;

/**
 * Variant del componente `<Badge>` apropiado para mostrar el estado.
 * Equivalente al `HEALTH_BADGE_VARIANTS` pero para vacunación.
 */
export const VACCINATION_BADGE_VARIANTS = {
  UP_TO_DATE: 'success',
  PENDING:    'info',
  OVERDUE:    'danger',
  NO_RECORDS: 'default',
  NONE:       'default',
} as const;

// ── Helpers defensivos ────────────────────────────────────────────────────

/** Color hex del estado de vacunación, fallback gris (NO_RECORDS). */
export function getVaccinationColor(status: string | undefined | null): string {
  if (!status) return VACCINATION_STATUS_COLORS.NO_RECORDS;
  return (VACCINATION_STATUS_COLORS as Record<string, string>)[status] ?? VACCINATION_STATUS_COLORS.NO_RECORDS;
}

/** Etiqueta localizada del estado de vacunación. */
export function getVaccinationLabel(status: string | undefined | null): string {
  if (!status) return VACCINATION_STATUS_LABELS.NO_RECORDS;
  return (VACCINATION_STATUS_LABELS as Record<string, string>)[status] ?? VACCINATION_STATUS_LABELS.NO_RECORDS;
}

/** Variant del Badge para el estado de vacunación (success/info/danger/default). */
export function getVaccinationBadgeVariant(
  status: string | undefined | null,
): 'success' | 'info' | 'danger' | 'default' {
  if (!status) return VACCINATION_BADGE_VARIANTS.NO_RECORDS;
  return (VACCINATION_BADGE_VARIANTS as Record<string, 'success' | 'info' | 'danger' | 'default'>)[status]
    ?? VACCINATION_BADGE_VARIANTS.NO_RECORDS;
}