/**
 * ════════════════════════════════════════════════════════════════════════
 *  HERD HEALTH SCORE — indicador visual de salud del hato
 * ════════════════════════════════════════════════════════════════════════
 *
 * A diferencia de `HEALTH_COLORS` (que mapea ESTADO INDIVIDUAL → color),
 * este token mapea un SCORE AGREGADO (-1.0 .. +1.0) → color, para que el
 * heatmap del módulo bovinos refleje "¿qué tan sano está el rancho aquí?"
 * en lugar de "¿cuántos animales hay aquí?".
 *
 * ── Cómo se calcula el score ─────────────────────────────────────────────
 *
 * Cada bovino contribuye un peso CON SIGNO según su estado de salud:
 *
 *   HEALTHY    → +1.0   (aporta salud al promedio)
 *   RECOVERING → +0.5   (mejora con reserva)
 *   UNKNOWN    →  0.0   (neutral, no contamina la lectura)
 *   SICK       → -0.7   (resta salud)
 *   QUARANTINE → -0.9   (resta significativamente)
 *   DECEASED   → -1.0   (resta máximo)
 *
 * El score de una zona es el PROMEDIO de los pesos de sus bovinos:
 *
 *   score = Σ(weight_i) / count
 *
 * Resultado en [-1, +1]:
 *   • +1.0  → todos sanos
 *   •  0.0  → mitad sanos, mitad enfermos (o todos UNKNOWN)
 *   • -1.0  → todos fallecidos
 *
 * ── Gradiente visual (INVERTIDO respecto al heatmap clásico) ─────────────
 *
 * Los tonos fríos representan SALUD, los cálidos representan RIESGO.
 * Esto es lo contrario al heatmap genérico de leaflet.heat (donde rojo
 * típicamente significa "alta densidad" sin discriminación sanitaria).
 *
 *   score ≥ +0.7  → 🟢 verde intenso  — Saludable
 *   score +0.3..+0.7 → 🟢 verde claro — Estable
 *   score -0.1..+0.3 → 🟡 amarillo    — Mixto / atención
 *   score -0.5..-0.1 → 🟠 naranja     — Alerta
 *   score < -0.5  → 🔴 rojo intenso   — Crítico
 *
 * ════════════════════════════════════════════════════════════════════════
 */

import type { HealthStatusKey } from './health.colors';

/**
 * Pesos por estado de salud para el SCORE AGREGADO del hato.
 *
 * IMPORTANTE: estos pesos son CON SIGNO (positivo = aporta salud, negativo =
 * resta). NO confundir con `HEALTH_WEIGHTS` (intensidad para leaflet.heat,
 * siempre positivos y ponderan severidad para que críticos pesen más).
 */
export const HERD_HEALTH_SCORE_WEIGHTS: Record<HealthStatusKey, number> = {
  HEALTHY:    +1.0,
  RECOVERING: +0.5,
  UNKNOWN:     0.0,
  SICK:       -0.7,
  QUARANTINE: -0.9,
  DECEASED:   -1.0,
};

/**
 * Buckets de score → color hex + label. Definidos en orden de "peor a mejor"
 * — la función de búsqueda recorre la lista y devuelve el primer bucket
 * cuyo `threshold` sea ≥ al score consultado.
 */
export interface HerdHealthBucket {
  /** Score máximo (inclusive) para este bucket. */
  threshold: number;
  color: string;
  label: string;
  description: string;
}

export const HERD_HEALTH_BUCKETS: readonly HerdHealthBucket[] = [
  {
    threshold:   -0.5,
    color:       '#dc2626',  // red-600
    label:       'Crítico',
    description: 'Alta concentración de bovinos en cuarentena o fallecidos',
  },
  {
    threshold:   -0.1,
    color:       '#f97316',  // orange-500
    label:       'Alerta',
    description: 'Más enfermos que sanos — requiere atención',
  },
  {
    threshold:   +0.3,
    color:       '#facc15',  // yellow-400
    label:       'Mixto',
    description: 'Mezcla de sanos y enfermos — monitorear',
  },
  {
    threshold:   +0.7,
    color:       '#84cc16',  // lime-500
    label:       'Estable',
    description: 'Mayoría sana con algunos casos',
  },
  {
    threshold:   +1.0,
    color:       '#16a34a',  // green-600
    label:       'Saludable',
    description: 'Hato completamente sano',
  },
] as const;

