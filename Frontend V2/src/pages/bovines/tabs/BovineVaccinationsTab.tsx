/**
 * BovineVaccinationsTab — vaccination history + create/edit/delete for a single bovine.
 *
 * Consumes the dedicated vaccination endpoints (NOT the legacy events/health
 * stream). Sources:
 *   - useBovineVaccinations(id)        → paginated list of VaccinationResponse
 *   - useBovineVaccinationStatus(id)   → derived snapshot (UP_TO_DATE/PENDING/OVERDUE/NONE)
 *   - useCreateBovineVaccination(id)   → POST + cross-invalidation
 *   - useUpdateBovineVaccination(id)   → PATCH (Backend V-04) + cross-invalidation
 *   - useDeleteBovineVaccination(id)   → DELETE + cross-invalidation
 *
 * Labels: Backend V-06 embebe los labels en espanol dentro de la respuesta
 * (`vaccineTypeLabel`, `applicationRouteLabel`, `statusLabel`). El tab los
 * usa directamente con fallback al enum o a `STATUS_CONFIG` local para
 * respuestas serializadas antes de V-06.
 *
 * The status badge is sourced from the SERVER (server is the SoT for derived
 * fields). Frontend never recomputes it.
 */

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  useBovineVaccinations,
  useBovineVaccinationStatus,
  useCreateBovineVaccination,
  useUpdateBovineVaccination,
  useDeleteBovineVaccination,
  type VaccinationResponse,
} from '@/hooks/useBovines';
import { useBovineFilterOptions } from '@/hooks/useBovines';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { getFriendlyMessage, getErrorCode } from '@/utils/errorHandler';

import { Card, CardTitle } from '@/components/ui/Card';
import { BovineProtectionCard } from '@/components/bovines/BovineProtectionCard';
import { BovineVaccinationScheduleCard } from '@/components/bovines/BovineVaccinationScheduleCard';
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
  type UpdateVaccinationInput,
} from '@/types/bovine.dtos';

import {
  Syringe, Plus, ShieldCheck, ShieldAlert, ShieldX, Shield,
  Calendar, AlertTriangle, User as UserIcon, ChevronRight,
  Pencil, Trash2,
} from 'lucide-react';

// F-35 / Hallazgo H-1: label + variant + classes vienen del design-system
// para eliminar la triple fuente que tenia este componente, `BovineDetailPage`
// y el backend. Aqui solo conservamos los iconos, que son especificos del tab.
import {
  getVaccinationStatusLabel, getVaccinationStatusVariant, getVaccinationStatusClasses,
} from '@/design-system/tokens';

// ─── Status config ──────────────────────────────────────────────────────────
// Solo iconos locales — el label/variant/classes los obtenemos via tokens.

const STATUS_ICON: Record<VaccinationStatus, React.ElementType> = {
  UP_TO_DATE: ShieldCheck,
  PENDING:    Shield,
  OVERDUE:    ShieldAlert,
  NONE:       ShieldX,
};

