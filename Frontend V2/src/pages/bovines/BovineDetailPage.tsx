/**
 * BovineDetailPage — single source of truth via /bovines/:id/full.
 *
 * Layout (mirrors LocationDetailPage / RanchDetailPage):
 *   • Header: back, avatar, name + ear tag, badges, action buttons
 *   • 2×2 grid of cards:
 *       - Top-Left  : mini-map with currentLocation
 *       - Top-Right : core info (cattle type, breed, age, weight, etc.)
 *       - Bottom-Left  : health snapshot (status + last check)
 *       - Bottom-Right : vaccination summary (derived status + next due)
 *   • Tabs below (lazy): Info / Salud / Tratamientos / Vacunación / Potreros / Multimedia / Eventos
 *
 * Cache strategy:
 *   - useBovineFull(id) → 1 request, drives the entire header + grid + most tabs.
 *   - Tabs that need extra data (events, treatments paginated, etc.) load only
 *     when active.
 */

import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { bovinesApi } from '@/api/bovines.api';
import { locationsApi } from '@/api/locations.api';
import {
  useBovineFull, useDeleteBovine, useMoveBovine,
  useMarkBovineSick, useRegenerateBovineQr, bovineKeys,
  useBovineRiskScore,
} from '@/hooks/useBovines';
import { ClinicalDataForm, isClinicalDataValid } from '@/components/bovines/ClinicalDataForm';
import { DeathRegistrationModal } from '@/components/bovines/DeathRegistrationModal';
import type { InitialCaseInput } from '@/types/bovine.dtos';
import { useBovineWithdrawalStatus } from '@/hooks/useBovineHealth';
import { WithdrawalStatusBanner } from '@/components/health/WithdrawalStatusBanner';
import { BovineQR } from '@/components/bovines/BovineQR';
import { MovementReason, MovementType } from '@/types/bovine.dtos';
import { MapPicker, type Coordinates } from '@/components/maps/MapPicker';
import { isPointInBoundary, type BoundaryShape } from '@/utils/geoValidation';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import {
  getErrorCode, getFriendlyMessage, ErrorCodes,
  getBovineErrorMessage, getBovineActiveRecords,
} from '@/utils/errorHandler';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import { LocationSelector } from '@/components/ui/LocationSelector';

import { BovineHealthTab } from './tabs/BovineHealthTab';
import { BovineTreatmentsTab } from './tabs/BovineTreatmentsTab';
import { BovineVaccinationsTab } from './tabs/BovineVaccinationsTab';
import { BovineLocationHistoryTab } from './tabs/BovineLocationHistoryTab';
import { MediaGallery } from '@/components/media/MediaGallery';

import type { BovineFullResponse, VaccinationStatus, HealthStatus } from '@/types/bovine.dtos';
import {
  getCattleTypeGradient, getCattleTypeEmoji,
  getVaccinationStatusLabel, getVaccinationStatusVariant,
} from '@/design-system/tokens';

import {
  ArrowLeft, Edit, QrCode, HeartPulse, MapPin, Beef,
  Mars, Venus, Calendar, Weight, Hash, Pill, Image as ImageIcon,
  Syringe, Info, Trash2, MoveRight, RefreshCw, AlertTriangle, Skull,
  ShieldCheck, Activity, Clock, Copy, ExternalLink, Users,
  Dna, CheckCircle2, XCircle, Wifi, WifiOff,
  Printer, Download,
} from 'lucide-react';

// ─── Tabs ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'info',             label: 'Información',  icon: Info },
  { id: 'health',           label: 'Salud',        icon: HeartPulse },
  { id: 'treatments',       label: 'Tratamientos', icon: Pill },
  { id: 'vaccinations',     label: 'Vacunación',   icon: Syringe },
  { id: 'location_history', label: 'Potreros',     icon: MapPin },
  { id: 'media',            label: 'Multimedia',   icon: ImageIcon },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Helper: vaccination status color ───────────────────────────────────────
// F-35 / Hallazgo H-1: VAC_STATUS_VARIANT + VAC_STATUS_LABEL movidos a
// `design-system/tokens/vaccination.labels.ts`. Import via
// `getVaccinationStatusVariant()` / `getVaccinationStatusLabel()`.

// ─── Avatar gradient by cattle type ─────────────────────────────────────────
// Gradientes + emojis vienen del design-system (cattle-type.colors.ts).
// Aquí solo importamos los helpers para mantener legibilidad en el render.

// ─── InfoRow ────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
      <span className="shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-32">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white flex-1">{children}</span>
    </div>
  );
}

// ─── CurrentLocationMap ─────────────────────────────────────────────────────

