/**
 * Card de tendencia historica de resultados de laboratorio anormales
 * para UN bovino. Se monta en BovineHealthTab.
 *
 * El endpoint backend devuelve solo records con anormales. Por eso la
 * "tendencia" muestra la evolucion de los parametros que han estado
 * fuera de rango en visitas pasadas. Cuando un parametro deja de
 * aparecer en records posteriores, significa que volvio a NORMAL y se
 * recupero.
 *
 * Diseno: small multiples - una mini line chart por parametro. Cada
 * chart tiene su propio eje Y porque las unidades son distintas
 * (Hematocrito % vs Hemoglobina g/dL vs Leucocitos x10^3). Compactos,
 * 2 columnas en lg, 1 en mobile.
 *
 * Hint clinico per chart: comparamos primer vs ultimo valor para
 * indicar si el parametro esta MEJORANDO o EMPEORANDO. Si solo hay 1
 * punto, no podemos calcular tendencia y omitimos el hint.
 *
 * Edge cases:
 *   - Sin anormales en historial -> empty state positivo (no alarma).
 *   - Valor cualitativo (string) -> se omite del chart (no es graficable).
 *   - Un solo punto -> chart con punto solo, sin linea, sin hint.
 */

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Activity, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, FlaskConical,
} from 'lucide-react';
import { useBovineAbnormalLabHistory } from '@/hooks/useBovineHealth';
import {
  getLabInterpretationBadgeVariant,
  getLabInterpretationColor,
  getLabInterpretationLabel,
} from '@/design-system/tokens/lab-interpretation.colors';
import { formatDate } from '@/utils/formatters';
import type { BovineAbnormalLabRecord } from '@/types/health.types';

interface BovineLabTrendCardProps {
  bovineId: string;
}

interface ParamSeries {
  parameter:      string;
  unit?:          string;
  /** Puntos ordenados por fecha asc. */
  points:         Array<{
    date:           string;       // ISO
    dateLabel:      string;       // MM-DD para axis
    value:          number;
    interpretation: string;
  }>;
  /** Color del ultimo punto (interpretacion mas reciente). */
  lastInterpretation: string;
  /** Diferencia entre primero y ultimo valor. NaN si <2 puntos. */
  delta:          number;
  /** El ultimo punto del rango aceptable como referencia visual (si lo
   *  pudieramos inferir del referenceRange; no siempre posible). */
  refRangeText?:  string;
}

/**
 * Transforma el response del backend (records con anormales agrupados)
 * a series por parametro. Solo incluye valores numericos chartables.
 */