/**
 * Gradiente lineal CSS (verde → amarillo → rojo) — usado por la leyenda
 * visual en la barra del sidebar. Coordina con los buckets de arriba.
 */
export const HERD_HEALTH_GRADIENT = {
  0.0: '#dc2626',  // crítico (score = -1.0 → stop 0%)
  0.25: '#f97316',
  0.5: '#facc15',
  0.75: '#84cc16',
  1.0: '#16a34a',  // saludable (score = +1.0 → stop 100%)
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Devuelve el peso (con signo) del estado de salud para el score agregado.
 *
 * Defensive en 2 dimensiones:
 *  1. CASE-INSENSITIVE: acepta 'HEALTHY' | 'healthy' | 'Healthy' — el
 *     backend podría almacenar variaciones de casing si los datos vienen
 *     de migraciones legacy o de un seed manual.
 *  2. ALIASES comunes: 'SANO', 'ALIVE' → HEALTHY, 'DEAD' → DECEASED, etc.
 *     Cubre nombres anglosajones/españoles intercambiables que aparecen
 *     en sistemas integrados con terceros.
 *
 * Si el status sigue sin matchear tras normalizar, devuelve 0 (neutral).
 */
const STATUS_ALIAS: Record<string, HealthStatusKey> = {
  // Inglés alternativo
  ALIVE: 'HEALTHY',
  WELL: 'HEALTHY',
  ILL: 'SICK',
  DISEASED: 'SICK',
  ISOLATED: 'QUARANTINE',
  ISOLATION: 'QUARANTINE',
  DEAD: 'DECEASED',
  DIED: 'DECEASED',
  RECOVERY: 'RECOVERING',
  RECOVERED: 'RECOVERING',
  // Español frecuente
  SANO: 'HEALTHY',
  SALUDABLE: 'HEALTHY',
  ENFERMO: 'SICK',
  CUARENTENA: 'QUARANTINE',
  RECUPERANDOSE: 'RECOVERING',
  RECUPERACION: 'RECOVERING',
  FALLECIDO: 'DECEASED',
  MUERTO: 'DECEASED',
  DESCONOCIDO: 'UNKNOWN',
};

export function getHerdHealthWeight(status: string | undefined | null): number {
  if (!status) return 0;
  const upper = String(status).toUpperCase().trim();
  // Match directo contra el set canónico.
  if (upper in HERD_HEALTH_SCORE_WEIGHTS) {
    return HERD_HEALTH_SCORE_WEIGHTS[upper as HealthStatusKey];
  }
  // Fallback: alias legacy / español.
  const aliased = STATUS_ALIAS[upper];
  if (aliased) return HERD_HEALTH_SCORE_WEIGHTS[aliased];
  return 0;
}

/**
 * Calcula el score agregado de un conjunto de bovinos (rango -1 a +1).
 * Si no hay bovinos devuelve 0 (neutral) — el caller decide si ocultar
 * la zona o mostrarla en color neutro.
 *
 * @example
 *   computeHerdHealthScore([
 *     { healthStatus: 'HEALTHY' },
 *     { healthStatus: 'HEALTHY' },
 *     { healthStatus: 'SICK' },
 *   ])
 *   // → (1.0 + 1.0 - 0.7) / 3 = 0.43 → "Mixto" / amarillo
 */
export function computeHerdHealthScore(
  bovines: Array<{ healthStatus?: string | null }>,
): number {
  if (bovines.length === 0) return 0;
  const total = bovines.reduce((sum, b) => sum + getHerdHealthWeight(b.healthStatus), 0);
  return total / bovines.length;
}

/**
 * Resuelve el bucket que corresponde a un score. Recorre los buckets en
 * orden ascendente y devuelve el PRIMERO cuyo threshold sea ≥ al score.
 */
export function getHerdHealthBucket(score: number): HerdHealthBucket {
  for (const bucket of HERD_HEALTH_BUCKETS) {
    if (score <= bucket.threshold) return bucket;
  }
  // Si score > +1.0 (no debería pasar), caemos al último.
  return HERD_HEALTH_BUCKETS[HERD_HEALTH_BUCKETS.length - 1];
}

/** Atajo: color hex correspondiente al score. */
export function getHerdHealthColor(score: number): string {
  return getHerdHealthBucket(score).color;
}

/** Atajo: label localizado del nivel de salud agregado. */
export function getHerdHealthLabel(score: number): string {
  return getHerdHealthBucket(score).label;
}
