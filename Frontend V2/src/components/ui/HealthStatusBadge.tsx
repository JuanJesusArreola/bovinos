import { Heart, Thermometer, RefreshCw, AlertTriangle, Skull, HelpCircle } from 'lucide-react';
import { OverallHealthStatus } from '@/types/health.types';

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG: Record<
  OverallHealthStatus,
  { label: string; icon: React.ReactNode; classes: string }
> = {
  [OverallHealthStatus.HEALTHY]: {
    label: 'Saludable',
    icon: <Heart className="w-3.5 h-3.5" />,
    classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  [OverallHealthStatus.SICK]: {
    label: 'Enfermo',
    icon: <Thermometer className="w-3.5 h-3.5" />,
    classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  [OverallHealthStatus.RECOVERING]: {
    label: 'Recuperación',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  [OverallHealthStatus.QUARANTINE]: {
    label: 'Cuarentena',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  [OverallHealthStatus.DECEASED]: {
    label: 'Fallecido',
    icon: <Skull className="w-3.5 h-3.5" />,
    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
  [OverallHealthStatus.UNKNOWN]: {
    label: 'Desconocido',
    icon: <HelpCircle className="w-3.5 h-3.5" />,
    classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  },
};

// ─── Fallback for raw string statuses (bovine.healthStatus is string) ─────────

const FALLBACK_MAP: Record<string, OverallHealthStatus> = {
  HEALTHY:    OverallHealthStatus.HEALTHY,
  SICK:       OverallHealthStatus.SICK,
  RECOVERING: OverallHealthStatus.RECOVERING,
  QUARANTINE: OverallHealthStatus.QUARANTINE,
  DECEASED:   OverallHealthStatus.DECEASED,
  UNKNOWN:    OverallHealthStatus.UNKNOWN,
};

// ─── Component ────────────────────────────────────────────────────────────────

interface HealthStatusBadgeProps {
  status: OverallHealthStatus | string | null | undefined;
  /** Show the icon alongside the label */
  showIcon?: boolean;
  /** Compact size (smaller padding) */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Centralised badge for bovine / health record health status.
 * Accepts both the OverallHealthStatus enum and raw backend strings.
 *
 * Usage:
 *   <HealthStatusBadge status={bovine.healthStatus} />
 *   <HealthStatusBadge status={OverallHealthStatus.SICK} showIcon />
 */
export function HealthStatusBadge({
  status,
  showIcon = true,
  size = 'sm',
  className = '',
}: HealthStatusBadgeProps) {
  const normalized = status
    ? (FALLBACK_MAP[status as string] ?? OverallHealthStatus.UNKNOWN)
    : OverallHealthStatus.UNKNOWN;

  const cfg = CONFIG[normalized];

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${cfg.classes} ${className}`}
      title={cfg.label}
    >
      {showIcon && cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Utility exports ─────────────────────────────────────────────────────────

export function getHealthStatusLabel(status: OverallHealthStatus | string | null | undefined): string {
  const normalized = status
    ? (FALLBACK_MAP[status as string] ?? OverallHealthStatus.UNKNOWN)
    : OverallHealthStatus.UNKNOWN;
  return CONFIG[normalized].label;
}

export function getHealthStatusClasses(status: OverallHealthStatus | string | null | undefined): string {
  const normalized = status
    ? (FALLBACK_MAP[status as string] ?? OverallHealthStatus.UNKNOWN)
    : OverallHealthStatus.UNKNOWN;
  return CONFIG[normalized].classes;
}
