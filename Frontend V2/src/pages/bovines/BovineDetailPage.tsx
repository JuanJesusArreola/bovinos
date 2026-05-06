import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bovinesApi } from '@/api/bovines.api';
import { healthApi } from '@/api/health.api';
import { eventsApi } from '@/api/events.api';
import { BovineHealthTab } from './tabs/BovineHealthTab';
import { BovineTreatmentsTab } from './tabs/BovineTreatmentsTab';
import { BovineVaccinationsTab } from './tabs/BovineVaccinationsTab';
import { BovineLocationHistoryTab } from './tabs/BovineLocationHistoryTab';
import { BovineMediaTab } from './tabs/BovineMediaTab';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { getErrorCode, getFriendlyMessage, ErrorCodes } from '@/utils/errorHandler';
import { formatDate, formatWeight, formatRelative } from '@/utils/formatters';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageLoader, Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { HealthStatusBadge } from '@/components/ui/HealthStatusBadge';
import { LocationSelector } from '@/components/ui/LocationSelector';
import { cn } from '@/utils/cn';
import type { Bovine } from '@/types';
import {
  ArrowLeft, Edit, QrCode, HeartPulse, CalendarDays,
  MapPin, Milk, Baby, Info, Activity, Download, RefreshCw,
  Trash2, MoveRight, Scale, Clock, Mars, Venus, Beef,
  AlertTriangle, ShieldCheck, Syringe, Users, ChevronRight,
  Dna, Baby as BabyIcon, Calendar, Hash, Pill, Image,
} from 'lucide-react';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'info',             label: 'Información',  icon: Info },
  { id: 'health',           label: 'Salud',        icon: HeartPulse },
  { id: 'treatments',       label: 'Tratamientos', icon: Pill },
  { id: 'vaccinations',     label: 'Vacunaciones', icon: Syringe },
  { id: 'location_history', label: 'Potreros',     icon: MapPin },
  { id: 'media',            label: 'Media',        icon: Image },
  { id: 'events',           label: 'Eventos',      icon: CalendarDays },
  { id: 'production',       label: 'Producción',   icon: Milk },
  { id: 'reproduction',     label: 'Reproducción', icon: Baby },
  { id: 'tracking',         label: 'GPS',          icon: Activity },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Avatar gradient palette ──────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600',
  'from-blue-400 to-indigo-600',
  'from-violet-400 to-purple-600',
  'from-rose-400 to-pink-600',
  'from-cyan-400 to-sky-600',
  'from-lime-400 to-green-600',
];

// ─── Vaccination chip config ──────────────────────────────────────────────────

