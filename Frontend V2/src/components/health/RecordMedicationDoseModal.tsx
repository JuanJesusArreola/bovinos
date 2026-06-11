/**
 * Modal para registrar UNA dosis efectivamente aplicada de un medicamento.
 *
 * Contexto: el VET inicio un tratamiento (e.g. Oxitetraciclina cada 48h
 * por 5 dias). Cada vez que aplica una dosis al bovino debe registrarla
 * aqui para que:
 *   1. El historial clinico refleje el calendario real de aplicacion.
 *   2. El periodo de retiro se calcule correctamente (el countdown
 *      arranca desde la ULTIMA dosis aplicada, no desde el inicio del
 *      tratamiento).
 *   3. La integracion con inventario sepa cuanto stock se consumio
 *      cuando se cierre el tratamiento (releaseStock del sobrante).
 *
 * El backend toma `medicationIndex` (posicion en el array
 * `treatment.medications`) en vez de un id porque las medicaciones
 * viven en JSONB y no tienen identidad propia.
 *
 * Idempotencia: el endpoint NO valida duplicados. Si el usuario hace
 * doble click, se registran dos timestamps. Mitigamos con loading.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Save, Pill } from 'lucide-react';
import { useToast } from '@/store/ToastContext';
import { useRecordMedicationDose } from '@/hooks/useBovineHealth';
import type { TreatmentMedication } from '@/types/health.types';
import { formatDate, formatRelative } from '@/utils/formatters';

interface RecordMedicationDoseModalProps {
  open: boolean;
  onClose: () => void;
  /** Id del HealthRecord que contiene el tratamiento. */
  healthId: string;
  /** Posicion del medicamento dentro del array del record. */
  medicationIndex: number;
  /** Medicamento al que se aplicara la dosis (para mostrar contexto). */
  medication: TreatmentMedication;
  /** Necesario para invalidar el banner agregado del bovino. */
  bovineId?: string;
}

const schema = z.object({
  // Tomamos `datetime-local` (sin TZ) y convertimos a ISO en el submit.
  administeredAt: z.string().min(1, 'Indica cuando se aplico la dosis'),
  notes:          z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

/**
 * Devuelve un valor por defecto para el input datetime-local: ahora,
 * sin segundos, ajustado a la zona horaria del navegador. `datetime-local`
 * NO acepta una cadena ISO con `Z`, espera "YYYY-MM-DDTHH:mm".
 */
function nowForDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RecordMedicationDoseModal({
  open, onClose, healthId, medicationIndex, medication, bovineId,
}: RecordMedicationDoseModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useRecordMedicationDose({ bovineId });

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      administeredAt: nowForDatetimeLocal(),
      notes: '',
    },
  });

  // Contexto visible para el VET antes de confirmar.
  const dosesGiven = medication.administeredAt?.length
    ?? medication.administeredCount
    ?? 0;
  const lastDose = medication.administeredAt && medication.administeredAt.length > 0
    ? medication.administeredAt[medication.administeredAt.length - 1]
    : null;

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync({
        healthId,
        medicationIndex,
        // datetime-local -> ISO. El new Date() lo interpreta en TZ local
        // del navegador, lo que es lo deseado (el VET marca la hora REAL
        // a la que aplico la dosis en su zona).
        administeredAt: new Date(values.administeredAt).toISOString(),
        notes: values.notes?.trim() || undefined,
      });
      toastSuccess(
        'Dosis registrada',
        `Aplicacion de ${medication.name} registrada correctamente.`,
      );
      reset({ administeredAt: nowForDatetimeLocal(), notes: '' });
      onClose();
    } catch (err) {
      toastError(
        'No se pudo registrar la dosis',
        (err as Error)?.message ?? 'Intenta nuevamente en unos segundos.',
      );
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar dosis aplicada">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Contexto del medicamento */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Pill className="w-4 h-4 text-primary-600" />
            <span className="font-semibold text-gray-900 dark:text-white">
              {medication.name}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {medication.dosage} {medication.dosageUnit}
            {' por '}{medication.route}
            {medication.frequency && (
              <> &middot; {medication.frequency}</>
            )}
            {medication.duration != null && (
              <> &middot; duracion planeada {medication.duration} dias</>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Dosis registradas hasta ahora: <strong>{dosesGiven}</strong>
            {lastDose && (
              <> &middot; ultima el {formatDate(lastDose)} ({formatRelative(lastDose)})</>
            )}
          </p>
        </div>

        {/* Warning si ya hay otra dosis muy reciente (posible doble click) */}
        {lastDose && (Date.now() - new Date(lastDose).getTime()) < 60 * 60 * 1000 && (
          <Alert variant="warning">
            La ultima dosis se registro hace menos de 1 hora. Verifica que
            no estes registrando la misma aplicacion dos veces.
          </Alert>
        )}

        <Input
          type="datetime-local"
          label="Fecha y hora de la aplicacion *"
          error={errors.administeredAt?.message}
          {...register('administeredAt')}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Notas <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Sitio de aplicacion, reacciones, observaciones..."
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('notes')}
          />
          {errors.notes && (
            <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            icon={<Save className="w-4 h-4" />}
          >
            Registrar dosis
          </Button>
        </div>
      </form>
    </Modal>
  );
}
