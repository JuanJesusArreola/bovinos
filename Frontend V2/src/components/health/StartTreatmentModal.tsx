/**
 * Modal para iniciar un tratamiento sobre un HealthRecord existente.
 *
 * Lo importante de este flujo separado:
 *   1. El HealthRecord ya existe (se creo antes con vitales + diagnostico).
 *   2. Aqui anadimos el plan terapeutico real: que medicamentos, dosis,
 *      frecuencia, duracion y - si aplica - el inventoryItemId para que
 *      el backend RESERVE stock automaticamente.
 *   3. Si el stock no alcanza, el backend rechaza con 400 antes de
 *      modificar el record. La UI muestra el error inline para que el
 *      VET ajuste cantidades o cambie el medicamento.
 *
 * Diferencias con la creacion legacy del HealthRecord (que ya soporta
 * medicaciones embebidas en HealthListPage):
 *   - Aqui las cantidades son numericas (dosageAmount + dosageUnit)
 *     para que el backend pueda calcular total a reservar.
 *   - Aqui pasamos por /treatment/start, que reserva stock; en la
 *     creacion legacy NO hay reserva.
 *
 * Para anadir mas de un medicamento, useFieldArray con tarjetas
 * apilables. Cada tarjeta ofrece selector de inventoryItem opcional
 * (texto libre por ahora; el wire al modulo de inventario queda
 * pendiente).
 */

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Plus, Trash2, Pill, Play } from 'lucide-react';
import { useToast } from '@/store/ToastContext';
import { useStartTreatment } from '@/hooks/useBovineHealth';
import type {
  StartTreatmentInput,
  TreatmentApplicationRoute,
} from '@/types/health.types';

interface StartTreatmentModalProps {
  open: boolean;
  onClose: () => void;
  healthId: string;
  bovineId?: string;
  /** Diagnostico para pre-llenar el campo. Idealmente lo pasa el caller
   *  con el `primaryDiagnosis` del HealthRecord. */
  defaultDiagnosis?: string;
  /** Nombre del VET para pre-llenar (idealmente del useAuth). */
  defaultVet?: string;
}

const ROUTE_OPTIONS: { value: TreatmentApplicationRoute; label: string }[] = [
  { value: 'INTRAMUSCULAR', label: 'Intramuscular' },
  { value: 'SUBCUTANEOUS',  label: 'Subcutanea' },
  { value: 'INTRAVENOUS',   label: 'Intravenosa' },
  { value: 'ORAL',          label: 'Oral' },
  { value: 'TOPICAL',       label: 'Topica' },
  { value: 'INTRANASAL',    label: 'Intranasal' },
  { value: 'INTRADERMAL',   label: 'Intradermica' },
  { value: 'INJECTABLE',    label: 'Inyectable (otro)' },
  { value: 'OTHER',         label: 'Otra' },
];

const medicationSchema = z.object({
  name:             z.string().min(1, 'Nombre requerido').max(150),
  inventoryItemId:  z.string().optional().or(z.literal('')),
  dosage:           z.string().optional().or(z.literal('')),
  dosageAmount:     z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().positive().optional(),
  ),
  dosageUnit:       z.string().optional().or(z.literal('')),
  frequency:        z.string().optional().or(z.literal('')),
  durationDays:     z.coerce.number().int().min(1).max(365),
  applicationRoute: z.enum([
    'ORAL', 'INJECTABLE', 'TOPICAL', 'INTRAVENOUS',
    'INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRANASAL', 'INTRADERMAL', 'OTHER',
  ]),
  withdrawalPeriodDays: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().int().min(0).max(365).optional(),
  ),
  targetSite:       z.string().max(150).optional().or(z.literal('')),
  notes:            z.string().max(500).optional().or(z.literal('')),
});

