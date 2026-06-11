/**
 * ════════════════════════════════════════════════════════════════════════
 *  SEVERITY — qué tan GRAVE fue lo que YA ocurrió
 * ════════════════════════════════════════════════════════════════════════
 *
 * Mirada hacia el PASADO. Califica un evento que ya sucedió (no algo que
 * está por hacerse). En el backend corresponde al enum `EventSeverity` del
 * modelo `SecurityEvent`.
 *
 * NO confundir con `priority.colors.ts` (`EventPriority`), que mira al
 * FUTURO — qué tan rápido hay que actuar sobre algo pendiente.
 *
 *   SEVERITY  →  ¿qué tan serio fue?    (post-mortem)
 *   PRIORITY  →  ¿qué tan rápido actuar? (queue de trabajo)
 *
 * ── Niveles y casos de uso (ejemplos del módulo de seguridad) ────────────
 *
 *   LOW       Login exitoso, actividad rutinaria del usuario.
 *             Solo se registra para auditoría, no requiere acción.
 *             Color azul (informativo, no alarmante).
 *
 *   MEDIUM    Reset de contraseña, login desde IP nueva, cambio de email.
 *             Algo inusual pero no necesariamente malicioso.
 *             Color amber (atención sin urgencia).
 *
 *   HIGH      Intento de acceso no autorizado, múltiples logins fallidos
 *             consecutivos, intento de escalación de privilegios.
 *             Color naranja (clara señal de alerta).
 *
 *   CRITICAL  Cuenta bloqueada por seguridad, rate limit excedido, token
 *             comprometido, acceso confirmado desde origen sospechoso.
 *             Color rojo (post-mortem grave).
 *
 * ── ¿Por qué NO existe `EMERGENCY` aquí? ─────────────────────────────────
 *
 * En seguridad, el peor escenario es `CRITICAL` — ya pasó algo grave que
 * exige investigar/contener. No tiene sentido un nivel "todavía peor" para
 * algo del pasado. El concepto de "actuar AHORA" pertenece a `PRIORITY`
 * (parto en progreso, cirugía de emergencia), no a `SEVERITY`.
 *
 * ════════════════════════════════════════════════════════════════════════
 */

export const SEVERITY_COLORS = {
  LOW:      '#3b82f6',  // azul — informativo, no alarmante
  MEDIUM:   '#f59e0b',  // amber — atención sin urgencia
  HIGH:     '#f97316',  // naranja — alerta clara
  CRITICAL: '#ef4444',  // rojo — post-mortem grave
} as const;

export const SEVERITY_LABELS = {
  LOW:      'Baja',
  MEDIUM:   'Media',
  HIGH:     'Alta',
  CRITICAL: 'Crítica',
} as const;

/**
 * Casos de uso típicos por nivel — pensados para tooltips, ayuda contextual
 * y la página de admin de auditoría. NO se renderizan en producción salvo
 * que un consumidor los pida explícitamente.
 */
export const SEVERITY_EXAMPLES = {
  LOW:      'Login exitoso · Actividad rutinaria',
  MEDIUM:   'Reset de contraseña · IP nueva',
  HIGH:     'Acceso no autorizado · Múltiples logins fallidos',
  CRITICAL: 'Cuenta bloqueada · Token comprometido · Rate limit excedido',
} as const;

export type SeverityKey = keyof typeof SEVERITY_COLORS;

/**
 * Alias semántico — refleja el nombre canónico del enum del backend
 * (`EventSeverity` en `SecurityEvent`). Use este alias cuando el código
 * trabaje específicamente con eventos de seguridad y quieras dejar
 * explícito que NO es `EventPriority`.
 */
export type EventSeverityKey = SeverityKey;

// ── Helpers defensivos ────────────────────────────────────────────────────

/** Color hex de la severidad, fallback MEDIUM (amber neutral). */
export function getSeverityColor(severity: string | undefined | null): string {
  if (!severity) return SEVERITY_COLORS.MEDIUM;
  return (SEVERITY_COLORS as Record<string, string>)[severity] ?? SEVERITY_COLORS.MEDIUM;
}

/** Etiqueta localizada de la severidad. */
export function getSeverityLabel(severity: string | undefined | null): string {
  if (!severity) return SEVERITY_LABELS.MEDIUM;
  return (SEVERITY_LABELS as Record<string, string>)[severity] ?? SEVERITY_LABELS.MEDIUM;
}

/** Texto de ejemplo para tooltips ("¿cuándo aplica este nivel?"). */
export function getSeverityExample(severity: string | undefined | null): string {
  if (!severity) return '';
  return (SEVERITY_EXAMPLES as Record<string, string>)[severity] ?? '';
}
