/**
 * Tokens visuales para la INTERPRETACION automatica de resultados de
 * laboratorio (Capa 4 del modulo de salud).
 *
 * El backend calcula la interpretacion comparando `value` contra
 * `referenceRange`. Formatos aceptados por el backend:
 *   - "24-46"   (rango cerrado, normal cuando inclusivo)
 *   - ">0.5"    (mayor estricto)
 *   - ">=20"    (mayor o igual)
 *   - "<10"     (menor estricto)
 *   - "<=100"   (menor o igual)
 *
 * Devuelve uno de:
 *   - NORMAL      → dentro de rango
 *   - ABNORMAL    → fuera de rango por <2 desviaciones
 *   - CRITICAL    → fuera de rango por >=2 desviaciones (alerta clinica)
 *   - PENDING     → todavia sin valor (lab solicitado pero no entregado)
 *
 * Los helpers son defensivos: aceptan strings desconocidos sin romper
 * el render.
 */

export type LabInterpretation = 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | 'PENDING';

export const LAB_INTERPRETATION_LABELS: Record<string, string> = {
  NORMAL:   'Normal',
  ABNORMAL: 'Anormal',
  CRITICAL: 'Critico',
  PENDING:  'Pendiente',
};

export const LAB_INTERPRETATION_COLORS: Record<string, string> = {
  NORMAL:   '#22c55e', // verde
  ABNORMAL: '#f59e0b', // amber
  CRITICAL: '#dc2626', // rojo
  PENDING:  '#9ca3af', // gris
};

/**
 * Clases Tailwind para badges. Light + dark. Alineadas con los colores
 * hex correspondientes.
 */
export const LAB_INTERPRETATION_BADGE_CLASSES: Record<string, string> = {
  NORMAL:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ABNORMAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PENDING:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

type BadgeVariant = 'success' | 'warning' | 'danger' | 'default';

export const LAB_INTERPRETATION_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  NORMAL:   'success',
  ABNORMAL: 'warning',
  CRITICAL: 'danger',
  PENDING:  'default',
};

// ── Helpers defensivos ──────────────────────────────────────────────────────

export function getLabInterpretationLabel(interp: string | null | undefined): string {
  if (!interp) return LAB_INTERPRETATION_LABELS.PENDING;
  return LAB_INTERPRETATION_LABELS[interp.toUpperCase()] ?? interp;
}

export function getLabInterpretationColor(interp: string | null | undefined): string {
  if (!interp) return LAB_INTERPRETATION_COLORS.PENDING;
  return LAB_INTERPRETATION_COLORS[interp.toUpperCase()] ?? LAB_INTERPRETATION_COLORS.PENDING;
}

export function getLabInterpretationBadgeVariant(
  interp: string | null | undefined,
): BadgeVariant {
  if (!interp) return 'default';
  return LAB_INTERPRETATION_BADGE_VARIANTS[interp.toUpperCase()] ?? 'default';
}

export function getLabInterpretationBadgeClass(interp: string | null | undefined): string {
  if (!interp) return LAB_INTERPRETATION_BADGE_CLASSES.PENDING;
  return LAB_INTERPRETATION_BADGE_CLASSES[interp.toUpperCase()]
    ?? LAB_INTERPRETATION_BADGE_CLASSES.PENDING;
}

/**
 * True si la interpretacion indica un valor fuera de rango (ABNORMAL o
 * CRITICAL). Usado por filtros tipo "mostrar solo anormales".
 */
export function isLabAbnormal(interp: string | null | undefined): boolean {
  if (!interp) return false;
  const up = interp.toUpperCase();
  return up === 'ABNORMAL' || up === 'CRITICAL';
}
