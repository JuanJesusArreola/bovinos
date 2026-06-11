/**
 * Card de vigilancia epidemiologica de laboratorio por rancho.
 *
 * Se monta en el dashboard de epidemiologia (`/health/epidemiology`) como
 * un panel adicional al final, junto al trend y al top-diseases. La idea
 * es detectar patrones tempranos ANTES de que haya casos clinicos
 * abiertos: si 7 bovinos tienen hematocrito + hemoglobina bajos en 30
 * dias, hay alta sospecha de Anaplasmosis o Babesiosis circulando en el
 * hato aunque ningun VET haya diagnosticado todavia.
 *
 * UX:
 *   - Selector de ventana de tiempo (7/30/90 dias).
 *   - 2 KPIs prominentes (bovinos afectados + resultados anormales).
 *   - Lista de parametros ordenada por count desc. Cada parametro
 *     muestra: nombre, conteo, promedio del valor anormal, unidad.
 *   - Hints clinicos: detecta combinaciones conocidas y sugiere
 *     enfermedades a investigar.
 *
 * El hint es solo SUGERENCIA - no diagnostica. Esta basado en el
 * conocimiento veterinario comun (no hace falta IA): combinaciones de
 * parametros que aparecen consistentemente con ciertas enfermedades
 * bovinas.
 */

import { useState, useMemo } from 'react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  FlaskConical, AlertTriangle, TrendingDown, Activity, Lightbulb,
} from 'lucide-react';
import { useRanchAbnormalLab } from '@/hooks/useBovineHealth';
import type { RanchAbnormalStats } from '@/types/health.types';

interface RanchLabSurveillanceCardProps {
  ranchId: string;
}

const WINDOW_OPTIONS = [
  { value: '7',   label: 'Ultimos 7 dias'  },
  { value: '30',  label: 'Ultimos 30 dias' },
  { value: '90',  label: 'Ultimos 90 dias' },
];

/**
 * Definicion de patrones clinicos conocidos. Cada patron declara los
 * parametros que deben aparecer en el agregado del rancho. Si todos
 * estan presentes, mostramos el hint.
 *
 * IMPORTANTE: solo es una sugerencia para que el VET investigue. NO es
 * un diagnostico medico. El frontend deja claro en el copy que requiere
 * confirmacion clinica.
 *
 * Para anadir mas patrones, basta extender este array. No hace falta
 * tocar el backend.
 */
const CLINICAL_PATTERNS: ReadonlyArray<{
  /** Parametros que deben estar presentes en `byParameter` (case-insensitive). */
  parameters: string[];
  /** Texto principal del hint. */
  message:    string;
  /** Severidad visual del hint. */
  severity:   'warning' | 'info';
}> = [
  {
    parameters: ['hematocrito', 'hemoglobina'],
    message: 'Hematocrito y Hemoglobina bajos en multiples bovinos sugiere ANEMIA HEMOLITICA — investigar Anaplasmosis, Babesiosis o Tristeza bovina. Solicitar frotis sanguineo.',
    severity: 'warning',
  },
  {
    parameters: ['leucocitos', 'fibrinogeno'],
    message: 'Leucocitosis con Fibrinogeno elevado en varios animales sugiere PROCESO INFECCIOSO/INFLAMATORIO sistemico. Revisar manejo y posibles fuentes de contagio.',
    severity: 'warning',
  },
  {
    parameters: ['urea', 'creatinina'],
    message: 'Urea y Creatinina elevadas sugieren INSUFICIENCIA RENAL — revisar acceso a agua, calidad y posibles nefrotoxinas (plantas, agroquimicos).',
    severity: 'warning',
  },
  {
    parameters: ['glucosa', 'cetonas'],
    message: 'Glucosa baja con Cetonas elevadas sugiere CETOSIS — frecuente postparto. Evaluar dieta y condicion corporal en vacas lactantes.',
    severity: 'info',
  },
  {
    parameters: ['calcio', 'fosforo'],
    message: 'Calcio y Fosforo desbalanceados sugieren HIPOCALCEMIA POSTPARTO o desbalance nutricional. Revisar minerales en racion.',
    severity: 'info',
  },
];

/**
 * Detecta qué patrones clinicos aplican al agregado actual.
 * Hace match case-insensitive sobre las keys de `byParameter`.
 */