function buildSeries(records: BovineAbnormalLabRecord[]): ParamSeries[] {
  const map = new Map<string, ParamSeries>();

  // Procesamos de mas antiguo a mas reciente para que `points` quede
  // ordenado asc - el backend devuelve desc por convencion.
  const ascending = [...records].sort(
    (a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime(),
  );

  for (const rec of ascending) {
    if (!rec?.abnormalResults) continue;
    for (const r of rec.abnormalResults) {
      // Si el valor no es numerico no podemos graficar. Para parametros
      // cualitativos ("Positivo", "Negativo") habria que hacer un
      // categorical chart distinto - lo dejamos fuera por ahora.
      const numValue = typeof r.value === 'number'
        ? r.value
        : Number(String(r.value).replace(',', '.'));
      if (!Number.isFinite(numValue)) continue;

      const key = r.parameter;
      let s = map.get(key);
      if (!s) {
        s = {
          parameter:          r.parameter,
          unit:               r.unit,
          points:             [],
          lastInterpretation: String(r.interpretation ?? 'ABNORMAL'),
          delta:              NaN,
          refRangeText:       r.referenceRange,
        };
        map.set(key, s);
      }
      s.points.push({
        date:           rec.recordDate,
        dateLabel:      String(rec.recordDate).slice(5, 10),
        value:          numValue,
        interpretation: String(r.interpretation ?? 'ABNORMAL'),
      });
      // El ultimo recorrido sobreescribe (es el mas reciente).
      s.lastInterpretation = String(r.interpretation ?? 'ABNORMAL');
      s.unit               = r.unit ?? s.unit;
      s.refRangeText       = r.referenceRange ?? s.refRangeText;
    }
  }

  // Calcular delta primer vs ultimo.
  for (const s of map.values()) {
    if (s.points.length >= 2) {
      s.delta = s.points[s.points.length - 1].value - s.points[0].value;
    }
  }

  // Ordenar series: primero las que tienen mas puntos (mejor para
  // observar tendencia), luego alfabetico por nombre.
  return Array.from(map.values()).sort((a, b) => {
    if (b.points.length !== a.points.length) return b.points.length - a.points.length;
    return a.parameter.localeCompare(b.parameter);
  });
}

/**
 * Para cada serie decide si la tendencia es "mejora", "empeora" o
 * "estable". Como no sabemos automatical si "mas alto" es bueno o malo
 * (para Hematocrito mas alto = mejor, para Creatinina mas alto = peor),
 * usamos una heuristica: si el ULTIMO valor sigue siendo CRITICAL es
 * peor; si bajo de CRITICAL a ABNORMAL es mejor; con misma
 * interpretacion en ambos puntos, usamos magnitud del delta como
 * empate desambiguador, pero etiquetamos como "estable" para no
 * comprometer una interpretacion sin contexto clinico.
 */
function trendVerdict(s: ParamSeries): 'improving' | 'worsening' | 'stable' | null {
  if (s.points.length < 2) return null;
  const first = s.points[0];
  const last  = s.points[s.points.length - 1];
  const firstCrit = String(first.interpretation).toUpperCase() === 'CRITICAL';
  const lastCrit  = String(last.interpretation).toUpperCase() === 'CRITICAL';
  if (firstCrit && !lastCrit) return 'improving';
  if (!firstCrit && lastCrit) return 'worsening';
  // Misma interpretacion: estable.
  return 'stable';
}

export function BovineLabTrendCard({ bovineId }: BovineLabTrendCardProps) {
  const [expanded, setExpanded] = useState(true);
  const { data: records = [], isLoading } = useBovineAbnormalLabHistory(bovineId, 10);

  const series = useMemo(() => buildSeries(records), [records]);

  // Si esta cargando o no hay datos chartables, render minimo.
  const hasData = series.length > 0;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between group"
      >
        <CardTitle className="flex items-center gap-2 mb-0">
          <FlaskConical className="w-5 h-5 text-primary-600" />
          Tendencia de laboratorio
          {hasData && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({series.length} {series.length === 1 ? 'parametro' : 'parametros'})
            </span>
          )}
        </CardTitle>
        <span className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-primary-500 transition-colors">
          {expanded
            ? <><ChevronUp className="w-4 h-4" /> Contraer</>
            : <><ChevronDown className="w-4 h-4" /> Expandir</>}
        </span>
      </button>

      {expanded && (
        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner />
            </div>
          ) : !hasData ? (
            <div className="text-center py-8">
              <Activity className="w-10 h-10 text-emerald-300 dark:text-emerald-700 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sin parametros fuera de rango en el historial
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Cuando algun resultado caiga como anormal, aparecera aqui con su tendencia.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {series.map((s) => (
                <MiniTrendChart key={s.parameter} series={s} />
              ))}
            </div>
          )}
          {hasData && (
            <p className="text-[11px] text-gray-400 italic mt-3">
              Solo se grafican parametros con al menos un resultado anormal en
              el historial. Cuando un parametro vuelve a NORMAL, deja de
              aparecer en visitas posteriores (signo de recuperacion).
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Mini chart por parametro ───────────────────────────────────────────────

function MiniTrendChart({ series }: { series: ParamSeries }) {
  const verdict = trendVerdict(series);
  const lastPoint = series.points[series.points.length - 1];
  const color = getLabInterpretationColor(series.lastInterpretation);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {series.parameter}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ultimo: <strong className="text-gray-900 dark:text-white">{lastPoint.value}</strong>
            {series.unit && <> {series.unit}</>}
            {series.refRangeText && (
              <> &middot; rango {series.refRangeText}</>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={getLabInterpretationBadgeVariant(series.lastInterpretation)}>
            {getLabInterpretationLabel(series.lastInterpretation)}
          </Badge>
          {verdict && (
            <TrendChip verdict={verdict} delta={series.delta} unit={series.unit} />
          )}
        </div>
      </div>

      <div className="w-full h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={series.points}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-800" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10 }} width={30} />
            <RTooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.date
                  ? formatDate(payload[0].payload.date)
                  : ''
              }
              formatter={(value: number) => [
                `${value}${series.unit ? ' ' + series.unit : ''}`,
                series.parameter,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            {/* Si el referenceRange tiene formato "N-M", podemos dibujar
                lineas horizontales como limite normal. La parseamos
                defensivamente; si falla, simplemente no la mostramos. */}
            {parseRangeBounds(series.refRangeText).map((bound, i) => (
              <ReferenceLine
                key={i}
                y={bound}
                stroke="#9ca3af"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-gray-400 mt-1">
        {series.points.length} {series.points.length === 1 ? 'visita' : 'visitas'} con valor anormal
      </p>
    </div>
  );
}

interface TrendChipProps {
  verdict: 'improving' | 'worsening' | 'stable';
  delta:   number;
  unit?:   string;
}

function TrendChip({ verdict, delta, unit }: TrendChipProps) {
  if (verdict === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
        <TrendingUp className="w-3 h-3" />
        Mejorando
        {Number.isFinite(delta) && (
          <span className="text-emerald-600/80 dark:text-emerald-400/80">
            ({delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit ? ' ' + unit : ''})
          </span>
        )}
      </span>
    );
  }
  if (verdict === 'worsening') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-red-700 dark:text-red-400 font-medium">
        <TrendingDown className="w-3 h-3" />
        Empeorando
        {Number.isFinite(delta) && (
          <span className="text-red-600/80 dark:text-red-400/80">
            ({delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit ? ' ' + unit : ''})
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
      <Minus className="w-3 h-3" />
      Estable
    </span>
  );
}

/**
 * Parsea formatos de referenceRange aceptados por el backend a las
 * cotas numericas que se pueden dibujar como lineas de referencia.
 *   "24-46"    -> [24, 46]
 *   ">0.5"     -> [0.5]
 *   ">=20"     -> [20]
 *   "<10"      -> [10]
 *   "<=100"    -> [100]
 *   otro       -> []
 */
function parseRangeBounds(text: string | undefined): number[] {
  if (!text) return [];
  const t = text.trim();
  const range = t.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (range) {
    const lo = Number(range[1]); const hi = Number(range[2]);
    return [lo, hi].filter(Number.isFinite);
  }
  const cmp = t.match(/^(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (cmp) {
    const v = Number(cmp[2]);
    return Number.isFinite(v) ? [v] : [];
  }
  return [];
}
