/**
 * Dashboard de Epidemiología.
 *
 * Ruta: `/health/epidemiology`
 * Permisos: `VIEW_EPIDEMIOLOGY` (VETERINARIAN o superior). El listado
 * crudo de casos sigue siendo público vía `/health/cases`, pero el
 * agregado epidemiológico es lectura sólo para roles clínicos.
 *
 * Datos consumidos:
 *   - `useLatestSnapshots({ranchId, diseaseId:'null'})` → KPIs globales
 *     del rancho (un único snapshot agregado del último día).
 *   - `useTopDiseases(ranchId, {limit:5})` → top-5 enfermedades activas
 *     para barras horizontales + tabla con link al brote (Sprint 7).
 *   - `useEpidemiologyTrend(ranchId, {diseaseId, days})` → serie temporal
 *     para line chart. El diseaseId admite `'null'` literal (global del
 *     rancho) o un UUID concreto; el selector controla cuál mostrar.
 *
 * Solo SUPER_ADMIN ve "Recalcular ahora" — dispara el cron manualmente.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
  LineChart, Line,
} from 'recharts';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import {
  RanchFilterBanner, RanchFilterBannerEmpty,
} from '@/components/shared/RanchFilterBanner';
import { RanchLabSurveillanceCard } from '@/components/health/RanchLabSurveillanceCard';
import { DiagnosisStatsDashboard } from '@/components/health/DiagnosisStatsDashboard';
import { MortalityReportCard } from '@/components/epidemiology/MortalityReportCard';
import { HerdHealthIndexCard } from '@/components/epidemiology/HerdHealthIndexCard';
import { defaultDateRange } from '@/components/health/DateRangeSelector';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import { PermissionGuard } from '@/components/ui/PermissionGuard';
import {
  Activity, TrendingUp, AlertTriangle, Skull, HeartPulse,
  RefreshCw, BarChart3, LineChart as LineIcon, ExternalLink,
  Calendar, Stethoscope,
} from 'lucide-react';
import {
  useLatestSnapshots,
  useTopDiseases,
  useEpidemiologyTrend,
  useComputeEpidemiology,
} from '@/hooks/useEpidemiology';
import { useActiveDiseases } from '@/hooks/useDiseases';
import { formatDate } from '@/utils/formatters';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Formatea un porcentaje 0..100 con 1 decimal y sufijo "%".
 *  Defensivo: Sequelize devuelve NUMERIC/DECIMAL como string en algunos
 *  drivers, asi que coercemos a Number antes de llamar toFixed. */
