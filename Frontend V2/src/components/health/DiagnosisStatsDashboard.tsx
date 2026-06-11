/**
 * Dashboard de estadisticas de diagnosticos.
 *
 * Variantes:
 *   - 'compact': widget que se monta en /health/epidemiology. Muestra
 *                3 KPIs, donut pequeno, top 3 diagnosticos, link a la
 *                pagina completa.
 *   - 'full':    pagina dedicada /health/diagnosis/stats. 4 KPI cards,
 *                donut grande, top 10 diagnosticos, barra split
 *                confirmados/sospechosos.
 *
 * En ambas variantes los conteos navegan a /health/records con los
 * filtros pre-aplicados (drill-down). El componente NO maneja el
 * date range; lo recibe por props para que el padre lo controle.
 *
 * Calcula delta vs periodo anterior cuando hay startDate+endDate
 * (requerido por `useDiagnosisStatsWithDelta`). Si el periodo previo
 * falla en backend, oculta deltas sin romper el render.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import {
  Activity, Stethoscope, AlertTriangle, BarChart3, PieChart as PieIcon,
  TrendingUp, TrendingDown, Minus, ExternalLink, CheckCircle2, HelpCircle,
} from 'lucide-react';
import { useDiagnosisStatsWithDelta } from '@/hooks/useBovineHealth';
import { OverallHealthStatus } from '@/types/health.types';
import {
  HEALTH_COLORS, getHealthLabel,
} from '@/design-system/tokens/health.colors';
import type { DiagnosisStatsFilters, DiagnosisStatsResponse } from '@/types/health.types';

interface DiagnosisStatsDashboardProps {
  /** Rango + ranchId que el padre controla. */
  filters: DiagnosisStatsFilters;
  /** 'compact' = widget. 'full' = pagina dedicada. */
  variant: 'compact' | 'full';
  /** Solo para variant='compact'. Link a la pagina completa. */
  fullViewHref?: string;
}

// ── Helpers de UI ───────────────────────────────────────────────────────────

/**
 * Construye la URL al listado de records aplicando los filtros que
 * tengan sentido para cada celda clickable del dashboard.
 */
function buildRecordsLink(
  base: Record<string, string | undefined>,
  filters: DiagnosisStatsFilters,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v != null && v !== '') params.set(k, v);
  }
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate)   params.set('endDate', filters.endDate);
  return `/health/records?${params.toString()}`;
}

/**
 * Color del badge de delta segun signo y "polarity" del KPI:
 *   - positive: mas es mejor (e.g. confirmados). +N verde, -N rojo.
 *   - negative: menos es mejor (e.g. emergencias). -N verde, +N rojo.
 *   - neutral:  sin juicio (e.g. total diagnosticos). +N azul, -N gris.
 */
type DeltaPolarity = 'positive' | 'negative' | 'neutral';

interface DeltaProps {
  current:  number;
  previous: number | undefined;
  polarity?: DeltaPolarity;
}

