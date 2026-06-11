/**
 * Tokens visuales para `CaseStatus` (módulo de casos clínicos).
 *
 * Ciclo de vida del caso:
 *   SUSPECTED → CONFIRMED → RECOVERING → RECOVERED | DECEASED | DISCARDED
 *
 * Convención cromática:
 *   - SUSPECTED  (gris azulado)  ⇒ aún sin diagnóstico firme
 *   - CONFIRMED  (rojo)          ⇒ enfermedad confirmada y activa
 *   - RECOVERING (azul)          ⇒ bajo tratamiento, evolucionando
 *   - RECOVERED  (verde)         ⇒ cerrado con éxito
 *   - DECEASED   (negro/rojo)    ⇒ cerrado, animal fallecido
 *   - DISCARDED  (gris)          ⇒ descartado (falsa sospecha)
 *
 * También se exportan tokens para `CaseSeverity` y `CaseOutcome` por estar
 * conceptualmente ligados al mismo dominio (caso clínico).
 */

// ── CaseStatus ──────────────────────────────────────────────────────────────

export const CASE_STATUS_COLORS = {
  SUSPECTED:  '#64748b', // slate-500
  CONFIRMED:  '#ef4444', // red-500
  RECOVERING: '#3b82f6', // blue-500
  RECOVERED:  '#22c55e', // green-500
  DECEASED:   '#111827', // gray-900
  DISCARDED:  '#9ca3af', // gray-400
} as const;

export const CASE_STATUS_LABELS = {
  SUSPECTED:  'Sospechoso',
  CONFIRMED:  'Confirmado',
  RECOVERING: 'En recuperación',
  RECOVERED:  'Recuperado',
  DECEASED:   'Fallecido',
  DISCARDED:  'Descartado',
} as const;

export const CASE_STATUS_BADGE_VARIANTS = {
  SUSPECTED:  'default',
  CONFIRMED:  'danger',
  RECOVERING: 'info',
  RECOVERED:  'success',
  DECEASED:   'danger',
  DISCARDED:  'default',
} as const;

/** Indica si el estado representa un caso aún abierto (clínicamente activo). */
export const CASE_STATUS_IS_OPEN = {
  SUSPECTED:  true,
  CONFIRMED:  true,
  RECOVERING: true,
  RECOVERED:  false,
  DECEASED:   false,
  DISCARDED:  false,
} as const;

export type CaseStatusKey = keyof typeof CASE_STATUS_COLORS;

// ── CaseSeverity ────────────────────────────────────────────────────────────

export const CASE_SEVERITY_COLORS = {
  LOW:      '#22c55e', // green
  MODERATE: '#f59e0b', // amber
  HIGH:     '#f97316', // orange
  CRITICAL: '#dc2626', // red-600
} as const;

export const CASE_SEVERITY_LABELS = {
  LOW:      'Baja',
  MODERATE: 'Moderada',
  HIGH:     'Alta',
  CRITICAL: 'Crítica',
} as const;

export const CASE_SEVERITY_BADGE_VARIANTS = {
  LOW:      'success',
  MODERATE: 'warning',
  HIGH:     'warning',
  CRITICAL: 'danger',
} as const;

export type CaseSeverityKey = keyof typeof CASE_SEVERITY_COLORS;

// ── CaseOutcome ─────────────────────────────────────────────────────────────

export const CASE_OUTCOME_COLORS = {
  RECOVERED:   '#22c55e',
  DECEASED:    '#111827',
  TRANSFERRED: '#a855f7',
  UNKNOWN:     '#6b7280',
} as const;

export const CASE_OUTCOME_LABELS = {
  RECOVERED:   'Recuperado',
  DECEASED:    'Fallecido',
  TRANSFERRED: 'Transferido',
  UNKNOWN:     'Desconocido',
} as const;

export const CASE_OUTCOME_BADGE_VARIANTS = {
  RECOVERED:   'success',
  DECEASED:    'danger',
  TRANSFERRED: 'info',
  UNKNOWN:     'default',
} as const;

export type CaseOutcomeKey = keyof typeof CASE_OUTCOME_COLORS;

// ── SymptomIntensity ────────────────────────────────────────────────────────

export const SYMPTOM_INTENSITY_COLORS = {
  MILD:     '#22c55e',
  MODERATE: '#f59e0b',
  SEVERE:   '#dc2626',
} as const;

export const SYMPTOM_INTENSITY_LABELS = {
  MILD:     'Leve',
  MODERATE: 'Moderada',
  SEVERE:   'Severa',
} as const;

export const SYMPTOM_INTENSITY_BADGE_VARIANTS = {
  MILD:     'success',
  MODERATE: 'warning',
  SEVERE:   'danger',
} as const;

export type SymptomIntensityKey = keyof typeof SYMPTOM_INTENSITY_COLORS;

// ── LabResultStatus ─────────────────────────────────────────────────────────

export const LAB_RESULT_STATUS_COLORS = {
  PENDING:      '#6b7280',
  POSITIVE:     '#dc2626',
  NEGATIVE:     '#22c55e',
  INCONCLUSIVE: '#f59e0b',
} as const;

