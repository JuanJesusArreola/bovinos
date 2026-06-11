/**
 * Labels canónicos de VaccinationStatus + helpers.
 *
 * F-35 / Hallazgo H-1: antes de este módulo había TRES fuentes de labels:
 *   - `STATUS_CONFIG` en `BovineVaccinationsTab` (label + icon + variant + classes)
 *   - `VAC_STATUS_LABEL` / `VAC_STATUS_VARIANT` en `BovineDetailPage`
 *   - `statusLabel` que el backend embebe en respuestas (Backend V-06)
 *
 * Esta es la fuente única para frontend. El backend sigue siendo la verdad
 * absoluta cuando emite `statusLabel`; este archivo es fallback consistente
 * cuando no llega (respuestas legacy / cache frío / tests).
 *
 * Regla de uso en componentes:
 *   const label = response.statusLabel || getVaccinationStatusLabel(status);
 */

import type { VaccinationStatus } from '@/types/bovine.dtos';

// ── Labels en español ───────────────────────────────────────────────────────

export const VACCINATION_STATUS_LABELS: Record<VaccinationStatus, string> = {
  UP_TO_DATE: 'Al día',
  PENDING:    'Pendiente',
  OVERDUE:    'Vencida',
  NONE:       'Sin vacunas',
};

export function getVaccinationStatusLabel(status: VaccinationStatus): string {
  return VACCINATION_STATUS_LABELS[status] ?? status;
}

// ── Variant para Badge (componente del design-system) ──────────────────────

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'default';

export const VACCINATION_STATUS_VARIANT: Record<VaccinationStatus, BadgeVariant> = {
  UP_TO_DATE: 'success',
  PENDING:    'warning',
  OVERDUE:    'danger',
  NONE:       'default',
};

export function getVaccinationStatusVariant(status: VaccinationStatus): BadgeVariant {
  return VACCINATION_STATUS_VARIANT[status] ?? 'default';
}

// ── Classes Tailwind para presentaciones custom (card grande, etc.) ────────
// Útil cuando el Badge no encaja (ej: pill grande con icono). Para los casos
// estándar usar el componente <Badge variant={getVaccinationStatusVariant()}>.

export const VACCINATION_STATUS_CLASSES: Record<VaccinationStatus, string> = {
  UP_TO_DATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PENDING:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  OVERDUE:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NONE:       'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function getVaccinationStatusClasses(status: VaccinationStatus): string {
  return VACCINATION_STATUS_CLASSES[status] ?? VACCINATION_STATUS_CLASSES.NONE;
}
