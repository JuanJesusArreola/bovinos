/**
 * Hero card de resumen clinico para UN bovino. Va arriba de la pestana
 * de salud y muestra de un vistazo:
 *   - Estado actual de salud (badge grande)
 *   - Total registros + ultima visita
 *   - Caso clinico activo si lo hay (link al detalle)
 *   - KPIs operativos: emergencias 90d, follow-ups pendientes
 *   - Desglose de registros por tipo (chips compactos)
 *
 * Empty state: si el backend devuelve `null` o `totalRecords === 0`,
 * mostramos un mensaje neutro indicando que el bovino aun no tiene
 * registros clinicos (no es alarma, es contexto).
 *
 * No re-renderiza los datos que el header del BovineDetailPage ya
 * muestra (raza, edad, ubicacion); solo lo especifico de salud.
 */

import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import { Spinner } from '@/components/ui/Spinner';
import {
  HeartPulse, FileText, Calendar, AlertTriangle, Bell,
  Stethoscope, ExternalLink,
} from 'lucide-react';
import { useBovineHealthSummary } from '@/hooks/useBovineHealth';
import { formatDate, formatRelative } from '@/utils/formatters';
import { HEALTH_RECORD_TYPE_LABELS } from '@/design-system/tokens/health-record-type.colors';
import {
  getCaseStatusBadgeVariant, getCaseStatusLabel,
} from '@/design-system/tokens/case-status.colors';

interface BovineHealthSummaryCardProps {
  bovineId: string;
}

export function BovineHealthSummaryCard({ bovineId }: BovineHealthSummaryCardProps) {
  const { data: summary, isLoading } = useBovineHealthSummary(bovineId);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-24">
        <Spinner />
      </Card>
    );
  }

  // Sin datos o sin registros: render compacto neutro.
  if (!summary || summary.totalRecords === 0) {
    return (
      <Card className="!p-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center shrink-0">
            <HeartPulse className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Sin historial clinico aun
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cuando se registre la primera consulta aparecera el resumen aqui.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const recordsByType = Object.entries(summary.recordsByType ?? {})
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <Card>
      {/* Fila 1: estado + caso activo */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
            <HeartPulse className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
              Estado clinico actual
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <HealthStatusBadge
                status={summary.currentHealthStatus}
                showIcon
                size="md"
              />
              {summary.lastVisitDate && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  &middot; ultima visita {formatRelative(summary.lastVisitDate)}
                </span>
              )}
            </div>
          </div>
        </div>

        {summary.activeCase && (
          <Link
            to={`/health/cases/${summary.activeCase.id}`}
            className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20 px-3 py-2 hover:bg-red-100/60 dark:hover:bg-red-900/30 transition-colors"
          >
            <p className="text-[10px] text-red-700 dark:text-red-300 uppercase tracking-wider font-medium flex items-center gap-1">
              <Stethoscope className="w-3 h-3" />
              Caso clinico activo
            </p>
            <p className="text-sm font-semibold text-red-900 dark:text-red-100 mt-0.5">
              {summary.activeCase.diseaseName}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={getCaseStatusBadgeVariant(summary.activeCase.status)}>
                {getCaseStatusLabel(summary.activeCase.status)}
              </Badge>
              <span className="text-[11px] text-red-700/80 dark:text-red-300/80">
                desde {formatDate(summary.activeCase.diagnosedAt)}
              </span>
              <ExternalLink className="w-3 h-3 text-red-600 dark:text-red-400" />
            </div>
          </Link>
        )}
      </div>

      {/* Fila 2: 4 KPIs operativos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <SummaryStat
          icon={<FileText className="w-4 h-4" />}
          label="Total registros"
          value={summary.totalRecords}
        />
        <SummaryStat
          icon={<Calendar className="w-4 h-4" />}
          label="Ultima visita"
          value={summary.lastVisitDate ? formatDate(summary.lastVisitDate) : '—'}
          asText
        />
        <SummaryStat
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Emergencias 90d"
          value={summary.emergenciesLast90Days}
          accent={summary.emergenciesLast90Days > 0 ? 'red' : undefined}
        />
        <SummaryStat
          icon={<Bell className="w-4 h-4" />}
          label="Seguimientos pendientes"
          value={summary.pendingFollowUps}
          accent={summary.pendingFollowUps > 0 ? 'blue' : undefined}
        />
      </div>

      {/* Fila 3: desglose por tipo (solo si hay algo que mostrar) */}
      {recordsByType.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-2">
            Registros por tipo
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recordsByType.map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {HEALTH_RECORD_TYPE_LABELS[type] ?? type}
                <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Sub-componente: una celda de KPI ───────────────────────────────────────

interface SummaryStatProps {
  icon:    React.ReactNode;
  label:   string;
  value:   number | string;
  /** Cuando true, renderiza el valor como string (no aplica formato tabular). */
  asText?: boolean;
  /** Si esta presente, tinta el contenedor para llamar la atencion. */
  accent?: 'red' | 'blue';
}

function SummaryStat({ icon, label, value, asText, accent }: SummaryStatProps) {
  const accentClass =
    accent === 'red'
      ? 'border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20 text-red-700 dark:text-red-300'
      : accent === 'blue'
        ? 'border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300';
  return (
    <div className={`rounded-lg border px-3 py-2 ${accentClass}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <p className={`mt-0.5 font-semibold ${asText ? 'text-sm' : 'text-xl tabular-nums'}`}>
        {value}
      </p>
    </div>
  );
}