function DeltaIndicator({ current, previous, polarity = 'neutral' }: DeltaProps) {
  if (previous == null || !Number.isFinite(previous)) return null;
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        <Minus className="w-3 h-3" /> Sin cambio
      </span>
    );
  }
  const pct = previous === 0
    ? null
    : Math.round((diff / previous) * 100);

  // Decide color por polarity.
  let cls = 'text-gray-500 dark:text-gray-400';
  if (polarity === 'positive') {
    cls = diff > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';
  } else if (polarity === 'negative') {
    cls = diff > 0
      ? 'text-red-600 dark:text-red-400'
      : 'text-emerald-600 dark:text-emerald-400';
  }

  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${cls}`}>
      <Icon className="w-3 h-3" />
      {diff > 0 ? '+' : ''}{diff}
      {pct != null && (
        <span className="opacity-80">
          ({diff > 0 ? '+' : ''}{pct}%)
        </span>
      )}
    </span>
  );
}

/**
 * Colores del donut. Mapeamos los status conocidos a HEALTH_COLORS;
 * los desconocidos caen a gris.
 */
function colorForStatus(status: string): string {
  const up = status.toUpperCase();
  return (HEALTH_COLORS as Record<string, string>)[up]
    ?? '#9ca3af';
}

// ── Componente principal ────────────────────────────────────────────────────

export function DiagnosisStatsDashboard({
  filters, variant, fullViewHref,
}: DiagnosisStatsDashboardProps) {
  const { data, isLoading, isError, error } = useDiagnosisStatsWithDelta(filters, {
    enabled: !!filters.ranchId,
  });

  const current  = data?.current;
  const previous = data?.previous ?? null;

  // Pie data para el donut. Solo entradas con count > 0 (sin slices vacios).
  const pieData = useMemo(() => {
    if (!current) return [];
    return Object.entries(current.byHealthStatus ?? {})
      .filter(([, n]) => n > 0)
      .map(([status, count]) => ({
        status,
        label: getHealthLabel(status),
        count,
        color: colorForStatus(status),
      }));
  }, [current]);

  // Top diagnosticos en formato para recharts (vertical bar layout).
  const topLimit = variant === 'full' ? 10 : 3;
  const topData = useMemo(() => {
    if (!current?.topDiagnoses) return [];
    return current.topDiagnoses.slice(0, topLimit).map((d) => ({
      name:      d.diagnosis.length > 22
        ? d.diagnosis.slice(0, 21) + '...'
        : d.diagnosis,
      fullName:  d.diagnosis,
      count:     d.count,
    }));
  }, [current, topLimit]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (!filters.ranchId) {
    // Sin rancho activo no podemos hacer la query.
    if (variant === 'compact') {
      return (
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Selecciona un rancho para ver las estadisticas de diagnosticos.
          </p>
        </Card>
      );
    }
    return (
      <Alert variant="info">
        Selecciona un rancho desde el picker superior para cargar las estadisticas.
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Card className={variant === 'compact' ? '' : 'h-64'}>
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (isError || !current) {
    return (
      <Alert variant="error" title="No se pudieron cargar las estadisticas">
        {(error as Error)?.message ?? 'Intenta nuevamente.'}
      </Alert>
    );
  }

  const totalConfirmed = current.confirmedVsSuspected?.confirmed ?? 0;
  const totalSuspected = current.confirmedVsSuspected?.suspected ?? 0;
  const totalCS = totalConfirmed + totalSuspected;
  const confirmedPct = totalCS > 0 ? Math.round((totalConfirmed / totalCS) * 100) : 0;

  // Links de drill-down. Todos respetan el rango del dashboard.
  const linkTotal     = buildRecordsLink({}, filters);
  const linkConfirmed = buildRecordsLink({ diagnosisConfirmed: 'true' }, filters);
  const linkSuspected = buildRecordsLink({ diagnosisConfirmed: 'false' }, filters);

  // ── Variante COMPACT (widget en epidemiology) ─────────────────────────────

  if (variant === 'compact') {
    return (
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <CardTitle className="flex items-center gap-2 mb-0">
            <Stethoscope className="w-5 h-5 text-primary-600" />
            Diagnosticos del periodo
          </CardTitle>
          {fullViewHref && (
            <Link
              to={fullViewHref}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
            >
              Ver dashboard completo
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>

        {/* 3 KPIs compactos */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <CompactKpi
            label="Total"
            value={current.totalDiagnoses}
            href={linkTotal}
            icon={<Activity className="w-4 h-4" />}
            delta={
              <DeltaIndicator
                current={current.totalDiagnoses}
                previous={previous?.totalDiagnoses}
                polarity="neutral"
              />
            }
          />
          <CompactKpi
            label="Confirmados"
            value={totalConfirmed}
            href={linkConfirmed}
            icon={<CheckCircle2 className="w-4 h-4" />}
            delta={
              <DeltaIndicator
                current={totalConfirmed}
                previous={previous?.confirmedVsSuspected?.confirmed}
                polarity="positive"
              />
            }
            accent="emerald"
          />
          <CompactKpi
            label="Sospechosos"
            value={totalSuspected}
            href={linkSuspected}
            icon={<HelpCircle className="w-4 h-4" />}
            delta={
              <DeltaIndicator
                current={totalSuspected}
                previous={previous?.confirmedVsSuspected?.suspected}
                polarity="neutral"
              />
            }
            accent="amber"
          />
        </div>

        {/* Mini donut + top 3 */}
        {(pieData.length > 0 || topData.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pieData.length > 0 && (
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={60}
                      stroke="none"
                    >
                      {pieData.map((p, i) => (
                        <Cell key={i} fill={p.color} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{ fontSize: 11, borderRadius: 6 }}
                      formatter={(v: number, _name, item) => [
                        v,
                        item?.payload?.label ?? '',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {topData.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-1">
                  Top diagnosticos
                </p>
                <ul className="space-y-1">
                  {topData.map((d) => (
                    <li key={d.fullName} className="flex items-center justify-between text-xs">
                      <Link
                        to={buildRecordsLink({ search: d.fullName }, filters)}
                        className="text-gray-700 dark:text-gray-300 truncate hover:text-primary-600 dark:hover:text-primary-400"
                        title={d.fullName}
                      >
                        {d.name}
                      </Link>
                      <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400 ml-2 shrink-0">
                        {d.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  // ── Variante FULL (pagina dedicada) ───────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* 4 KPI cards grandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FullKpi
          label="Total diagnosticos"
          value={current.totalDiagnoses}
          href={linkTotal}
          icon={<Activity className="w-5 h-5" />}
          delta={
            <DeltaIndicator
              current={current.totalDiagnoses}
              previous={previous?.totalDiagnoses}
              polarity="neutral"
            />
          }
        />
        <FullKpi
          label="Confirmados"
          value={totalConfirmed}
          href={linkConfirmed}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="emerald"
          delta={
            <DeltaIndicator
              current={totalConfirmed}
              previous={previous?.confirmedVsSuspected?.confirmed}
              polarity="positive"
            />
          }
        />
        <FullKpi
          label="Sospechosos"
          value={totalSuspected}
          href={linkSuspected}
          icon={<HelpCircle className="w-5 h-5" />}
          accent="amber"
          delta={
            <DeltaIndicator
              current={totalSuspected}
              previous={previous?.confirmedVsSuspected?.suspected}
              polarity="neutral"
            />
          }
        />
        <FullKpi
          label="% Confirmacion"
          value={`${confirmedPct}%`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          subtitle={`${totalConfirmed} / ${totalCS} diagnosticos`}
        />
      </div>

      {/* Donut + top diagnosticos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle className="flex items-center gap-2 mb-3">
            <PieIcon className="w-5 h-5 text-primary-600" />
            Distribucion por estado clinico
          </CardTitle>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic py-8 text-center">
              Sin diagnosticos en el periodo para distribuir.
            </p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    stroke="none"
                  >
                    {pieData.map((p, i) => (
                      <Cell
                        key={i}
                        fill={p.color}
                        className="cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, _n, item) => [v, item?.payload?.label ?? '']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(_v, _e, idx) => {
                      const p = pieData[idx as number];
                      if (!p) return '';
                      const link = buildRecordsLink(
                        { overallHealthStatus: p.status },
                        filters,
                      );
                      return (
                        <Link
                          to={link}
                          className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {p.label} ({p.count})
                        </Link>
                      ) as unknown as string;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            Top {topLimit} diagnosticos
          </CardTitle>
          {topData.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic py-8 text-center">
              Sin diagnosticos registrados en el periodo.
            </p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topData}
                  layout="vertical"
                  margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    className="dark:stroke-gray-800"
                  />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={140}
                  />
                  <RTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullName ?? ''
                    }
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {topData.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-1">
              {topData.map((d) => (
                <Link
                  key={d.fullName}
                  to={buildRecordsLink({ search: d.fullName }, filters)}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate"
                >
                  Ver registros de "{d.fullName}" -&gt;
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Barra split confirmados / sospechosos */}
      {totalCS > 0 && (
        <Card>
          <CardTitle className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-primary-600" />
            Confirmados vs sospechosos
          </CardTitle>
          <div className="flex h-8 rounded-lg overflow-hidden">
            <Link
              to={linkConfirmed}
              className="bg-emerald-500 dark:bg-emerald-600 hover:opacity-90 flex items-center justify-center text-xs font-medium text-white transition-opacity"
              style={{ width: `${confirmedPct}%` }}
              title={`Confirmados: ${totalConfirmed}`}
            >
              {confirmedPct >= 8 && `${totalConfirmed} (${confirmedPct}%)`}
            </Link>
            <Link
              to={linkSuspected}
              className="bg-amber-500 dark:bg-amber-600 hover:opacity-90 flex items-center justify-center text-xs font-medium text-white transition-opacity"
              style={{ width: `${100 - confirmedPct}%` }}
              title={`Sospechosos: ${totalSuspected}`}
            >
              {(100 - confirmedPct) >= 8 && `${totalSuspected} (${100 - confirmedPct}%)`}
            </Link>
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Confirmados
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Sospechosos
            </span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-2">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Un diagnostico "confirmado" tiene <code>confirmedAt</code> y
            <code> confirmedBy</code> registrados. Click en cualquier
            seccion para ver los registros correspondientes.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Sub-componentes de KPI ─────────────────────────────────────────────────

interface CompactKpiProps {
  label:  string;
  value:  number;
  href?:  string;
  icon?:  React.ReactNode;
  delta?: React.ReactNode;
  accent?: 'emerald' | 'amber' | 'red';
}

function CompactKpi({ label, value, href, icon, delta, accent }: CompactKpiProps) {
  const accentClass =
    accent === 'emerald' ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
    : accent === 'amber'   ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
    : accent === 'red'     ? 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
    :                        'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300';

  const inner = (
    <div className={`rounded-lg border px-3 py-2 ${accentClass} ${href ? 'hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer' : ''}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums mt-0.5">{value}</p>
      {delta && <div className="mt-0.5">{delta}</div>}
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

interface FullKpiProps {
  label:     string;
  value:     number | string;
  href?:     string;
  icon?:     React.ReactNode;
  delta?:    React.ReactNode;
  subtitle?: string;
  accent?:   'emerald' | 'amber' | 'red';
}

function FullKpi({ label, value, href, icon, delta, subtitle, accent }: FullKpiProps) {
  const accentClass =
    accent === 'emerald' ? 'bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
    : accent === 'amber'   ? 'bg-amber-50/60 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    : accent === 'red'     ? 'bg-red-50/60 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    :                        'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800';

  const inner = (
    <Card className={`!p-4 ${accentClass} ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
          {label}
        </p>
        {icon && (
          <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
      )}
      {delta && <div className="mt-1">{delta}</div>}
    </Card>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}