export const LAB_RESULT_STATUS_LABELS = {
  PENDING:      'Pendiente',
  POSITIVE:     'Positivo',
  NEGATIVE:     'Negativo',
  INCONCLUSIVE: 'No concluyente',
} as const;

export const LAB_RESULT_STATUS_BADGE_VARIANTS = {
  PENDING:      'default',
  POSITIVE:     'danger',
  NEGATIVE:     'success',
  INCONCLUSIVE: 'warning',
} as const;

export type LabResultStatusKey = keyof typeof LAB_RESULT_STATUS_COLORS;

// ── DiseaseCategory ─────────────────────────────────────────────────────────

export const DISEASE_CATEGORY_COLORS = {
  BACTERIAL: '#f97316',
  VIRAL:     '#dc2626',
  PARASITIC: '#84cc16',
  FUNGAL:    '#a855f7',
  METABOLIC: '#3b82f6',
  GENETIC:   '#ec4899',
  OTHER:     '#6b7280',
} as const;

export const DISEASE_CATEGORY_LABELS = {
  BACTERIAL: 'Bacteriana',
  VIRAL:     'Viral',
  PARASITIC: 'Parasitaria',
  FUNGAL:    'Micótica',
  METABOLIC: 'Metabólica',
  GENETIC:   'Genética',
  OTHER:     'Otra',
} as const;

export type DiseaseCategoryKey = keyof typeof DISEASE_CATEGORY_COLORS;

// ── DiseaseSeverity (alias semántico de CaseSeverity) ───────────────────────

export const DISEASE_SEVERITY_COLORS = CASE_SEVERITY_COLORS;
export const DISEASE_SEVERITY_LABELS = CASE_SEVERITY_LABELS;
export const DISEASE_SEVERITY_BADGE_VARIANTS = CASE_SEVERITY_BADGE_VARIANTS;
export type DiseaseSeverityKey = CaseSeverityKey;

// ─── Helpers defensivos ────────────────────────────────────────────────────
//
// Todos siguen la convención `getXxx(input: string | null | undefined)` con
// fallback seguro. Tolerantes a strings desconocidos para nunca tirar la UI.

type BadgeVariant = 'success' | 'warning' | 'info' | 'danger' | 'default';

export function getCaseStatusColor(status: string | null | undefined): string {
  if (!status) return CASE_STATUS_COLORS.SUSPECTED;
  return (CASE_STATUS_COLORS as Record<string, string>)[status]
    ?? CASE_STATUS_COLORS.SUSPECTED;
}

export function getCaseStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return (CASE_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export function getCaseStatusBadgeVariant(status: string | null | undefined): BadgeVariant {
  if (!status) return 'default';
  return (CASE_STATUS_BADGE_VARIANTS as Record<string, BadgeVariant>)[status] ?? 'default';
}

/** True si el caso está activo (SUSPECTED / CONFIRMED / RECOVERING). */
export function isCaseOpen(status: string | null | undefined): boolean {
  if (!status) return false;
  return (CASE_STATUS_IS_OPEN as Record<string, boolean>)[status] ?? false;
}

export function getCaseSeverityColor(severity: string | null | undefined): string {
  if (!severity) return CASE_SEVERITY_COLORS.LOW;
  return (CASE_SEVERITY_COLORS as Record<string, string>)[severity]
    ?? CASE_SEVERITY_COLORS.LOW;
}

export function getCaseSeverityLabel(severity: string | null | undefined): string {
  if (!severity) return '—';
  return (CASE_SEVERITY_LABELS as Record<string, string>)[severity] ?? severity;
}

export function getCaseSeverityBadgeVariant(severity: string | null | undefined): BadgeVariant {
  if (!severity) return 'default';
  return (CASE_SEVERITY_BADGE_VARIANTS as Record<string, BadgeVariant>)[severity] ?? 'default';
}

export function getCaseOutcomeColor(outcome: string | null | undefined): string {
  if (!outcome) return CASE_OUTCOME_COLORS.UNKNOWN;
  return (CASE_OUTCOME_COLORS as Record<string, string>)[outcome]
    ?? CASE_OUTCOME_COLORS.UNKNOWN;
}

export function getCaseOutcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return '—';
  return (CASE_OUTCOME_LABELS as Record<string, string>)[outcome] ?? outcome;
}

export function getCaseOutcomeBadgeVariant(outcome: string | null | undefined): BadgeVariant {
  if (!outcome) return 'default';
  return (CASE_OUTCOME_BADGE_VARIANTS as Record<string, BadgeVariant>)[outcome] ?? 'default';
}

export function getSymptomIntensityColor(intensity: string | null | undefined): string {
  if (!intensity) return SYMPTOM_INTENSITY_COLORS.MILD;
  return (SYMPTOM_INTENSITY_COLORS as Record<string, string>)[intensity]
    ?? SYMPTOM_INTENSITY_COLORS.MILD;
}

