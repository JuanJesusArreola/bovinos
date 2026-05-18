/**
 * BovineVaccinationsTab — vaccination history + create form for a single bovine.
 *
 * Consumes the dedicated vaccination endpoints (NOT the legacy events/health
 * stream). Sources:
 *   - useBovineVaccinations(id)        → paginated list of VaccinationResponse
 *   - useBovineVaccinationStatus(id)   → derived snapshot (UP_TO_DATE/PENDING/OVERDUE/NONE)
 *   - useCreateBovineVaccination(id)   → POST + cross-invalidation
 *
 * The status badge is sourced from the SERVER (server is the SoT for derived
 * fields). Frontend never recomputes it.
 */

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  useBovineVaccinations,
  useBovineVaccinationStatus,
  useCreateBovineVaccination,
  type VaccinationResponse,
} from '@/hooks/useBovines';
import { useBovineFilterOptions } from '@/hooks/useBovines';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { getFriendlyMessage } from '@/utils/errorHandler';

import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';

import {
  VaccineType,
  ApplicationRoute,
  VaccinationStatus,
  type CreateVaccinationInput,
} from '@/types/bovine.dtos';

import {
  Syringe, Plus, ShieldCheck, ShieldAlert, ShieldX, Shield,
  Calendar, AlertTriangle, User as UserIcon, ChevronRight,
} from 'lucide-react';

