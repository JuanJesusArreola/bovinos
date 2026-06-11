/**
 * Modal para cerrar un tratamiento con outcome.
 *
 * Efectos del cierre (backend):
 *   1. `treatment.status` pasa a COMPLETED.
 *   2. Se persiste `outcome` (RECOVERED, PARTIAL_RECOVERY, FAILED, DECEASED).
 *   3. Se calcula `unconsumedQuantity` por medicamento = stock reservado
 *      menos cantidad efectivamente aplicada (segun `administeredAt.length`).
 *   4. Se llama a inventoryService.releaseStock para devolver el sobrante
 *      al stock disponible. Si todo se aplico, libera 0.
 *
 * Riesgo de error: el backend NO permite cerrar dos veces el mismo
 * tratamiento. Si el VET se equivoco, debe corregir el record entero
 * via PATCH (UI pendiente). Mostramos un toast claro si llega 409.
 *
 * No mostramos lista detallada de "stock que se liberara" porque el
 * frontend no conoce la formula exacta del backend (depende de la
 * frecuencia y administeredAt, que pueden no estar al 100% sincronizados).
 * Cuando el modulo de inventario tenga UI mas profunda, podemos enlazar
 * a la transaccion de liberacion generada.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CheckCircle2 } from 'lucide-react';
import { useToast } from '@/store/ToastContext';
import { useCompleteTreatment } from '@/hooks/useBovineHealth';
import {
  TreatmentOutcome,
  type CompleteTreatmentInput,
  type TreatmentMedication,
} from '@/types/health.types';

interface CompleteTreatmentModalProps {
  open: boolean;
  onClose: () => void;
  healthId: string;
  bovineId?: string;
  /** Medicaciones actuales del tratamiento, solo para mostrar resumen
   *  pre-cierre (cuantas dosis se aplicaron de cada una). */
  medications?: TreatmentMedication[];
}

const OUTCOME_OPTIONS = [
  { value: TreatmentOutcome.RECOVERED,        label: 'Recuperado' },
  { value: TreatmentOutcome.PARTIAL_RECOVERY, label: 'Recuperacion parcial' },
  { value: TreatmentOutcome.FAILED,           label: 'Tratamiento fallido' },
  { value: TreatmentOutcome.DECEASED,         label: 'Animal fallecido' },
];

const schema = z.object({
  outcome: z.nativeEnum(TreatmentOutcome, { error: 'Selecciona el resultado' }),
  endDate: z.string().optional().or(z.literal('')),
  notes:   z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CompleteTreatmentModal({
  open, onClose, healthId, bovineId, medications,
}: CompleteTreatmentModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useCompleteTreatment({ bovineId });

  const {
    register, handleSubmit, watch, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      outcome: TreatmentOutcome.RECOVERED,
      endDate: todayDate(),
      notes:   '',
    },
  });
  const selectedOutcome = watch('outcome');

  async function onSubmit(values: FormValues) {
    try {
      const payload: CompleteTreatmentInput = {
        healthId,
        outcome: values.outcome,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        notes:   values.notes?.trim() || undefined,
      };
      await mutation.mutateAsync(payload);
      toastSuccess(
        'Tratamiento completado',
        'El stock no consumido fue devuelto al inventario.',
      );
      reset();
      onClose();
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.error?.message
        ?? (err as Error)?.message
        ?? 'Verifica que el tratamiento siga abierto e intenta nuevamente.';
      toastError('No se pudo completar el tratamiento', msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Completar tratamiento">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert variant="warning">
          Al completar el tratamiento:
          <ul className="list-disc ml-5 mt-1 text-xs space-y-0.5">
            <li>El estado pasa a COMPLETED y no podras registrar mas dosis.</li>
            <li>El stock reservado y no consumido se devuelve al inventario.</li>
            <li>El periodo de retiro empieza a contar desde la ULTIMA dosis ya aplicada.</li>
          </ul>
        </Alert>

        {/* Resumen de dosis aplicadas por medicamento */}
        {medications && medications.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
              Resumen del tratamiento
            </p>
            <ul className="space-y-1 text-sm">
              {medications.map((m, i) => {
                const dosesGiven = m.administeredAt?.length
                  ?? m.administeredCount
                  ?? 0;
                return (
                  <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {dosesGiven} {dosesGiven === 1 ? 'dosis aplicada' : 'dosis aplicadas'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Resultado *"
            options={OUTCOME_OPTIONS}
            error={errors.outcome?.message}
            {...register('outcome')}
          />
          <Input
            type="date"
            label="Fecha de finalizacion"
            error={errors.endDate?.message}
            {...register('endDate')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Notas finales
          </label>
          <textarea
            rows={3}
            placeholder="Respuesta al tratamiento, observaciones post-cierre, etc."
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
            // Cambio cosmetico de color cuando el outcome es DECEASED para
            // que el VET sea consciente del peso de la decision.
            variant={selectedOutcome === TreatmentOutcome.DECEASED ? 'danger' : 'primary'}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Completar tratamiento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
