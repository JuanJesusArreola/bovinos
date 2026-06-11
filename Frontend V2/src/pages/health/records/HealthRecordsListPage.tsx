/**
 * Listado paginado global de HealthRecords del rancho activo.
 *
 * Ruta: /health/records
 * Permisos: VIEW (todos los autenticados pueden leer; las acciones de
 *           editar/eliminar dentro de cada fila siguen gated por
 *           RECORD_HEALTH en sus modales correspondientes).
 *
 * Estructura:
 *   - Header con titulo + breadcrumb implicito.
 *   - RanchFilterBanner (consistencia con resto de modulos).
 *   - 4 KPI cards rapidos (visibles si hay paginacion = pagina actual).
 *   - Card de filtros colapsable (clones de la convencion en CasesListPage).
 *   - Tabla desktop + cards mobile responsive.
 *   - Paginacion con anterior/siguiente.
 *
 * Decisiones:
 *   - Filtros multi-select (recordType, overallHealthStatus) como chips
 *     clickables coloreados, mismo patron que /health/cases.
 *   - Single-select de enfermedad (catalogo). El backend solo acepta una.
 *   - Booleanos (isEmergency, followUpRequired) como toggles tri-estado
 *     (Todos / Solo si / Solo no).
 *   - Reset a page=1 cada vez que cambia un filtro - evita quedarse en
 *     una pagina inexistente al estrechar el resultado.
 *   - Cada fila enlaza al detalle del bovino (`/bovines/:id`); el detalle
 *     individual del record no tiene pagina propia todavia, asi que la
 *     fila NO es clickable como entera (solo el bovino).
 */

import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import {
  RanchFilterBanner, RanchFilterBannerEmpty,
} from '@/components/shared/RanchFilterBanner';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { PageLoader } from '@/components/ui/Spinner';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import {
  HeartPulse, Plus, Search, ChevronLeft, ChevronRight, RotateCcw,
  Filter, ChevronDown, ChevronUp, AlertTriangle, Activity, Calendar,
  CheckCircle2, ExternalLink, Bell,
} from 'lucide-react';
import { useHealthRecordsList } from '@/hooks/useBovineHealth';
import { useActiveDiseases } from '@/hooks/useDiseases';
import {
  HealthRecordType,
  OverallHealthStatus,
  type HealthRecordsListFilters,
} from '@/types/health.types';
import { HEALTH_RECORD_TYPE_LABELS } from '@/design-system/tokens/health-record-type.colors';
import { formatDate, formatRelative } from '@/utils/formatters';

const PAGE_SIZE = 20;

// ── Opciones de filtros ────────────────────────────────────────────────────

const RECORD_TYPE_OPTIONS: { value: HealthRecordType; label: string }[] =
  Object.values(HealthRecordType).map((t) => ({
    value: t,
    label: HEALTH_RECORD_TYPE_LABELS[t] ?? t,
  }));

const HEALTH_STATUS_OPTIONS: { value: OverallHealthStatus; label: string }[] = [
  { value: OverallHealthStatus.HEALTHY,    label: 'Saludable' },
  { value: OverallHealthStatus.SICK,       label: 'Enfermo' },
  { value: OverallHealthStatus.RECOVERING, label: 'Recuperacion' },
  { value: OverallHealthStatus.QUARANTINE, label: 'Cuarentena' },
  { value: OverallHealthStatus.DECEASED,   label: 'Fallecido' },
  { value: OverallHealthStatus.UNKNOWN,    label: 'Desconocido' },
];

const TRI_STATE_OPTIONS = [
  { value: '',      label: 'Todos' },
  { value: 'true',  label: 'Solo si' },
  { value: 'false', label: 'Solo no' },
];

// ── Component ──────────────────────────────────────────────────────────────