function CurrentLocationMap({ full }: { full: BovineFullResponse }) {
  const cl = full.currentLocation;

  // Resolve the map point — prefer GPS (more accurate), fall back to location
  // center if location is set but no GPS, or to the bovine's static location.
  const point = useMemo(() => {
    if (cl.gpsPoint) {
      return { lat: cl.gpsPoint.latitude, lng: cl.gpsPoint.longitude, source: 'GPS' as const };
    }
    // Backend D-01: leer del bloque `profile` (fuente canonica).
    if (full.profile.location?.latitude && full.profile.location?.longitude) {
      return {
        lat: full.profile.location.latitude,
        lng: full.profile.location.longitude,
        source: 'STATIC' as const,
      };
    }
    return null;
  }, [cl.gpsPoint, full.profile.location]);

  if (!point) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
        <MapPin className="w-10 h-10" />
        <p className="text-sm text-center px-4">Sin ubicación geográfica registrada</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={[point.lat, point.lng]}
      zoom={15}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[point.lat, point.lng]}
        radius={10}
        pathOptions={{
          color: '#fff',
          fillColor: '#16a34a',
          fillOpacity: 0.95,
          weight: 3,
        }}
      >
        <Popup>
          <div className="text-xs">
            <p className="font-semibold mb-0.5">{full.profile.earTag}</p>
            <p className="text-gray-600">
              {cl.location?.name ?? (point.source === 'GPS' ? 'Posición GPS' : 'Ubicación registrada')}
            </p>
            {cl.gpsPoint?.recordedAt && (
              <p className="text-gray-400 text-[10px] mt-1">
                Última posición: {formatDate(cl.gpsPoint.recordedAt)}
              </p>
            )}
          </div>
        </Popup>
      </CircleMarker>
    </MapContainer>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function BovineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveLocationId, setMoveLocationId] = useState<string | null>(null);
  // Reason must be one of the 8 valid MovementReason values — defaults to
  // TRANSFER for ad-hoc moves (CREATION is reserved for the initial registry).
  const [moveReason, setMoveReason] = useState<MovementReason>(MovementReason.TRANSFER);
  const [moveMovementType, setMoveMovementType] = useState<MovementType>(MovementType.MANUAL);
  const [moveNotes, setMoveNotes] = useState('');
  // New GPS coords picked in the Move modal. `null` means "don't update GPS".
  const [moveCoords, setMoveCoords] = useState<Coordinates | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  // Escape hatch para el bloqueo de período de retiro — solo SE muestra y se
  // habilita cuando hay withdrawal activo + reason ∈ {SALE, TRANSFER}. Al
  // marcarlo, el operador asume formalmente la responsabilidad legal del
  // movimiento (necropsia, decomiso oficial, donación a rendering, etc.).
  // Se REINICIA cada vez que se abre el modal o cambia el reason.
  const [requireSaleAck, setRequireSaleAck] = useState(false);
  const [deleteBlockMsg, setDeleteBlockMsg] = useState<string | null>(null);
  // F-20 / Backend L-01: prompt para confirmar forceOverride cuando el
  // backend respondio 409 BOVINE_LOCATION_FULL. El estado se llena con los
  // numeros que el backend reporto y un closure que reenvia con
  // `forceOverride: true`. Null = no hay prompt activo.
  const [forceOverridePrompt, setForceOverridePrompt] = useState<{
    currentOccupancy: number;
    maxAnimals:       number;
  } | null>(null);

  // F-25 / Backend X-03: modal "Registrar muerte". Solo se ofrece cuando
  // el bovino NO esta ya fallecido (la accion es irreversible y el backend
  // devuelve 409 ALREADY_DECEASED si se intenta de nuevo).
  const [showDeathModal, setShowDeathModal] = useState(false);

  // F-24 / Backend C-04: modal "Marcar enfermo". Solo se ofrece cuando el
  // bovino esta sano/desconocido; para bovinos ya enfermos se redirige al
  // modulo Salud (donde se gestionan los casos clinicos activos).
  const [showMarkSickModal, setShowMarkSickModal] = useState(false);
  const [markSickData, setMarkSickData] = useState<InitialCaseInput | null>(null);
  const [markSickErrors, setMarkSickErrors] = useState<
    Partial<Record<keyof InitialCaseInput, string>>
  >({});

  // Load the selected destination location so we can overlay its boundary
  // on the map and validate the new GPS pin against it.
  const { data: moveTargetLocation } = useQuery({
    queryKey: ['location', moveLocationId],
    queryFn: () => locationsApi.getById(moveLocationId!).then((r) => r.data.data),
    enabled: !!moveLocationId,
    staleTime: 60_000,
  });

  // Hard-validation: if the user picked coords AND the destination has a
  // configured geofence, the coords must fall inside it.
  const moveCoordsOutside = useMemo(() => {
    if (!moveCoords) return false;
    const gf = moveTargetLocation?.geofenceConfig as BoundaryShape | undefined;
    if (!gf || !gf.type) return false;
    return !isPointInBoundary(moveCoords, gf);
  }, [moveCoords, moveTargetLocation]);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: full, isLoading, error } = useBovineFull(id);

  // Estado de período de retiro — banner legal que aparece en el header
  // del detalle si el bovino tiene medicamentos cuyo withdrawal aún corre.
  // Cargamos solo cuando hay id válido. Si el bovino no tiene tratamientos
  // recientes, el hook devuelve `hasActiveWithdrawal: false` sin penalizar
  // mucho (es una query barata: 1 historial + N retiros donde N≈0 en sanos).
  const { data: withdrawalStatus, isLoading: isLoadingWithdrawal } =
    useBovineWithdrawalStatus(id);

  const bovineHealthStatus = full?.profile?.healthStatus;
  const { data: riskScore } = useBovineRiskScore(id, {
    enabled: bovineHealthStatus !== 'DECEASED',
  });

  // ── Permissions ──────────────────────────────────────────────────────────
  const canEdit    = canUser(user?.role, 'MANAGE_BOVINE');
  const canMove    = canUser(user?.role, 'MOVE_BOVINE');
  const canDelete  = canUser(user?.role, 'DELETE_BOVINE');
  // VIEW_QR — todos los autenticados; permite abrir el modal e imprimir.
  const canViewQR  = canUser(user?.role, 'VIEW_QR');
  // REGENERATE_QR — solo managers; rotación destructiva del código.
  const canRegenQR = canUser(user?.role, 'REGENERATE_QR');

  // ── Mutations ────────────────────────────────────────────────────────────
  const deleteMutation = useDeleteBovine();
  const moveMutation = useMoveBovine();
  // F-24: mutation se instancia con id ya disponible (ruta protegida — id
  // garantizado para este componente). El hook invalida los caches que
  // dependen de salud + casos clinicos (ver useMarkBovineSick).
  const markSickMutation = useMarkBovineSick(id!);
  // Centralized hook — invalidates full/detail/lists automatically. We keep
  // the toast wrappers locally so the user sees feedback at this entry point.
  const regenerateQrHook = useRegenerateBovineQr();
  const regenerateQrMutation = {
    isPending: regenerateQrHook.isPending,
    mutate: () =>
      regenerateQrHook.mutate(id!, {
        onSuccess: () => toast.success('QR regenerado', 'El código QR fue actualizado.'),
        onError: (err: unknown) =>
          toast.error('Error', getFriendlyMessage(err) || 'No se pudo regenerar el QR.'),
      }),
  };

  // When the move modal opens, seed the GPS picker with the bovine's current
  // coordinates so the user has a reference point and can ADJUST it instead of
  // starting from a blank map.
  //
  // IMPORTANT: this effect MUST stay above the early returns below — React's
  // Rules of Hooks require hooks to run unconditionally on every render. If
  // it's placed after `if (isLoading) return ...`, the hook count changes
  // between renders and the page crashes (white screen).
  useEffect(() => {
    if (!showMoveModal) return;
    const loc = full?.bovine?.location;
    if (loc?.latitude != null && loc?.longitude != null) {
      setMoveCoords({ latitude: loc.latitude, longitude: loc.longitude });
    } else {
      setMoveCoords(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMoveModal]);

  // ── Loading / error guards ───────────────────────────────────────────────
  if (isLoading) return <PageLoader />;
  if (error || !full) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No se pudo cargar el bovino</p>
        <Button variant="outline" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/bovines')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  // Backend D-01: la fuente canonica de los datos visibles del bovino es
  // `full.profile` (mismo shape que GET /bovines/:id, con labels resueltos,
  // clasificacion etaria y flags derivados). Mantenemos el alias local
  // `bovine` para no tocar las ~60 referencias del JSX; las llamadas a
  // `bovine.X` ahora leen del bloque profile.
  //
  // Si en el futuro necesitas datos crudos del modelo Sequelize que el
  // profile no expone (p.ej. `healthSnapshot.activeCaseId`), accede a
  // `full.bovine.X` directamente.
  const bovine = full.profile;
  const currentLoc = full.currentLocation;
  // Estado de vacunacion: leer del bloque dedicado (derivado, con statusLabel),
  // NO de `profile.vaccinationStatus` que refleja la columna legacy de la
  // tabla bovines y puede estar desactualizada (F-12).
  const vacStatus  = full.vaccinationStatus;

  // ── Handlers ─────────────────────────────────────────────────────────────
  /**
   * F-24 / Backend C-04: submit del modal "Marcar enfermo". Reusa
   * `useMarkBovineSick` que pega contra POST /api/bovines/:id/sick. Si el
   * backend rechaza por coherencia (poco probable porque guardamos local
   * tambien con isClinicalDataValid), mapea MISSING_CLINICAL_DATA a errores
   * por campo y deja el modal abierto.
   */
  function handleMarkSick() {
    if (!markSickData) return;

    // Guard local — espejo de C-03 del backend.
    if (!isClinicalDataValid(markSickData)) {
      const errs: Partial<Record<keyof InitialCaseInput, string>> = {};
      if (!markSickData.diseaseId)   errs.diseaseId   = 'Selecciona la enfermedad.';
      if (!markSickData.severity)    errs.severity    = 'Selecciona la severidad.';
      if (!markSickData.diagnosedAt) errs.diagnosedAt = 'Captura la fecha de diagnóstico.';
      setMarkSickErrors(errs);
      return;
    }

    markSickMutation.mutate(
      {
        ...markSickData,
        diagnosedBy: markSickData.diagnosedBy?.trim() || undefined,
        notes:       markSickData.notes?.trim()       || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            'Bovino marcado como enfermo',
            'Se abrió un caso clínico y el estado de salud fue actualizado.',
          );
          setShowMarkSickModal(false);
          setMarkSickData(null);
          setMarkSickErrors({});
        },
        onError: (err: unknown) => {
          const code = getErrorCode(err);
          if (code === 'MISSING_CLINICAL_DATA') {
            setMarkSickErrors({
              diseaseId:   'Captura la enfermedad.',
              severity:    'Captura la severidad.',
              diagnosedAt: 'Captura la fecha de diagnóstico.',
            });
            toast.error(
              'Faltan datos clínicos',
              'Faltan datos clínicos: enfermedad, severidad y fecha de diagnóstico.',
            );
          } else {
            toast.error('No se pudo marcar enfermo', getFriendlyMessage(err) || 'Error desconocido');
          }
        },
      },
    );
  }

  function handleDelete() {
    deleteMutation.mutate(id!, {
      onSuccess: () => {
        toast.success('Bovino eliminado', `El bovino ${bovine.earTag} fue eliminado.`);
        navigate('/bovines');
      },
      onError: (err: unknown) => {
        const code = getErrorCode(err);
        if (code === ErrorCodes.BOVINE_HAS_ACTIVE_RECORDS) {
          // Compose a friendly inline message using the centralized helper.
          // getBovineActiveRecords returns the list of blocking record types.
          const records = getBovineActiveRecords(err);
          const msg = records.length
            ? `No se puede eliminar porque tiene ${records.length} registro${records.length !== 1 ? 's' : ''} activo${records.length !== 1 ? 's' : ''}: ${records.join(', ')}.`
            : 'No se puede eliminar porque tiene registros activos. Ciérralos primero.';
          setDeleteBlockMsg(msg);
        } else {
          toast.error('Error al eliminar', getBovineErrorMessage(err));
        }
      },
    });
  }

  function handleMove() {
    if (!moveLocationId) return;
    setMoveError(null);

    // ── Bloqueo legal: período de retiro vigente ────────────────────────
    // Si el bovino tiene medicamentos en withdrawal activo Y el motivo
    // del movimiento implica salida hacia consumo humano (SALE) o salida
    // del rancho (TRANSFER), bloqueamos el submit con un mensaje claro
    // que explica las consecuencias legales.
    //
    // Excepción: si requireSaleAck === true, el operador ya marcó que
    // asume responsabilidad explícita y deshabilitamos el bloqueo
    // (escape hatch para casos especiales: necropsia, decomiso oficial,
    // donación a planta de rendering, etc.). El registro queda en el log
    // con el `notes` del movimiento para auditoría posterior.
    if (
      withdrawalStatus?.hasActiveWithdrawal &&
      (moveReason === MovementReason.SALE || moveReason === MovementReason.TRANSFER) &&
      !requireSaleAck
    ) {
      const isSale = moveReason === MovementReason.SALE;
      setMoveError(
        isSale
          ? `BLOQUEADO: el bovino está en PERÍODO DE RETIRO con ${withdrawalStatus.activeCount} medicamento(s) activo(s). NO puede venderse para consumo humano hasta el ${new Date(withdrawalStatus.finalClearedAt!).toLocaleDateString('es-MX')}. Sus residuos farmacológicos pueden causar decomiso del lote y sanciones SENASICA/COFEPRIS. Marca la confirmación de responsabilidad abajo si aún así necesitas registrar este movimiento (necropsia, decomiso oficial, etc.).`
          : `ADVERTENCIA: el bovino está en período de retiro. Si este TRANSFER es hacia un comprador o subasta, asegúrate de informar al destinatario. Apto para consumo a partir del ${new Date(withdrawalStatus.finalClearedAt!).toLocaleDateString('es-MX')}. Marca la confirmación abajo para continuar.`,
      );
      return;
    }

    // Block submit when the picked GPS is outside the destination's boundary.
    if (moveCoordsOutside) {
      setMoveError(
        'Las nuevas coordenadas GPS están fuera del área del potrero destino. '
        + 'Mueve el pin dentro del área verde-azulada o cambia el potrero.',
      );
      return;
    }

    // Delego en la helper reutilizable para soportar el reintento con
    // `forceOverride: true` desde el modal de confirmacion (F-20).
    performMove(false);
  }

  /**
   * F-20 / F-21: helper unico que dispara el mutate. `force=true` envia
   * `forceOverride: true` para saltar la validacion de capacidad del backend
   * (L-01) — solo se invoca desde el confirm modal tras un 409.
   */
  function performMove(force: boolean) {
    if (!moveLocationId) return;

    moveMutation.mutate(
      {
        id: id!,
        data: {
          locationId: moveLocationId,
          reason: moveReason,
          movementType: moveMovementType,
          enteredAt: new Date().toISOString(),
          notes: moveNotes || undefined,
          forceOverride: force || undefined,
        },
      },
      {
        onSuccess: async (result) => {
          // If the user picked new GPS coordinates, persist them on the bovine
          // record itself so the visual position (mini-map, map view, marker)
          // actually moves. The previous version only updated locationId,
          // leaving the GPS stale and the mini-map "frozen".
          if (moveCoords) {
            try {
              await bovinesApi.update(id!, { location: moveCoords });
              queryClient.invalidateQueries({ queryKey: bovineKeys.full(id!) });
              queryClient.invalidateQueries({ queryKey: bovineKeys.currentLocation(id!) });
            } catch (e: unknown) {
              // Soft-fail: the move itself succeeded; the GPS update is a
              // secondary nice-to-have. Show a non-blocking notice.
              toast.error(
                'Movimiento OK, pero falló al actualizar GPS',
                getBovineErrorMessage(e),
              );
            }
          }

          // F-21 / Backend L-04: usar el flag wasNoOp del envelope (no
          // comparar client-side). El backend hace no-op cuando el destino
          // coincide con la estancia activa actual; el FE antes inferia el
          // caso comparando, pero estaba sujeto a estados stale (H-3).
          if (result.wasNoOp) {
            toast.info(
              'Sin movimiento registrado',
              moveCoords
                ? 'El bovino ya estaba en este potrero. Solo se actualizó su posición GPS.'
                : 'El bovino ya estaba en este potrero. No se registró ningún movimiento.',
            );
          } else if (force) {
            // Caso especial F-20: el movimiento exitoso fue un forceOverride.
            // Toast con warning para que quede claro que se excedio capacidad.
            toast.warning(
              'Bovino movido (capacidad excedida)',
              'El movimiento se registró aunque el potrero está sobre su capacidad máxima. Acción auditada en el backend.',
            );
          } else {
            toast.success('Bovino movido', 'La ubicación fue actualizada correctamente.');
          }

          setShowMoveModal(false);
          setMoveLocationId(null);
          setMoveReason(MovementReason.TRANSFER);
          setMoveMovementType(MovementType.MANUAL);
          setMoveNotes('');
          setMoveCoords(null);
          setMoveError(null);
          setRequireSaleAck(false);
          setForceOverridePrompt(null);
        },
        onError: (err: unknown) => {
          // F-20 / Backend L-01: si el potrero esta lleno, abrir prompt de
          // confirmacion en lugar de mostrar error inline. El usuario decide
          // si reenvia con `forceOverride: true` (uso reservado para casos
          // clinicos / emergencia). El backend audita la accion.
          const code = getErrorCode(err);
          if (code === 'BOVINE_LOCATION_FULL') {
            // Extraer details del error si existen (axios envuelve en .response.data.details).
            const details = (err as { response?: { data?: { details?: { currentOccupancy?: number; maxAnimals?: number } } } })
              ?.response?.data?.details;
            if (canMove && typeof details?.currentOccupancy === 'number' && typeof details?.maxAnimals === 'number') {
              setForceOverridePrompt({
                currentOccupancy: details.currentOccupancy,
                maxAnimals:       details.maxAnimals,
              });
              // No setear moveError — el prompt es modal, no error inline.
              return;
            }
            // Fallback si no hay details o el usuario no puede forzar:
            // mostrar el mensaje del handler centralizado en el alert inline.
          }
          // Centralized handler resolves BOVINE_LOCATION_FULL (with capacity
          // details), RANCH_MISMATCH (with ranch names), and falls back to
          // getFriendlyMessage for everything else.
          setMoveError(getBovineErrorMessage(err));
        },
      },
    );
  }

  /**
   * Open a print-friendly window with a single large QR card for the bovine.
   * The QR is rendered server-side inside the new window using a CDN-served
   * QR generator (api.qrserver.com) — this keeps the implementation simple
   * and avoids serializing React-rendered SVG across windows. The CDN call
   * uses the SAME `qrCode` string already stored on the backend, so the
   * resulting image is scannable and matches the modal.
   */
  function handlePrintQR() {
    if (!bovine.qrCode) {
      toast.error('Sin QR', 'Este bovino no tiene un código QR generado.');
      return;
    }
    const win = window.open('', '_blank', 'width=420,height=560');
    if (!win) {
      toast.error('Pop-ups bloqueados', 'Habilita las ventanas emergentes para imprimir.');
      return;
    }
    const code = encodeURIComponent(bovine.qrCode);
    const earTagSafe = (bovine.earTag || '').replace(/[<>&"']/g, '');
    const nameSafe   = (bovine.name    || '').replace(/[<>&"']/g, '');
    win.document.write(`
      <!doctype html><html><head><meta charset="utf-8" />
      <title>QR ${earTagSafe}</title>
      <style>
        @page { margin: 10mm; }
        body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 24px; text-align: center; width: 320px; }
        .qr   { width: 256px; height: 256px; margin: 0 auto 12px; }
        h1    { font-size: 18px; margin: 0 0 4px; }
        p     { font-size: 13px; color: #6b7280; margin: 2px 0; }
        .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; color: #9ca3af; word-break: break-all; margin-top: 8px; }
      </style></head><body>
        <div class="card">
          <img class="qr" alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${code}" />
          <h1>${earTagSafe}</h1>
          ${nameSafe ? `<p>${nameSafe}</p>` : ''}
          <p class="code">${code}</p>
        </div>
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));<\/script>
      </body></html>
    `);
    win.document.close();
  }

  /**
   * Download the QR as a PNG by rasterizing the qrcode.react CANVAS hidden in
   * the modal. We grab the canvas via DOM, convert to dataURL, and trigger a
   * download. The canvas is added to the modal via `variant="canvas"`.
   */
  function handleDownloadQR() {
    if (!bovine.qrCode) {
      toast.error('Sin QR', 'Este bovino no tiene un código QR generado.');
      return;
    }
    const canvas = document.querySelector<HTMLCanvasElement>('#bovine-qr-download canvas');
    if (!canvas) {
      toast.error('Error', 'No se pudo capturar el QR. Inténtalo de nuevo.');
      return;
    }
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${bovine.earTag || 'bovino'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function copyCoords() {
    const lat = bovine.location?.latitude;
    const lng = bovine.location?.longitude;
    if (lat == null || lng == null) return;
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`).then(() => {
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 1500);
    }).catch(() => toast.error('No se pudo copiar', 'Tu navegador bloqueó el portapapeles'));
  }

  const gradient = getCattleTypeGradient(bovine.cattleType);
  const emoji    = getCattleTypeEmoji(bovine.cattleType);
  const lat = bovine.location?.latitude;
  const lng = bovine.location?.longitude;
  const hasCoords = lat != null && lng != null && !(lat === 0 && lng === 0);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* ── ALERTA LEGAL DE PERÍODO DE RETIRO ────────────────────────────
          Si el bovino tiene medicamentos en withdrawal activo, se muestra
          ANTES del header. Imposible de ignorar (rojo, ancho completo).
          Si no hay retiro, no se renderiza (el chip "Apto" lo agregamos
          junto a los badges del header, no aquí — aquí solo gritamos
          cuando hay riesgo legal real). */}
      <WithdrawalStatusBanner
        status={withdrawalStatus}
        isLoading={isLoadingWithdrawal}
      />

      {/* F-28 / Backend X-03: banner persistente cuando el bovino esta
          fallecido. Toda la accion del detail page sigue visible en modo
          de solo-consulta visual (el backend ya bloquea mutaciones
          imposibles: vacunar, mover, enfermar a un bovino DECEASED). */}
      {full.death && (
        <div className="rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-900 dark:to-gray-950 border border-gray-700 dark:border-gray-800 px-4 py-3 flex items-start gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center shrink-0">
            <Skull className="w-5 h-5 text-gray-200" />
          </div>
          <div className="flex-1 min-w-0 text-gray-100">
            <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              <span>Bovino fallecido</span>
              <span className="text-[11px] font-normal px-1.5 py-0.5 rounded bg-gray-700/70 text-gray-300">
                {full.death.causeLabel}
              </span>
              {full.death.necropsyPerformed && (
                <span className="text-[11px] font-normal px-1.5 py-0.5 rounded bg-emerald-700/40 text-emerald-200">
                  Necropsia realizada
                </span>
              )}
            </p>
            <p className="text-xs text-gray-300 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>
                <Calendar className="inline w-3 h-3 mr-1 -mt-0.5" />
                Fecha de muerte: <strong>{formatDate(full.death.deathDate)}</strong>
              </span>
              {full.death.weightAtDeath != null && (
                <span>
                  <Weight className="inline w-3 h-3 mr-1 -mt-0.5" />
                  {full.death.weightAtDeath} kg
                </span>
              )}
              {full.death.diseaseCaseId && (
                <button
                  type="button"
                  onClick={() => navigate(`/health/cases/${full.death!.diseaseCaseId}`)}
                  className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 hover:underline"
                  title="Ver caso clínico relacionado"
                >
                  Ver caso clínico
                </button>
              )}
            </p>
            {full.death.notes && (
              <p className="text-[11px] text-gray-400 italic mt-1 line-clamp-2">
                "{full.death.notes}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate('/bovines')}
          className="mt-1 shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className={cn(
          'shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl shadow-md',
          gradient,
        )}>
          {emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {bovine.name || bovine.earTag}
            </h1>
            <span className="text-sm text-gray-400 font-mono">[{bovine.earTag}]</span>
            <Badge variant="info">{bovine.cattleTypeLabel}</Badge>
            <Badge variant="default">
              {bovine.gender === 'MALE'
                ? <span className="inline-flex items-center gap-1"><Mars className="w-3 h-3" />{bovine.genderLabel}</span>
                : bovine.gender === 'FEMALE'
                  ? <span className="inline-flex items-center gap-1"><Venus className="w-3 h-3" />{bovine.genderLabel}</span>
                  : bovine.genderLabel}
            </Badge>
            <HealthStatusBadge status={bovine.healthStatus as any} />
            {riskScore && (
              <span
                title={riskScore.factors.map((f) => `${f.factor}: +${f.points}`).join('\n')}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-help',
                  riskScore.level === 'LOW'      && 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
                  riskScore.level === 'MEDIUM'   && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                  riskScore.level === 'HIGH'     && 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
                  riskScore.level === 'CRITICAL' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                )}
              >
                <ShieldCheck className="w-3 h-3" />
                Riesgo: {riskScore.riskScore}/100
              </span>
            )}
            {/* F-12: el badge de vacunacion lee del bloque dedicado
                `vaccinationStatus` (derivado, con statusLabel embebido),
                NO de `profile.vaccinationStatus` que es la columna legacy
                de la tabla bovines y puede estar desactualizada. */}
            <Badge variant={getVaccinationStatusVariant(vacStatus.status)}>
              <span className="inline-flex items-center gap-1">
                <Syringe className="w-3 h-3" />
                {vacStatus.statusLabel || getVaccinationStatusLabel(vacStatus.status)}
              </span>
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
            <span><Calendar className="inline w-3 h-3 mr-1" />{bovine.ageDisplay}</span>
            <span><Beef className="inline w-3 h-3 mr-1" />{bovine.breed}</span>
            {bovine.weight != null && <span><Weight className="inline w-3 h-3 mr-1" />{bovine.weight} kg</span>}
            {bovine.ranch && <span><Hash className="inline w-3 h-3 mr-1" />{bovine.ranch.name}</span>}
            {bovine.isPregnant && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400">
                <Activity className="w-3 h-3" /> Gestante
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
          {/* Botón de QR: VISIBLE para cualquier usuario autenticado.
              La rotación del código (regenerar) está protegida adicionalmente
              dentro del modal por `canRegenQR`. Antes este botón se ocultaba
              a roles como WORKER/VET/VIEWER, que sí necesitan VERLO en campo. */}
          {canViewQR && (
            <Button size="sm" variant="outline" icon={<QrCode className="w-3.5 h-3.5" />} onClick={() => setShowQrModal(true)}>
              QR
            </Button>
          )}
          {/* F-24 / Backend C-04: "Marcar enfermo" solo se ofrece para
              bovinos sanos/desconocidos. Si el bovino ya esta en SICK,
              RECOVERING o QUARANTINE, gestionar el caso desde el modulo
              Salud (donde estan los flujos de cierre/tratamiento). El
              boton se gatea con el mismo permiso que editar (canEdit). */}
          {canEdit && (bovine.healthStatus === 'HEALTHY' || bovine.healthStatus === 'UNKNOWN') && (
            <Button
              size="sm"
              variant="outline"
              icon={<Activity className="w-3.5 h-3.5" />}
              onClick={() => {
                setShowMarkSickModal(true);
                setMarkSickData(null);
                setMarkSickErrors({});
                markSickMutation.reset();
              }}
              title="Abrir caso clínico inicial para este bovino"
            >
              Marcar enfermo
            </Button>
          )}
          {canMove && (
            <Button size="sm" variant="outline" icon={<MoveRight className="w-3.5 h-3.5" />} onClick={() => setShowMoveModal(true)}>
              Mover
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" icon={<Edit className="w-3.5 h-3.5" />} onClick={() => navigate(`/bovines/${id}/edit`)}>
              Editar
            </Button>
          )}
          {/* F-25 / Backend X-03: "Registrar muerte" gated por MANAGE_BOVINE
              (canEdit). Solo visible si el bovino NO esta ya fallecido —
              el backend devuelve 409 ALREADY_DECEASED si se intentara. */}
          {canEdit && !full.death && bovine.healthStatus !== 'DECEASED' && (
            <Button
              size="sm"
              variant="outline"
              icon={<Skull className="w-3.5 h-3.5" />}
              onClick={() => setShowDeathModal(true)}
              title="Registrar la muerte / baja del bovino"
            >
              Registrar muerte
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => { setDeleteBlockMsg(null); setShowDeleteModal(true); }}>
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* ── 2×2 grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top-Left: current location map */}
        <Card noPadding className="overflow-hidden aspect-square lg:aspect-auto lg:h-[420px]">
          <CurrentLocationMap full={full} />
        </Card>

        {/* Top-Right: core info */}
        <Card className="lg:h-[420px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Info className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            </div>
            <CardTitle>Información del bovino</CardTitle>
          </div>
          <div>
            <InfoRow label="Arete">{bovine.earTag}</InfoRow>
            {bovine.name && <InfoRow label="Nombre">{bovine.name}</InfoRow>}
            <InfoRow label="Tipo">{bovine.cattleTypeLabel}</InfoRow>
            {/* Clasificacion derivada (Backend B-05): label gendered ("Vaca",
                "Becerra", "Novillo"...). Solo se muestra cuando el backend
                la calculo (bovinos serializados post-B-05); para los demas
                la fila "Tipo" sigue siendo el dato canonico. */}
            {bovine.classificationLabel && (
              <InfoRow label="Clasificación">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span>{bovine.classificationLabel}</span>
                  {bovine.isReproductiveAge && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      title="Edad reproductiva alcanzada"
                    >
                      Edad reproductiva
                    </span>
                  )}
                </span>
              </InfoRow>
            )}
            <InfoRow label="Raza">{bovine.breed}</InfoRow>
            <InfoRow label="Sexo">{bovine.genderLabel}</InfoRow>
            {/* F-17 / Backend G-05: genealogia. `profile.mother` y `profile.father`
                vienen siempre en /full cuando estan asignados (mini-objetos con
                id+earTag+name+gender+breed). Solo renderizar la fila cuando hay
                referencia; sin valor no se muestra placeholder para no saturar
                el card. Click navega al detalle del padre. */}
            {bovine.mother && (
              <InfoRow label="Madre">
                <button
                  type="button"
                  onClick={() => navigate(`/bovines/${bovine.mother!.id}`)}
                  className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1.5"
                  title={`Ver detalle de ${bovine.mother.name || bovine.mother.earTag}`}
                >
                  <Venus className="w-3 h-3" />
                  <span className="font-mono">{bovine.mother.earTag}</span>
                  {bovine.mother.name && (
                    <span className="text-gray-500 dark:text-gray-400">· {bovine.mother.name}</span>
                  )}
                  {bovine.mother.breed && (
                    <span className="text-xs text-gray-400 ml-1">({bovine.mother.breed})</span>
                  )}
                </button>
              </InfoRow>
            )}
            {bovine.father && (
              <InfoRow label="Padre">
                <button
                  type="button"
                  onClick={() => navigate(`/bovines/${bovine.father!.id}`)}
                  className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1.5"
                  title={`Ver detalle de ${bovine.father.name || bovine.father.earTag}`}
                >
                  <Mars className="w-3 h-3" />
                  <span className="font-mono">{bovine.father.earTag}</span>
                  {bovine.father.name && (
                    <span className="text-gray-500 dark:text-gray-400">· {bovine.father.name}</span>
                  )}
                  {bovine.father.breed && (
                    <span className="text-xs text-gray-400 ml-1">({bovine.father.breed})</span>
                  )}
                </button>
              </InfoRow>
            )}
            <InfoRow label="Nacimiento">
              {bovine.birthDate ? formatDate(bovine.birthDate) : '—'} · {bovine.ageDisplay}
              {bovine.isAdult && <Badge variant="default" className="ml-2">Adulto</Badge>}
            </InfoRow>
            {bovine.weight != null && <InfoRow label="Peso">{bovine.weight} kg</InfoRow>}
            {bovine.ranch && (
              <InfoRow label="Rancho">
                <button
                  type="button"
                  onClick={() => bovine.ranchId && navigate(`/ranch/${bovine.ranchId}`)}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {bovine.ranch.name}
                </button>
              </InfoRow>
            )}
            {bovine.daysInOperation != null && (
              <InfoRow label="Días en operación">{bovine.daysInOperation} días</InfoRow>
            )}
            {bovine.isPregnant && bovine.expectedCalvingDate && (
              <InfoRow label="Parto esperado">{formatDate(bovine.expectedCalvingDate)}</InfoRow>
            )}
            {bovine.notes && <InfoRow label="Notas">{bovine.notes}</InfoRow>}
            <InfoRow label="Activo">
              {bovine.isActive
                ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Sí</span>
                : <span className="inline-flex items-center gap-1 text-gray-400"><XCircle className="w-3.5 h-3.5" />No</span>}
            </InfoRow>
          </div>
        </Card>

        {/* Bottom-Left: current location card + GPS */}
        <Card className="lg:h-[280px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <CardTitle>Ubicación actual</CardTitle>
          </div>
          <div className="space-y-2">
            {/* Status pill */}
            <div className="flex items-center gap-2">
              {currentLoc.status === 'IN_LOCATION' && (
                <Badge variant="success">
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />En potrero</span>
                </Badge>
              )}
              {currentLoc.status === 'GPS_ONLY' && (
                <Badge variant="info">
                  <span className="inline-flex items-center gap-1"><Wifi className="w-3 h-3" />GPS activo</span>
                </Badge>
              )}
              {currentLoc.status === 'GPS_STALE' && (
                <Badge variant="warning">
                  <span className="inline-flex items-center gap-1"><WifiOff className="w-3 h-3" />GPS desactualizado</span>
                </Badge>
              )}
              {currentLoc.status === 'UNKNOWN' && (
                <Badge variant="default">
                  <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Desconocida</span>
                </Badge>
              )}
            </div>

            {/* In-location details */}
            {currentLoc.location && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{currentLoc.location.name}</p>
                <p className="text-xs text-gray-500">
                  {currentLoc.location.type} ·
                  {' '}<Clock className="inline w-3 h-3 mr-0.5" />
                  Desde {formatDate(currentLoc.location.enteredAt)}
                  {currentLoc.location.timeSpentMinutes > 0 && (
                    <> · {Math.floor(currentLoc.location.timeSpentMinutes / 60)}h en este potrero</>
                  )}
                </p>
                {currentLoc.location.reason && (
                  <p className="text-xs text-gray-400 italic">"{currentLoc.location.reason}"</p>
                )}
              </div>
            )}

            {/* GPS point */}
            {currentLoc.gpsPoint && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500">Posición GPS</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white">
                  {currentLoc.gpsPoint.latitude.toFixed(5)}, {currentLoc.gpsPoint.longitude.toFixed(5)}
                </p>
                <p className="text-xs text-gray-400">
                  {currentLoc.gpsPoint.source} · {formatDate(currentLoc.gpsPoint.recordedAt)}
                  {currentLoc.gpsPoint.batteryLevel != null && ` · 🔋 ${currentLoc.gpsPoint.batteryLevel}%`}
                </p>
              </div>
            )}

            {/* Static coords fallback */}
            {!currentLoc.location && !currentLoc.gpsPoint && hasCoords && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500">Coordenadas registradas</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white">
                  {lat!.toFixed(6)}, {lng!.toFixed(6)}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={copyCoords}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
                      copiedCoords
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
                    )}
                  >
                    {copiedCoords ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCoords ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-sky-100 text-sky-700 hover:bg-sky-200"
                  >
                    <ExternalLink className="w-3 h-3" /> Maps
                  </a>
                </div>
              </div>
            )}

            {currentLoc.lastSeenAt && (
              <p className="text-xs text-gray-400">
                Último avistamiento: {formatDate(currentLoc.lastSeenAt)}
              </p>
            )}
          </div>
        </Card>

        {/* Bottom-Right: vaccination summary */}
        <Card className="lg:h-[280px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <Syringe className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle>Vacunación</CardTitle>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant={getVaccinationStatusVariant(vacStatus.status)}>
                <span className="inline-flex items-center gap-1 text-sm font-semibold">
                  {vacStatus.status === 'UP_TO_DATE'
                    ? <ShieldCheck className="w-3.5 h-3.5" />
                    : <Syringe className="w-3.5 h-3.5" />}
                  {vacStatus.statusLabel || getVaccinationStatusLabel(vacStatus.status)}
                </span>
              </Badge>
              <div className="text-xs text-gray-500">
                <strong className="text-gray-700 dark:text-gray-300">{vacStatus.totalApplied}</strong> aplicadas
                {vacStatus.overdueCount > 0 && (
                  <span className="ml-2 text-red-600 font-semibold">{vacStatus.overdueCount} atrasada{vacStatus.overdueCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            {vacStatus.lastVaccinationAt && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Última aplicación</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {vacStatus.lastVaccineType ?? '—'}
                  <span className="text-xs text-gray-400 ml-1.5">{formatDate(vacStatus.lastVaccinationAt)}</span>
                </p>
              </div>
            )}

            {vacStatus.nextDueAt && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 p-2.5">
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-0.5">Próxima dosis</p>
                <p className="text-sm text-amber-900 dark:text-amber-300 font-semibold">
                  {formatDate(vacStatus.nextDueAt)}
                </p>
              </div>
            )}

            {full.recentVaccinations && full.recentVaccinations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Últimas vacunas</p>
                <div className="space-y-1">
                  {full.recentVaccinations.slice(0, 3).map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-gray-50 dark:bg-gray-800/60">
                      <span className="text-gray-900 dark:text-white truncate">
                        {v.vaccineType}
                        {v.vaccineName && <span className="text-gray-400 ml-1">({v.vaccineName})</span>}
                      </span>
                      <span className="text-gray-400 ml-2 shrink-0">{formatDate(v.applicationDate)}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('vaccinations')}
                  className="mt-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Ver historial completo →
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Tabs (lazy) ─────────────────────────────────────────────────── */}
      <div className="pt-4">
        <div className="flex overflow-x-auto gap-1 border-b border-gray-200 dark:border-gray-800 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="pt-4 pb-10">
          {/* Info tab — extra panels (genealogy, recent health, recent movements) */}
          {activeTab === 'info' && (
            <InfoTabContent full={full} onNavigate={(bid) => navigate(`/bovines/${bid}`)} />
          )}
          {activeTab === 'health' && <BovineHealthTab bovineId={id!} />}
          {activeTab === 'treatments' && <BovineTreatmentsTab bovineId={id!} />}
          {activeTab === 'vaccinations' && (
            <BovineVaccinationsTab bovineId={id!} vaccinationStatus={vacStatus.status} />
          )}
          {activeTab === 'location_history' && <BovineLocationHistoryTab bovineId={id!} />}
          {activeTab === 'media' && <MediaGallery entityType="bovine" entityId={id!} />}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {/* QR display — renders a REAL scannable QR (qrcode.react) plus actions
          to print and download. Regenerate stays gated by REGENERATE_QR. */}
      <Modal open={showQrModal} onClose={() => setShowQrModal(false)} title="Código QR del bovino" size="sm">
        <div className="flex flex-col items-center gap-4 py-4">
          {/* SVG variant — crisp at any zoom + clean print */}
          <BovineQR
            value={bovine.qrCode}
            earTag={bovine.earTag}
            size={208}
            variant="svg"
          />

          {/* Hidden canvas variant used only as the source for downloadPNG. */}
          <div id="bovine-qr-download" style={{ position: 'absolute', left: -9999, top: -9999 }}>
            <BovineQR value={bovine.qrCode} size={512} variant="canvas" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={handlePrintQR}
              disabled={!bovine.qrCode}
            >
              Imprimir
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleDownloadQR}
              disabled={!bovine.qrCode}
            >
              Descargar PNG
            </Button>
            {canRegenQR && (
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                loading={regenerateQrMutation.isPending}
                onClick={() => regenerateQrMutation.mutate()}
              >
                Regenerar QR
              </Button>
            )}
          </div>

          {!canRegenQR && bovine.qrCode && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
              Para regenerar el código QR se requieren permisos de gestión del rancho.
            </p>
          )}
        </div>
      </Modal>

      {/* Move location */}
      <Modal
        open={showMoveModal}
        onClose={() => { setShowMoveModal(false); setMoveError(null); setRequireSaleAck(false); }}
        title="Mover bovino a otro potrero"
        size="lg"
      >
        <div className="space-y-4">
          <LocationSelector
            label="Potrero destino"
            value={moveLocationId}
            onChange={(id) => {
              setMoveLocationId(id);
              // If the user changes the destination after picking coords, clear
              // them — the previous pin is meaningless for the new potrero.
              setMoveCoords(null);
            }}
            ranchId={bovine.ranchId}
            placeholder="Selecciona el potrero..."
            // F-13 / Backend M-01: deshabilitar visualmente el potrero donde
            // el bovino ya esta. El backend tambien hace no-op si lo intentan
            // bypass-ear; aqui solo mejoramos UX para que el caso ni se
            // presente.
            disabledIds={currentLoc.location?.id ? [currentLoc.location.id] : undefined}
            disabledHint="Ubicación actual"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* MovementReason — strictly the 8 backend values. Note we omit
                CREATION here because it is reserved for the initial registry
                (creating a bovine), not ad-hoc moves on an existing one. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Razón del movimiento
              </label>
              <select
                value={moveReason}
                onChange={(e) => {
                  setMoveReason(e.target.value as MovementReason);
                  // Reset del ack al cambiar reason — si pasan de SALE a
                  // MEDICAL y vuelven, no queremos que el checkbox quede
                  // "encendido" sin contexto. Forzamos re-consentimiento.
                  setRequireSaleAck(false);
                  setMoveError(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              >
                <option value={MovementReason.TRANSFER}>Traslado</option>
                <option value={MovementReason.GRAZING}>Pastoreo</option>
                <option value={MovementReason.MEDICAL}>Atención médica</option>
                <option value={MovementReason.QUARANTINE}>Cuarentena</option>
                <option value={MovementReason.BREEDING}>Reproducción</option>
                <option value={MovementReason.SALE}>Venta</option>
                <option value={MovementReason.OTHER}>Otro</option>
              </select>
            </div>

            {/* MovementType — exactly the 3 backend values. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de movimiento
              </label>
              <select
                value={moveMovementType}
                onChange={(e) => setMoveMovementType(e.target.value as MovementType)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              >
                <option value={MovementType.MANUAL}>Manual</option>
                <option value={MovementType.AUTOMATED}>Automatizado</option>
                <option value={MovementType.SCHEDULED}>Programado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={moveNotes}
              onChange={(e) => setMoveNotes(e.target.value)}
              placeholder="Comentario adicional sobre el movimiento..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm resize-none"
            />
          </div>

          {/* ── BLOQUEO LEGAL POR PERÍODO DE RETIRO ─────────────────────────
              Aparece SOLO si el bovino tiene retiro activo Y el reason es
              SALE o TRANSFER. Explica las consecuencias legales y ofrece
              al operador un escape hatch explícito ("acuso recibo y asumo
              responsabilidad") para casos legítimos como necropsia o
              decomiso oficial. La marca queda registrada en `moveNotes`
              para auditoría sanitaria posterior. */}
          {withdrawalStatus?.hasActiveWithdrawal &&
            (moveReason === MovementReason.SALE || moveReason === MovementReason.TRANSFER) && (
              <div className="rounded-lg border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                      {moveReason === MovementReason.SALE
                        ? 'No se puede vender este bovino: período de retiro activo'
                        : 'Movimiento delicado: bovino en período de retiro'}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Apto para consumo humano a partir del{' '}
                      <strong className="whitespace-nowrap">
                        {new Date(withdrawalStatus.finalClearedAt!).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </strong>
                      . Hay {withdrawalStatus.activeCount}{' '}
                      medicamento(s) con residuos activos en el animal —
                      enviar a matadero, subasta o procesadora ahora puede
                      causar decomiso del lote y sanciones SENASICA/COFEPRIS.
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-2 pt-2 border-t border-red-200/60 dark:border-red-800/40 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded text-red-600 focus:ring-red-500"
                    checked={requireSaleAck}
                    onChange={(e) => setRequireSaleAck(e.target.checked)}
                  />
                  <span className="text-xs text-red-800 dark:text-red-200">
                    <strong>Acuso recibo y asumo la responsabilidad legal.</strong>{' '}
                    Confirmo que conozco el período de retiro activo del animal y
                    que este movimiento corresponde a un caso especial (necropsia,
                    decomiso oficial, donación a rendering, traslado interno, etc.).
                    Anota el motivo en las notas arriba para auditoría.
                  </span>
                </label>
              </div>
            )}

          {/* GPS picker — lets the user update the bovine's coordinates
              alongside the potrero change. Without this, the visual position
              on the mini-map / map view does NOT move and stays stale. The
              destination potrero's geofence is overlaid so the user can drop
              the pin inside it. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nueva ubicación GPS{' '}
              <span className="text-gray-400 font-normal">
                (opcional — déjala como está si no necesitas mover el pin)
              </span>
            </label>
            <MapPicker
              value={moveCoords}
              onChange={(c) => setMoveCoords(c)}
              className="h-[260px]"
              locationBoundary={
                (moveTargetLocation?.geofenceConfig as BoundaryShape | undefined) ?? null
              }
              locationName={moveTargetLocation?.name}
            />
          </div>

          {moveError && <Alert variant="error">{moveError}</Alert>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowMoveModal(false); setMoveError(null); setRequireSaleAck(false); }}>
              Cancelar
            </Button>
            <Button
              icon={<MoveRight className="w-4 h-4" />}
              disabled={
                !moveLocationId
                || moveMutation.isPending
                || moveCoordsOutside
                // Deshabilita Confirmar mientras haya bloqueo legal sin
                // acknowledgement. El bovino en retiro NO se puede mover
                // a SALE/TRANSFER sin que el operador marque el checkbox
                // de responsabilidad.
                || (
                  withdrawalStatus?.hasActiveWithdrawal === true
                  && (moveReason === MovementReason.SALE || moveReason === MovementReason.TRANSFER)
                  && !requireSaleAck
                )
              }
              loading={moveMutation.isPending}
              onClick={handleMove}
              title={moveCoordsOutside
                ? 'Las coordenadas GPS están fuera del potrero destino'
                : undefined}
            >
              Confirmar movimiento
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar bovino" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700 dark:text-red-400">
              <p className="font-medium">Esta acción no se puede deshacer.</p>
              <p className="mt-0.5">
                Se eliminará <strong>{bovine.name || bovine.earTag}</strong> permanentemente.
              </p>
            </div>
          </div>
          {deleteBlockMsg && <Alert variant="error">{deleteBlockMsg}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleteMutation.isPending}
              disabled={!!deleteBlockMsg}
              onClick={handleDelete}
            >
              Sí, eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* F-25 / F-26 / Backend X-03: modal de registro de muerte. Tiene su
          propio toast + manejo de errores; aqui solo lo orquestamos con el
          estado local del detail page. */}
      <DeathRegistrationModal
        open={showDeathModal}
        onClose={() => setShowDeathModal(false)}
        bovineId={id!}
        bovineEarTag={bovine.earTag}
        bovineName={bovine.name}
        ranchId={bovine.ranchId}
        // Si hay un caso activo y la causa elegida es DISEASE, el modal lo
        // preseleccionara automaticamente (el form envia diseaseCaseId).
        activeCaseId={(full.bovine as { healthSnapshot?: { activeCaseId?: string | null } }).healthSnapshot?.activeCaseId ?? null}
        currentLocationId={currentLoc.location?.id ?? null}
      />

      {/* F-24 / Backend C-04: modal "Marcar enfermo". Reusa
          ClinicalDataForm (el mismo que el wizard de alta usa en F-22)
          para mantener UX consistente y un solo lugar de validacion. */}
      <Modal
        open={showMarkSickModal}
        onClose={() => {
          if (markSickMutation.isPending) return; // evitar cerrar durante request
          setShowMarkSickModal(false);
          setMarkSickData(null);
          setMarkSickErrors({});
          markSickMutation.reset();
        }}
        title={`Marcar como enfermo a ${bovine.name || bovine.earTag}`}
        size="lg"
      >
        <div className="space-y-4">
          <Alert variant="warning">
            <p className="font-medium">Se abrirá un caso clínico inicial.</p>
            <p className="mt-1 text-xs">
              El estado de salud del bovino y su snapshot serán actualizados
              automáticamente. El cierre del caso (recuperación / fallecimiento)
              se gestiona desde el módulo Salud.
            </p>
          </Alert>

          <ClinicalDataForm
            value={markSickData}
            onChange={(v) => {
              setMarkSickData(v);
              setMarkSickErrors({});
            }}
            errors={markSickErrors}
            compact
            title="Datos clínicos iniciales"
            subtitle="Captura la enfermedad y severidad; los síntomas son opcionales."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={markSickMutation.isPending}
              onClick={() => {
                setShowMarkSickModal(false);
                setMarkSickData(null);
                setMarkSickErrors({});
                markSickMutation.reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Activity className="w-4 h-4" />}
              loading={markSickMutation.isPending}
              onClick={handleMarkSick}
            >
              Abrir caso clínico
            </Button>
          </div>
        </div>
      </Modal>

      {/* F-20 / Backend L-01: confirm modal de forceOverride cuando el
          potrero destino esta lleno. Solo se abre tras un 409, y solo si
          el usuario tiene permiso para mover (canMove). El backend audita
          cualquier forceOverride aceptado. */}
      <Modal
        open={!!forceOverridePrompt}
        onClose={() => setForceOverridePrompt(null)}
        title="Potrero al máximo de capacidad"
        size="sm"
      >
        {forceOverridePrompt && (
          <div className="space-y-4">
            <Alert variant="warning">
              <p className="font-medium">
                El potrero destino está al {Math.round((forceOverridePrompt.currentOccupancy / Math.max(forceOverridePrompt.maxAnimals, 1)) * 100)}% de su capacidad.
              </p>
              <p className="mt-1 text-xs">
                Ocupación actual: <strong>{forceOverridePrompt.currentOccupancy}</strong> de <strong>{forceOverridePrompt.maxAnimals}</strong> bovinos.
              </p>
            </Alert>

            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p>
                Si forzas el movimiento, el bovino se asignará al potrero aunque
                exceda el límite recomendado. Usa esta opción solo para casos
                excepcionales:
              </p>
              <ul className="list-disc list-inside text-xs text-gray-500 dark:text-gray-400 ml-2 space-y-0.5">
                <li>Cuarentena clínica urgente</li>
                <li>Parto inminente sin alternativa</li>
                <li>Decomiso oficial / emergencia sanitaria</li>
                <li>Reagrupación temporal previa a traslado</li>
              </ul>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                La acción quedará registrada en la auditoría del backend.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setForceOverridePrompt(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={moveMutation.isPending}
                onClick={() => performMove(true)}
              >
                Forzar movimiento
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Info Tab content (genealogy + recent activity) ──────────────────────────

function InfoTabContent({
  full,
  onNavigate,
}: {
  full: BovineFullResponse;
  onNavigate: (bovineId: string) => void;
}) {
  // Backend D-01: leemos del bloque `profile` (labels normalizados +
  // clasificacion + flags derivados). Alias local `bovine` por compat con
  // el JSX existente.
  const { profile: bovine, recentHealthRecords, recentMovements } = full;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Genealogy */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Dna className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle>Genealogía</CardTitle>
        </div>
        <div className="space-y-2">
          {bovine.mother ? (
            <button
              type="button"
              onClick={() => onNavigate(bovine.mother!.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 text-left"
            >
              <Venus className="w-4 h-4 text-pink-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Madre</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {bovine.mother.name || bovine.mother.earTag}
                </p>
              </div>
            </button>
          ) : (
            <p className="text-sm text-gray-400 px-2">Sin madre registrada</p>
          )}
          {bovine.father ? (
            <button
              type="button"
              onClick={() => onNavigate(bovine.father!.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 text-left"
            >
              <Mars className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Padre</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {bovine.father.name || bovine.father.earTag}
                </p>
              </div>
            </button>
          ) : (
            <p className="text-sm text-gray-400 px-2">Sin padre registrado</p>
          )}
        </div>
      </Card>

      {/* Recent health records */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
            <HeartPulse className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          </div>
          <CardTitle>Salud reciente</CardTitle>
        </div>
        {recentHealthRecords.length === 0 ? (
          <p className="text-sm text-gray-400">Sin registros recientes</p>
        ) : (
          <div className="space-y-2">
            {recentHealthRecords.slice(0, 5).map((r) => (
              <div key={r.id} className="text-xs p-2 rounded bg-gray-50 dark:bg-gray-800/60">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{r.recordType}</span>
                  <span className="text-gray-400">{formatDate(r.recordDate)}</span>
                </div>
                {r.diagnosisSummary && (
                  <p className="text-gray-500 mt-0.5 italic">{r.diagnosisSummary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent movements */}
      <Card className="lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle>Movimientos recientes</CardTitle>
        </div>
        {recentMovements.length === 0 ? (
          <p className="text-sm text-gray-400">Sin movimientos recientes</p>
        ) : (
          <div className="space-y-1">
            {recentMovements.slice(0, 5).map((m) => (
              <div key={m.historyId} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">
                  Entrada · {formatDate(m.enteredAt)}
                  {m.exitedAt && ` → Salida · ${formatDate(m.exitedAt)}`}
                </span>
                {m.reason && <span className="text-gray-400">{m.reason}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
