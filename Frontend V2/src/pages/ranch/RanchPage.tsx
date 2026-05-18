import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { ranchApi } from '@/api/ranch.api';
import {
  RanchType,
  RanchStatus,
  LandTenure,
  ClimateZone,
  MediaType,
  MediaCategory,
} from '@/types/ranch.types';
import type { Ranch, RanchFormData, RanchMedia } from '@/types';
import type { GeofenceConfig } from '@/types/location.types';
import { getBoundaryConflictDetails } from '@/utils/errorHandler';
import type { BoundaryConflictDetails } from '@/utils/errorHandler';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { Alert } from '@/components/ui/Alert';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import { MapPicker, defaultIcon } from '@/components/maps/MapPicker';
import type { Coordinates } from '@/components/maps/MapPicker';
import { reverseGeocode, timezoneForMxState } from '@/utils/geocoding';
import type { ReverseGeocodeResult } from '@/utils/geocoding';
import { GeofenceDrawer } from '@/components/maps/GeofenceDrawer';
import { MediaGallery } from '@/components/media/MediaGallery';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Home, Plus, Edit2, Trash2, MapPin, Users, BarChart3,
  Mountain, Ruler, ImageIcon, Eye, Upload, FileText, Image,
  X, Download, Calendar, Globe, Thermometer, Droplets,
  ArrowLeft, Tag, Info, Sparkles, Loader2,
} from 'lucide-react';

// ─── FieldHint (small reusable info icon with hover tooltip) ───────────────

function FieldHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 rounded-full text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 cursor-help align-middle"
      aria-label={text}
    >
      <Info className="w-3.5 h-3.5" />
    </span>
  );
}

// ─── AutoFillField wrapper (Phase 8) ───────────────────────────────────────
// Renders a label with an optional ✨ icon + tooltip when the field is
// currently auto-filled. The icon disappears as soon as the user edits
// the field (the snapshot diverges from the current value).