function detectPatterns(stats: RanchAbnormalStats): typeof CLINICAL_PATTERNS[number][] {
  const present = new Set(
    Object.keys(stats.byParameter).map((k) => k.toLowerCase().trim()),
  );
  // Un parametro se considera "presente" si su nombre normalizado coincide
  // por substring con alguna clave del agregado (tolera variaciones como
  // "Hematocrito" vs "Hematocrito %" vs "HCT").
  function isPresent(needle: string): boolean {
    const n = needle.toLowerCase();
    for (const k of present) {
      if (k.includes(n)) return true;
    }
    return false;
  }
  return CLINICAL_PATTERNS.filter((p) => p.parameters.every(isPresent));
}

export function RanchLabSurveillanceCard({ ranchId }: RanchLabSurveillanceCardProps) {
  const [days, setDays] = useState<number>(30);
  const { data: stats, isLoading } = useRanchAbnormalLab(ranchId, days);

  // Lista de parametros ordenada por count desc para que el VET vea
  // primero lo mas frecuente. Tope visual: 8 parametros (el resto se
  // condensa en "+ N mas" si excede).
  const sortedParams = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byParameter)
      .sort(([, a], [, b]) => b.count - a.count);
  }, [stats]);

  const patterns = useMemo(
    () => stats ? detectPatterns(stats) : [],
    [stats],
  );

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <CardTitle className="flex items-center gap-2 mb-0">
          <FlaskConical className="w-5 h-5 text-primary-600" />
          Vigilancia de laboratorio
        </CardTitle>
        <Select
          options={WINDOW_OPTIONS}
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          className="!py-1.5 text-xs"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      ) : !stats || stats.totalAbnormalResults === 0 ? (
        <div className="text-center py-8">
          <Activity className="w-10 h-10 text-emerald-300 dark:text-emerald-700 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Sin resultados anormales en los ultimos {days} dias
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cuando algun bovino tenga un parametro fuera de rango, aparecera aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 2 KPIs prominentes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300 uppercase tracking-wider font-medium">
                Bovinos afectados
              </p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-0.5">
                {stats.totalBovinesWithAbnormal}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20 p-3">
              <p className="text-xs text-red-700 dark:text-red-300 uppercase tracking-wider font-medium">
                Resultados fuera de rango
              </p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-0.5">
                {stats.totalAbnormalResults}
              </p>
            </div>
          </div>

          {/* Patrones clinicos sugeridos */}
          {patterns.length > 0 && (
            <div className="space-y-2">
              {patterns.map((p, idx) => (
                <Alert key={idx} variant={p.severity} title="Patron clinico sugerido">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{p.message}</span>
                  </div>
                </Alert>
              ))}
              <p className="text-[10px] text-gray-500 dark:text-gray-400 italic px-1">
                Las sugerencias son orientativas y NO sustituyen un diagnostico clinico.
                Requieren confirmacion por examen veterinario + pruebas dirigidas.
              </p>
            </div>
          )}

          {/* Tabla de parametros */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Parametro</th>
                  <th className="text-right py-2 px-3 font-medium">Anormales</th>
                  <th className="text-right py-2 px-3 font-medium">Promedio</th>
                  <th className="text-left py-2 pl-3 font-medium">Tendencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedParams.slice(0, 8).map(([name, stat]) => (
                  <tr key={name}>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 font-medium">
                      {name}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {stat.count >= 5 ? (
                        <Badge variant="danger">{stat.count}</Badge>
                      ) : stat.count >= 2 ? (
                        <Badge variant="warning">{stat.count}</Badge>
                      ) : (
                        <span className="text-gray-500">{stat.count}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {Number.isFinite(stat.avgValue) ? stat.avgValue.toFixed(1) : '—'}
                      {stat.unit && (
                        <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
                          {stat.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pl-3">
                      {/* Indicador simple de severidad por count, sin chart
                          (el chart de tendencia historica va en otra
                          iteracion - per-bovino, no per-parametro-rancho). */}
                      {stat.count >= 5 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <TrendingDown className="w-3 h-3" />
                          Vigilar
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedParams.length > 8 && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 italic mt-2 text-center">
                + {sortedParams.length - 8} parametros mas con anormalidades
              </p>
            )}
          </div>

          {/* Disclaimer general del agregado */}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Conteo basado en los resultados de laboratorio capturados en
            HealthRecords del rancho. Si un bovino tiene varios resultados
            anormales para el mismo parametro, cada uno cuenta por separado.
          </p>
        </div>
      )}
    </Card>
  );
}
