/**
 * Listado de casos clínicos del rancho activo.
 *
 * Ruta: `/health/cases`
 * Permisos: `VIEW_DISEASES` (lectura abierta — todo usuario autenticado).
 *   El botón "Reportar caso" se oculta con `PermissionGuard action="RECORD_CASE"`.
 *
 * El listado se filtra por:
 *   - `ranchId` (siempre el activo — sin él, no se renderiza la tabla).
 *   - `status[]`, `severity[]` (multi-select traducido a CSV por el API client).
 *   - `diseaseId` (single).
 *   - `search` (texto libre — el backend matchea earTag/nombre/notas).
 *   - rango `fromDate / toDate`.
 *   - Paginación clásica (page + limit).
 *
 * Diseño:
 *   - Card de filtros colapsable (siguiendo la convención de MapFiltersPanel).
 *   - Tabla densa en lg+, lista de cards en mobile.
 *   - StatCards arriba con conteos por status (rápido de leer).
 *
 * NO se asume que el backend devuelve totales por status; se calculan a
 * partir de la página visible solamente (los KPI dicen "en esta página"
 * cuando hay paginación, evita engañar al usuario).
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { PageLoader } from '@/components/ui/Spinner';
import { PermissionGuard } from '@/components/ui/PermissionGuard';
import {
  RanchFilterBanner,
  RanchFilterBannerEmpty,
} from '@/components/shared/RanchFilterBanner';
import {
  Stethoscope, Plus, Search, ChevronLeft, ChevronRight, RotateCcw,
  Filter, ChevronDown, ChevronUp, AlertTriangle, Activity, CheckCircle2, XCircle,
  ShieldOff,
} from 'lucide-react';
import {
  useBovineCases,
} from '@/hooks/useBovineCases';
import { useActiveDiseases } from '@/hooks/useDiseases';
import {
  CaseStatus, CaseSeverity,
  type BovineCaseFilters, type BovineCaseListItem,
} from '@/types/bovineCase.dtos';
import {
  CASE_STATUS_LABELS, CASE_SEVERITY_LABELS,
  getCaseStatusBadgeVariant, getCaseStatusLabel, getCaseStatusColor,
  getCaseSeverityBadgeVariant, getCaseSeverityLabel,
  isCaseOpen,
} from '@/design-system/tokens/case-status.colors';
import { formatDate, formatRelative } from '@/utils/formatters';

const PAGE_SIZE = 20;

// ── Constantes de filtro ────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: CaseStatus; label: string }[] =
  Object.values(CaseStatus).map((s) => ({ value: s, label: CASE_STATUS_LABELS[s] }));

const SEVERITY_OPTIONS: { value: CaseSeverity; label: string }[] =
  Object.values(CaseSeverity).map((s) => ({ value: s, label: CASE_SEVERITY_LABELS[s] }));

// ────────────────────────────────────────────────────────────────────────────

export function CasesListPage() {
  const { activeRanchId } = useAuth();

  // ── Estado de filtros ─────────────────────────────────────────────────────
  const [statuses, setStatuses]     = useState<CaseStatus[]>([]);
  const [severities, setSeverities] = useState<CaseSeverity[]>([]);
  const [diseaseId, setDiseaseId]   = useState<string>('');
  const [search, setSearch]         = useState('');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [page, setPage]             = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Catálogo activo de enfermedades para el select. Lazy: sólo cuando el
  // panel de filtros está abierto, igual que MapFiltersPanel.
  const { data: diseases = [], isLoading: isLoadingDiseases } = useActiveDiseases({
    enabled: filtersOpen,
  });

  // Memo de filtros — referencia estable para evitar refetch innecesario.
  const filters: BovineCaseFilters = useMemo(() => ({
    ranchId: activeRanchId ?? undefined,
    page,
    limit: PAGE_SIZE,
    ...(statuses.length   ? { status:   statuses }   : {}),
    ...(severities.length ? { severity: severities } : {}),
    ...(diseaseId         ? { diseaseId }            : {}),
    ...(search.trim()     ? { search: search.trim() } : {}),
    ...(fromDate          ? { fromDate }              : {}),
    ...(toDate            ? { toDate }                : {}),
  }), [activeRanchId, page, statuses, severities, diseaseId, search, fromDate, toDate]);

  const { data, isLoading, isError, error } = useBovineCases(filters, {
    enabled: !!activeRanchId,
  });
  const cases      = data?.data       ?? [];
  const pagination = data?.pagination;

  // KPIs derivados de la página visible. Cuando hay paginación lo anotamos
  // explícitamente para que el lector no asuma totales globales.
  const pageKpis = useMemo(() => {
    const open       = cases.filter((c) => isCaseOpen(c.status)).length;
    const confirmed  = cases.filter((c) => c.status === CaseStatus.CONFIRMED).length;
    const recovered  = cases.filter((c) => c.status === CaseStatus.RECOVERED).length;
    const deceased   = cases.filter((c) => c.status === CaseStatus.DECEASED).length;
    return { open, confirmed, recovered, deceased };
  }, [cases]);

  // ── Helpers de toggle multi-select ────────────────────────────────────────
  function toggleStatus(v: CaseStatus) {
    setStatuses((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    setPage(1);
  }
  function toggleSeverity(v: CaseSeverity) {
    setSeverities((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    setPage(1);
  }
  function resetFilters() {
    setStatuses([]); setSeverities([]); setDiseaseId('');
    setSearch('');   setFromDate('');   setToDate('');
    setPage(1);
  }

  const activeFilterCount =
    statuses.length + severities.length +
    (diseaseId ? 1 : 0) + (search ? 1 : 0) +
    (fromDate ? 1 : 0) + (toDate ? 1 : 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Stethoscope className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Casos clínicos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Diagnósticos activos y cerrados — sigue el ciclo de cada caso.
            </p>
          </div>
        </div>
        <PermissionGuard action="RECORD_CASE">
          <Link to="/health/cases/nuevo">
            <Button icon={<Plus className="w-4 h-4" />}>Reportar caso</Button>
          </Link>
        </PermissionGuard>
      </div>

      {/* Banner global de rancho */}
      <RanchFilterBanner
        activeHint="Casos clínicos de este rancho."
        emptyHint="Selecciona un rancho para ver sus casos clínicos."
      />

      {/* Empty state cuando no hay rancho */}
      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="Los casos clínicos se listan por rancho. Elige uno arriba para continuar."
        />
      )}

      {/* Contenido principal — solo si hay rancho activo */}
      {activeRanchId && (
        <>
          {/* KPIs (página visible) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat
              icon={<Activity className="w-4 h-4" />}
              label="Abiertos"
              value={pageKpis.open}
              colorClass="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
            />
            <MiniStat
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Confirmados"
              value={pageKpis.confirmed}
              colorClass="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
            />
            <MiniStat
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="Recuperados"
              value={pageKpis.recovered}
              colorClass="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
            />
            <MiniStat
              icon={<XCircle className="w-4 h-4" />}
              label="Fallecidos"
              value={pageKpis.deceased}
              colorClass="text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800"
            />
          </div>
          {pagination && pagination.totalPages > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
              * Conteos calculados sobre la página visible ({cases.length} casos).
            </p>
          )}

          {/* Card de filtros (colapsable) */}
          <Card noPadding className="overflow-hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Filtros</span>
                {activeFilterCount > 0 && (
                  <Badge variant="info">{activeFilterCount} activos</Badge>
                )}
              </div>
              {filtersOpen
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {filtersOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" icon={<RotateCcw className="w-3 h-3" />} onClick={resetFilters}>
                    Limpiar filtros
                  </Button>
                )}

                {/* Búsqueda + rango fechas + enfermedad */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    type="text"
                    placeholder="Buscar arete, nombre, notas…"
                    icon={<Search className="w-4 h-4" />}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                  <Select
                    label="Enfermedad"
                    options={[
                      { value: '', label: isLoadingDiseases ? 'Cargando…' : 'Todas' },
                      ...diseases.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                    disabled={isLoadingDiseases}
                    value={diseaseId}
                    onChange={(e) => { setDiseaseId(e.target.value); setPage(1); }}
                  />
                  <Input
                    type="date"
                    label="Desde"
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                  />
                  <Input
                    type="date"
                    label="Hasta"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Status chips */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Estado</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((s) => {
                      const active = statuses.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => toggleStatus(s.value)}
                          className={[
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'border-transparent text-white'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400',
                          ].join(' ')}
                          style={active ? { backgroundColor: getCaseStatusColor(s.value) } : {}}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getCaseStatusColor(s.value) }}
                          />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Severity chips */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Severidad</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SEVERITY_OPTIONS.map((s) => {
                      const active = severities.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => toggleSeverity(s.value)}
                          className={[
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400',
                          ].join(' ')}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Listado */}
          {isLoading ? (
            <PageLoader />
          ) : isError ? (
            <Alert variant="error" title="No se pudieron cargar los casos">
              {(error as Error)?.message ?? 'Intenta nuevamente.'}
            </Alert>
          ) : cases.length === 0 ? (
            <Card className="text-center py-12">
              <Stethoscope className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Sin casos que mostrar
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {activeFilterCount > 0
                  ? 'Prueba ajustando los filtros o limpiándolos.'
                  : 'Cuando se reporte un caso clínico aparecerá aquí.'}
              </p>
            </Card>
          ) : (
            <>
              {/* Desktop: tabla; mobile: cards (un solo render condicional CSS) */}
              <DesktopTable cases={cases} />
              <MobileList cases={cases} />

              {/* Paginación */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Página {pagination.page} de {pagination.totalPages} · {pagination.total} casos
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      icon={<ChevronLeft className="w-4 h-4" />}
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      icon={<ChevronRight className="w-4 h-4" />}
                      iconPosition="right"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}

function MiniStat({ icon, label, value, colorClass }: MiniStatProps) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </Card>
  );
}

// ── Tabla desktop (lg+) ────────────────────────────────────────────────────

function DesktopTable({ cases }: { cases: BovineCaseListItem[] }) {
  return (
    <Card noPadding className="hidden lg:block overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Bovino</th>
              <th className="text-left px-4 py-3 font-medium">Enfermedad</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-left px-4 py-3 font-medium">Severidad</th>
              <th className="text-left px-4 py-3 font-medium">Diagnóstico</th>
              <th className="text-left px-4 py-3 font-medium">Resolución</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {cases.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link to={`/bovines/${c.bovineId}`} className="hover:underline">
                    <p className="font-medium text-gray-900 dark:text-white">{c.bovine.earTag}</p>
                    {c.bovine.name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.bovine.name}</p>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/health/diseases/catalogo/${c.disease.slug}`}
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {c.disease.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getCaseStatusBadgeVariant(c.status)}>
                    {getCaseStatusLabel(c.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getCaseSeverityBadgeVariant(c.severity)}>
                    {getCaseSeverityLabel(c.severity)}
                  </Badge>
                  {c.isBreakthrough && (
                    <Badge
                      variant="warning"
                      className="ml-1 inline-flex items-center gap-1"
                      title="Fallo vacunal: el bovino estaba vacunado al diagnosticarse"
                    >
                      <ShieldOff className="w-3 h-3" />
                      Breakthrough
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  <p>{formatDate(c.diagnosedAt)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatRelative(c.diagnosedAt)}
                  </p>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {c.resolvedAt ? formatDate(c.resolvedAt) : (
                    <span className="text-xs text-gray-400">En curso</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/health/cases/${c.id}`}>
                    <Button size="sm" variant="outline">Ver</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Lista mobile (< lg) ────────────────────────────────────────────────────

function MobileList({ cases }: { cases: BovineCaseListItem[] }) {
  return (
    <div className="lg:hidden grid grid-cols-1 gap-3">
      {cases.map((c) => (
        <Link key={c.id} to={`/health/cases/${c.id}`}>
          <Card className="hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all !p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {c.bovine.earTag}
                  {c.bovine.name && (
                    <span className="font-normal text-gray-500 dark:text-gray-400"> · {c.bovine.name}</span>
                  )}
                </p>
                <p className="text-sm text-primary-600 dark:text-primary-400 truncate">
                  {c.disease.name}
                </p>
              </div>
              <Badge variant={getCaseStatusBadgeVariant(c.status)}>
                {getCaseStatusLabel(c.status)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Badge variant={getCaseSeverityBadgeVariant(c.severity)}>
                {getCaseSeverityLabel(c.severity)}
              </Badge>
              {c.isBreakthrough && (
                <Badge variant="warning" className="inline-flex items-center gap-1">
                  <ShieldOff className="w-3 h-3" />
                  Fallo vacunal
                </Badge>
              )}
              <span>· Diagnóstico {formatRelative(c.diagnosedAt)}</span>
              {c.resolvedAt && <span>· Cerrado {formatDate(c.resolvedAt)}</span>}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
