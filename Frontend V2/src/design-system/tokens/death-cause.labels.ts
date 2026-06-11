/**
 * Labels canónicos de DeathCause (Backend X-02 / Modulo 8).
 *
 * F-35 / Hallazgo H-6: el `DeathRegistrationModal` duplicaba estos labels
 * en `CAUSE_OPTIONS`. Si el backend agrega un valor al enum, había que
 * recordar agregarlo en el modal también — drift garantizado.
 *
 * Esta es la fuente única para frontend. Backend embebe `causeLabel` en
 * `BovineDeathRecord.causeLabel` y en `MortalityGroupItem.label` cuando
 * groupBy='cause'; usar esos cuando vengan. Este map es fallback
 * defensivo + única fuente para el select del modal.
 */

import type { DeathCause } from '@/types/bovine.dtos';

// ── Labels en español ───────────────────────────────────────────────────────

export const DEATH_CAUSE_LABELS: Record<DeathCause, string> = {
  DISEASE:          'Enfermedad',
  ACCIDENT:         'Accidente',
  PREDATOR_ATTACK:  'Ataque de depredador',
  DROWNING:         'Ahogamiento',
  OLD_AGE:          'Vejez',
  SLAUGHTER:        'Sacrificio',
  NATURAL_DISASTER: 'Desastre natural',
  UNKNOWN:          'Desconocida',
  OTHER:            'Otra',
};

export function getDeathCauseLabel(cause: DeathCause): string {
  return DEATH_CAUSE_LABELS[cause] ?? cause;
}

// ── Hints contextuales para el modal de registro ────────────────────────────
// Solo para causas que requieren UX adicional. Las demas se muestran sin hint.

export const DEATH_CAUSE_HINTS: Partial<Record<DeathCause, string>> = {
  DISEASE:   'Cierra el caso clínico activo si existe',
  ACCIDENT:  'Lesión, caída, etc.',
  SLAUGHTER: 'Solicita valor de venta del sacrificio',
};

// ── Color del bar para reportes (MortalityReportCard) ──────────────────────
// Asignacion semantica para distinguir causas en el reporte agregado.

export const DEATH_CAUSE_BAR_COLORS: Record<DeathCause, string> = {
  DISEASE:          'bg-red-500',
  ACCIDENT:         'bg-amber-500',
  PREDATOR_ATTACK:  'bg-orange-500',
  DROWNING:         'bg-sky-500',
  OLD_AGE:          'bg-gray-500',
  SLAUGHTER:        'bg-violet-500',
  NATURAL_DISASTER: 'bg-yellow-500',
  UNKNOWN:          'bg-gray-400',
  OTHER:            'bg-gray-400',
};

export function getDeathCauseBarColor(cause: DeathCause): string {
  return DEATH_CAUSE_BAR_COLORS[cause] ?? 'bg-gray-400';
}

// ── Lista ordenada para selects ─────────────────────────────────────────────
// Orden = relevancia clinica (causas mas comunes primero).

export const DEATH_CAUSE_OPTIONS: { value: DeathCause; label: string; hint?: string }[] = [
  { value: 'DISEASE',          label: DEATH_CAUSE_LABELS.DISEASE,          hint: DEATH_CAUSE_HINTS.DISEASE },
  { value: 'ACCIDENT',         label: DEATH_CAUSE_LABELS.ACCIDENT,         hint: DEATH_CAUSE_HINTS.ACCIDENT },
  { value: 'PREDATOR_ATTACK',  label: DEATH_CAUSE_LABELS.PREDATOR_ATTACK },
  { value: 'DROWNING',         label: DEATH_CAUSE_LABELS.DROWNING },
  { value: 'OLD_AGE',          label: DEATH_CAUSE_LABELS.OLD_AGE },
  { value: 'SLAUGHTER',        label: DEATH_CAUSE_LABELS.SLAUGHTER,        hint: DEATH_CAUSE_HINTS.SLAUGHTER },
  { value: 'NATURAL_DISASTER', label: DEATH_CAUSE_LABELS.NATURAL_DISASTER },
  { value: 'UNKNOWN',          label: DEATH_CAUSE_LABELS.UNKNOWN },
  { value: 'OTHER',            label: DEATH_CAUSE_LABELS.OTHER },
];