const schema = z.object({
  diagnosis:        z.string().max(500).optional().or(z.literal('')),
  startDate:        z.string().optional().or(z.literal('')),
  veterinarianName: z.string().max(150).optional().or(z.literal('')),
  medications:      z.array(medicationSchema).min(1, 'Anade al menos un medicamento'),
  notes:            z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StartTreatmentModal({
  open, onClose, healthId, bovineId, defaultDiagnosis, defaultVet,
}: StartTreatmentModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useStartTreatment({ bovineId });

  const {
    register, handleSubmit, control, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      diagnosis:        defaultDiagnosis ?? '',
      startDate:        todayDate(),
      veterinarianName: defaultVet ?? '',
      medications:      [{
        name:             '',
        durationDays:     5,
        applicationRoute: 'INTRAMUSCULAR',
      }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'medications',
  });

  async function onSubmit(values: FormValues) {
    try {
      // Convertimos a la shape exacta del backend, limpiando strings vacios.
      const payload: StartTreatmentInput = {
        healthId,
        diagnosis:        values.diagnosis?.trim() || undefined,
        startDate:        values.startDate
          ? new Date(values.startDate).toISOString()
          : undefined,
        veterinarianName: values.veterinarianName?.trim() || undefined,
        notes:            values.notes?.trim() || undefined,
        medications:      values.medications.map((m) => ({
          name:                 m.name.trim(),
          inventoryItemId:      m.inventoryItemId?.trim() || undefined,
          dosage:               m.dosage?.trim() || undefined,
          dosageAmount:         m.dosageAmount,
          dosageUnit:           m.dosageUnit?.trim() || undefined,
          frequency:            m.frequency?.trim() || undefined,
          durationDays:         m.durationDays,
          applicationRoute:     m.applicationRoute,
          withdrawalPeriodDays: m.withdrawalPeriodDays,
          targetSite:           m.targetSite?.trim() || undefined,
          notes:                m.notes?.trim() || undefined,
        })),
      };
      await mutation.mutateAsync(payload);
      toastSuccess(
        'Tratamiento iniciado',
        values.medications.some((m) => m.inventoryItemId)
          ? 'Stock reservado en inventario.'
          : 'El tratamiento quedo registrado.',
      );
      reset();
      onClose();
    } catch (err) {
      // Errores tipicos del backend:
      //   - Stock insuficiente: backend devuelve 400 con detalle.
      //   - Tratamiento ya iniciado: 409.
      // Mostramos el mensaje crudo en el toast para que el VET vea
      // exactamente que medicamento fallo.
      const msg =
        (err as any)?.response?.data?.error?.message
        ?? (err as Error)?.message
        ?? 'Verifica los datos e intenta nuevamente.';
      toastError('No se pudo iniciar el tratamiento', msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Iniciar tratamiento" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert variant="info">
          Al iniciar el tratamiento, el sistema reservara automaticamente el
          stock de los medicamentos que tengan inventario vinculado. Si no
          hay stock suficiente, la operacion sera rechazada.
        </Alert>

        {/* Datos generales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Diagnostico"
            placeholder="Anaplasmosis bovina"
            error={errors.diagnosis?.message}
            {...register('diagnosis')}
          />
          <Input
            type="date"
            label="Fecha de inicio"
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <Input
            label="Veterinario responsable"
            placeholder="Dr. Ramirez"
            error={errors.veterinarianName?.message}
            {...register('veterinarianName')}
          />
        </div>

        {/* Medicamentos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Pill className="w-4 h-4 text-primary-600" />
              Medicamentos ({fields.length})
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => append({
                name:             '',
                durationDays:     5,
                applicationRoute: 'INTRAMUSCULAR',
              })}
            >
              Anadir medicamento
            </Button>
          </div>

          {fields.map((f, idx) => (
            <div
              key={f.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Medicamento #{idx + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                    title="Eliminar medicamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Nombre *"
                  placeholder="Oxitetraciclina 20%"
                  error={errors.medications?.[idx]?.name?.message}
                  {...register(`medications.${idx}.name`)}
                />
                <Input
                  label="Inventory Item ID"
                  placeholder="UUID del inventario (opcional)"
                  {...register(`medications.${idx}.inventoryItemId`)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Dosis (texto)"
                  placeholder="20 mg/kg"
                  {...register(`medications.${idx}.dosage`)}
                />
                <Input
                  type="number"
                  step="0.01"
                  label="Cantidad numerica"
                  placeholder="7.6"
                  error={errors.medications?.[idx]?.dosageAmount?.message}
                  {...register(`medications.${idx}.dosageAmount`)}
                />
                <Input
                  label="Unidad"
                  placeholder="mL"
                  {...register(`medications.${idx}.dosageUnit`)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Frecuencia"
                  placeholder="cada 48h"
                  {...register(`medications.${idx}.frequency`)}
                />
                <Input
                  type="number"
                  min={1}
                  max={365}
                  label="Duracion (dias) *"
                  error={errors.medications?.[idx]?.durationDays?.message}
                  {...register(`medications.${idx}.durationDays`)}
                />
                <Controller
                  control={control}
                  name={`medications.${idx}.applicationRoute`}
                  render={({ field }) => (
                    <Select
                      label="Via *"
                      options={ROUTE_OPTIONS}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={errors.medications?.[idx]?.applicationRoute?.message}
                    />
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  label="Periodo de retiro (dias)"
                  error={errors.medications?.[idx]?.withdrawalPeriodDays?.message}
                  {...register(`medications.${idx}.withdrawalPeriodDays`)}
                />
                <Input
                  label="Sitio anatomico"
                  placeholder="cuello izquierdo"
                  {...register(`medications.${idx}.targetSite`)}
                />
              </div>

              <Input
                label="Notas"
                placeholder="Reaccion local previa, etc."
                {...register(`medications.${idx}.notes`)}
              />
            </div>
          ))}

          {errors.medications && typeof errors.medications.message === 'string' && (
            <p className="text-xs text-red-500">{errors.medications.message}</p>
          )}
        </div>

        {/* Notas generales */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Notas del tratamiento
          </label>
          <textarea
            rows={2}
            placeholder="Hidratacion parenteral concurrente, vigilancia 24h, etc."
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            icon={<Play className="w-4 h-4" />}
          >
            Iniciar tratamiento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