export function HealthRecordsListPage() {
  const { activeRanchId } = useAuth();
  // Lee filtros pre-cargados desde el query string (drill-down desde el
  // dashboard de stats lleva aqui con params: search, overallHealthStatus,
  // diagnosisConfirmed, startDate, endDate).
  const [searchParams] = useSearchParams();

  // Estado de filtros
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Helpers para parsear los valores del query string que pueden venir
  // del drill-down del dashboard de stats. Tolerantes a valores invalidos.
  const initialStatuses: OverallHealthStatus[] = (() => {
    const raw = searchParams.get('overallHealthStatus');
    if (!raw) return [];
    const valid = new Set(Object.values(OverallHealthStatus));
    return raw.split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => valid.has(s as OverallHealthStatus)) as OverallHealthStatus[];
  })();
  const initialDiagnosisConfirmed = (() => {
    const raw = searchParams.get('diagnosisConfirmed');
    if (raw === 'true')  return 'true';
    if (raw === 'false') return 'false';
    return '';
  })();

  const [recordTypes, setRecordTypes] = useState<HealthRecordType[]>([]);
  const [statuses, setStatuses]       = useState<OverallHealthStatus[]>(initialStatuses);
  const [diseaseId, setDiseaseId]     = useState<string>('');
  const [emergency, setEmergency]     = useState<string>('');
  const [followUp, setFollowUp]       = useState<string>('');
  const [diagConfirmed, setDiagConfirmed] = useState<string>(initialDiagnosisConfirmed);
  const [startDate, setStartDate]     = useState(searchParams.get('startDate') ?? '');
  const [endDate, setEndDate]         = useState(searchParams.get('endDate') ?? '');
  const [page, setPage]               = useState(1);
  // Abrir el panel de filtros automaticamente si llegan params de drill-down
  // para que el usuario vea inmediatamente que filtros estan aplicados.
  const [filtersOpen, setFiltersOpen] = useState(
    initialStatuses.length > 0
    || !!initialDiagnosisConfirmed
    || !!searchParams.get('startDate')
    || !!searchParams.get('search'),
  );

  // Cualquier cambio de filtro vuelve a la primera pagina.
  useEffect(() => { setPage(1); }, [
    search, recordTypes, statuses, diseaseId, emergency, followUp, diagConfirmed,
    startDate, endDate,
  ]);

  // Catalogo lazy: solo cuando el panel de filtros esta abierto.
  const { data: diseases = [], isLoading: isLoadingDiseases } = useActiveDiseases({
    enabled: filtersOpen,
  });

  // Filtros memorizados para queryKey estable.
  const filters: HealthRecordsListFilters = useMemo(() => ({
    ranchId: activeRanchId ?? undefined,
    page,
    limit: PAGE_SIZE,
    sortBy: 'recordDate',
    sortOrder: 'DESC',
    ...(search                  ? { search }                                 : {}),
    ...(recordTypes.length      ? { recordType: recordTypes }                : {}),
    ...(statuses.length         ? { overallHealthStatus: statuses }          : {}),
    ...(diseaseId               ? { diseaseId }                              : {}),
    ...(emergency               ? { isEmergency: emergency === 'true' }      : {}),
    ...(followUp                ? { followUpRequired: followUp === 'true' }  : {}),
    ...(diagConfirmed           ? { diagnosisConfirmed: diagConfirmed === 'true' } : {}),
    ...(startDate               ? { startDate }                              : {}),
    ...(endDate                 ? { endDate }                                : {}),
  }), [
    activeRanchId, page, search, recordTypes, statuses, diseaseId,
    emergency, followUp, diagConfirmed, startDate, endDate,
  ]);

  const { data, isLoading, isError, error } = useHealthRecordsList(filters, {
    enabled: !!activeRanchId,
  });
  const records    = data?.data       ?? [];
  const pagination = data?.pagination;

  // KPIs derivados de la pagina visible.
  const pageKpis = useMemo(() => {
    const emergencies = records.filter((r) => r.isEmergency).length;
    const sick        = records.filter((r) =>
      r.overallHealthStatus === OverallHealthStatus.SICK
      || r.overallHealthStatus === OverallHealthStatus.QUARANTINE,
    ).length;
    const pending     = records.filter((r) => r.followUpRequired && !r.isCompleted).length;
    const linked      = records.filter((r) => !!r.disease).length;
    return { emergencies, sick, pending, linked };
  }, [records]);

  // Toggle helpers para chips multi-select.
  function toggleRecordType(v: HealthRecordType) {
    setRecordTypes((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }
  function toggleStatus(v: OverallHealthStatus) {
    setStatuses((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function resetFilters() {
    setSearchInput(''); setSearch('');
    setRecordTypes([]); setStatuses([]);
    setDiseaseId('');
    setEmergency(''); setFollowUp('');
    setDiagConfirmed('');
    setStartDate(''); setEndDate('');
  }

  const activeFilterCount =
    (search ? 1 : 0)
    + recordTypes.length + statuses.length
    + (diseaseId ? 1 : 0) + (emergency ? 1 : 0) + (followUp ? 1 : 0)
    + (diagConfirmed ? 1 : 0)
    + (startDate ? 1 : 0) + (endDate ? 1 : 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <HeartPulse className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Registros de salud
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Listado paginado del rancho con filtros clinicos completos.
            </p>
          </div>
        </div>
        <Link
          to="/health"
          className="inline-flex items-center gap-2 px-3 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Nuevo registro
        </Link>
      </div>

      <RanchFilterBanner
        activeHint="Registros de salud de este rancho."
        emptyHint="Selecciona un rancho para ver sus registros de salud."
      />

      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="Los registros de salud se listan por rancho. Elige uno arriba para continuar."
        />
      )}

      {activeRanchId && (
        <>
          {/* KPI mini cards (pagina visible) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Emergencias"
              value={pageKpis.emergencies}
              colorClass="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
            />
            <MiniStat
              icon={<Activity className="w-4 h-4" />}
              label="Enfermos / cuarentena"
              value={pageKpis.sick}
              colorClass="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
            />
            <MiniStat
              icon={<Bell className="w-4 h-4" />}
              label="Seguimiento pendiente"
              value={pageKpis.pending}
              colorClass="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
            />
            <MiniStat
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="Vinculados al catalogo"
              value={pageKpis.linked}
              colorClass="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
            />
          </div>
          {pagination && pagination.totalPages > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
              Conteos calculados sobre la pagina visible ({records.length} registros de {pagination.total} totales).
            </p>
          )}

          {/* Card de filtros colapsable */}
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    type="text"
                    placeholder="Buscar en motivo / diagnostico..."
                    icon={<Search className="w-4 h-4" />}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <Select
                    label="Enfermedad"
                    options={[
                      { value: '', label: isLoadingDiseases ? 'Cargando...' : 'Todas' },
                      ...diseases.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                    disabled={isLoadingDiseases}
                    value={diseaseId}
                    onChange={(e) => setDiseaseId(e.target.value)}
                  />
                  <Input
                    type="date"
                    label="Desde"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Input
                    type="date"
                    label="Hasta"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select
                    label="Emergencia"
                    options={TRI_STATE_OPTIONS}
                    value={emergency}
                    onChange={(e) => setEmergency(e.target.value)}
                  />
                  <Select
                    label="Requiere seguimiento"
                    options={TRI_STATE_OPTIONS}
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                  />
                  <Select
                    label="Diagnostico confirmado"
                    options={TRI_STATE_OPTIONS}
                    value={diagConfirmed}
                    onChange={(e) => setDiagConfirmed(e.target.value)}
                  />
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Tipo de registro
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {RECORD_TYPE_OPTIONS.map((t) => {
                      const active = recordTypes.includes(t.value);
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => toggleRecordType(t.value)}
                          className={[
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400',
                          ].join(' ')}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                    Estado de salud
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {HEALTH_STATUS_OPTIONS.map((s) => {
                      const active = statuses.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => toggleStatus(s.value)}
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
            <Alert variant="error" title="No se pudieron cargar los registros">
              {(error as Error)?.message ?? 'Intenta nuevamente.'}
            </Alert>
          ) : records.length === 0 ? (
            <Card className="text-center py-12">
              <HeartPulse className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Sin registros que mostrar
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {activeFilterCount > 0
                  ? 'Prueba ajustando los filtros o limpiandolos.'
                  : 'Cuando se registre una visita aparecera aqui.'}
              </p>
            </Card>
          ) : (
            <>
              <DesktopTable records={records} />
              <MobileList records={records} />

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Pagina {pagination.page} de {pagination.totalPages}
                    {' '}&middot;{' '}
                    {pagination.total} registros
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      icon={<ChevronLeft className="w-4 h-4" />}
                      disabled={!pagination.hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      icon={<ChevronRight className="w-4 h-4" />}
                      iconPosition="right"
                      disabled={!pagination.hasNext}
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

interface ListProps {
  records: import('@/types/health.types').HealthRecordListItem[];
}

function DesktopTable({ records }: ListProps) {
  return (
    <Card noPadding className="hidden lg:block overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Bovino</th>
              <th className="text-left px-4 py-3 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-left px-4 py-3 font-medium">Diagnostico</th>
              <th className="text-left px-4 py-3 font-medium">Enfermedad</th>
              <th className="text-center px-4 py-3 font-medium">Seguim.</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {records.map((r) => (
              <tr
                key={r.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="text-gray-700 dark:text-gray-300">
                    {formatDate(r.recordDate ?? r.createdAt ?? '')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatRelative(r.recordDate ?? r.createdAt ?? '')}
                  </p>
                  {r.isEmergency && (
                    <Badge variant="danger" className="mt-1">URGENTE</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.bovine ? (
                    <Link
                      to={`/bovines/${r.bovine.id}`}
                      className="hover:underline"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {r.bovine.earTag}
                      </p>
                      {r.bovine.name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {r.bovine.name}
                        </p>
                      )}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">{r.bovineId}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {HEALTH_RECORD_TYPE_LABELS[r.recordType] ?? r.recordType}
                </td>
                <td className="px-4 py-3">
                  <HealthStatusBadge
                    status={r.overallHealthStatus}
                    showIcon={false}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
                  {r.diagnosis?.primaryDiagnosis ?? r.chiefComplaint ?? (
                    <span className="text-gray-400">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.disease ? (
                    <Link
                      to={`/health/diseases/catalogo/${r.disease.slug}`}
                      className="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                    >
                      {r.disease.name}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.followUpRequired ? (
                    <Calendar
                      className="w-4 h-4 text-blue-500 inline"
                      aria-label="Requiere seguimiento"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link to={`/health/records/${r.id}`}>
                      <Button size="sm" variant="outline">
                        Detalle
                      </Button>
                    </Link>
                    {r.bovine && (
                      <Link
                        to={`/bovines/${r.bovine.id}`}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                        title="Ir al bovino"
                      >
                        Bovino
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MobileList({ records }: ListProps) {
  return (
    <div className="lg:hidden grid grid-cols-1 gap-3">
      {records.map((r) => (
        <Link key={r.id} to={`/health/records/${r.id}`} className="block">
        <Card className="!p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              {r.bovine ? (
                <span className="font-semibold text-gray-900 dark:text-white truncate inline-block">
                  {r.bovine.earTag}
                  {r.bovine.name && (
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                      {' '}&middot; {r.bovine.name}
                    </span>
                  )}
                </span>
              ) : (
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  Bovino {r.bovineId}
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {HEALTH_RECORD_TYPE_LABELS[r.recordType] ?? r.recordType}
                {' '}&middot;{' '}
                {formatDate(r.recordDate ?? r.createdAt ?? '')}
              </p>
            </div>
            <HealthStatusBadge
              status={r.overallHealthStatus}
              showIcon={false}
              size="sm"
            />
          </div>

          {(r.diagnosis?.primaryDiagnosis || r.chiefComplaint) && (
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
              {r.diagnosis?.primaryDiagnosis ?? r.chiefComplaint}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {r.isEmergency && <Badge variant="danger">URGENTE</Badge>}
            {r.followUpRequired && (
              <Badge variant="info">
                <Calendar className="w-3 h-3 mr-1 inline" /> Seguimiento
              </Badge>
            )}
            {r.disease && (
              <span className="text-primary-600 dark:text-primary-400 inline-flex items-center gap-1">
                {r.disease.name}
              </span>
            )}
          </div>
        </Card>
        </Link>
      ))}
    </div>
  );
}