function AutoFillField({
  label,
  autoFilled,
  children,
}: {
  label: string;
  autoFilled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {autoFilled && (
          <span
            title="Autocompletado desde la ubicación del pin. Edítalo si necesitas cambiarlo."
            className="inline-flex items-center justify-center w-3.5 h-3.5 ml-0.5 text-sky-500 dark:text-sky-400 align-middle"
            aria-label="Autocompletado desde la ubicación del pin"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Zod schema matching backend ranch.validators.ts ───────────────────────

const ranchSchema = z.object({
  ranchCode: z.string().min(3, 'Mínimo 3 caracteres').max(50, 'Máximo 50 caracteres')
    .regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones').transform((v) => v.toUpperCase()),
  name: z.string().min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  description: z.string().max(1000, 'Máximo 1000 caracteres').optional().or(z.literal('')),
  type: z.nativeEnum(RanchType, { error: 'Selecciona un tipo' }),
  status: z.nativeEnum(RanchStatus, { error: 'Selecciona un estado' }),
  address: z.string().min(5, 'Mínimo 5 caracteres').max(500, 'Máximo 500 caracteres'),
  city: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  state: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  country: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  postalCode: z.string().regex(/^[0-9A-Za-z-]{4,10}$/, 'Código postal inválido').optional().or(z.literal('')),
  timezone: z.string().min(1, 'Requerido').regex(/^[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$|^UTC$/, 'Formato IANA inválido'),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).refine((c) => !(c.latitude === 0 && c.longitude === 0), { message: 'Las coordenadas (0, 0) no son válidas' }),
  landTenure: z.nativeEnum(LandTenure, { error: 'Selecciona tipo de tenencia' }),
  climateZone: z.nativeEnum(ClimateZone, { error: 'Selecciona zona climática' }),
  elevation: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(-100).max(6000).optional()),
  annualRainfall: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(0).max(12000).optional()),
  averageTemperature: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(-20).max(50).optional()),
  boundaryRadius: z.preprocess((v) => (v === "" || v == null) ? undefined : v, z.coerce.number().min(0.5, 'Mínimo 0.5 km').max(500, 'Máximo 500 km').optional()),
  /**
   * Real ranch boundary (Phase B).
   * Validated structurally on backend. Frontend stores it as-is.
   */
  boundary: z.any().optional().nullable(),
  totalArea: z.coerce.number().min(0.1, 'Mínimo 0.1 ha').max(500000),
  grazingArea: z.coerce.number().min(0.1, 'Mínimo 0.1 ha').max(500000),
  maxCattleCapacity: z.coerce.number().int().min(1, 'Mínimo 1').max(100000),
}).refine((d) => d.grazingArea <= d.totalArea, {
  message: 'El área de pastoreo no puede ser mayor que el área total', path: ['grazingArea'],
});

type FormValues = z.infer<typeof ranchSchema>;

// ─── Select options ────────────────────────────────────────────────────────

const ranchTypeOptions = [
  { value: RanchType.DAIRY, label: 'Lechero' }, { value: RanchType.BEEF, label: 'Cárnico' },
  { value: RanchType.MIXED, label: 'Mixto' }, { value: RanchType.BREEDING, label: 'Cría' },
  { value: RanchType.FEEDLOT, label: 'Engorda' }, { value: RanchType.ORGANIC, label: 'Orgánico' },
  { value: RanchType.SUSTAINABLE, label: 'Sustentable' }, { value: RanchType.COMMERCIAL, label: 'Comercial' },
  { value: RanchType.FAMILY_FARM, label: 'Familiar' }, { value: RanchType.COOPERATIVE, label: 'Cooperativa' },
  { value: RanchType.CORPORATE, label: 'Corporativo' }, { value: RanchType.RESEARCH, label: 'Investigación' },
  { value: RanchType.EDUCATIONAL, label: 'Educativo' },
];

const ranchStatusOptions = [
  { value: RanchStatus.ACTIVE, label: 'Activo' }, { value: RanchStatus.INACTIVE, label: 'Inactivo' },
  { value: RanchStatus.UNDER_CONSTRUCTION, label: 'En Construcción' }, { value: RanchStatus.RENOVATION, label: 'Renovación' },
  { value: RanchStatus.TEMPORARY_CLOSURE, label: 'Cierre Temporal' }, { value: RanchStatus.PERMANENT_CLOSURE, label: 'Cierre Permanente' },
  { value: RanchStatus.QUARANTINE, label: 'Cuarentena' }, { value: RanchStatus.SUSPENDED, label: 'Suspendido' },
  { value: RanchStatus.PENDING_APPROVAL, label: 'Pendiente de Aprobación' },
];

const landTenureOptions = [
  { value: LandTenure.OWNED, label: 'Propiedad' }, { value: LandTenure.LEASED, label: 'Arrendado' },
  { value: LandTenure.SHARED, label: 'Compartido' }, { value: LandTenure.EJIDAL, label: 'Ejidal' },
  { value: LandTenure.COMMUNAL, label: 'Comunal' }, { value: LandTenure.CONCESSION, label: 'Concesión' },
  { value: LandTenure.COOPERATIVE, label: 'Cooperativa' }, { value: LandTenure.MIXED_TENURE, label: 'Mixta' },
];

const climateZoneOptions = [
  { value: ClimateZone.TROPICAL, label: 'Tropical' }, { value: ClimateZone.SUBTROPICAL, label: 'Subtropical' },
  { value: ClimateZone.TEMPERATE, label: 'Templado' }, { value: ClimateZone.ARID, label: 'Árido' },
  { value: ClimateZone.SEMI_ARID, label: 'Semiárido' }, { value: ClimateZone.HUMID, label: 'Húmedo' },
  { value: ClimateZone.SEMI_HUMID, label: 'Semihúmedo' }, { value: ClimateZone.HIGHLAND, label: 'Altiplano' },
  { value: ClimateZone.COASTAL, label: 'Costero' },
];

const timezoneOptions = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (UTC-6)' },
  { value: 'America/Cancun', label: 'Cancún (UTC-5)' },
  { value: 'America/Monterrey', label: 'Monterrey (UTC-6)' },
  { value: 'America/Chihuahua', label: 'Chihuahua (UTC-6)' },
  { value: 'America/Mazatlan', label: 'Mazatlán (UTC-7)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (UTC-7)' },
  { value: 'America/Tijuana', label: 'Tijuana (UTC-8)' },
  { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
  { value: 'America/Lima', label: 'Lima (UTC-5)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
  { value: 'UTC', label: 'UTC' },
];

const mediaCategoryOptions = [
  { value: MediaCategory.FACILITY_PHOTO, label: 'Foto de Instalación' },
  { value: MediaCategory.AERIAL_PHOTO, label: 'Foto Aérea' },
  { value: MediaCategory.SATELLITE_IMAGE, label: 'Imagen Satelital' },
  { value: MediaCategory.LIVESTOCK_PHOTO, label: 'Foto de Ganado' },
  { value: MediaCategory.PROPERTY_MAP, label: 'Mapa de Propiedad' },
  { value: MediaCategory.LOGO, label: 'Logo' },
  { value: MediaCategory.CERTIFICATE, label: 'Certificado' },
  { value: MediaCategory.LICENSE, label: 'Licencia' },
  { value: MediaCategory.CONTRACT, label: 'Contrato' },
  { value: MediaCategory.REPORT, label: 'Reporte' },
  { value: MediaCategory.PLAN, label: 'Plano' },
  { value: MediaCategory.LEGAL_DOCUMENT, label: 'Documento Legal' },
  { value: MediaCategory.FINANCIAL_DOCUMENT, label: 'Documento Financiero' },
  { value: MediaCategory.OTHER, label: 'Otro' },
];

// ─── Label lookups ────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = Object.fromEntries(ranchTypeOptions.map((o) => [o.value, o.label]));
const statusLabels: Record<string, string> = Object.fromEntries(ranchStatusOptions.map((o) => [o.value, o.label]));
const tenureLabels: Record<string, string> = Object.fromEntries(landTenureOptions.map((o) => [o.value, o.label]));
const climateLabels: Record<string, string> = Object.fromEntries(climateZoneOptions.map((o) => [o.value, o.label]));
const categoryLabels: Record<string, string> = Object.fromEntries(mediaCategoryOptions.map((o) => [o.value, o.label]));

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success', INACTIVE: 'default', UNDER_CONSTRUCTION: 'info', RENOVATION: 'info',
  TEMPORARY_CLOSURE: 'warning', PERMANENT_CLOSURE: 'danger', QUARANTINE: 'danger',
  SUSPENDED: 'warning', PENDING_APPROVAL: 'info',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function getDefaultValues(): FormValues {
  return {
    ranchCode: '', name: '', description: '', type: RanchType.MIXED, status: RanchStatus.ACTIVE,
    address: '', city: '', state: '', country: 'México', postalCode: '', timezone: 'America/Mexico_City',
    coordinates: { latitude: 0, longitude: 0 }, landTenure: LandTenure.OWNED, climateZone: ClimateZone.TROPICAL,
    elevation: undefined, annualRainfall: undefined, averageTemperature: undefined, boundaryRadius: undefined,
    boundary: null,
    totalArea: 0, grazingArea: 0, maxCattleCapacity: 0,
  };
}

function ranchToFormValues(ranch: Ranch): FormValues {
  return {
    ranchCode: ranch.ranchCode || '', name: ranch.name, description: ranch.description || '',
    type: ranch.type, status: ranch.status, address: ranch.address, city: ranch.city,
    state: ranch.state, country: ranch.country, postalCode: ranch.postalCode || '',
    timezone: ranch.timezone, coordinates: ranch.coordinates, landTenure: ranch.landTenure,
    climateZone: ranch.climateZone, elevation: ranch.elevation, annualRainfall: ranch.annualRainfall,
    averageTemperature: ranch.averageTemperature, boundaryRadius: ranch.boundaryRadius,
    boundary: ranch.boundary ?? null,
    totalArea: ranch.totalArea,
    grazingArea: ranch.grazingArea, maxCattleCapacity: ranch.maxCattleCapacity,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RanchPage() {
  const { activeRanchId } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRanch, setEditingRanch] = useState<Ranch | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Ranch | null>(null);
  const [page, setPage] = useState(1);
  const [showRanchBoundary, setShowRanchBoundary] = useState(false);
  // 409 conflict: list of locations that would fall outside the new boundary
  const [boundaryConflict, setBoundaryConflict] = useState<BoundaryConflictDetails | null>(null);

  // ── Auto-fill (Phase 8) ────────────────────────────────────────────────
  // `autoFillSnapshotRef` holds the values our LAST reverseGeocode applied.
  // A field is considered "still auto-filled" when its current value equals
  // that snapshot value. If the user edits the field, the values diverge and
  // the icon disappears; subsequent auto-fills won't overwrite it.
  const autoFillSnapshotRef = useRef<Record<string, string>>({});
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  // Tick used to force re-evaluation of `isAutoFilled()` when the snapshot mutates.
  const [autoFillTick, setAutoFillTick] = useState(0);

  // ── Queries ────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['ranches', page],
    queryFn: () => ranchApi.list({ page, limit: 20 }),
  });

  const { data: summary } = useQuery({
    queryKey: ['ranch-summary', activeRanchId],
    queryFn: () => ranchApi.getSummary(activeRanchId!).then((r) => r.data.data),
    enabled: !!activeRanchId,
  });

  // ── Live per-ranch occupancy ────────────────────────────────────────────
  // The `/ranch` list endpoint returns `currentCattleCount` from the Ranch
  // table — a DENORMALIZED field that isn't recomputed on every bovine
  // mutation. The `/ranch/:id/summary` endpoint, in contrast, calculates it
  // live by querying the bovines table. We fan-out a parallel `getSummary`
  // for each row so the listing always matches what the detail page shows.
  //
  // Cache strategy:
  //   - Shares the SAME query key `['ranch-summary', id]` as RanchDetailPage,
  //     so navigating between list and detail reuses the cached value.
  //   - `invalidateOccupancyCaches` (called by every bovine create / move /
  //     delete mutation) already invalidates the `['ranch-summary']` prefix,
  //     so these queries automatically refetch when the population changes.
  //   - 20 rows × ~1 small request = trivial cost; React Query dedupes.
  const ranchIds = useMemo(
    () => (data?.items ?? []).map((r) => r.id),
    [data?.items],
  );
  const summaryQueries = useQueries({
    queries: ranchIds.map((rid) => ({
      queryKey: ['ranch-summary', rid],
      queryFn: () => ranchApi.getSummary(rid).then((r) => r.data.data),
      staleTime: 1000 * 30,
    })),
  });
  /** Map<ranchId, { currentCattleCount, maxCattleCapacity }> from live summaries. */
  const liveOccupancyById = useMemo(() => {
    const map = new Map<string, { current?: number; max?: number; rate?: number }>();
    summaryQueries.forEach((q, i) => {
      const rid = ranchIds[i];
      if (rid && q.data) {
        map.set(rid, {
          current: q.data.currentCattleCount,
          max:     q.data.maxCattleCapacity,
          rate:    q.data.occupancyRate,
        });
      }
    });
    return map;
  }, [summaryQueries, ranchIds]);

  // ── Form ───────────────────────────────────────────────────────────────

  const form = useForm<FormValues>({
    resolver: zodResolver(ranchSchema) as any,
    defaultValues: getDefaultValues(),
  });

  // Returns true when a field is currently auto-filled (i.e. its value still
  // matches the snapshot from the last reverseGeocode). The user editing the
  // field makes them diverge and the icon disappears.
  // Reads autoFillTick so that snapshot mutations re-render this.
  const isAutoFilled = (field: string): boolean => {
    void autoFillTick;
    const snap = autoFillSnapshotRef.current[field];
    if (!snap) return false;
    const current = form.getValues(field as any) as string;
    return !!current && current === snap;
  };

  // Apply a reverse-geocode result to the form, respecting user edits.
  // A field is overwritten ONLY when:
  //   - it is empty, OR
  //   - it still matches our last snapshot (i.e. user didn't change it).
  // Otherwise we keep the user's value and store it in the snapshot to track
  // it as "user-edited" (not eligible for auto-fill until cleared).
  const applyAutoFill = (data: ReverseGeocodeResult) => {
    const newSnap: Record<string, string> = {};
    const setIfFree = (field: string, val: string | undefined) => {
      if (!val) return;
      const current = (form.getValues(field as any) as string) ?? '';
      const lastSnap = autoFillSnapshotRef.current[field];
      const safeToOverwrite = !current || current === lastSnap;
      if (safeToOverwrite) {
        form.setValue(field as any, val, { shouldDirty: true, shouldValidate: false });
        newSnap[field] = val;
      } else {
        // User-edited: do not overwrite. Track their value so we don't try
        // to re-autofill until they clear it manually.
        newSnap[field] = current;
      }
    };

    setIfFree('address',    data.address);
    setIfFree('city',       data.city);
    setIfFree('state',      data.state);
    setIfFree('country',    data.country || 'México');
    setIfFree('postalCode', data.postalCode);
    setIfFree('timezone',   timezoneForMxState(data.state));

    autoFillSnapshotRef.current = newSnap;
    setAutoFillTick((t) => t + 1);
  };

  // Watch coordinates and trigger reverseGeocode after 800ms of stillness.
  // Only fires when the modal is open (no point lookups when we're not editing).
  const coordsLat = form.watch('coordinates')?.latitude;
  const coordsLng = form.watch('coordinates')?.longitude;
  useEffect(() => {
    if (!modalOpen) return;
    if (!coordsLat && !coordsLng) return;
    if (coordsLat === 0 && coordsLng === 0) return;
    const id = setTimeout(async () => {
      setAutoFillLoading(true);
      const result = await reverseGeocode(coordsLat as number, coordsLng as number);
      setAutoFillLoading(false);
      if (result) applyAutoFill(result);
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordsLat, coordsLng, modalOpen]);

  // Detect whether boundary changed between the original ranch and the form.
  // We use JSON.stringify for a deep-equal check — boundary is a small JSON blob.
  function boundaryChanged(formBoundary: GeofenceConfig | null | undefined, original: GeofenceConfig | null | undefined): boolean {
    const a = formBoundary ?? null;
    const b = original ?? null;
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  const saveMutation = useMutation({
    mutationFn: async (formData: FormValues) => {
      // Strip `boundary` from the generic payload — it has its own dedicated
      // endpoint with cross-validation. The generic PUT/POST handles everything else.
      const { boundary: formBoundary, ...rest } = formData;
      const genericPayload: RanchFormData = {
        ...rest,
        postalCode: rest.postalCode || undefined,
        description: rest.description || undefined,
        elevation: rest.elevation ?? undefined,
        annualRainfall: rest.annualRainfall ?? undefined,
        averageTemperature: rest.averageTemperature ?? undefined,
        boundaryRadius: rest.boundaryRadius ?? undefined,
      };

      // CREATE: send boundary inline (no existing locations to validate against).
      if (!editingRanch) {
        return ranchApi.create({ ...genericPayload, boundary: formBoundary ?? null });
      }

      // UPDATE: 1) generic PUT for everything else, 2) dedicated PUT for boundary if it changed.
      const res = await ranchApi.update(editingRanch.id, genericPayload);

      const original = (editingRanch as any).boundary as GeofenceConfig | null | undefined;
      if (boundaryChanged(formBoundary, original)) {
        // The dedicated endpoint runs cross-validation:
        // 409 BOUNDARY_LEAVES_LOCATIONS_OUTSIDE if existing locations would be outside.
        await ranchApi.updateBoundary(editingRanch.id, formBoundary ?? null);
      }

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranches'] });
      queryClient.invalidateQueries({ queryKey: ['ranch-summary'] });
      // Detail page reads from ['ranch', id]; without this, the max capacity /
      // total area / name fields on RanchDetailPage stay stale after editing.
      queryClient.invalidateQueries({ queryKey: ['ranch'] });
      // Boundary cache may be served by getBoundary() — invalidate it too.
      if (editingRanch) {
        queryClient.invalidateQueries({ queryKey: ['ranch-boundary', editingRanch.id] });
        queryClient.invalidateQueries({ queryKey: ['ranch-for-geo', editingRanch.id] });
      }
      toast.success(editingRanch ? 'Rancho actualizado' : 'Rancho creado', editingRanch ? 'Los cambios fueron guardados correctamente.' : 'El rancho fue registrado exitosamente.');
      closeModal();
    },
    onError: (err: any) => {
      // Special case: 409 with details — open the dedicated conflict modal.
      const conflict = getBoundaryConflictDetails(err);
      if (conflict) {
        setBoundaryConflict(conflict);
        return;
      }
      toast.error(
        'Error al guardar',
        err?.response?.data?.error || err?.response?.data?.error?.message || 'Verifica los datos e intenta de nuevo.',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ranchApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranches'] });
      toast.success('Rancho eliminado', 'El rancho fue eliminado correctamente.');
      setDeleteConfirm(null);
    },
    onError: (err: any) => {
      toast.error('Error al eliminar', err?.response?.data?.error?.message || 'No se pudo eliminar el rancho.');
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────

  function openCreate() {
    setEditingRanch(null);
    form.reset(getDefaultValues());
    autoFillSnapshotRef.current = {};
    setAutoFillTick((t) => t + 1);
    setModalOpen(true);
  }

  function openEdit(ranch: Ranch) {
    setEditingRanch(ranch);
    form.reset(ranchToFormValues(ranch));
    // Existing values count as user-supplied — start with no auto-fill snapshot
    // so we don't overwrite saved fields when the map first renders.
    autoFillSnapshotRef.current = {};
    setAutoFillTick((t) => t + 1);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingRanch(null);
    form.reset(getDefaultValues());
    autoFillSnapshotRef.current = {};
    saveMutation.reset();
  }

  function openDetail(ranch: Ranch) {
    navigate(`/ranch/${ranch.id}`);
  }

  // Support `?edit=<ranchId>` deep-link from RanchDetailPage's "Edit" button.
  // When the URL has `?edit=ID`, find that ranch in the list and open the edit modal.
  const editIdFromQuery = searchParams.get('edit');
  useEffect(() => {
    if (!editIdFromQuery) return;
    const items = data?.items ?? [];
    const target = items.find((r) => r.id === editIdFromQuery);
    if (target) {
      openEdit(target);
      // Clean the query string so a refresh doesn't reopen the modal.
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editIdFromQuery, data?.items]);

  // ── Table columns ──────────────────────────────────────────────────────

  const columns: Column<Ranch>[] = [
    {
      key: 'name', header: 'Rancho',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{r.name}</p>
          <p className="text-xs text-gray-500">{r.ranchCode} &middot; {r.city}, {r.state}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Tipo', render: (r) => <Badge variant="info">{typeLabels[r.type] || r.type}</Badge> },
    {
      key: 'status', header: 'Estado',
      render: (r) => <Badge variant={statusVariant[r.status] || 'default'}>{statusLabels[r.status] || r.status}</Badge>,
    },
    {
      key: 'capacity', header: 'Ganado',
      // Prefer the live value computed by the backend's summary endpoint;
      // fall back to the denormalized field only while the summary loads.
      render: (r) => {
        const live = liveOccupancyById.get(r.id);
        const current = live?.current ?? r.currentCattleCount ?? 0;
        const max     = live?.max     ?? r.maxCattleCapacity;
        return (
          <span className="text-sm">
            {current} / {max ?? '—'}
            {max && max > 0 && (
              <span className="ml-1 text-xs text-gray-400">
                ({Math.round((current / max) * 100)}%)
              </span>
            )}
          </span>
        );
      },
    },
    { key: 'totalArea', header: 'Superficie', render: (r) => <span className="text-sm">{r.totalArea ? `${r.totalArea} ha` : '—'}</span> },
    {
      key: 'actions', header: '', className: 'w-32',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); openDetail(r); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="Ver detalle">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="Editar">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(r); }}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Eliminar">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) return <PageLoader />;

  const errorMessage = saveMutation.error
    ? ((saveMutation.error as any)?.response?.data?.error?.details?.fieldErrors?.[0]?.message
      || (saveMutation.error as any)?.response?.data?.error?.message
      || (saveMutation.error as any)?.response?.data?.error
      || 'Error al guardar el rancho. Verifica los datos e intenta de nuevo.')
    : null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
            <Home className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ranchos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Administración de ranchos ganaderos</p>
          </div>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nuevo Rancho</Button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Capacidad Máxima" value={summary.maxCattleCapacity} icon={BarChart3} color="primary" />
          <StatCard title="Ganado Actual" value={summary.currentCattleCount} icon={BarChart3} color="emerald" />
          <StatCard title="Área Total (ha)" value={summary.totalArea} icon={MapPin} color="blue" />
          <StatCard title="Ocupación" value={`${Math.round(summary.occupancyRate || 0)}%`} icon={Users} color="amber" />
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(r) => r.id}
        page={page}
        totalPages={data?.totalPages || 1}
        total={data?.total || 0}
        onPageChange={setPage}
        onRowClick={openDetail}
      />

      {/* Detail view moved to its own page: /ranch/:id (RanchDetailPage) */}

      {/* ── Create/Edit Modal ─────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={closeModal} title={editingRanch ? 'Editar Rancho' : 'Nuevo Rancho'} size="xl">
        {errorMessage && <Alert variant="error" className="mb-4">{errorMessage}</Alert>}
        <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Sección 1: Identidad */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Home className="w-4 h-4 text-primary-600" /> Identidad del Rancho
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Código del Rancho *" placeholder="RCH-001" error={form.formState.errors.ranchCode?.message} {...form.register('ranchCode')} />
              <Input label="Nombre *" placeholder="Rancho El Encino" error={form.formState.errors.name?.message} {...form.register('name')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Select label="Tipo de Rancho *" options={ranchTypeOptions} placeholder="Selecciona tipo" error={form.formState.errors.type?.message} {...form.register('type')} />
              <Select label="Estado *" options={ranchStatusOptions} placeholder="Selecciona estado" error={form.formState.errors.status?.message} {...form.register('status')} />
            </div>
            <div className="mt-4">
              <Input label="Descripción" placeholder="Descripción breve del rancho..." error={form.formState.errors.description?.message} {...form.register('description')} />
            </div>
          </fieldset>

          {/* Sección 2: Ubicación */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-600" /> Ubicación Geográfica
              {autoFillLoading && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-sky-600 dark:text-sky-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Autocompletando…
                </span>
              )}
            </legend>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Estos campos se rellenan automáticamente cuando colocas el pin en el mapa.
              Los campos editados manualmente no se sobrescriben.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AutoFillField label="Dirección *" autoFilled={isAutoFilled('address')}>
                <Input
                  placeholder="Km 5 Carretera Nacional"
                  error={form.formState.errors.address?.message}
                  {...form.register('address')}
                />
              </AutoFillField>
              <AutoFillField label="Ciudad *" autoFilled={isAutoFilled('city')}>
                <Input
                  placeholder="Tuxtla Gutiérrez"
                  error={form.formState.errors.city?.message}
                  {...form.register('city')}
                />
              </AutoFillField>
              <AutoFillField label="Estado *" autoFilled={isAutoFilled('state')}>
                <Input
                  placeholder="Chiapas"
                  error={form.formState.errors.state?.message}
                  {...form.register('state')}
                />
              </AutoFillField>
              <AutoFillField label="País *" autoFilled={isAutoFilled('country')}>
                <Input
                  placeholder="México"
                  error={form.formState.errors.country?.message}
                  {...form.register('country')}
                />
              </AutoFillField>
              <AutoFillField label="Código Postal" autoFilled={isAutoFilled('postalCode')}>
                <Input
                  placeholder="29000"
                  error={form.formState.errors.postalCode?.message}
                  {...form.register('postalCode')}
                />
              </AutoFillField>
              <AutoFillField label="Zona Horaria *" autoFilled={isAutoFilled('timezone')}>
                <Select
                  options={timezoneOptions}
                  error={form.formState.errors.timezone?.message}
                  {...form.register('timezone')}
                />
              </AutoFillField>
            </div>
            <div className="mt-4">
              <Controller name="coordinates" control={form.control}
                render={({ field, fieldState }) => (
                  <MapPicker label="Coordenadas del Rancho *"
                    value={field.value.latitude !== 0 || field.value.longitude !== 0 ? field.value : null}
                    onChange={(coords: Coordinates) => field.onChange(coords)}
                    error={fieldState.error?.message || (form.formState.errors.coordinates as any)?.root?.message}
                    className="h-[280px]" />
                )} />
            </div>
          </fieldset>

          {/* Sección 3: Características Físicas */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Mountain className="w-4 h-4 text-primary-600" /> Características Físicas
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Tenencia de la Tierra *" options={landTenureOptions} placeholder="Selecciona tenencia" error={form.formState.errors.landTenure?.message} {...form.register('landTenure')} />
              <Select label="Zona Climática *" options={climateZoneOptions} placeholder="Selecciona zona" error={form.formState.errors.climateZone?.message} {...form.register('climateZone')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <Input label="Elevación (msnm)" type="number" step="0.1" min={-100} max={6000} placeholder="850" error={form.formState.errors.elevation?.message} {...form.register('elevation')} />
              <Input label="Precipitación Anual (mm)" type="number" step="0.1" min={0} max={12000} placeholder="1200" error={form.formState.errors.annualRainfall?.message} {...form.register('annualRainfall')} />
              <Input label="Temperatura Promedio (°C)" type="number" step="0.1" min={-20} max={50} placeholder="25.5" error={form.formState.errors.averageTemperature?.message} {...form.register('averageTemperature')} />
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Radio Operativo (km)
                </label>
                <FieldHint text="Forma circular APROXIMADA del rancho — solo se usa como fallback cuando no hay un Perímetro real (boundary) configurado. Es geográfico, no es superficie ni capacidad." />
              </div>
              <Input
                type="number"
                step="0.5"
                min={0.5}
                max={500}
                placeholder="Ej: 25"
                error={(form.formState.errors as any).boundaryRadius?.message}
                {...form.register('boundaryRadius')}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Fallback circular cuando no hay un perímetro real configurado abajo.
                Las ubicaciones dentro de este radio se marcan en verde; más allá se emite advertencia o bloqueo.
                Si no hay nada configurado, se usa 25 km por defecto.
              </p>
            </div>

            {/* Perímetro real del rancho — Fase B */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowRanchBoundary((s) => !s)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"
              >
                <MapPin className="w-4 h-4 text-emerald-600" />
                Perímetro del rancho (opcional)
                {form.watch('boundary') && (
                  <Badge variant="success">Configurado</Badge>
                )}
                <span className="text-xs text-gray-400 font-normal ml-2">
                  {showRanchBoundary ? 'Ocultar' : 'Mostrar'}
                </span>
              </button>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Dibuja el contorno real del rancho (polígono / rectángulo / círculo).
                Cuando esté configurado, el sistema validará que las ubicaciones nuevas estén
                dentro de la forma — más preciso que el radio operativo.
              </p>

              {showRanchBoundary && (
                <div className="mt-3">
                  <Controller
                    name="boundary"
                    control={form.control}
                    render={({ field }) => (
                      <GeofenceDrawer
                        value={field.value ?? null}
                        onChange={(cfg) => field.onChange(cfg)}
                        // Phase 6 — boundary must contain the ranch's center pin.
                        // No `containerBoundary` here: the ranch boundary IS the
                        // top-level container; nothing wraps it.
                        requiredPoint={
                          form.watch('coordinates')?.latitude
                            ? {
                                latitude:  form.watch('coordinates').latitude,
                                longitude: form.watch('coordinates').longitude,
                              }
                            : null
                        }
                        requiredPointLabel="Centro del rancho"
                        areaForRectangle={
                          (form.watch('totalArea') ?? 0) > 0
                            ? { area: form.watch('totalArea'), unit: 'HA' }
                            : null
                        }
                      />
                    )}
                  />
                </div>
              )}
            </div>
          </fieldset>

          {/* Sección 4: Capacidad */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-primary-600" /> Superficie y Capacidad
            </legend>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              <strong>Tres conceptos distintos:</strong> el <em>área total</em> es la superficie física del rancho;
              el <em>área de pastoreo</em> es la porción dedicada al ganado; la <em>capacidad máxima</em> es
              cuántas cabezas puede albergar.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Área Total (ha) <span className="text-red-500">*</span>
                  </label>
                  <FieldHint text="Superficie física total del rancho en hectáreas (lo que dice tu título o levantamiento topográfico). Incluye TODO: pastos, edificios, caminos, cuerpos de agua, montes." />
                </div>
                <Input
                  type="number" step="0.01" min={0.1} max={500000} placeholder="150"
                  error={form.formState.errors.totalArea?.message}
                  {...form.register('totalArea')}
                />
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Área de Pastoreo (ha) <span className="text-red-500">*</span>
                  </label>
                  <FieldHint text="Subconjunto del área total realmente usado para pasto. Excluye caminos, edificios, lagunas, montes. Se usa para calcular la densidad ganadera." />
                </div>
                <Input
                  type="number" step="0.01" min={0.1} max={500000} placeholder="120"
                  error={form.formState.errors.grazingArea?.message}
                  {...form.register('grazingArea')}
                />
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Capacidad Máx. (cabezas) <span className="text-red-500">*</span>
                  </label>
                  <FieldHint text="Número máximo de bovinos que puede albergar el rancho. La suma de capacidades de todas las ubicaciones no puede exceder este valor." />
                </div>
                <Input
                  type="number" step="1" min={1} max={100000} placeholder="500"
                  error={form.formState.errors.maxCattleCapacity?.message}
                  {...form.register('maxCattleCapacity')}
                />
              </div>
            </div>
          </fieldset>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" type="button" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={saveMutation.isPending}>{editingRanch ? 'Guardar Cambios' : 'Crear Rancho'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar Eliminación" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ¿Estás seguro de que deseas eliminar el rancho <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.ranchCode})? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleteMutation.isPending}
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}>Eliminar</Button>
        </div>
      </Modal>

      {/* ── Boundary Conflict Modal (409 BOUNDARY_LEAVES_LOCATIONS_OUTSIDE) ── */}
      <BoundaryConflictModal
        details={boundaryConflict}
        ranchName={editingRanch?.name}
        onClose={() => setBoundaryConflict(null)}
        onGoToLocations={() => {
          setBoundaryConflict(null);
          // Close the ranch edit modal so the user can navigate freely.
          closeModal();
          // Soft navigation to the locations list.
          // Using window for simplicity here (avoids importing useNavigate higher up).
          window.location.href = '/locations';
        }}
      />
    </div>
  );
}

// ─── BoundaryConflictModal ──────────────────────────────────────────────────
// Shows the list of locations that would be outside the new boundary, so the
// admin can either cancel the change or jump to fix the offending locations.

function BoundaryConflictModal({
  details,
  ranchName,
  onClose,
  onGoToLocations,
}: {
  details: BoundaryConflictDetails | null;
  ranchName?: string;
  onClose: () => void;
  onGoToLocations: () => void;
}) {
  const open = !!details;
  const list = details?.outsideLocations ?? [];

  return (
    <Modal open={open} onClose={onClose} title="No se pudo guardar el perímetro" size="md">
      <div className="space-y-4">
        <Alert variant="warning">
          <p className="text-sm">
            El nuevo perímetro dejaría <strong>{list.length}</strong>{' '}
            ubicación{list.length === 1 ? '' : 'es'} fuera del rancho
            {ranchName ? <> <strong>"{ranchName}"</strong></> : ''}.
            Antes de aplicar el cambio, ajusta o reubica las siguientes ubicaciones:
          </p>
        </Alert>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {list.map((loc) => (
            <div
              key={loc.id}
              className="flex items-start gap-3 px-3 py-2.5 text-sm"
            >
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-white truncate">{loc.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  [{loc.locationCode}] · {loc.coordinates.latitude.toFixed(5)}, {loc.coordinates.longitude.toFixed(5)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tip: puedes editar cada ubicación moviendo su pin dentro del nuevo perímetro,
          o ajustar el perímetro para que contenga estas ubicaciones.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar cambio de perímetro
          </Button>
          <Button onClick={onGoToLocations}>
            Ir a corregir ubicaciones
          </Button>
        </div>
      </div>
    </Modal>
  );
}
