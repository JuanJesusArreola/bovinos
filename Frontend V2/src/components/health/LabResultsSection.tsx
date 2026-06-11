/**
 * Render de la seccion `laboratoryResults[]` de un HealthRecord.
 *
 * Se renderiza dentro de cada tarjeta del historial (BovineHealthTab).
 * Muestra cada parametro con su badge de interpretacion (NORMAL en
 * verde, ABNORMAL en amber, CRITICAL en rojo). Permite filtrar para
 * ver solo los anormales cuando hay muchos parametros normales (caso
 * tipico: hemograma con 15 parametros, solo 2 alterados).
 *
 * Si el record no tiene resultados, NO se renderiza (silencio).
 * Si tiene resultados, ofrece un boton "Subir mas" para anadir mas
 * parametros al mismo record (idempotente: el backend acumula).
 */

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { FlaskConical, Filter, AlertTriangle } from 'lucide-react';
import {
  getLabInterpretationBadgeVariant,
  getLabInterpretationLabel,
  isLabAbnormal,
} from '@/design-system/tokens/lab-interpretation.colors';
import { formatDate } from '@/utils/formatters';
import type { LaboratoryResultItem } from '@/types/health.types';

interface LabResultsSectionProps {
  results: LaboratoryResultItem[];
  /** Si el caller pasa una funcion, se renderiza un boton "Subir mas". */
  onAddMore?: () => void;
}

export function LabResultsSection({ results, onAddMore }: LabResultsSectionProps) {
  const [showOnlyAbnormal, setShowOnlyAbnormal] = useState(false);

  if (!results || results.length === 0) return null;

  const abnormalCount = results.filter((r) => isLabAbnormal(r.interpretation)).length;
  const criticalCount = results.filter(
    (r) => String(r.interpretation ?? '').toUpperCase() === 'CRITICAL',
  ).length;

  const visible = useMemo(
    () => showOnlyAbnormal ? results.filter((r) => isLabAbnormal(r.interpretation)) : results,
    [results, showOnlyAbnormal],
  );

  // Agrupamos visibles por testName para que se vea ordenado cuando hay
  // varios paneles (Hemograma + Quimica + Coproparasitoscopico, etc.).
  // El backend ya guarda los items con su testName respectivo.
  const groups = useMemo(() => {
    const map = new Map<string, LaboratoryResultItem[]>();
    for (const r of visible) {
      const key = r.testName || 'Resultados';
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [visible]);

  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <FlaskConical className="w-3.5 h-3.5" /> Laboratorio
          <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {results.length} {results.length === 1 ? 'parametro' : 'parametros'}
          </span>
          {abnormalCount > 0 && (
            <span
              className={[
                'ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1',
                criticalCount > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              ].join(' ')}
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              {abnormalCount} fuera de rango
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {abnormalCount > 0 && (
            <button
              type="button"
              onClick={() => setShowOnlyAbnormal((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              <Filter className="w-3 h-3" />
              {showOnlyAbnormal ? 'Mostrar todos' : 'Solo anormales'}
            </button>
          )}
          {onAddMore && (
            <button
              type="button"
              onClick={onAddMore}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              <FlaskConical className="w-3 h-3" />
              Subir mas
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          Sin parametros que coincidan con el filtro.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map(([groupName, items]) => (
            <div key={groupName} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {groupName}
                </span>
                {items[0].labName && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {items[0].labName}
                    {items[0].testedAt && <> &middot; {formatDate(items[0].testedAt)}</>}
                  </span>
                )}
              </div>
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/40">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium">Parametro</th>
                    <th className="text-right px-3 py-1.5 font-medium">Valor</th>
                    <th className="text-left px-3 py-1.5 font-medium">Rango</th>
                    <th className="text-right px-3 py-1.5 font-medium">Interpretacion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((r, idx) => (
                    <tr key={`${r.parameter}-${idx}`}>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                        {r.parameter}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium text-gray-900 dark:text-white">
                        {String(r.value)}
                        {r.unit && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
                            {r.unit}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                        {r.referenceRange ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Badge variant={getLabInterpretationBadgeVariant(r.interpretation)}>
                          {getLabInterpretationLabel(r.interpretation)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