// ─── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<VaccinationStatus, { label: string; Icon: React.ElementType; classes: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  UP_TO_DATE: {
    label: 'Al día', Icon: ShieldCheck, variant: 'success',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  PENDING: {
    label: 'Pendiente', Icon: Shield, variant: 'warning',
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  OVERDUE: {
    label: 'Atrasada', Icon: ShieldAlert, variant: 'danger',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  NONE: {
    label: 'Sin vacunas', Icon: ShieldX, variant: 'default',
    classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── Zod schema — mirrors backend CreateVaccinationInput ────────────────────

const vaccinationSchema = z.object({
  vaccineType:          z.nativeEnum(VaccineType, { error: 'Selecciona el tipo de vacuna' }),
  vaccineName:          z.string().max(200).optional().or(z.literal('')),
  manufacturer:         z.string().max(200).optional().or(z.literal('')),
  batchNumber:          z.string().max(100).optional().or(z.literal('')),
  doseNumber:           z.preprocess((v) => (v === '' || v == null) ? undefined : v,
                          z.coerce.number().int().min(1, 'Debe ser ≥ 1').optional()),
  doseAmountMl:         z.preprocess((v) => (v === '' || v == null) ? undefined : v,
                          z.coerce.number().min(0).optional()),
  applicationRoute:     z.nativeEnum(ApplicationRoute).optional().or(z.literal('')),
  applicationDate:      z.string().min(1, 'Fecha requerida'),
  nextDueDate:          z.string().optional().or(z.literal('')),
  withdrawalPeriodDays: z.preprocess((v) => (v === '' || v == null) ? undefined : v,
                          z.coerce.number().int().min(0).optional()),
  notes:                z.string().max(500).optional().or(z.literal('')),
}).refine(
  (d) => new Date(d.applicationDate).getTime() <= Date.now() + 86_400_000,
  { message: 'La fecha de aplicación no puede ser futura.', path: ['applicationDate'] },
).refine(
  (d) => !d.nextDueDate || new Date(d.nextDueDate) > new Date(d.applicationDate),
  { message: 'La próxima dosis debe ser después de la aplicación.', path: ['nextDueDate'] },
);

type FormValues = z.infer<typeof vaccinationSchema>;

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  bovineId: string;
  /** @deprecated The tab now reads vaccination status from its own hook. */
  vaccinationStatus?: VaccinationStatus;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BovineVaccinationsTab({ bovineId }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = canUser(user?.role, 'MANAGE_HEALTH');

  const [showApplyModal, setShowApplyModal] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: listData, isLoading: loadingList } = useBovineVaccinations(bovineId);
  const { data: statusSnap, isLoading: loadingStatus } = useBovineVaccinationStatus(bovineId);
  const { data: filterOptions } = useBovineFilterOptions();

  const createMutation = useCreateBovineVaccination(bovineId);

  const vaccines: VaccinationResponse[] = listData?.items ?? [];

  // Catalog options for selects — fallback to enum keys if backend missing them.
  const vaccineTypeOptions = useMemo(() => {
    if (filterOptions?.vaccineTypes && filterOptions.vaccineTypes.length > 0) {
      return filterOptions.vaccineTypes.map((o) => ({ value: o.value, label: o.label }));
    }
    return Object.values(VaccineType).map((v) => ({ value: v, label: v }));
  }, [filterOptions]);

  const routeOptions = useMemo(() => {
    const base = [{ value: '', label: 'No especificar' }];
    if (filterOptions?.applicationRoutes && filterOptions.applicationRoutes.length > 0) {
      return [...base, ...filterOptions.applicationRoutes.map((o) => ({ value: o.value, label: o.label }))];
    }
    return [
      ...base,
      ...Object.values(ApplicationRoute).map((v) => ({ value: v, label: v })),
    ];
  }, [filterOptions]);

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(vaccinationSchema) as any,
    defaultValues: {
      vaccineType:          VaccineType.BRUCELLOSIS,
      vaccineName:          '',
      manufacturer:         '',
      batchNumber:          '',
      doseNumber:           undefined,
      doseAmountMl:         undefined,
      applicationRoute:     '',
      applicationDate:      todayISO(),
      nextDueDate:          '',
      withdrawalPeriodDays: undefined,
      notes:                '',
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!user?.id) {
      toast.error('Sesión inválida', 'No se pudo determinar el usuario aplicador. Intenta volver a iniciar sesión.');
      return;
    }

    const payload: Omit<CreateVaccinationInput, 'bovineId'> = {
      vaccineType:          values.vaccineType,
      vaccineName:          values.vaccineName || undefined,
      manufacturer:         values.manufacturer || undefined,
      batchNumber:          values.batchNumber || undefined,
      doseNumber:           values.doseNumber,
      doseAmountMl:         values.doseAmountMl,
      applicationRoute:     (values.applicationRoute || undefined) as ApplicationRoute | undefined,
      applicationDate:      values.applicationDate,
      nextDueDate:          values.nextDueDate || undefined,
      applicatorId:         user.id,        // current user is the applicator
      withdrawalPeriodDays: values.withdrawalPeriodDays,
      notes:                values.notes || undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Vacuna registrada', 'El registro se aplicó correctamente.');
        setShowApplyModal(false);
        reset();
      },
      onError: (err: unknown) => {
        toast.error('Error al registrar', getFriendlyMessage(err));
      },
    });
  });

  // ── Render ────────────────────────────────────────────────────────────────

  // Loading initial skeleton
  if (loadingList || loadingStatus) {
    return (
      <div className="flex justify-center py-10"><Spinner /></div>
    );
  }

  const status = statusSnap?.status ?? VaccinationStatus.NONE;
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.Icon;

  const nextDue = statusSnap?.nextDueAt
    ? { date: statusSnap.nextDueAt, days: daysUntil(statusSnap.nextDueAt) }
    : null;

  return (
    <div className="space-y-4">
      {/* ── Status summary card ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', statusCfg.classes)}>
              <StatusIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Estado de vacunación
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {statusCfg.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {statusSnap?.totalApplied ?? 0} vacuna{(statusSnap?.totalApplied ?? 0) !== 1 ? 's' : ''} aplicada{(statusSnap?.totalApplied ?? 0) !== 1 ? 's' : ''}
                {statusSnap && statusSnap.overdueCount > 0 && (
                  <span className="ml-2 text-red-600 font-semibold">
                    · {statusSnap.overdueCount} atrasada{statusSnap.overdueCount !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
          {canManage && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowApplyModal(true)}>
              Registrar vacuna
            </Button>
          )}
        </div>

        {/* Next due banner */}
        {nextDue && (
          <div className={cn(
            'mt-4 flex items-start gap-3 p-3 rounded-lg border',
            nextDue.days < 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : nextDue.days <= 7
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800',
          )}>
            {nextDue.days < 0
              ? <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              : <Calendar className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
            }
            <div className="text-sm">
              <p className={cn(
                'font-medium',
                nextDue.days < 0 ? 'text-red-700 dark:text-red-300'
                                 : 'text-gray-700 dark:text-gray-300',
              )}>
                {nextDue.days < 0
                  ? `Próxima dosis vencida hace ${Math.abs(nextDue.days)} día${Math.abs(nextDue.days) !== 1 ? 's' : ''}`
                  : nextDue.days === 0
                    ? 'Próxima dosis hoy'
                    : `Próxima dosis en ${nextDue.days} día${nextDue.days !== 1 ? 's' : ''}`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Programada para {formatDate(nextDue.date)}
              </p>
            </div>
          </div>
        )}

        {/* Last vaccine */}
        {statusSnap?.lastVaccinationAt && (
          <p className="text-xs text-gray-500 mt-3">
            Última aplicación: <strong className="text-gray-700 dark:text-gray-300">{statusSnap.lastVaccineType ?? '—'}</strong>
            {' '}({formatDate(statusSnap.lastVaccinationAt)})
          </p>
        )}
      </Card>

      {/* ── Vaccinations list ────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Historial de vacunaciones</CardTitle>
          <span className="text-xs text-gray-500">
            {vaccines.length} de {listData?.total ?? 0}
          </span>
        </div>

        {vaccines.length === 0 ? (
          <div className="text-center py-10">
            <Syringe className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Este bovino aún no tiene vacunas registradas.
            </p>
            {canManage && (
              <Button
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                className="mt-3"
                onClick={() => setShowApplyModal(true)}
              >
                Registrar primera vacuna
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {vaccines.map((v) => (
              <VaccinationCard key={v.id} v={v} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Apply modal ──────────────────────────────────────────────────── */}
      <Modal
        open={showApplyModal}
        onClose={() => { setShowApplyModal(false); reset(); createMutation.reset(); }}
        title="Registrar nueva vacuna"
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Vaccine type + name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de vacuna <span className="text-red-500">*</span>
              </label>
              <Select
                options={vaccineTypeOptions}
                error={errors.vaccineType?.message as string | undefined}
                {...register('vaccineType')}
              />
            </div>
            <Input
              label="Nombre comercial"
              placeholder="Ej: Vacuna Brucella RB51"
              error={errors.vaccineName?.message}
              {...register('vaccineName')}
            />
          </div>

          {/* Manufacturer + batch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Fabricante"
              placeholder="Ej: Zoetis"
              error={errors.manufacturer?.message}
              {...register('manufacturer')}
            />
            <Input
              label="Número de lote"
              placeholder="Ej: BR2026-0042"
              error={errors.batchNumber?.message}
              {...register('batchNumber')}
            />
          </div>

          {/* Dose info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Número de dosis"
              type="number"
              min={1}
              placeholder="Ej: 1"
              error={errors.doseNumber?.message}
              {...register('doseNumber')}
            />
            <Input
              label="Cantidad (ml)"
              type="number"
              step="0.1"
              min={0}
              placeholder="Ej: 2.0"
              error={errors.doseAmountMl?.message}
              {...register('doseAmountMl')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vía de aplicación
              </label>
              <Select
                options={routeOptions}
                error={errors.applicationRoute?.message as string | undefined}
                {...register('applicationRoute')}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Fecha de aplicación *"
              type="date"
              max={todayISO()}
              error={errors.applicationDate?.message}
              {...register('applicationDate')}
            />
            <Input
              label="Próxima dosis (opcional)"
              type="date"
              error={errors.nextDueDate?.message}
              {...register('nextDueDate')}
            />
          </div>

          {/* Withdrawal */}
          <Input
            label="Periodo de retiro (días)"
            type="number"
            min={0}
            placeholder="Días en los que la carne/leche no puede comercializarse"
            error={errors.withdrawalPeriodDays?.message}
            {...register('withdrawalPeriodDays')}
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Observaciones, reacción del bovino, etc."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            {errors.notes && <p className="mt-1 text-xs text-red-500">{errors.notes.message}</p>}
          </div>

          {/* Applicator info */}
          <div className="flex items-center gap-2 text-xs text-gray-500 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <UserIcon className="w-3.5 h-3.5" />
            <span>
              Aplicador: <strong className="text-gray-700 dark:text-gray-300">{user?.username || user?.email || 'Tú'}</strong>
            </span>
          </div>

          {createMutation.error && (
            <Alert variant="error">{getFriendlyMessage(createMutation.error)}</Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => { setShowApplyModal(false); reset(); createMutation.reset(); }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              icon={<Syringe className="w-4 h-4" />}
              loading={createMutation.isPending}
            >
              Registrar vacuna
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Vaccination card ────────────────────────────────────────────────────────

function VaccinationCard({ v }: { v: VaccinationResponse }) {
  const nextDays = v.nextDueDate ? daysUntil(v.nextDueDate) : null;
  const nextOverdue = nextDays != null && nextDays < 0;
  const nextSoon    = nextDays != null && nextDays >= 0 && nextDays <= 14;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
        <Syringe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {v.vaccineType}
          </p>
          {v.vaccineName && (
            <span className="text-xs text-gray-500">({v.vaccineName})</span>
          )}
          {v.doseNumber != null && (
            <Badge variant="default">Dosis #{v.doseNumber}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
          <span>
            <Calendar className="inline w-3 h-3 mr-0.5" />
            {formatDate(v.applicationDate)}
          </span>
          {v.applicationRoute && <span>· {v.applicationRoute}</span>}
          {v.doseAmountMl != null && <span>· {v.doseAmountMl} ml</span>}
          {v.manufacturer && <span>· {v.manufacturer}</span>}
          {v.batchNumber && <span>· lote {v.batchNumber}</span>}
        </div>
        {v.notes && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">"{v.notes}"</p>
        )}
        {v.nextDueDate && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <Calendar className={cn('w-3 h-3', nextOverdue ? 'text-red-500' : nextSoon ? 'text-amber-500' : 'text-gray-400')} />
            <span className={cn(
              nextOverdue ? 'text-red-600 dark:text-red-400 font-medium'
                          : nextSoon ? 'text-amber-700 dark:text-amber-400'
                                     : 'text-gray-500',
            )}>
              Próxima dosis: {formatDate(v.nextDueDate)}
              {nextOverdue && ` (vencida ${Math.abs(nextDays!)} d)`}
              {nextSoon && !nextOverdue && ` (en ${nextDays} d)`}
            </span>
          </div>
        )}
      </div>
      {v.applicatorName && (
        <div className="text-xs text-gray-400 shrink-0 hidden sm:flex items-center gap-1">
          <UserIcon className="w-3 h-3" />
          {v.applicatorName}
        </div>
      )}
      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 hidden sm:block" />
    </div>
  );
}
