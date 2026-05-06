import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { locationsApi } from '@/api/locations.api';
import type { LocationCapacityPayload } from '@/api/locations.api';
import type { LocationCapacity, AreaUnit, SecurityLevel } from '@/types/location.types';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { getFriendlyMessage } from '@/utils/errorHandler';
import { cn } from '@/utils/cn';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  Users, AlertTriangle, CheckCircle2, TrendingUp, Edit3,
  Zap, Droplet, Wifi, Route, ShieldCheck, Home, Info,
} from 'lucide-react';

// ─── Capacity gauge ───────────────────────────────────────────────────────────

function CapacityGauge({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));

  const fillColor =
    clamped >= 100 ? '#ef4444' :
    clamped >= 85  ? '#f59e0b' :
    clamped >= 60  ? '#facc15' :
                     '#10b981';

  const ring =
    clamped >= 100 ? 'ring-red-200 dark:ring-red-900/40' :
    clamped >= 85  ? 'ring-amber-200 dark:ring-amber-900/40' :
                     'ring-emerald-200 dark:ring-emerald-900/40';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn('relative w-36 h-36 rounded-full ring-8', ring)}
        style={{
          background: `conic-gradient(${fillColor} ${clamped * 3.6}deg, #e5e7eb ${clamped * 3.6}deg)`,
        }}
      >
        <div className="absolute inset-2 rounded-full bg-white dark:bg-gray-900 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round(clamped)}%</span>
          <span className="text-xs text-gray-400">ocupación</span>
        </div>
      </div>

      <span className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold',
        clamped >= 100 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
        clamped >= 85  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      )}>
        {clamped >= 100
          ? <><AlertTriangle className="w-3.5 h-3.5" /> Lleno</>
          : clamped >= 85
            ? <><TrendingUp className="w-3.5 h-3.5" /> Casi lleno</>
            : <><CheckCircle2 className="w-3.5 h-3.5" /> Disponible</>}
      </span>
    </div>
  );
}

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-center">
      <span className={cn('text-3xl font-bold', color ?? 'text-gray-900 dark:text-white')}>{value}</span>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

// ─── InfraChip ────────────────────────────────────────────────────────────────

function InfraChip({ icon, label, enabled }: { icon: React.ReactNode; label: string; enabled?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
      enabled
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
    )}>
      {icon}
      <span>{label}</span>
      {enabled
        ? <CheckCircle2 className="w-3 h-3" />
        : <span className="w-3 h-3 rounded-full border border-current opacity-40" />}
    </div>
  );
}

// ─── Edit modal form ──────────────────────────────────────────────────────────

interface CapacityFormValues {
  maxAnimals: number | '';
  area?: number | '';
  areaUnit: AreaUnit;
  carryingCapacity?: number | '';
  waterSources?: number | '';
  feedingStations?: number | '';
  shelters?: number | '';
  hasElectricity: boolean;
  hasWater: boolean;
  hasInternet: boolean;
  hasRoadAccess: boolean;
  securityLevel: SecurityLevel;
}

const defaultFormValues = (existing: LocationCapacity | null): CapacityFormValues => ({
  maxAnimals:       existing?.maxAnimals       ?? '',
  area:             existing?.area             ?? '',
  areaUnit:         existing?.areaUnit         ?? 'HA',
  carryingCapacity: existing?.carryingCapacity ?? '',
  waterSources:     existing?.waterSources     ?? '',
  feedingStations:  existing?.feedingStations  ?? '',
  shelters:         existing?.shelters         ?? '',
  hasElectricity:   existing?.hasElectricity   ?? false,
  hasWater:         existing?.hasWater         ?? false,
  hasInternet:      existing?.hasInternet      ?? false,
  hasRoadAccess:    existing?.hasRoadAccess    ?? false,
  securityLevel:    existing?.securityLevel    ?? 'LOW',
});