// Conservado por compatibilidad con el cuerpo del componente que todavia
// indexa STATUS_CONFIG[status]. Cada acceso se resuelve a los helpers del
// design-system; aqui solo agregamos `Icon` que el design-system no expone.
const STATUS_CONFIG: Record<VaccinationStatus, { label: string; Icon: React.ElementType; classes: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  UP_TO_DATE: {
    label: getVaccinationStatusLabel('UP_TO_DATE'),
    Icon:  STATUS_ICON.UP_TO_DATE,
    variant: getVaccinationStatusVariant('UP_TO_DATE'),
    classes: getVaccinationStatusClasses('UP_TO_DATE'),
  },
  PENDING: {
    label: getVaccinationStatusLabel('PENDING'),
    Icon:  STATUS_ICON.PENDING,
    variant: getVaccinationStatusVariant('PENDING'),
    classes: getVaccinationStatusClasses('PENDING'),
  },
  OVERDUE: {
    label: getVaccinationStatusLabel('OVERDUE'),
    Icon:  STATUS_ICON.OVERDUE,
    variant: getVaccinationStatusVariant('OVERDUE'),
    classes: getVaccinationStatusClasses('OVERDUE'),
  },
  NONE: {
    label: getVaccinationStatusLabel('NONE'),
    Icon:  STATUS_ICON.NONE,
    variant: getVaccinationStatusVariant('NONE'),
    classes: getVaccinationStatusClasses('NONE'),
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Normaliza una fecha ISO o un Date a `YYYY-MM-DD` para inputs type=date.
 * Devuelve '' si no es parseable.
 */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

// ─── Zod schema — create + edit comparten estructura ────────────────────────
//
// El schema es el mismo para create y edit. La unica diferencia: en edit
// `vaccineType` puede no tocarse (RHF lo prellena con el valor actual). El
// payload final del edit solo envia los campos modificados (diff por
// `dirtyFields` de RHF).

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
  // Override de la duracion de inmunidad. Si se omite, backend usa el
  // default del catalogo VaccineDiseaseProtection. Backend valida 0-3650.
  immunityDurationDays: z.preprocess((v) => (v === '' || v == null) ? undefined : v,
                          z.coerce.number().int().min(0).max(3650).optional()),
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
  const [editingVaccination, setEditingVaccination] = useState<VaccinationResponse | null>(null);
  const [deletingVaccination, setDeletingVaccination] = useState<VaccinationResponse | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: listData, isLoading: loadingList } = useBovineVaccinations(bovineId);
  const { data: statusSnap, isLoading: loadingStatus } = useBovineVaccinationStatus(bovineId);
  const { data: filterOptions } = useBovineFilterOptions();

  const createMutation = useCreateBovineVaccination(bovineId);
  const updateMutation = useUpdateBovineVaccination(bovineId);
  const deleteMutation = useDeleteBovineVaccination(bovineId);

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

  // ── Form: CREATE ─────────────────────────────────────────────────────────
  const createForm = useForm<FormValues>({
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
      immunityDurationDays: undefined,
      notes:                '',
    },
  });

  const onCreateSubmit = createForm.handleSubmit((values) => {
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
      immunityDurationDays: values.immunityDurationDays,
      notes:                values.notes || undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Vacuna registrada', 'El registro se aplicó correctamente.');
        setShowApplyModal(false);
        createForm.reset();
      },
      onError: (err: unknown) => {
        const code = getErrorCode(err);
        if (code === 'VACCINATION_DUPLICATE') {
          toast.error('Vacuna duplicada',
            'Ya hay una vacuna de este tipo registrada en la misma fecha para este bovino.');
        } else {
          toast.error('Error al registrar', getFriendlyMessage(err));
        }
      },
    });
  });

  // ── Form: EDIT ───────────────────────────────────────────────────────────
  // Form separado para no contaminar el estado del create cuando se abre el
  // modal de edicion. RHF rastrea `dirtyFields` para enviar solo el diff.
  const editForm = useForm<FormValues>({
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
      immunityDurationDays: undefined,
      notes:                '',
    },
  });

  // Hidratar el editForm cada vez que cambia la vacuna seleccionada para editar
  useEffect(() => {
    if (!editingVaccination) return;
    editForm.reset({
      vaccineType:          editingVaccination.vaccineType,
      vaccineName:          editingVaccination.vaccineName ?? '',
      manufacturer:         editingVaccination.manufacturer ?? '',
      batchNumber:          editingVaccination.batchNumber ?? '',
      doseNumber:           editingVaccination.doseNumber ?? undefined,
      doseAmountMl:         editingVaccination.doseAmountMl ?? undefined,
      applicationRoute:     (editingVaccination.applicationRoute ?? '') as FormValues['applicationRoute'],
      applicationDate:      toDateInput(editingVaccination.applicationDate),
      nextDueDate:          toDateInput(editingVaccination.nextDueDate),
      withdrawalPeriodDays: editingVaccination.withdrawalPeriodDays ?? undefined,
      immunityDurationDays: editingVaccination.immunityDurationDays ?? undefined,
      notes:                editingVaccination.notes ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingVaccination?.id]);

  const onEditSubmit = editForm.handleSubmit((values) => {
    if (!editingVaccination) return;

    // Construir payload con SOLO los campos dirty (PATCH parcial). Asi el
    // backend no tiene que recalcular ni revalidar nada que no cambio.
    const dirty = editForm.formState.dirtyFields;
    const patch: UpdateVaccinationInput = {};

    if (dirty.vaccineType)          patch.vaccineType = values.vaccineType;
    if (dirty.vaccineName)          patch.vaccineName = values.vaccineName || undefined;
    if (dirty.manufacturer)         patch.manufacturer = values.manufacturer || undefined;
    if (dirty.batchNumber)          patch.batchNumber = values.batchNumber || undefined;
    if (dirty.doseNumber)           patch.doseNumber = values.doseNumber;
    if (dirty.doseAmountMl)         patch.doseAmountMl = values.doseAmountMl;
    if (dirty.applicationRoute)     patch.applicationRoute = (values.applicationRoute || undefined) as ApplicationRoute | undefined;
    if (dirty.applicationDate)      patch.applicationDate = values.applicationDate;
    if (dirty.nextDueDate) {
      // Permitir borrar la nextDueDate enviando null explicito.
      patch.nextDueDate = values.nextDueDate || null;
    }
    if (dirty.withdrawalPeriodDays) patch.withdrawalPeriodDays = values.withdrawalPeriodDays;
    if (dirty.immunityDurationDays) {
      // immunityDurationDays acepta null para volver al default del catalogo.
      patch.immunityDurationDays = values.immunityDurationDays ?? null;
    }
    if (dirty.notes)                patch.notes = values.notes || undefined;

    if (Object.keys(patch).length === 0) {
      toast.info('Sin cambios', 'No se modifico ningun campo.');
      setEditingVaccination(null);
      return;
    }

    updateMutation.mutate(
      { vaccinationId: editingVaccination.id, data: patch },
      {
        onSuccess: () => {
          toast.success('Vacuna actualizada', 'Los cambios se guardaron correctamente.');
          setEditingVaccination(null);
          editForm.reset();
        },
        onError: (err: unknown) => {
          const code = getErrorCode(err);
          if (code === 'VACCINATION_DUPLICATE') {
            toast.error('Vacuna duplicada',
              'Ya existe otra vacuna de este tipo en la nueva fecha para este bovino. Elige una fecha distinta.');
            // Marcar el campo en el form para resaltar al usuario.
            editForm.setError('applicationDate', { message: 'Genera un duplicado con otra vacuna.' });
          } else if (code === 'VACCINATION_NOT_FOUND') {
            toast.error('Vacuna no encontrada',
              'El registro fue eliminado por otro usuario. Cerrando editor.');
            setEditingVaccination(null);
          } else {
            toast.error('Error al actualizar', getFriendlyMessage(err));
          }
        },
      },
    );
  });

  // ── Delete confirmacion ──────────────────────────────────────────────────
  function confirmDelete() {
    if (!deletingVaccination) return;
    deleteMutation.mutate(deletingVaccination.id, {
      onSuccess: () => {
        toast.success('Vacuna eliminada', 'El registro fue removido.');
        setDeletingVaccination(null);
      },
      onError: (err: unknown) => {
        const code = getErrorCode(err);
        if (code === 'VACCINATION_NOT_FOUND') {
          toast.error('Vacuna no encontrada',
            'El registro ya habia sido eliminado.');
          setDeletingVaccination(null);
        } else {
          toast.error('Error al eliminar', getFriendlyMessage(err));
        }
      },
    });
  }

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
  // Backend V-06: preferir el label embebido del servidor; fallback al map local.
  const statusLabel = statusSnap?.statusLabel || statusCfg.label;

  const nextDue = statusSnap?.nextDueAt
    ? { date: statusSnap.nextDueAt, days: daysUntil(statusSnap.nextDueAt) }
    : null;

  return (
    <div className="space-y-4">
      {/* ── Proteccion por enfermedad (derivada de vacunas) ──────────────── */}
      <BovineProtectionCard bovineId={bovineId} />

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
                {statusLabel}
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

      {/* F-39 / Backend V-05: calendario sugerido. Lista lo que le toca al
          bovino segun protocolo (edad/sexo/raza) con estado por vacuna.
          Insertado ENTRE el status summary y la lista historica para que
          el VET vea en orden: estado global → que falta → que ya tiene. */}
      <BovineVaccinationScheduleCard bovineId={bovineId} />

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
              <VaccinationCard
                key={v.id}
                v={v}
                canManage={canManage}
                onEdit={() => setEditingVaccination(v)}
                onDelete={() => setDeletingVaccination(v)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* ── Apply (CREATE) modal ─────────────────────────────────────────── */}
      <Modal
        open={showApplyModal}
        onClose={() => { setShowApplyModal(false); createForm.reset(); createMutation.reset(); }}
        title="Registrar nueva vacuna"
        size="lg"
      >
        <VaccinationForm
          form={createForm}
          onSubmit={onCreateSubmit}
          vaccineTypeOptions={vaccineTypeOptions}
          routeOptions={routeOptions}
          applicatorName={user?.username || user?.email || 'Tú'}
          submitting={createMutation.isPending}
          submitError={createMutation.error}
          submitLabel="Registrar vacuna"
          onCancel={() => { setShowApplyModal(false); createForm.reset(); createMutation.reset(); }}
        />
      </Modal>

      {/* ── Edit modal (Backend V-04) ────────────────────────────────────── */}
      <Modal
        open={!!editingVaccination}
        onClose={() => { setEditingVaccination(null); editForm.reset(); updateMutation.reset(); }}
        title="Editar vacuna"
        size="lg"
      >
        {editingVaccination && (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Editando registro del{' '}
              <strong>{formatDate(editingVaccination.applicationDate)}</strong>.
              Solo se enviaran al servidor los campos modificados (PATCH parcial).
            </p>
            <VaccinationForm
              form={editForm}
              onSubmit={onEditSubmit}
              vaccineTypeOptions={vaccineTypeOptions}
              routeOptions={routeOptions}
              applicatorName={editingVaccination.applicatorName || 'Aplicador original'}
              submitting={updateMutation.isPending}
              submitError={updateMutation.error}
              submitLabel="Guardar cambios"
              onCancel={() => { setEditingVaccination(null); editForm.reset(); updateMutation.reset(); }}
              applicatorLocked
            />
          </>
        )}
      </Modal>

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      <Modal
        open={!!deletingVaccination}
        onClose={() => setDeletingVaccination(null)}
        title="Eliminar vacuna"
        size="sm"
      >
        {deletingVaccination && (
          <div className="space-y-4">
            <Alert variant="warning">
              Esta acción no puede deshacerse desde la UI. Se reevaluará el estado
              de vacunación del bovino tras eliminar.
            </Alert>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p>¿Confirmas eliminar esta vacuna?</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-500">
                <li>
                  <strong>Tipo:</strong>{' '}
                  {deletingVaccination.vaccineTypeLabel || deletingVaccination.vaccineType}
                </li>
                <li>
                  <strong>Fecha:</strong> {formatDate(deletingVaccination.applicationDate)}
                </li>
                {deletingVaccination.batchNumber && (
                  <li><strong>Lote:</strong> {deletingVaccination.batchNumber}</li>
                )}
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeletingVaccination(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 className="w-4 h-4" />}
                loading={deleteMutation.isPending}
                onClick={confirmDelete}
              >
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Vaccination form (create + edit comparten markup) ──────────────────────

interface VaccinationFormProps {
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  vaccineTypeOptions: { value: string; label: string }[];
  routeOptions: { value: string; label: string }[];
  applicatorName: string;
  submitting: boolean;
  submitError: unknown;
  submitLabel: string;
  onCancel: () => void;
  /** True en modo edicion: el applicator no es el current user. */
  applicatorLocked?: boolean;
}

function VaccinationForm({
  form, onSubmit,
  vaccineTypeOptions, routeOptions,
  applicatorName, submitting, submitError, submitLabel,
  onCancel, applicatorLocked,
}: VaccinationFormProps) {
  const { register, formState: { errors } } = form;

  return (
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

      <div>
        <Input
          label="Duración de inmunidad personalizada (días)"
          type="number"
          min={0}
          max={3650}
          placeholder="Dejar vacío para usar el default del catálogo"
          error={errors.immunityDurationDays?.message}
          {...register('immunityDurationDays')}
        />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          Override del catálogo. Si tienes información del fabricante o
          del lote que sugiere una duración distinta a la estándar,
          capturala aquí. Rango: 0–3650 días.
        </p>
      </div>

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
          Aplicador: <strong className="text-gray-700 dark:text-gray-300">{applicatorName}</strong>
          {applicatorLocked && (
            <span className="ml-1 text-[11px] text-gray-400">
              (no editable — borrar y recrear para cambiarlo)
            </span>
          )}
        </span>
      </div>

      {submitError ? (
        <Alert variant="error">{getFriendlyMessage(submitError)}</Alert>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          icon={<Syringe className="w-4 h-4" />}
          loading={submitting}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── Vaccination card ────────────────────────────────────────────────────────

interface VaccinationCardProps {
  v: VaccinationResponse;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function VaccinationCard({ v, canManage, onEdit, onDelete }: VaccinationCardProps) {
  const nextDays = v.nextDueDate ? daysUntil(v.nextDueDate) : null;
  const nextOverdue = nextDays != null && nextDays < 0;
  const nextSoon    = nextDays != null && nextDays >= 0 && nextDays <= 14;

  // Backend V-06: preferir los labels embebidos; fallback al enum crudo
  // cuando vienen respuestas legacy sin el campo.
  const typeLabel  = v.vaccineTypeLabel || v.vaccineType;
  const routeLabel = v.applicationRouteLabel || v.applicationRoute;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
        <Syringe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {typeLabel}
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
          {routeLabel && <span>· {routeLabel}</span>}
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
      {canManage ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            title="Editar vacuna"
            className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar vacuna"
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 hidden sm:block" />
      )}
    </div>
  );
}