const VACC_CONFIG: Record<string, { label: string; classes: string }> = {
  UP_TO_DATE: {
    label: 'Vacunas al día',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  PENDING: {
    label: 'Vacunas pendientes',
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  OVERDUE: {
    label: 'Vacunas atrasadas',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  NONE: {
    label: 'Sin vacunas',
    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

// ─── Cattle type label ────────────────────────────────────────────────────────

const CATTLE_TYPE_LABEL: Record<string, string> = {
  CATTLE: 'Ganado',
  BULL:   'Toro',
  COW:    'Vaca',
  CALF:   'Becerro/a',
};

// ─── Avatar gradient helper ───────────────────────────────────────────────────

function getBovineGradient(earTag: string) {
  return AVATAR_GRADIENTS[(earTag.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

// ─── ParentCard — clickable card for mother / father ─────────────────────────

function ParentCard({ bovine, onClick }: { bovine: Bovine; onClick: () => void }) {
  const gradient = getBovineGradient(bovine.earTag);
  const initial  = bovine.earTag.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
    >
      {/* Avatar */}
      <div className={cn('shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-white text-base shadow-sm', gradient)}>
        {initial}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{bovine.earTag}</p>
        {bovine.name && <p className="text-xs text-gray-400 truncate">"{bovine.name}"</p>}
        <p className="text-xs text-gray-500 truncate">{bovine.breed}{bovine.ageDisplay ? ` · ${bovine.ageDisplay}` : ''}</p>
      </div>
      {/* Health + arrow */}
      <div className="shrink-0 flex items-center gap-1.5">
        <HealthStatusBadge status={bovine.healthStatus} showIcon={false} size="sm" />
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
      </div>
    </button>
  );
}

// ─── UnknownParentCard — placeholder when parent id exists but data missing ───

function UnknownParentCard({ label }: { label: string }) {
  return (
    <div className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
      <div className="shrink-0 w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <Users className="w-5 h-5 text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-500 italic">{label}</p>
    </div>
  );
}

// ─── OffspringCard — compact card for each cría ───────────────────────────────

function OffspringCard({ bovine, onClick }: { bovine: Bovine; onClick: () => void }) {
  const gradient = getBovineGradient(bovine.earTag);
  const initial  = bovine.earTag.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group w-full text-left"
    >
      <div className={cn('shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center font-bold text-white text-sm shadow-sm', gradient)}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{bovine.earTag}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <HealthStatusBadge status={bovine.healthStatus} showIcon={false} size="sm" />
          {bovine.ageDisplay && (
            <span className="text-xs text-gray-400 truncate">{bovine.ageDisplay}</span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BovineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, activeRanchId } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('info');

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [showQrModal, setShowQrModal]       = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMoveModal, setShowMoveModal]   = useState(false);
  const [moveLocationId, setMoveLocationId] = useState<string | null>(null);
  const [moveReason, setMoveReason]         = useState('ROUTINE');
  const [moveNotes, setMoveNotes]           = useState('');
  const [moveError, setMoveError]           = useState<string | null>(null);
  // When deletion is blocked: string describing why (e.g. active health records)
  const [deleteBlockMsg, setDeleteBlockMsg] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: bovine, isLoading, error } = useQuery({
    queryKey: ['bovine', id],
    queryFn: () => bovinesApi.getById(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  // Genealogy — only fetch when on info tab
  const { data: motherBovine, isLoading: loadingMother } = useQuery({
    queryKey: ['bovine', bovine?.motherId],
    queryFn: () => bovinesApi.getById(bovine!.motherId!).then((r) => r.data.data),
    enabled: !!bovine?.motherId && activeTab === 'info',
    staleTime: 1000 * 60 * 5,
  });

  const { data: fatherBovine, isLoading: loadingFather } = useQuery({
    queryKey: ['bovine', bovine?.fatherId],
    queryFn: () => bovinesApi.getById(bovine!.fatherId!).then((r) => r.data.data),
    enabled: !!bovine?.fatherId && activeTab === 'info',
    staleTime: 1000 * 60 * 5,
  });

  // Offspring — calves where this bovine is mother or father
  const { data: offspring, isLoading: loadingOffspring } = useQuery({
    queryKey: ['bovine-offspring', id, bovine?.gender],
    queryFn: () => {
      const filter = bovine!.gender === 'FEMALE' ? { motherId: id } : { fatherId: id };
      return bovinesApi
        .list({ ...filter, limit: 20 } as any)
        .then((r) => r.data.data.items ?? []);
    },
    enabled: !!id && !!bovine && activeTab === 'info',
    staleTime: 1000 * 60 * 3,
  });

  // healthHistory is now handled inside BovineHealthTab

  const { data: events } = useQuery({
    queryKey: ['bovine-events', id],
    queryFn: () => eventsApi.getByBovine(id!).then((r) => r.data.data),
    enabled: !!id && activeTab === 'events',
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => bovinesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovines'] });
      toast.success('Bovino eliminado', `El bovino ${bovine?.earTag} fue eliminado.`);
      navigate('/bovines');
    },
    onError: (err: any) => {
      const code = getErrorCode(err);
      if (code === ErrorCodes.BOVINE_HAS_ACTIVE_RECORDS) {
        // Surface the blocking details inside the modal instead of a generic toast
        const details = err?.response?.data?.details;
        const active: string[] = Array.isArray(details?.records)
          ? details.records.map((r: any) => r.type || r.recordType || r).filter(Boolean)
          : [];
        const msg = active.length
          ? `No se puede eliminar porque tiene ${active.length} registro${active.length !== 1 ? 's' : ''} activo${active.length !== 1 ? 's' : ''}: ${active.join(', ')}.`
          : 'No se puede eliminar porque tiene registros activos (tratamientos, salud u otros). Ciérralos primero.';
        setDeleteBlockMsg(msg);
      } else {
        toast.error('Error al eliminar', getFriendlyMessage(err));
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ locationId, reason, notes }: { locationId: string; reason: string; notes?: string }) =>
      bovinesApi.moveToLocation(id!, { locationId, reason: notes ? `${reason} — ${notes}` : reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine', id] });
      queryClient.invalidateQueries({ queryKey: ['bovine-location-history', id] });
      toast.success('Bovino movido', 'La ubicación fue actualizada correctamente.');
      setShowMoveModal(false);
      setMoveLocationId(null);
      setMoveReason('ROUTINE');
      setMoveNotes('');
      setMoveError(null);
    },
    onError: (err: any) => {
      const code = getErrorCode(err);
      if (code === ErrorCodes.BOVINE_LOCATION_FULL) {
        setMoveError('El potrero seleccionado ha alcanzado su capacidad máxima. Elige otro destino.');
      } else if (code === ErrorCodes.RANCH_MISMATCH) {
        setMoveError('El destino pertenece a un rancho diferente. Solo puedes mover dentro del mismo rancho.');
      } else {
        setMoveError(getFriendlyMessage(err));
      }
    },
  });

  const regenerateQrMutation = useMutation({
    mutationFn: () => bovinesApi.regenerateQR(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bovine', id] });
      toast.success('QR regenerado', 'El código QR fue actualizado.');
    },
    onError: (err: any) => {
      toast.error('Error', err?.response?.data?.error?.message || 'No se pudo regenerar el QR.');
    },
  });

  // ── Permissions ──────────────────────────────────────────────────────────────
  const canEdit       = canUser(user?.role, 'MANAGE_BOVINE');
  const canMove       = canUser(user?.role, 'MOVE_BOVINE');
  const canDelete     = canUser(user?.role, 'DELETE_BOVINE');
  const canRegenQR    = canUser(user?.role, 'REGENERATE_QR');

  // ── Loading / error guards ───────────────────────────────────────────────────
  if (isLoading) return <PageLoader />;
  if (error || !bovine) {
    return <Alert variant="error">No se pudo cargar la información del bovino.</Alert>;
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const avatarGradient = AVATAR_GRADIENTS[(bovine.earTag.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
  const initial = bovine.earTag.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?';

  const locationLabel =
    bovine.location?.address ||
    bovine.location?.municipality ||
    bovine.ranch?.name ||
    null;

  const vaccConfig = bovine.vaccinationStatus ? VACC_CONFIG[bovine.vaccinationStatus] : null;
  const cattleTypeLabel = CATTLE_TYPE_LABEL[bovine.cattleType] || bovine.cattleTypeLabel || bovine.cattleType;

  // ── QR download ──────────────────────────────────────────────────────────────
  const handleDownloadQR = () => {
    if (!bovine.qrCode) return;
    const a = document.createElement('a');
    a.href = bovine.qrCode;
    a.download = `qr-${bovine.earTag}.png`;
    a.click();
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ══════════════════════════════════════════════════════════════════════
          CABECERA
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">

        {/* Top bar: back + actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/bovines')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Bovinos</span>
          </Button>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* QR button */}
            <Button
              variant="outline"
              size="sm"
              icon={<QrCode className="w-4 h-4" />}
              onClick={() => setShowQrModal(true)}
              title="Ver código QR"
            >
              <span className="hidden sm:inline">QR</span>
            </Button>

            {/* Move button */}
            {canMove && (
              <Button
                variant="outline"
                size="sm"
                icon={<MoveRight className="w-4 h-4" />}
                onClick={() => setShowMoveModal(true)}
                title="Mover a otro potrero"
              >
                <span className="hidden sm:inline">Mover</span>
              </Button>
            )}

            {/* Edit button */}
            {canEdit && (
              <Button
                size="sm"
                icon={<Edit className="w-4 h-4" />}
                onClick={() => navigate(`/bovines/${bovine.id}/edit`)}
              >
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}

            {/* Delete button */}
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => setShowDeleteModal(true)}
                title="Eliminar bovino"
              />
            )}
          </div>
        </div>

        {/* Main header content */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 px-4 sm:px-6 py-5">

          {/* ── Avatar ─────────────────────────────────────────────────────── */}
          <div
            className={cn(
              'shrink-0 flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br text-white font-bold text-3xl sm:text-4xl shadow-md select-none',
              avatarGradient,
            )}
          >
            {initial}
          </div>

          {/* ── Info ───────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 text-center sm:text-left">

            {/* Earring + name */}
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {bovine.earTag}
              </h1>
              {bovine.name && (
                <span className="text-lg text-gray-500 dark:text-gray-400 font-normal">
                  "{bovine.name}"
                </span>
              )}
            </div>

            {/* Badges row */}
            <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              {/* Health status */}
              <HealthStatusBadge status={bovine.healthStatus} showIcon size="md" />

              {/* Gender */}
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium',
                  bovine.gender === 'MALE'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
                )}
              >
                {bovine.gender === 'MALE'
                  ? <Mars className="w-3.5 h-3.5" />
                  : <Venus className="w-3.5 h-3.5" />}
                {bovine.genderLabel || (bovine.gender === 'MALE' ? 'Macho' : 'Hembra')}
              </span>

              {/* Cattle type */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Beef className="w-3.5 h-3.5" />
                {cattleTypeLabel}
              </span>

              {/* Vaccination */}
              {vaccConfig && (
                <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium', vaccConfig.classes)}>
                  <Syringe className="w-3.5 h-3.5" />
                  {vaccConfig.label}
                </span>
              )}

              {/* Pregnant */}
              {bovine.isPregnant && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <Baby className="w-3.5 h-3.5" />
                  Preñada
                </span>
              )}
            </div>

            {/* Location chip */}
            {locationLabel && (
              <div className="mt-2 flex items-center justify-center sm:justify-start gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <MapPin className="w-4 h-4 text-primary-500 shrink-0" />
                <span className="truncate">
                  {locationLabel}
                  {bovine.ranch?.name && bovine.location?.municipality && (
                    <span className="text-gray-400"> · {bovine.ranch.name}</span>
                  )}
                </span>
              </div>
            )}

            {/* Quick stats */}
            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-gray-500 dark:text-gray-400">
              {bovine.ageDisplay && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{bovine.ageDisplay}</span>
                </div>
              )}
              {bovine.weight && (
                <div className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 shrink-0" />
                  <span>{bovine.weight} kg</span>
                </div>
              )}
              {bovine.lastHealthCheck && (
                <div className="flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 shrink-0" />
                  <span>Chequeo {formatRelative(bovine.lastHealthCheck)}</span>
                </div>
              )}
              {bovine.ranch?.name && (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{bovine.ranch.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TABS
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB CONTENT
          ══════════════════════════════════════════════════════════════════════ */}

      {/* ── INFO TAB ──────────────────────────────────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="space-y-6">

          {/* Row 1 — Datos básicos + Estado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Datos Generales */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40">
                  <Hash className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                </div>
                <CardTitle>Datos Generales</CardTitle>
              </div>
              <dl className="space-y-0 divide-y divide-gray-50 dark:divide-gray-800">
                {[
                  ['Arete',        bovine.earTag],
                  ['Nombre',       bovine.name || '—'],
                  ['Raza',         bovine.breed],
                  ['Tipo',         cattleTypeLabel],
                  ['Sexo',         bovine.genderLabel || (bovine.gender === 'MALE' ? 'Macho' : 'Hembra')],
                  ['Edad',         bovine.ageDisplay || '—'],
                  ['Nacimiento',   formatDate(bovine.birthDate)],
                  ['Peso actual',  bovine.weight ? formatWeight(bovine.weight) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-2.5 text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className="font-medium text-gray-900 dark:text-white text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            {/* Estado Actual */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle>Estado Actual</CardTitle>
              </div>
              <dl className="space-y-0 divide-y divide-gray-50 dark:divide-gray-800">
                {/* Health with badge */}
                <div className="flex justify-between items-center py-2.5 text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Salud</dt>
                  <dd><HealthStatusBadge status={bovine.healthStatus} showIcon size="sm" /></dd>
                </div>
                {/* Vaccination */}
                {bovine.vaccinationStatus && (
                  <div className="flex justify-between items-center py-2.5 text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">Vacunación</dt>
                    <dd>
                      {vaccConfig ? (
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', vaccConfig.classes)}>
                          <Syringe className="w-3 h-3" />
                          {vaccConfig.label}
                        </span>
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-white">{bovine.vaccinationStatusLabel || bovine.vaccinationStatus}</span>
                      )}
                    </dd>
                  </div>
                )}
                {/* Other fields */}
                {[
                  ['Rancho',               bovine.ranch?.name || '—'],
                  ['Preñada',              bovine.isPregnant ? 'Sí' : 'No'],
                  ['Último chequeo',       bovine.lastHealthCheck ? formatRelative(bovine.lastHealthCheck) : 'Sin registro'],
                  ['Días en operación',    bovine.daysInOperation != null ? `${bovine.daysInOperation} días` : '—'],
                  ['Registrado',           bovine.createdAt ? formatDate(bovine.createdAt) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-2.5 text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className="font-medium text-gray-900 dark:text-white text-right">{value}</dd>
                  </div>
                ))}
                {/* Expected calving */}
                {bovine.isPregnant && bovine.expectedCalvingDate && (
                  <div className="flex justify-between items-center py-2.5 text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">Parto esperado</dt>
                    <dd className="font-medium text-purple-600 dark:text-purple-400 text-right">{formatDate(bovine.expectedCalvingDate)}</dd>
                  </div>
                )}
              </dl>
              {bovine.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Notas</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{bovine.notes}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Row 2 — Genealogía */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <Dna className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <CardTitle>Genealogía</CardTitle>
            </div>

            {!bovine.motherId && !bovine.fatherId && !bovine.mother && !bovine.father ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Users className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                <p className="text-sm text-gray-400 dark:text-gray-500">Sin registros de genealogía</p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Edit className="w-3.5 h-3.5" />}
                    onClick={() => navigate(`/bovines/${bovine.id}/edit`)}
                    className="mt-1"
                  >
                    Agregar genealogía
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                {/* Mother */}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">
                    Madre
                  </p>
                  {(bovine.motherId || bovine.mother) ? (
                    loadingMother ? (
                      <div className="flex items-center justify-center h-20">
                        <Spinner size="sm" />
                      </div>
                    ) : motherBovine ? (
                      <ParentCard bovine={motherBovine} onClick={() => navigate(`/bovines/${motherBovine.id}`)} />
                    ) : bovine.mother ? (
                      <ParentCard bovine={bovine.mother as Bovine} onClick={() => navigate(`/bovines/${bovine.mother!.id}`)} />
                    ) : (
                      <UnknownParentCard label="Madre no encontrada" />
                    )
                  ) : (
                    <UnknownParentCard label="Madre desconocida" />
                  )}
                </div>

                {/* Center connector */}
                <div className="flex flex-col items-center gap-1 sm:mt-6 shrink-0">
                  <div className="hidden sm:flex flex-col items-center gap-1">
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                    <div className="w-2 h-2 rounded-full bg-primary-400" />
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 shrink-0">
                    <Beef className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold mt-1 text-center">
                    {bovine.earTag}
                  </p>
                </div>

                {/* Father */}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">
                    Padre
                  </p>
                  {(bovine.fatherId || bovine.father) ? (
                    loadingFather ? (
                      <div className="flex items-center justify-center h-20">
                        <Spinner size="sm" />
                      </div>
                    ) : fatherBovine ? (
                      <ParentCard bovine={fatherBovine} onClick={() => navigate(`/bovines/${fatherBovine.id}`)} />
                    ) : bovine.father ? (
                      <ParentCard bovine={bovine.father as Bovine} onClick={() => navigate(`/bovines/${bovine.father!.id}`)} />
                    ) : (
                      <UnknownParentCard label="Padre no encontrado" />
                    )
                  ) : (
                    <UnknownParentCard label="Padre desconocido" />
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Row 3 — Crías */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <BabyIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <CardTitle>
                  Crías
                  {offspring && offspring.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-400">({offspring.length})</span>
                  )}
                </CardTitle>
              </div>
            </div>

            {loadingOffspring ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : offspring && offspring.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {offspring.map((calf) => (
                  <OffspringCard
                    key={calf.id}
                    bovine={calf}
                    onClick={() => navigate(`/bovines/${calf.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <BabyIcon className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Sin crías registradas
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Health */}
      {activeTab === 'health' && <BovineHealthTab bovineId={id!} />}

      {/* Events */}
      {activeTab === 'events' && (
        <Card>
          <CardTitle>Eventos</CardTitle>
          {events && events.length > 0 ? (
            <div className="mt-4 space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <CalendarDays className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{event.title}</span>
                      <Badge variant={event.status === 'COMPLETED' ? 'success' : event.status === 'OVERDUE' ? 'danger' : 'info'}>
                        {event.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(event.scheduledDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-400">Sin eventos registrados.</p>
          )}
        </Card>
      )}

      {/* Treatments tab */}
      {activeTab === 'treatments' && <BovineTreatmentsTab bovineId={id!} />}

      {/* Vaccinations tab */}
      {activeTab === 'vaccinations' && (
        <BovineVaccinationsTab
          bovineId={id!}
          vaccinationStatus={bovine?.vaccinationStatus}
        />
      )}

      {/* Location history tab */}
      {activeTab === 'location_history' && (
        <BovineLocationHistoryTab bovineId={id!} />
      )}

      {/* Media tab */}
      {activeTab === 'media' && (
        <BovineMediaTab bovineId={id!} earTag={bovine.earTag} />
      )}

      {/* Upcoming tabs */}
      {(activeTab === 'production' || activeTab === 'reproduction' || activeTab === 'tracking') && (
        <Card>
          <p className="text-gray-500 dark:text-gray-400">
            Sección de {TABS.find((t) => t.id === activeTab)?.label} — próximamente.
          </p>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — QR CODE
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showQrModal}
        onClose={() => setShowQrModal(false)}
        title={`Código QR — ${bovine.earTag}`}
        size="sm"
      >
        <div className="flex flex-col items-center gap-5">
          {bovine.qrCode ? (
            <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-inner">
              <img
                src={bovine.qrCode}
                alt={`QR de ${bovine.earTag}`}
                className="w-52 h-52 object-contain"
              />
            </div>
          ) : (
            <div className="w-52 h-52 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <QrCode className="w-12 h-12 text-gray-300" />
              <p className="text-sm text-gray-400 text-center">Sin código QR generado</p>
            </div>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Arete: <span className="font-semibold text-gray-900 dark:text-white">{bovine.earTag}</span>
            {bovine.name && <> · "{bovine.name}"</>}
          </p>

          <div className="flex gap-3 w-full">
            {bovine.qrCode && (
              <Button
                variant="outline"
                icon={<Download className="w-4 h-4" />}
                onClick={handleDownloadQR}
                className="flex-1"
              >
                Descargar
              </Button>
            )}
            {canRegenQR && (
              <Button
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
                loading={regenerateQrMutation.isPending}
                onClick={() => regenerateQrMutation.mutate()}
                className="flex-1"
              >
                Regenerar
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — MOVER A OTRO POTRERO
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showMoveModal}
        onClose={() => { setShowMoveModal(false); setMoveLocationId(null); setMoveReason('ROUTINE'); setMoveNotes(''); setMoveError(null); }}
        title={`Mover a otro potrero`}
        size="md"
      >
        <div className="space-y-5">
          {/* Animal info pill */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className={cn('w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0', getBovineGradient(bovine.earTag))}>
              {bovine.earTag.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {bovine.earTag}{bovine.name ? ` — ${bovine.name}` : ''}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Ubicación actual: <span className="font-medium text-gray-600 dark:text-gray-300">
                  {(bovine as any).currentLocation?.name ?? 'Sin ubicación registrada'}
                </span>
              </p>
            </div>
            <MoveRight className="w-5 h-5 text-primary-400 shrink-0" />
          </div>

          {/* Inline error banner */}
          {moveError && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{moveError}</span>
            </div>
          )}

          {/* Destination */}
          <LocationSelector
            label="Destino *"
            placeholder="Buscar potrero o corral..."
            value={moveLocationId}
            onChange={(locId) => { setMoveLocationId(locId); setMoveError(null); }}
            ranchId={activeRanchId}
            clearable
          />

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Motivo del movimiento
            </label>
            <select
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ROUTINE">Rotación rutinaria</option>
              <option value="GRAZING">Pastoreo</option>
              <option value="HEALTH">Tratamiento / Salud</option>
              <option value="QUARANTINE">Cuarentena</option>
              <option value="BREEDING">Reproducción</option>
              <option value="FEEDING">Suplementación / Alimentación</option>
              <option value="SALE_PREP">Preparación para venta</option>
              <option value="TRANSPORT">Transporte externo</option>
              <option value="MAINTENANCE">Mantenimiento de ubicación</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notas adicionales <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={moveNotes}
              onChange={(e) => setMoveNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones sobre el movimiento..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder:text-gray-400"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => { setShowMoveModal(false); setMoveLocationId(null); setMoveReason('ROUTINE'); setMoveNotes(''); setMoveError(null); }}
            >
              Cancelar
            </Button>
            <Button
              icon={<MoveRight className="w-4 h-4" />}
              disabled={!moveLocationId}
              loading={moveMutation.isPending}
              onClick={() => moveLocationId && moveMutation.mutate({ locationId: moveLocationId, reason: moveReason, notes: moveNotes || undefined })}
            >
              Confirmar Movimiento
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — CONFIRMAR ELIMINACIÓN
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteBlockMsg(null); }}
        title="Eliminar Bovino"
        size="sm"
      >
        <div className="space-y-5">
          {/* Warning banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Esta acción no se puede deshacer</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                Se eliminará permanentemente el bovino <strong>{bovine.earTag}</strong>
                {bovine.name ? ` "${bovine.name}"` : ''} y todos sus registros asociados.
              </p>
            </div>
          </div>

          {/* Blocking records error — shown after a failed attempt */}
          {deleteBlockMsg && (
            <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-400">
                <p className="font-semibold mb-0.5">No se puede eliminar</p>
                <p>{deleteBlockMsg}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteBlockMsg(null); }}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="w-4 h-4" />}
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