function fmtPct(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

/** Coerce defensivo a number finito. Devuelve null si no es coercible.
 *  Usado para campos numericos que el backend puede emitir como string
 *  (PostgreSQL NUMERIC con Sequelize). */
function toNum(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Acorta nombre de enfermedad si excede N chars — el axis de recharts
 *  no envuelve y los nombres largos se cortan visualmente. */
function truncate(s: string, max = 18): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// Selector "días hacia atrás" del trend.
const DAYS_OPTIONS = [
  { value: '7',   label: 'Últimos 7 días'  },
  { value: '30',  label: 'Últimos 30 días' },
  { value: '90',  label: 'Últimos 90 días' },
];

// ── Component ──────────────────────────────────────────────────────────────

export function EpidemiologyDashboardPage() {
  const { activeRanchId } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  // ── Estado de controles ──────────────────────────────────────────────────
  // diseaseId del trend: 'null' (string literal, ver convención backend) =
  // snapshot global del rancho. UUID = una enfermedad concreta.
  const [trendDiseaseId, setTrendDiseaseId] = useState<string>('null');
  const [trendDays, setTrendDays]           = useState<number>(30);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: globalSnapshots, isLoading: isLoadingSnap } = useLatestSnapshots(
    { ranchId: activeRanchId ?? undefined, diseaseId: 'null' },
    { enabled: !!activeRanchId },
  );
  // El endpoint puede devolver array (esperamos 1 elemento — el global del
  // último día) o vacío si aún no se ha corrido el cron en este rancho.
  const globalSnapshot = globalSnapshots?.[0];

  const { data: topDiseases = [], isLoading: isLoadingTop } = useTopDiseases(
    activeRanchId ?? undefined,
    { limit: 5 },
    { enabled: !!activeRanchId },
  );

  const { data: trendPoints = [], isLoading: isLoadingTrend } = useEpidemiologyTrend(
    activeRanchId ?? undefined,
    { diseaseId: trendDiseaseId as 'null' | string, days: trendDays },
    { enabled: !!activeRanchId },
  );

  const { data: diseases = [] } = useActiveDiseases({ enabled: !!activeRanchId });

  const computeMutation = useComputeEpidemiology();

  // ── Datos derivados para charts ─────────────────────────────────────────
  // Barras: las claves del object van directo al dataKey de Bar.
  const topDiseasesChartData = useMemo(() =>
    topDiseases.map((d) => ({
      name:           truncate(d.diseaseName),
      fullName:       d.diseaseName,
      diseaseId:      d.diseaseId,
      diseaseSlug:    d.diseaseSlug,
      activeCases:    toNum(d.activeCases) ?? 0,
      affectedBovines: toNum(d.affectedBovines) ?? 0,
      newCases7d:     toNum(d.newCases7d) ?? 0,
      incidenceRate:  toNum(d.incidenceRate) ?? 0,
      vaccinationCoverage: toNum(d.vaccinationCoverage),
    })),
  [topDiseases]);

  /**
   * Cobertura vacunal promedio del top mostrado. Util como KPI rapido
   * porque el snapshot global del rancho no tiene este campo (es
   * per-disease). Si ningun top-disease trae coverage, el resultado es
   * null y la UI muestra "—".
   */
  const avgVaccinationCoverage = useMemo(() => {
    const valid = topDiseases
      .map((d) => toNum(d.vaccinationCoverage))
      .filter((v): v is number => v != null);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }, [topDiseases]);

  // Trend: recharts pide objetos planos con la fecha como string corto.
  const trendChartData = useMemo(() =>
    trendPoints.map((p) => ({
      date:           p.snapshotDate.slice(5), // MM-DD para axis legible
      fullDate:       p.snapshotDate,
      activeCases:    toNum(p.activeCases) ?? 0,
      newCases7d:     toNum(p.newCases7d) ?? 0,
      newCases30d:    toNum(p.newCases30d) ?? 0,
      incidenceRate:  toNum(p.incidenceRate) ?? 0,
      mortalityRate:  toNum(p.mortalityRate) ?? 0,
      // null en snapshots globales (cuando trendDiseaseId === 'null') o
      // cuando el backend no pudo calcular. Recharts grafica null como
      // hueco en la linea, lo cual es el comportamiento deseado.
      vaccinationCoverage: toNum(p.vaccinationCoverage),
    })),
  [trendPoints]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleRecompute() {
    try {
      const res = await computeMutation.mutateAsync({});
      toastSuccess(
        'Recálculo iniciado',
        `Procesados ${res.processed} snapshots para ${res.date}.`,
      );
    } catch (err) {
      toastError('No se pudo recalcular', (err as Error)?.message);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Activity className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Epidemiología</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tendencias, métricas y top de enfermedades activas en el rancho.
            </p>
          </div>
        </div>

        <PermissionGuard action="COMPUTE_EPIDEMIOLOGY">
          <Button
            variant="outline"
            icon={<RefreshCw className={computeMutation.isPending ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />}
            loading={computeMutation.isPending}
            onClick={handleRecompute}
          >
            Recalcular ahora
          </Button>
        </PermissionGuard>
      </div>

      <RanchFilterBanner
        activeHint="Datos epidemiológicos de este rancho."
        emptyHint="Selecciona un rancho para ver su dashboard epidemiológico."
      />

      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="Los KPIs, tendencias y rankings se calculan por rancho. Elige uno arriba para continuar."
        />
      )}

      {activeRanchId && (
        <>
          {/* F-36 / Backend E-02: hero KPI. Score 0-100 ponderado por
              status clinico + cobertura vacunal + desglose. El VET / dueno
              lo ve primero al entrar al dashboard como vista ejecutiva. */}
          <HerdHealthIndexCard ranchId={activeRanchId} />

          {/* ── KPI cards ────────────────────────────────────────────── */}
          {isLoadingSnap ? (
            <Card className="flex items-center justify-center h-32">
              <Spinner />
            </Card>
          ) : !globalSnapshot ? (
            <Alert variant="info" title="Aún no hay snapshot calculado">
              Los snapshots se generan automáticamente cada noche. Si necesitas
              ver datos ahora mismo, pide al Super-Administrador que ejecute
              «Recalcular ahora».
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                  title="Casos activos"
                  value={globalSnapshot.activeCases}
                  icon={Stethoscope}
                  color="red"
                />
                <StatCard
                  title="Bovinos afectados"
                  value={globalSnapshot.affectedBovines}
                  icon={HeartPulse}
                  color="amber"
                />
                <StatCard
                  title="Nuevos 7 días"
                  value={globalSnapshot.newCases7d}
                  icon={TrendingUp}
                  color="blue"
                />
                <StatCard
                  title="Incidencia"
                  value={fmtPct(globalSnapshot.incidenceRate)}
                  icon={AlertTriangle}
                  color="amber"
                />
                <StatCard
                  title="Mortalidad"
                  value={fmtPct(globalSnapshot.mortalityRate)}
                  icon={Skull}
                  color="gray"
                />
              </div>

              {/* Sub-fila con métricas secundarias en una sola línea */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                <SecondaryMetric label="Nuevos 30 días"     value={globalSnapshot.newCases30d} />
                <SecondaryMetric label="Cerrados 30 días"   value={globalSnapshot.closedCases30d} />
                <SecondaryMetric label="Recuperados"        value={globalSnapshot.recoveredCount} />
                <SecondaryMetric
                  label="Días resolución promedio"
                  value={(() => {
                    const n = toNum(globalSnapshot.avgResolutionDays);
                    return n != null ? `${n.toFixed(1)} días` : '—';
                  })()}
                />
                {/* Cobertura promedio derivada del top-diseases visible.
                    El snapshot global del rancho no la trae (es per-enfermedad);
                    por eso usamos el promedio de las que sí están en el top. */}
                <SecondaryMetric
                  label="Cobertura promedio (top)"
                  value={
                    avgVaccinationCoverage != null
                      ? `${avgVaccinationCoverage.toFixed(1)}%`
                      : '—'
                  }
                />
              </div>

              <p className="text-xs text-gray-400 italic">
                Snapshot calculado el {formatDate(globalSnapshot.computedAt)} —
                base: {globalSnapshot.totalBovinesInRanch} bovinos en el rancho.
              </p>
            </>
          )}

          {/* ── Top enfermedades ─────────────────────────────────────── */}
          <Card>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 mb-0">
                <BarChart3 className="w-5 h-5 text-primary-600" />
                Top 5 enfermedades activas
              </CardTitle>
              <Link
                to="/health/cases"
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
              >
                Ver todos los casos <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {isLoadingTop ? (
              <div className="flex items-center justify-center h-48">
                <Spinner />
              </div>
            ) : topDiseases.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No hay enfermedades activas en el rancho.
              </p>
            ) : (
              <>
                {/* Bar chart horizontal — más legible cuando los nombres
                    son largos. Recharts no soporta horizontal nativo en
                    BarChart V3, lo simulamos con layout="vertical" + ejes
                    intercambiados. */}
                <div className="w-full h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topDiseasesChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-800" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 11 }}
                        width={130}
                      />
                      <RTooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(value: number, _name, item) => {
                          if (item.dataKey === 'incidenceRate') return [`${value.toFixed(1)}%`, 'Incidencia'];
                          return [value, undefined];
                        }}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.fullName ?? ''
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="activeCases"     name="Casos activos"      fill="#ef4444" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="affectedBovines" name="Bovinos afectados"  fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="newCases7d"      name="Nuevos 7d"          fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabla compacta con link al brote (Sprint 7). */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="text-left py-2 pr-3 font-medium">Enfermedad</th>
                        <th className="text-right py-2 px-3 font-medium">Casos</th>
                        <th className="text-right py-2 px-3 font-medium">Bovinos</th>
                        <th className="text-right py-2 px-3 font-medium">Nuevos 7d</th>
                        <th className="text-right py-2 px-3 font-medium">Incidencia</th>
                        <th className="text-right py-2 px-3 font-medium" title="Bovinos con proteccion vacunal activa">
                          Vacunados
                        </th>
                        <th className="text-right py-2 px-3 font-medium" title="% del rancho con proteccion activa">
                          Cobertura
                        </th>
                        <th className="py-2 pl-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {topDiseases.map((d) => (
                        <tr key={d.diseaseId}>
                          <td className="py-2 pr-3">
                            <Link
                              to={`/health/diseases/catalogo/${d.diseaseSlug}`}
                              className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                            >
                              {d.diseaseName}
                            </Link>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{d.activeCases}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{d.affectedBovines}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {d.newCases7d > 0 ? (
                              <Badge variant="warning">+{d.newCases7d}</Badge>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{fmtPct(d.incidenceRate)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                            {d.vaccinatedBovines ?? '—'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {(() => {
                              const cov = toNum(d.vaccinationCoverage);
                              if (cov == null) {
                                return <span className="text-gray-400">—</span>;
                              }
                              const cls =
                                cov >= 70
                                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                  : cov >= 40
                                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                                    : 'text-red-600 dark:text-red-400 font-medium';
                              return <span className={cls}>{cov.toFixed(1)}%</span>;
                            })()}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            <Link
                              to={`/health/epidemiology/outbreak/${d.diseaseId}`}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                              title="Ver brote (Sprint 7)"
                            >
                              Brote <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          {/* ── Trend ──────────────────────────────────────────────── */}
          <Card>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 mb-0">
                <LineIcon className="w-5 h-5 text-primary-600" />
                Tendencia temporal
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  options={[
                    { value: 'null', label: 'Global del rancho' },
                    ...diseases.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                  value={trendDiseaseId}
                  onChange={(e) => setTrendDiseaseId(e.target.value)}
                  className="!py-1.5 text-xs"
                />
                <Select
                  options={DAYS_OPTIONS}
                  value={String(trendDays)}
                  onChange={(e) => setTrendDays(Number(e.target.value))}
                  className="!py-1.5 text-xs"
                />
              </div>
            </div>

            {isLoadingTrend ? (
              <div className="flex items-center justify-center h-64">
                <Spinner />
              </div>
            ) : trendChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Aún no hay datos históricos para los últimos {trendDays} días.
                </p>
              </div>
            ) : (
              <div className="w-full h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-800" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                    <RTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                      formatter={(value: number, name) => {
                        if (name === 'Incidencia' || name === 'Mortalidad') {
                          return [`${Number(value).toFixed(2)}%`, name];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="left"  type="monotone" dataKey="activeCases"  name="Casos activos" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line yAxisId="left"  type="monotone" dataKey="newCases7d"   name="Nuevos 7d"     stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="incidenceRate" name="Incidencia"   stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="mortalityRate" name="Mortalidad"   stroke="#6b7280" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                    {/* Cobertura vacunal - solo se grafica cuando se filtra
                        por enfermedad (en globales viene null y recharts
                        deja huecos en la linea naturalmente). Verde
                        emerald para diferenciarla visualmente de las
                        otras tasas y comunicar "metrica positiva". */}
                    <Line yAxisId="right" type="monotone" dataKey="vaccinationCoverage" name="Cobertura vacunal" stroke="#10b981" strokeWidth={2} dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <p className="text-[11px] text-gray-400 italic mt-2">
              Eje izquierdo: conteos (casos). Eje derecho: tasas en %.
              {trendDiseaseId === 'null'
                ? ' Serie agregada de TODAS las enfermedades del rancho. La cobertura vacunal NO se grafica en series globales (solo aplica por-enfermedad).'
                : ' Filtrada por la enfermedad seleccionada. Cobertura vacunal en verde si el backend la calculo para esta enfermedad.'}
            </p>
          </Card>

          {/* F-29 / Backend X-07: reporte de mortalidad por rancho con
              dropdown groupBy (cause / month / location) y rango temporal.
              Consume `GET /api/ranches/:ranchId/mortality` que devuelve
              labels en espanol; el FE solo arma las barras proporcionales. */}
          {activeRanchId && <MortalityReportCard ranchId={activeRanchId} />}

          {/* Vigilancia de laboratorio por rancho (Capa 4).
              Widget que detecta patrones tempranos de enfermedad
              ANTES de que haya casos clinicos abiertos. Util como
              senal de alerta para enfermedades de evolucion lenta
              (anemias hemoliticas, fallas renales, etc.). */}
          {activeRanchId && <RanchLabSurveillanceCard ranchId={activeRanchId} />}

          {/* Stats de diagnostico (Capa 2). Widget compact con KPIs,
              donut, top 3 y link a la pagina dedicada. El rango fijo
              de 30 dias evita un selector duplicado dentro del dashboard
              de epidemiologia - el usuario que quiera ajustar ventana
              va a la pagina completa. */}
          {activeRanchId && (
            <DiagnosisStatsDashboard
              filters={{ ranchId: activeRanchId, ...defaultDateRange() }}
              variant="compact"
              fullViewHref="/health/diagnosis/stats"
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

interface SecondaryMetricProps {
  label: string;
  value: number | string;
}

function SecondaryMetric({ label, value }: SecondaryMetricProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-base font-semibold text-gray-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}
