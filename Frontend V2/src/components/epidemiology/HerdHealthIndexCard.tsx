/**
 * HerdHealthIndexCard — KPI hero del dashboard de Epidemiología.
 *
 * F-36 / Backend E-02. Consume `GET /api/epidemiology/herd-health/:ranchId`
 * que devuelve:
 *   - `healthScore` 0..100 (ponderado por status clínico)
 *   - `vaccinationCoveragePct` 0..100
 *   - `byStatus` con conteo + %
 *
 * UX:
 *   - Anillo de progreso grande con el score (color semafórico).
 *   - Subtítulo con cobertura vacunal y total activo.
 *   - Mini-barras horizontales por cada status con label en español
 *     (del design-system `health.colors.ts`).
 *
 * NOTA: el endpoint devuelve `byStatus` con claves opcionales — si un
 * status tiene 0 bovinos, el backend lo omite. La UI filtra y solo muestra
 * las claves presentes para no saturar la card con líneas vacías.
 */

import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Activity, ShieldCheck, Skull } from 'lucide-react';
import { useHerdHealthIndex } from '@/hooks/useEpidemiology';
import { getHealthColor } from '@/design-system/tokens/health.colors';
import type { HerdHealthIndex } from '@/types/epidemiology.dtos';

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): { ring: string; text: string; bg: string } {
  if (score >= 80) return { ring: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
  if (score >= 60) return { ring: 'stroke-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20' };
  if (score >= 40) return { ring: 'stroke-orange-500',  text: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-900/20' };
  return                  { ring: 'stroke-red-500',     text: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/20' };
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bueno';
  if (score >= 55) return 'Regular';
  if (score >= 40) return 'Bajo';
  return 'Crítico';
}

const STATUS_LABELS: Record<keyof HerdHealthIndex['byStatus'], string> = {
  HEALTHY:    'Saludables',
  SICK:       'Enfermos',
  RECOVERING: 'En recuperación',
  QUARANTINE: 'En cuarentena',
  UNKNOWN:    'Sin diagnóstico',
  DECEASED:   'Fallecidos',
};

// Anillo SVG circular.
function ProgressRing({ value, colorClass }: { value: number; colorClass: string }) {
  const size = 140;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circ - (clamped / 100) * circ;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        className="text-gray-200 dark:text-gray-700"
        strokeWidth={stroke}
        fill="none"
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className={colorClass}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
    </svg>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface HerdHealthIndexCardProps {
  ranchId: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function HerdHealthIndexCard({ ranchId }: HerdHealthIndexCardProps) {
  const { data, isLoading, error } = useHerdHealthIndex(ranchId);

  if (isLoading) {
    return (
      <Card>
        <div className="flex justify-center py-12"><Spinner /></div>
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <Alert variant="error">No se pudo cargar el índice de salud del hato.</Alert>
      </Card>
    );
  }

  const colors = scoreColor(data.healthScore);

  // Solo mostrar los status que el backend reporta (omite count=0).
  const statusEntries = (Object.keys(STATUS_LABELS) as Array<keyof HerdHealthIndex['byStatus']>)
    .map((key) => ({ key, item: data.byStatus[key] }))
    .filter((e): e is { key: keyof HerdHealthIndex['byStatus']; item: NonNullable<typeof e.item> } => !!e.item)
    // Ordenar por count desc — el VET ve primero los grupos mas grandes.
    .sort((a, b) => b.item.count - a.item.count);

  return (
    <Card className={`relative overflow-hidden ${colors.bg}`}>
      <div className="flex items-start gap-2 mb-4">
        <Activity className={`w-5 h-5 mt-0.5 ${colors.text}`} />
        <div className="flex-1">
          <CardTitle className="mb-0">Índice de salud del hato</CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Score ponderado sobre {data.totalActive.toLocaleString()} bovinos activos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-6 items-center">
        {/* ── Ring + score ───────────────────────────────────────────────── */}
        <div className="relative inline-flex items-center justify-center mx-auto md:mx-0">
          <ProgressRing value={data.healthScore} colorClass={colors.ring} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className={`text-4xl font-bold tabular-nums ${colors.text}`}>
              {data.healthScore.toFixed(0)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-0.5">
              {scoreLabel(data.healthScore)}
            </p>
          </div>
        </div>

        {/* ── Breakdown ──────────────────────────────────────────────────── */}
        <div className="space-y-3 min-w-0">
          {/* Cobertura vacunal — destacada */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/60 dark:bg-gray-900/40 border border-white/40 dark:border-gray-800">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-gray-700 dark:text-gray-300">Cobertura vacunal</span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
              {data.vaccinationCoveragePct.toFixed(1)}%
            </span>
          </div>

          {/* Desglose por status */}
          <ul className="space-y-1.5">
            {statusEntries.map(({ key, item }) => {
              const color = key === 'DECEASED'
                ? '#6b7280'
                : getHealthColor(key as Parameters<typeof getHealthColor>[0]);
              return (
                <li key={key}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-700 dark:text-gray-300 inline-flex items-center gap-1.5">
                      {key === 'DECEASED' && <Skull className="w-3 h-3 text-gray-500" />}
                      {STATUS_LABELS[key]}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                      {item.count} · {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200/60 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(100, item.percentage)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}
