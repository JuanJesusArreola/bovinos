/**
 * Timeline cronológica de un brote.
 *
 * Visualiza los casos clínicos como una línea vertical ordenada por
 * `diagnosedAt` ascendente. Cada nodo muestra:
 *   - Bovino (arete + nombre)
 *   - Status + severidad (badges del design-system)
 *   - Fecha de diagnóstico y resolución
 *   - Duración (si está cerrado) o "En curso" (si sigue abierto)
 *
 * Click en un caso:
 *   - Si `onCaseSelect` está provisto → callback (para el grafo de contactos).
 *   - Siempre: link "Ver detalle" que navega a `/health/cases/:id`.
 */

import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  getCaseStatusBadgeVariant, getCaseStatusLabel, getCaseStatusColor,
  getCaseSeverityBadgeVariant, getCaseSeverityLabel,
  getCaseOutcomeBadgeVariant, getCaseOutcomeLabel,
} from '@/design-system/tokens/case-status.colors';
import type { OutbreakTimelineCase } from '@/types/epidemiology.dtos';
import { formatDate, formatRelative } from '@/utils/formatters';
import { Calendar, ExternalLink, Network } from 'lucide-react';

interface OutbreakTimelineProps {
  cases: OutbreakTimelineCase[];
  /** Caso actualmente seleccionado (para el grafo de contactos). */
  selectedCaseId?: string | null;
  /** Click sobre un nodo → selecciona el caso (no navega). */
  onCaseSelect?: (caseId: string) => void;
}

export function OutbreakTimeline({ cases, selectedCaseId, onCaseSelect }: OutbreakTimelineProps) {
  if (cases.length === 0) {
    return (
      <Card className="text-center py-12">
        <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sin casos registrados para este brote.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      {/* Línea vertical: usamos un padding-left grande y un border-l
          absoluto, los dots posicionados como overlay. */}
      <ol className="relative border-l-2 border-gray-200 dark:border-gray-800 ml-3 space-y-6">
        {cases.map((c, idx) => {
          const isFirst = idx === 0;
          const isSelected = selectedCaseId === c.caseId;
          return (
            <li key={c.caseId} className="ml-6 relative">
              {/* Dot del timeline */}
              <span
                className="absolute -left-[34px] top-1 w-4 h-4 rounded-full border-4 border-white dark:border-gray-900"
                style={{ backgroundColor: getCaseStatusColor(c.status) }}
                title={getCaseStatusLabel(c.status)}
              />
              {isFirst && (
                <span className="absolute -left-[60px] top-2 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400 tracking-wider rotate-[-90deg] origin-bottom-right">
                  Inicio
                </span>
              )}

              <div
                className={[
                  'rounded-lg border p-3 transition-colors cursor-pointer',
                  isSelected
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-700'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                ].join(' ')}
                onClick={() => onCaseSelect?.(c.caseId)}
                role={onCaseSelect ? 'button' : undefined}
                tabIndex={onCaseSelect ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onCaseSelect && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onCaseSelect(c.caseId);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {c.bovineEarTag}
                      {c.bovineName && (
                        <span className="text-gray-500 dark:text-gray-400 font-normal"> · {c.bovineName}</span>
                      )}
                      {c.breed && (
                        <span className="text-xs text-gray-400 ml-1">({c.breed})</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant={getCaseStatusBadgeVariant(c.status)}>
                        {getCaseStatusLabel(c.status)}
                      </Badge>
                      <Badge variant={getCaseSeverityBadgeVariant(c.severity)}>
                        {getCaseSeverityLabel(c.severity)}
                      </Badge>
                      {c.outcome && (
                        <Badge variant={getCaseOutcomeBadgeVariant(c.outcome)}>
                          {getCaseOutcomeLabel(c.outcome)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    <p title={c.diagnosedAt}>{formatDate(c.diagnosedAt)}</p>
                    <p className="text-gray-400">{formatRelative(c.diagnosedAt)}</p>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-3 flex-wrap">
                  {c.durationDays != null ? (
                    <span>
                      <strong>{c.durationDays}</strong> {c.durationDays === 1 ? 'día' : 'días'}
                      {c.resolvedAt && (
                        <span className="text-gray-400"> · cerrado {formatDate(c.resolvedAt)}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">En curso</span>
                  )}

                  {c.diagnosedBy && (
                    <span className="text-gray-400">Dx por {c.diagnosedBy}</span>
                  )}
                </div>

                {c.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-2 line-clamp-2">
                    {c.notes}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {onCaseSelect && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onCaseSelect(c.caseId); }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Network className="w-3 h-3" />
                      {isSelected ? 'Seleccionado en grafo' : 'Ver en grafo de contactos'}
                    </button>
                  )}
                  <Link
                    to={`/health/cases/${c.caseId}`}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1 ml-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Detalle clínico <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