function CapacityEditModal({
  open, onClose, locationId, existing,
}: {
  open: boolean;
  onClose: () => void;
  locationId: string;
  existing: LocationCapacity | null;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CapacityFormValues>({
    defaultValues: defaultFormValues(existing),
  });

  // Re-seed form when `existing` changes (e.g. modal re-opened with fresh data)
  useEffect(() => {
    if (open) form.reset(defaultFormValues(existing));
  }, [open, existing, form]);

  const mutation = useMutation({
    mutationFn: (values: CapacityFormValues) => {
      // Strip empty strings → undefined so backend sees them as "not set"
      const toNum = (v: number | '' | undefined) =>
        v === '' || v == null ? undefined : Number(v);

      const payload: LocationCapacityPayload = {
        maxAnimals:       toNum(values.maxAnimals),
        area:             toNum(values.area),
        areaUnit:         values.areaUnit,
        carryingCapacity: toNum(values.carryingCapacity),
        waterSources:     toNum(values.waterSources),
        feedingStations:  toNum(values.feedingStations),
        shelters:         toNum(values.shelters),
        hasElectricity:   values.hasElectricity,
        hasWater:         values.hasWater,
        hasInternet:      values.hasInternet,
        hasRoadAccess:    values.hasRoadAccess,
        securityLevel:    values.securityLevel,
      };
      // Upsert = PATCH: creates on first save, updates thereafter
      return locationsApi.upsertCapacity(locationId, payload);
    },
    onSuccess: () => {
      toast.success(
        existing ? 'Capacidad actualizada' : 'Capacidad configurada',
        existing ? 'Los cambios fueron guardados.' : 'La configuración inicial de capacidad se guardó.',
      );
      queryClient.invalidateQueries({ queryKey: ['location-capacity', locationId] });
      queryClient.invalidateQueries({ queryKey: ['location', locationId] });
      queryClient.invalidateQueries({ queryKey: ['location-summary', locationId] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error('Error al guardar', getFriendlyMessage(err));
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const max = Number(values.maxAnimals);
    if (!values.maxAnimals || !Number.isFinite(max) || max < 1) {
      toast.error('Datos inválidos', 'La capacidad máxima debe ser un número mayor a 0.');
      return;
    }
    mutation.mutate(values);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Editar capacidad' : 'Configurar capacidad'}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Info about currentAnimals */}
        {existing && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40">
            <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            <p className="text-xs text-sky-700 dark:text-sky-400">
              <strong>Ocupación actual: {existing.currentAnimals} animales.</strong> Este contador se ajusta
              automáticamente cuando los bovinos entran o salen de la ubicación — no se edita desde aquí.
            </p>
          </div>
        )}

        {/* Capacity + area */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Capacidad máxima <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={1}
              placeholder="Ej: 50"
              {...form.register('maxAnimals')}
            />
            <p className="mt-1 text-xs text-gray-400">Número máximo de animales.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Carga ganadera (UGR/ha)
            </label>
            <Input
              type="number"
              min={0}
              step="0.1"
              placeholder="Ej: 2.5"
              {...form.register('carryingCapacity')}
            />
          </div>
        </div>

        {/* Area */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Área</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Ej: 12.5"
              {...form.register('area')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidad</label>
            <Controller
              name="areaUnit"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value as AreaUnit)}
                  options={[
                    { value: 'HA',   label: 'ha' },
                    { value: 'M2',   label: 'm²' },
                    { value: 'ACRE', label: 'acres' },
                  ]}
                />
              )}
            />
          </div>
        </div>

        {/* Infrastructure counts */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fuentes de agua</label>
            <Input type="number" min={0} {...form.register('waterSources')} placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comederos</label>
            <Input type="number" min={0} {...form.register('feedingStations')} placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refugios</label>
            <Input type="number" min={0} {...form.register('shelters')} placeholder="0" />
          </div>
        </div>

        {/* Utilities toggles */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Servicios disponibles</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['hasElectricity', 'Electricidad', <Zap className="w-3.5 h-3.5" />],
              ['hasWater',       'Agua',         <Droplet className="w-3.5 h-3.5" />],
              ['hasInternet',    'Internet',     <Wifi className="w-3.5 h-3.5" />],
              ['hasRoadAccess',  'Acceso vial',  <Route className="w-3.5 h-3.5" />],
            ] as const).map(([name, label, icon]) => (
              <label key={name} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60">
                <input
                  type="checkbox"
                  {...form.register(name)}
                  className="rounded"
                />
                {icon}
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Security */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nivel de seguridad</label>
          <Controller
            name="securityLevel"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value as SecurityLevel)}
                options={[
                  { value: 'LOW',    label: 'Bajo' },
                  { value: 'MEDIUM', label: 'Medio' },
                  { value: 'HIGH',   label: 'Alto' },
                ]}
              />
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={mutation.isPending}>
            {existing ? 'Guardar cambios' : 'Crear capacidad'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyCapacityState({ onConfigure, canManage }: { onConfigure: () => void; canManage: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <Users className="w-8 h-8 text-gray-400" />
      </div>
      <div>
        <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
          Capacidad no configurada
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-sm">
          Esta ubicación aún no tiene información de capacidad. Configúrala para habilitar el seguimiento
          de ocupación y la asignación de bovinos.
        </p>
      </div>
      {canManage && (
        <Button size="sm" icon={<Edit3 className="w-3.5 h-3.5" />} onClick={onConfigure}>
          Configurar capacidad
        </Button>
      )}
    </div>
  );
}

// ─── LocationCapacityTab ──────────────────────────────────────────────────────

interface Props {
  locationId: string;
  /** @deprecated Capacity now comes exclusively from LocationCapacity (see getCapacity). */
  capacity?: number;
  /** @deprecated See above. */
  currentCount?: number;
}

export function LocationCapacityTab({ locationId }: Props) {
  const { user } = useAuth();
  const canManage = canUser(user?.role, 'MANAGE_LOCATION');
  const [editOpen, setEditOpen] = useState(false);

  const { data: capacity, isLoading } = useQuery({
    queryKey: ['location-capacity', locationId],
    queryFn: () => locationsApi.getCapacity(locationId),
    enabled: !!locationId,
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <Card>
        <div className="flex justify-center py-16"><Spinner size="md" /></div>
      </Card>
    );
  }

  // Empty state: no capacity record yet
  if (!capacity) {
    return (
      <>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle>Capacidad</CardTitle>
          </div>
          <EmptyCapacityState canManage={canManage} onConfigure={() => setEditOpen(true)} />
        </Card>

        <CapacityEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          locationId={locationId}
          existing={null}
        />
      </>
    );
  }

  const max     = capacity.maxAnimals ?? 0;
  const current = capacity.currentAnimals ?? 0;
  const avail   = Math.max(0, max - current);
  const pct     = max > 0 ? (current / max) * 100 : 0;

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle>Capacidad</CardTitle>
          </div>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              icon={<Edit3 className="w-3.5 h-3.5" />}
              onClick={() => setEditOpen(true)}
            >
              Editar
            </Button>
          )}
        </div>

        <div className="flex flex-col items-center gap-8">
          {/* Gauge */}
          <CapacityGauge pct={pct} />

          {/* Stat boxes */}
          <div className="grid grid-cols-3 gap-3 w-full">
            <StatBox
              label="Capacidad máx."
              value={max}
              sub="animales"
              color="text-gray-900 dark:text-white"
            />
            <StatBox
              label="Actualmente"
              value={current}
              sub="animales"
              color={pct >= 100 ? 'text-red-600 dark:text-red-400' : pct >= 85 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
            />
            <StatBox
              label="Disponibles"
              value={avail}
              sub="espacios"
              color={avail === 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
            />
          </div>

          {/* Progress bar */}
          {max > 0 && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>0</span>
                <span>{Math.round(pct)}% ocupado</span>
                <span>{max}</span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    pct >= 100 ? 'bg-red-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-600 dark:text-emerald-400">{current} presentes</span>
                <span className="text-gray-400">{avail} libres</span>
              </div>
            </div>
          )}

          {/* Area + carrying capacity */}
          {(capacity.area != null || capacity.carryingCapacity != null) && (
            <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              {capacity.area != null && (
                <StatBox
                  label="Área"
                  value={`${capacity.area} ${capacity.areaUnit === 'M2' ? 'm²' : capacity.areaUnit === 'ACRE' ? 'acres' : 'ha'}`}
                />
              )}
              {capacity.carryingCapacity != null && (
                <StatBox
                  label="Carga ganadera"
                  value={`${capacity.carryingCapacity}`}
                  sub="UGR/ha"
                />
              )}
            </div>
          )}

          {/* Infrastructure */}
          <div className="w-full pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Infraestructura</p>
            <div className="flex flex-wrap gap-1.5">
              {(capacity.waterSources ?? 0) > 0 && (
                <InfraChip icon={<Droplet className="w-3 h-3" />} label={`${capacity.waterSources} fuentes agua`} enabled />
              )}
              {(capacity.feedingStations ?? 0) > 0 && (
                <InfraChip icon={<Home className="w-3 h-3" />} label={`${capacity.feedingStations} comederos`} enabled />
              )}
              {(capacity.shelters ?? 0) > 0 && (
                <InfraChip icon={<Home className="w-3 h-3" />} label={`${capacity.shelters} refugios`} enabled />
              )}
              <InfraChip icon={<Zap className="w-3 h-3" />} label="Electricidad" enabled={capacity.hasElectricity} />
              <InfraChip icon={<Droplet className="w-3 h-3" />} label="Agua" enabled={capacity.hasWater} />
              <InfraChip icon={<Wifi className="w-3 h-3" />} label="Internet" enabled={capacity.hasInternet} />
              <InfraChip icon={<Route className="w-3 h-3" />} label="Acceso vial" enabled={capacity.hasRoadAccess} />
              {capacity.securityLevel && (
                <InfraChip
                  icon={<ShieldCheck className="w-3 h-3" />}
                  label={`Seguridad ${capacity.securityLevel === 'HIGH' ? 'alta' : capacity.securityLevel === 'MEDIUM' ? 'media' : 'baja'}`}
                  enabled
                />
              )}
            </div>
          </div>
        </div>
      </Card>

      <CapacityEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        locationId={locationId}
        existing={capacity}
      />
    </>
  );
}