export function getSymptomIntensityLabel(intensity: string | null | undefined): string {
  if (!intensity) return '—';
  return (SYMPTOM_INTENSITY_LABELS as Record<string, string>)[intensity] ?? intensity;
}

export function getSymptomIntensityBadgeVariant(intensity: string | null | undefined): BadgeVariant {
  if (!intensity) return 'default';
  return (SYMPTOM_INTENSITY_BADGE_VARIANTS as Record<string, BadgeVariant>)[intensity] ?? 'default';
}

export function getLabResultStatusColor(status: string | null | undefined): string {
  if (!status) return LAB_RESULT_STATUS_COLORS.PENDING;
  return (LAB_RESULT_STATUS_COLORS as Record<string, string>)[status]
    ?? LAB_RESULT_STATUS_COLORS.PENDING;
}

export function getLabResultStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return (LAB_RESULT_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export function getLabResultStatusBadgeVariant(status: string | null | undefined): BadgeVariant {
  if (!status) return 'default';
  return (LAB_RESULT_STATUS_BADGE_VARIANTS as Record<string, BadgeVariant>)[status] ?? 'default';
}

export function getDiseaseCategoryColor(category: string | null | undefined): string {
  if (!category) return DISEASE_CATEGORY_COLORS.OTHER;
  return (DISEASE_CATEGORY_COLORS as Record<string, string>)[category]
    ?? DISEASE_CATEGORY_COLORS.OTHER;
}

export function getDiseaseCategoryLabel(category: string | null | undefined): string {
  if (!category) return '—';
  return (DISEASE_CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}

// Alias 1:1 — disease severity comparte tabla con case severity.
export const getDiseaseSeverityColor        = getCaseSeverityColor;
export const getDiseaseSeverityLabel        = getCaseSeverityLabel;
export const getDiseaseSeverityBadgeVariant = getCaseSeverityBadgeVariant;

// ── Affected systems (sistemas anatómicos afectados) ────────────────────────
//
// El backend almacena los sistemas como strings libres en MAYÚSCULAS
// (e.g. "RESPIRATORY", "REPRODUCTIVE"). Para presentación al usuario
// final los traducimos al español con un mapa amigable. Si el backend
// envía un valor que no está aquí, caemos a un `capitalize()` defensivo
// para que NO se pierda información — preferimos mostrar
// "Algun-Otro-Sistema" antes que un raw "ALGUN_OTRO_SISTEMA" en pantalla.

export const AFFECTED_SYSTEM_LABELS: Record<string, string> = {
  DIGESTIVE:        'Digestivo',
  RESPIRATORY:      'Respiratorio',
  CIRCULATORY:      'Circulatorio',
  CARDIOVASCULAR:   'Cardiovascular',
  NERVOUS:          'Nervioso',
  MUSCULOSKELETAL:  'Musculoesquelético',
  MUSCULAR:         'Muscular',
  SKELETAL:         'Esquelético',
  REPRODUCTIVE:     'Reproductor',
  URINARY:          'Urinario',
  RENAL:            'Renal',
  IMMUNE:           'Inmunológico',
  IMMUNOLOGIC:      'Inmunológico',
  ENDOCRINE:        'Endocrino',
  INTEGUMENTARY:    'Tegumentario',
  DERMATOLOGICAL:   'Dermatológico',
  SKIN:             'Piel',
  HEMATOPOIETIC:    'Hematopoyético',
  HEMATOLOGIC:      'Hematológico',
  BLOOD:            'Sanguíneo',
  LYMPHATIC:        'Linfático',
  HEPATIC:          'Hepático',
  LIVER:            'Hepático',
  OCULAR:           'Ocular',
  EYE:              'Ocular',
  AUDITORY:         'Auditivo',
  EAR:              'Auditivo',
  ORAL:             'Oral',
  MAMMARY:          'Mamario',
  UDDER:            'Ubre',
  HOOF:             'Pezuñas',
  RESPIRATORY_UPPER:'Vías respiratorias altas',
  RESPIRATORY_LOWER:'Vías respiratorias bajas',
  GASTROINTESTINAL: 'Gastrointestinal',
  GI:               'Gastrointestinal',
  GENITOURINARY:    'Genitourinario',
  OTHER:            'Otro',
};

/**
 * Traduce un código de sistema afectado al español, con fallback amable.
 * Si el valor no está en el mapa:
 *   1. Se normaliza a MAYÚSCULAS para reintentar el lookup.
 *   2. Si sigue sin match, devolvemos la cadena con primera letra mayúscula
 *      y separadores normalizados (`UPPER_RESPIRATORY` → `Upper respiratory`).
 *      Mejor mostrar algo legible que un raw `UPPER_RESPIRATORY` en pantalla.
 */
export function getAffectedSystemLabel(system: string | null | undefined): string {
  if (!system) return '—';
  const upper = system.toUpperCase();
  if (AFFECTED_SYSTEM_LABELS[upper]) return AFFECTED_SYSTEM_LABELS[upper];
  // Fallback: normalizar guiones bajos a espacios y capitalizar.
  const pretty = upper.replace(/_/g, ' ').toLowerCase();
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}
