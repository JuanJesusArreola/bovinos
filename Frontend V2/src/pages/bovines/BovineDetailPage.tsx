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
  useRegenerateBovineQr, bovineKeys,
} from '@/hooks/useBovines';
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
  ArrowLeft, Edit, QrCode, HeartPulse, MapPin, Beef,
  Mars, Venus, Calendar, Weight, Hash, Pill, Image as ImageIcon,
  Syringe, Info, Trash2, MoveRight, RefreshCw, AlertTriangle,
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

const VAC_STATUS_VARIANT: Record<VaccinationStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  UP_TO_DATE: 'success',
  PENDING:    'warning',
  OVERDUE:    'danger',
  NONE:       'default',
};

const VAC_STATUS_LABEL: Record<VaccinationStatus, string> = {
  UP_TO_DATE: 'Al día',
  PENDING:    'Pendiente',
  OVERDUE:    'Atrasada',
  NONE:       'Sin vacunas',
};

// ─── Avatar gradient by cattle type ─────────────────────────────────────────

const TYPE_GRADIENT: Record<string, string> = {
  CATTLE: 'from-amber-400 to-orange-500',
  BULL:   'from-rose-500 to-red-700',
  COW:    'from-pink-400 to-rose-600',
  CALF:   'from-emerald-300 to-teal-500',
};

const TYPE_EMOJI: Record<string, string> = {
  CATTLE: '🐄', BULL: '🐂', COW: '🐄', CALF: '🐮',
};

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
    if (full.bovine.location?.latitude && full.bovine.location?.longitude) {
      return {
        lat: full.bovine.location.latitude,
        lng: full.bovine.location.longitude,
        source: 'STATIC' as const,
      };
    }
    return null;
  }, [cl.gpsPoint, full.bovine.location]);

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
            <p className="font-semibold mb-0.5">{full.bovine.earTag}</p>
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
  const [deleteBlockMsg, setDeleteBlockMsg] = useState<string | null>(null);

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

  const bovine = full.bovine;
  const currentLoc = full.currentLocation;
  const vacStatus  = full.vaccinationStatus;

  // ── Handlers ─────────────────────────────────────────────────────────────
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

    // Block submit when the picked GPS is outside the destination's boundary.
    if (moveCoordsOutside) {
      setMoveError(
        'Las nuevas coordenadas GPS están fuera del área del potrero destino. '
        + 'Mueve el pin dentro del área verde-azulada o cambia el potrero.',
      );
      return;
    }

    moveMutation.mutate(
      {
        id: id!,
        data: {
          locationId: moveLocationId,
          reason: moveReason,
          movementType: moveMovementType,
          enteredAt: new Date().toISOString(),
          notes: moveNotes || undefined,
        },
      },
      {
        onSuccess: async () => {
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

          toast.success('Bovino movido', 'La ubicación fue actualizada correctamente.');
          setShowMoveModal(false);
          setMoveLocationId(null);
          setMoveReason(MovementReason.TRANSFER);
          setMoveMovementType(MovementType.MANUAL);
          setMoveNotes('');
          setMoveCoords(null);
          setMoveError(null);
        },
        onError: (err: unknown) => {
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

  const gradient = TYPE_GRADIENT[bovine.cattleType] ?? 'from-gray-400 to-gray-600';
  const emoji    = TYPE_EMOJI[bovine.cattleType] ?? '🐄';
  const lat = bovine.location?.latitude;
  const lng = bovine.location?.longitude;
  const hasCoords = lat != null && lng != null && !(lat === 0 && lng === 0);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
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
            <Badge variant={VAC_STATUS_VARIANT[bovine.vaccinationStatus]}>
              <span className="inline-flex items-center gap-1">
                <Syringe className="w-3 h-3" />
                {VAC_STATUS_LABEL[bovine.vaccinationStatus]}
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
            <InfoRow label="Raza">{bovine.breed}</InfoRow>
            <InfoRow label="Sexo">{bovine.genderLabel}</InfoRow>
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
              <Badge variant={VAC_STATUS_VARIANT[vacStatus.status]}>
                <span className="inline-flex items-center gap-1 text-sm font-semibold">
                  {vacStatus.status === 'UP_TO_DATE'
                    ? <ShieldCheck className="w-3.5 h-3.5" />
                    : <Syringe className="w-3.5 h-3.5" />}
                  {VAC_STATUS_LABEL[vacStatus.status]}
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
            <BovineVaccinationsTab bovineId={id!} vaccinationStatus={bovine.vaccinationStatus} />
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
        onClose={() => { setShowMoveModal(false); setMoveError(null); }}
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
                onChange={(e) => setMoveReason(e.target.value as MovementReason)}
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
            <Button variant="outline" onClick={() => { setShowMoveModal(false); setMoveError(null); }}>
              Cancelar
            </Button>
            <Button
              icon={<MoveRight className="w-4 h-4" />}
              disabled={!moveLocationId || moveMutation.isPending || moveCoordsOutside}
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
  const { bovine, recentHealthRecords, recentMovements } = full;

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
