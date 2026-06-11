/**
 * Detalle de enfermedad del catálogo.
 *
 * Ruta: `/health/diseases/catalogo/:slug`
 * Resolución por slug (URL-friendly) vía `useDiseaseBySlug` — devuelve `null`
 * si no existe, en cuyo caso mostramos un 404 amigable inline.
 *
 * El detalle ya incluye `symptoms` y `transmissionMethods` eager-loaded,
 * por lo que no necesitamos hacer queries adicionales para la vista canónica.
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Spinner';
import { PermissionGuard } from '@/components/ui/PermissionGuard';
import { MediaGallery } from '@/components/media/MediaGallery';
import {
  ArrowLeft, Bug, AlertTriangle, Clock, Activity, Stethoscope,
  Wind, ShieldCheck, Microscope, ImagePlus, Image as ImageIcon, Tag,
} from 'lucide-react';
import { useDiseaseBySlug } from '@/hooks/useDiseases';
import type { DiseaseMediaResponse } from '@/types/disease.dtos';
import {
  DISEASE_CATEGORY_LABELS,
  getDiseaseCategoryColor,
  getDiseaseSeverityBadgeVariant,
  getDiseaseSeverityLabel,
  getAffectedSystemLabel,
} from '@/design-system/tokens/case-status.colors';

// ── Mapa de iconos por ruta de transmisión ──────────────────────────────────
//
// Los keys cubren TransmissionRoute del backend. Cualquier valor desconocido
// usa el fallback (`Wind`) — preferimos no romper la UI si el catálogo crece.
const ROUTE_ICONS: Record<string, typeof Wind> = {
  DIRECT:     Activity,
  AIRBORNE:   Wind,
  WATERBORNE: Wind,
  VECTOR:     Bug,
  FOMITE:     Tag,
  VERTICAL:   Stethoscope,
  SEXUAL:     Stethoscope,
  OTHER:      Wind,
};

const ROUTE_LABELS: Record<string, string> = {
  DIRECT:     'Contacto directo',
  AIRBORNE:   'Aérea',
  WATERBORNE: 'Hídrica',
  VECTOR:     'Por vector',
  FOMITE:     'Por fómite',
  VERTICAL:   'Vertical (madre-cría)',
  SEXUAL:     'Sexual',
  OTHER:      'Otra',
};

export function DiseaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: disease, isLoading, isError, error } = useDiseaseBySlug(slug);

  // Estado del modal de gestión de imágenes. Se puede auto-abrir vía
  // `?addMedia=1` (lo usa DiseaseFormPage tras crear, para que el SUPER_ADMIN
  // suba imágenes inmediatamente sin tener que buscar el botón).
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  useEffect(() => {
    if (searchParams.get('addMedia') === '1' && disease) {
      setMediaModalOpen(true);
      // Limpiamos el param para que un refresh no re-abra el modal.
      const next = new URLSearchParams(searchParams);
      next.delete('addMedia');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, disease, setSearchParams]);

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <Alert variant="error" title="Error al cargar la enfermedad">
        {(error as Error)?.message ?? 'Intenta nuevamente.'}
      </Alert>
    );
  }

  // `null` = slug no encontrado (404 lógico — la query NO falla).
  if (!disease) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="text-center py-12">
          <Microscope className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Enfermedad no encontrada
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            El slug «{slug}» no corresponde a ninguna entrada del catálogo.
          </p>
        </Card>
      </div>
    );
  }

  // Defensa en profundidad — aunque `diseasesApi.getBySlug` ya pasa por
  // `normalizeDiseaseDetail`, declaramos defaults locales para que cualquier
  // shape inesperado (e.g. respuesta cruda sin pasar por el adapter, futuras
  // refactorizaciones) NO cause `.length` / `.map` sobre undefined →
  // pantalla en blanco. El bug que motivó esta defensa: backend devolvió
  // `aliases` como `[{id, alias}]` y `diseaseSymptoms` nested, y el render
  // crasheaba antes de llegar al try/catch del error boundary.
  const symptoms             = disease.symptoms             ?? [];
  const transmissionMethods  = disease.transmissionMethods  ?? [];
  const aliases              = disease.aliases              ?? [];
  const affectedSystems      = disease.affectedSystems      ?? [];
  // `media` viene eager-loaded en `/diseases/:slug` (Fase 1b). Lo usamos para
  // el grid inline sin hacer fetch extra. El modal de gestión sí hace su
  // propio GET vía `useDiseaseMedia` para mantenerse fresco tras mutaciones.
  const mediaItems           = disease.media                 ?? [];
  const mediaImages          = mediaItems.filter((m) => m.mimeType?.startsWith('image/'));

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {disease.name}
              </h1>
              {!disease.isActive && <Badge variant="default">Inactiva</Badge>}
            </div>

            {aliases.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                <span className="font-medium">También conocida como:</span>{' '}
                {aliases.join(', ')}
              </p>
            )}

            {disease.description && (
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {disease.description}
              </p>
            )}
          </div>

          {/* Chips de clasificación */}
          <div className="flex flex-col gap-2 items-end shrink-0">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: getDiseaseCategoryColor(disease.category) }}
            >
              {DISEASE_CATEGORY_LABELS[disease.category] ?? disease.category}
            </span>
            <Badge variant={getDiseaseSeverityBadgeVariant(disease.severity)}>
              Severidad: {getDiseaseSeverityLabel(disease.severity)}
            </Badge>
            {disease.isContagious && (
              <Badge variant="warning">
                <Bug className="w-3 h-3 mr-1 inline" /> Contagiosa
              </Badge>
            )}
            {disease.isZoonotic && (
              <Badge variant="danger" title="Puede transmitirse al ser humano">
                <AlertTriangle className="w-3 h-3 mr-1 inline" /> Zoonótica
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* KPIs clínicos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={<Clock className="w-5 h-5" />}
          label="Incubación"
          value={
            disease.incubationDaysMin != null && disease.incubationDaysMax != null
              ? `${disease.incubationDaysMin}–${disease.incubationDaysMax} días`
              : '—'
          }
        />
        <KpiCard
          icon={<ShieldCheck className="w-5 h-5" />}
          label="Cuarentena por defecto"
          value={
            disease.defaultQuarantineDays != null
              ? `${disease.defaultQuarantineDays} días`
              : '—'
          }
        />
        <KpiCard
          icon={<Activity className="w-5 h-5" />}
          label="Sistemas afectados"
          value={
            affectedSystems.length > 0
              ? affectedSystems.map(getAffectedSystemLabel).join(', ')
              : '—'
          }
        />
      </div>

      {/* Acción recomendada */}
      {disease.recommendedAction && (
        <Alert variant="warning" title="Acción recomendada">
          {disease.recommendedAction}
        </Alert>
      )}

      {/* ── Galería de imágenes ──────────────────────────────────────────────
          Sección inline que SIEMPRE se renderiza para mostrar el botón
          "Gestionar imágenes" al SUPER_ADMIN. El grid solo aparece si hay
          media. Para casos sin permiso y sin imágenes, la sección no se
          renderiza (no aporta valor).
      */}
      <DiseaseMediaSection
        diseaseId={disease.id}
        mediaImages={mediaImages}
        totalCount={mediaItems.length}
        onOpenManager={() => setMediaModalOpen(true)}
      />

      {/* Modal de gestión: SUPER_ADMIN puede subir / borrar. Reutiliza
          MediaGallery (que ya implementa todo el flow CRUD). */}
      <Modal
        open={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        title={`Imágenes de ${disease.name}`}
        size="xl"
      >
        <MediaGallery entityType="disease" entityId={disease.id} />
      </Modal>

      {/* Síntomas + Transmisión side-by-side en lg, apilados en mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Síntomas */}
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary-600" />
            Síntomas asociados
          </CardTitle>
          {symptoms.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No hay síntomas catalogados para esta enfermedad.
            </p>
          ) : (
            <ul className="space-y-2">
              {symptoms.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <span className="w-1.5 h-1.5 mt-2 rounded-full bg-primary-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {s.name}
                    </p>
                    {s.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {s.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Transmisión */}
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Wind className="w-5 h-5 text-primary-600" />
            Mecanismos de transmisión
          </CardTitle>
          {transmissionMethods.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No hay métodos de transmisión documentados.
            </p>
          ) : (
            <ul className="space-y-3">
              {transmissionMethods.map((m) => {
                const RouteIcon = ROUTE_ICONS[m.route] ?? Wind;
                const routeLabel = ROUTE_LABELS[m.route] ?? m.route;
                return (
                  <li key={m.id} className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
                      <RouteIcon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {m.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {routeLabel}
                        {m.description ? ` · ${m.description}` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      to="/health/diseases/catalogo"
      className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
    >
      <ArrowLeft className="w-4 h-4" />
      Volver al catálogo
    </Link>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function KpiCard({ icon, label, value }: KpiCardProps) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ── Galería de imágenes inline ──────────────────────────────────────────────
//
// Render con dos comportamientos según permiso + presencia de media:
//   - SUPER_ADMIN  → siempre se muestra (con CTA "Subir/Gestionar"), incluso
//                    si no hay imágenes (necesita el acceso a subir).
//   - Otros roles  → solo se muestra si hay al menos 1 imagen, sin CTA.
// El grid colapsa a 2 col en mobile, 4 en lg. Click en una imagen abre el
// modal de gestión (preview + delete dentro de MediaGallery).

interface DiseaseMediaSectionProps {
  diseaseId: string;
  /** Items con mimeType image/*. Subset de `disease.media`. */
  mediaImages: DiseaseMediaResponse[];
  /** Total de media (incluye videos) — usado para el contador del CTA. */
  totalCount: number;
  /** Abre el modal CRUD (MediaGallery completo). */
  onOpenManager: () => void;
}

function DiseaseMediaSection({
  mediaImages, totalCount, onOpenManager,
}: DiseaseMediaSectionProps) {
  const hasMedia = totalCount > 0;

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <CardTitle className="flex items-center gap-2 mb-0">
          <ImageIcon className="w-5 h-5 text-primary-600" />
          Imágenes y videos
          {hasMedia && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({totalCount})
            </span>
          )}
        </CardTitle>
        <PermissionGuard
          action="MANAGE_DISEASE_MEDIA"
          // Para roles sin permiso, ocultar el botón pero seguir mostrando
          // el grid si hay media (los chips informativos siguen siendo útiles).
        >
          <Button
            size="sm"
            variant={hasMedia ? 'outline' : 'primary'}
            icon={<ImagePlus className="w-4 h-4" />}
            onClick={onOpenManager}
          >
            {hasMedia ? 'Gestionar imágenes' : 'Añadir imágenes'}
          </Button>
        </PermissionGuard>
      </div>

      {!hasMedia ? (
        <PermissionGuard
          action="MANAGE_DISEASE_MEDIA"
          fallback={
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No hay imágenes para esta enfermedad.
            </p>
          }
        >
          <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
            <ImageIcon className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aún no hay imágenes para esta enfermedad.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Añade fotos clínicas, esquemas o videos para enriquecer el catálogo.
            </p>
          </div>
        </PermissionGuard>
      ) : (
        <button
          type="button"
          onClick={onOpenManager}
          className="block w-full text-left"
          title="Ver, añadir o eliminar imágenes"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mediaImages.slice(0, 8).map((m) => (
              <div
                key={m.id}
                className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 group"
              >
                <img
                  src={m.thumbnailUrl || m.url}
                  alt={m.title || m.caption || 'Imagen de la enfermedad'}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                {(m.title || m.caption) && (
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-[11px] text-white truncate font-medium">
                      {m.title || m.caption}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {mediaImages.length > 8 && (
              <div className="relative aspect-square rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300">
                +{mediaImages.length - 8} más
              </div>
            )}
          </div>
        </button>
      )}
    </Card>
  );
}
