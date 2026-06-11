/**
 * ════════════════════════════════════════════════════════════════════════
 *  PRIORITY — qué tan URGENTE es atender lo que falta
 * ════════════════════════════════════════════════════════════════════════
 *
 * Mirada hacia el FUTURO. Califica algo PENDIENTE de hacer — un evento
 * programado, una tarea, una intervención. En el backend corresponde al
 * enum `EventPriority` del modelo `Event` (módulo de ganadería).
 *
 * NO confundir con `severity.colors.ts` (`EventSeverity`), que mira al
 * PASADO — qué tan grave fue lo que ya ocurrió.
 *
 *   PRIORITY  →  ¿qué tan rápido actuar?  (queue de trabajo)
 *   SEVERITY  →  ¿qué tan serio fue?      (post-mortem)
 *
 * ── Niveles y casos de uso (ejemplos del módulo de ganadería) ────────────
 *
 *   LOW        Puede esperar SEMANAS sin problema.
 *              Ej: pesaje rutinario, registro de datos genealógicos.
 *              Color verde (todo bien, sin presión).
 *
 *   MEDIUM     Normal — agendado, pero no apremia.
 *              Ej: vacuna programada en 2 semanas, revisión mensual.
 *              Color azul (informativo, en agenda).
 *
 *   HIGH       Atender PRONTO — esta semana o antes.
 *              Ej: tratamiento en curso, refuerzo de vacuna vencida.
 *              Color amber (atención requerida).
 *
 *   CRITICAL   Atender HOY — no puede pasar otro día.
 *              Ej: chequeo urgente, bovino con síntomas agudos.
 *              Color rojo (urgente).
 *
 *   EMERGENCY  Atender AHORA — interrumpe todo lo demás.
 *              Ej: parto en progreso, cirugía de emergencia, accidente.
 *              Color rojo-vino oscuro (máxima prioridad clínica).
 *
 * ── ¿Por qué SÍ existe `EMERGENCY` aquí (y no en SEVERITY)? ──────────────
 *
 * En ganadería existen escenarios de tiempo crítico real — un parto con
 * complicaciones o una cirugía no pueden esperar. Necesitamos un nivel
 * por encima de CRITICAL que SUSPENDA todo lo demás en la cola del
 * veterinario / encargado. En seguridad, en cambio, "ya pasó" es el
 * peor caso posible (CRITICAL es post-mortem), no hay un nivel "todavía
 * más urgente" porque el tiempo dejó de correr.
 *
 * ════════════════════════════════════════════════════════════════════════
 */

export const PRIORITY_COLORS = {
  LOW:       '#22c55e',  // verde — sin presión, puede esperar
  MEDIUM:    '#3b82f6',  // azul — agendado, informativo
  HIGH:      '#f59e0b',  // amber — atender pronto
  CRITICAL:  '#ef4444',  // rojo — hoy
  EMERGENCY: '#7f1d1d',  // rojo-vino — ahora, interrumpe todo
} as const;

export const PRIORITY_LABELS = {
  LOW:       'Baja',
  MEDIUM:    'Media',
  HIGH:      'Alta',
  CRITICAL:  'Crítica',
  EMERGENCY: 'Emergencia',
} as const;

/**
 * Casos de uso típicos por nivel — pensados para tooltips, ayuda contextual
 * en agendas y dashboards de pendientes. Documentan la regla práctica de
 * "¿cuándo decir LOW vs HIGH?".
 */
export const PRIORITY_EXAMPLES = {
  LOW:       'Pesaje rutinario · Datos genealógicos',
  MEDIUM:    'Vacuna agendada en 2 semanas · Revisión mensual',
  HIGH:      'Tratamiento en curso · Refuerzo vencido',
  CRITICAL:  'Chequeo urgente · Síntomas agudos (atender hoy)',
  EMERGENCY: 'Parto en progreso · Cirugía de emergencia · Accidente',
} as const;

/**
 * SLA orientativo asociado a cada nivel — útil para placeholders en formularios
 * y reportes ("Crítica: completar en menos de 24 h").
 */
export const PRIORITY_SLA = {
  LOW:       'Sin SLA — puede esperar semanas',
  MEDIUM:    'Dentro de 1-2 semanas',
  HIGH:      'Dentro de esta semana',
  CRITICAL:  'Hoy mismo (<24 h)',
  EMERGENCY: 'Inmediato — interrumpe otras tareas',
} as const;

export type PriorityKey = keyof typeof PRIORITY_COLORS;

/**
 * Alias semántico — refleja el nombre canónico del enum del backend
 * (`EventPriority` en `Event`). Use este alias cuando el código trabaje
 * específicamente con eventos de ganadería y quiera dejar explícito que
 * NO es `EventSeverity`.
 */
export type EventPriorityKey = PriorityKey;

// ── Helpers defensivos ────────────────────────────────────────────────────

/** Color hex de la prioridad con fallback a MEDIUM (azul neutral). */
export function getPriorityColor(priority: string | undefined | null): string {
  if (!priority) return PRIORITY_COLORS.MEDIUM;
  return (PRIORITY_COLORS as Record<string, string>)[priority] ?? PRIORITY_COLORS.MEDIUM;
}

/** Etiqueta localizada de la prioridad. */
export function getPriorityLabel(priority: string | undefined | null): string {
  if (!priority) return PRIORITY_LABELS.MEDIUM;
  return (PRIORITY_LABELS as Record<string, string>)[priority] ?? PRIORITY_LABELS.MEDIUM;
}

/** Texto de ejemplo para tooltips ("¿cuándo aplica este nivel?"). */
export function getPriorityExample(priority: string | undefined | null): string {
  if (!priority) return '';
  return (PRIORITY_EXAMPLES as Record<string, string>)[priority] ?? '';
}

/** SLA orientativo del nivel (ej. "Hoy mismo (<24 h)"). */
export function getPrioritySLA(priority: string | undefined | null): string {
  if (!priority) return '';
  return (PRIORITY_SLA as Record<string, string>)[priority] ?? '';
}
