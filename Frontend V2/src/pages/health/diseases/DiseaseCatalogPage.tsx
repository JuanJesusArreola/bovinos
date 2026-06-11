/**
 * Catálogo público de enfermedades.
 *
 * Ruta: `/health/diseases/catalogo`
 * Acceso: todos los usuarios autenticados (VIEW_DISEASES). El catálogo es
 * informacional — sirve como referencia al diagnosticar / reportar casos.
 *
 * Solo SUPER_ADMIN ve el botón "Nueva enfermedad" (PermissionGuard).
 */

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { PageLoader } from '@/components/ui/Spinner';
import {
  Microscope, Search, AlertTriangle, Bug, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useDiseases } from '@/hooks/useDiseases';
import {
  DiseaseCategory,
  DiseaseSeverity,
  type DiseaseListFilters,
} from '@/types/disease.dtos';
import {
  DISEASE_CATEGORY_LABELS,
  getDiseaseCategoryColor,
  getDiseaseSeverityBadgeVariant,
  getDiseaseSeverityLabel,
} from '@/design-system/tokens/case-status.colors';

const PAGE_SIZE = 100;

// ── Opciones de filtro ──────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  ...Object.values(DiseaseCategory).map((c) => ({
    value: c,
    label: DISEASE_CATEGORY_LABELS[c as keyof typeof DISEASE_CATEGORY_LABELS] ?? c,
  })),
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'Todas las severidades' },
  ...Object.values(DiseaseSeverity).map((s) => ({
    value: s,
    label: getDiseaseSeverityLabel(s),
  })),
];

const CONTAGIOUS_OPTIONS = [
  { value: '',      label: 'Contagiosa / no contagiosa' },
  { value: 'true',  label: 'Solo contagiosas' },
  { value: 'false', label: 'Solo no contagiosas' },
];

const ZOONOTIC_OPTIONS = [
  { value: '',      label: 'Zoonótica / no zoonótica' },
  { value: 'true',  label: 'Solo zoonóticas' },
  { value: 'false', label: 'Solo no zoonóticas' },
];

export function DiseaseCatalogPage() {
  // `searchInput` es lo que el usuario escribe (cambia en cada tecla).
  // `search` es lo que efectivamente se envía al backend — se actualiza
  // con un debounce de 300ms para evitar disparar 5 requests mientras
  // alguien escribe "Brucelosis".
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  // Cualquier cambio de búsqueda debe resetear la paginación — si no, te
  // quedas en la página 5 después de filtrar y no ves resultados.
  useEffect(() => { setPage(1); }, [search]);

  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [contagious, setContagious] = useState('');
  const [zoonotic, setZoonotic] = useState('');
  const [page, setPage] = useState(1);

  // Memo para mantener la referencia estable del objeto filters → cache key estable.
  const filters: DiseaseListFilters = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    ...(search     ? { search }                                     : {}),
    ...(category   ? { category: category as DiseaseCategory }      : {}),
    ...(severity   ? { severity: severity as DiseaseSeverity }      : {}),
    ...(contagious ? { isContagious: contagious === 'true' }        : {}),
    ...(zoonotic   ? { isZoonotic:   zoonotic === 'true' }          : {}),
  }), [page, search, category, severity, contagious, zoonotic]);

  const { data, isLoading, isError, error } = useDiseases(filters);
  const diseases   = data?.data       ?? [];
  const pagination = data?.pagination;

  // Cualquier cambio de filtro vuelve a la página 1 (evitamos quedarnos
  // "fuera de rango" si la nueva combinación tiene menos páginas).
  function withResetPage<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Microscope className="w-7 h-7 text-primary-600" />
            Catálogo de enfermedades
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Referencia global de enfermedades bovinas — síntomas, severidad, transmisión y manejo recomendado.
          </p>
        </div>

        {/* V2: el alta de enfermedades desde la app está deshabilitada porque
            el backend aún no expone POST/PATCH /diseases (solo lectura + media).
            El catálogo se gestiona por seed/BD. Reactivar este botón y la ruta
            `/health/diseases/catalogo/nuevo` cuando exista el CRUD en backend.
        <PermissionGuard action="MANAGE_DISEASES">
          <Link to="/health/diseases/catalogo/nuevo">
            <Button icon={<Plus className="w-4 h-4" />}>Nueva enfermedad</Button>
          </Link>
        </PermissionGuard>
        */}
      </div>

      {/* Banner informativo — el catálogo es lectura abierta */}
      <Alert variant="info">
        Este catálogo es <strong>global</strong> y compartido entre todos los ranchos.
        Cualquier usuario puede consultarlo como apoyo al diagnóstico. La edición está
        restringida a Super-Administradores.
      </Alert>

      {/* Filtros */}
      <Card className="!p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-1">
            <Input
              type="text"
              placeholder="Buscar por nombre, alias…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => withResetPage(setCategory)(e.target.value)}
          />
          <Select
            options={SEVERITY_OPTIONS}
            value={severity}
            onChange={(e) => withResetPage(setSeverity)(e.target.value)}
          />
          <Select
            options={CONTAGIOUS_OPTIONS}
            value={contagious}
            onChange={(e) => withResetPage(setContagious)(e.target.value)}
          />
          <Select
            options={ZOONOTIC_OPTIONS}
            value={zoonotic}
            onChange={(e) => withResetPage(setZoonotic)(e.target.value)}
          />
        </div>
      </Card>

      {/* Estado: loading / error / vacío / grid */}
      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <Alert variant="error" title="No se pudo cargar el catálogo">
          {(error as Error)?.message ?? 'Intenta nuevamente en unos segundos.'}
        </Alert>
      ) : diseases.length === 0 ? (
        <Card className="text-center py-12">
          <Microscope className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            No hay enfermedades que coincidan con los filtros.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {diseases.map((d) => (
              <Link key={d.id} to={`/health/diseases/catalogo/${d.slug}`}>
                <Card className="hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all h-full !p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">
                      {d.name}
                    </h3>
                    {!d.isActive && (
                      <Badge variant="default">Inactiva</Badge>
                    )}
                  </div>

                  {d.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                      {d.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: getDiseaseCategoryColor(d.category) }}
                    >
                      {DISEASE_CATEGORY_LABELS[d.category] ?? d.category}
                    </span>
                    <Badge variant={getDiseaseSeverityBadgeVariant(d.severity)}>
                      {getDiseaseSeverityLabel(d.severity)}
                    </Badge>
                    {d.isContagious && (
                      <Badge variant="warning">
                        <Bug className="w-3 h-3 mr-1 inline" /> Contagiosa
                      </Badge>
                    )}
                    {d.isZoonotic && (
                      <Badge variant="danger" title="Transmisible al ser humano">
                        <AlertTriangle className="w-3 h-3 mr-1 inline" /> Zoonótica
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Página {pagination.page} de {pagination.totalPages} · {pagination.total} resultados
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ChevronLeft className="w-4 h-4" />}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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
    </div>
  );
}
