/**
 * Modal: registrar un tratamiento aplicado al caso clínico.
 *
 * El tratamiento se considera ya APLICADO al momento del submit (a
 * diferencia del "plan de tratamiento" del módulo de Health legacy).
 * Por eso `administeredAt` es requerido y defaultea a hoy.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/store/ToastContext';
import { useAddCaseTreatment } from '@/hooks/useBovineCases';
import {
  ApplicationRoute, type AddCaseTreatmentInput,
} from '@/types/bovineCase.dtos';
import { Save } from 'lucide-react';

interface AddTreatmentModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  bovineId: string;
}

const APPLICATION_ROUTE_LABELS: Record<ApplicationRoute, string> = {
  INTRAMUSCULAR: 'Intramuscular',
  SUBCUTANEOUS:  'Subcutánea',
  INTRANASAL:    'Intranasal',
  ORAL:          'Oral',
  INTRADERMAL:   'Intradérmica',
  OTHER:         'Otra',
};

const ROUTE_OPTIONS = Object.values(ApplicationRoute).map((r) => ({
  value: r, label: APPLICATION_ROUTE_LABELS[r],
}));

const schema = z.object({
  treatmentName:    z.string().min(1, 'Nombre requerido').max(150),
  dosage:           z.string().min(1, 'Dosis requerida').max(100),
  applicationRoute: z.nativeEnum(ApplicationRoute, { error: 'Selecciona la vía' }),
  administeredAt:   z.string().min(1, 'Fecha requerida'),
  administeredBy:   z.string().max(150).optional().or(z.literal('')),
  durationDays: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().int().min(0).max(365).optional(),
  ),
  withdrawalPeriodDays: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().int().min(0).max(365).optional(),
  ),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function AddTreatmentModal({ open, onClose, caseId, bovineId }: AddTreatmentModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useAddCaseTreatment(caseId, bovineId);

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      treatmentName:    '',
      dosage:           '',
      applicationRoute: ApplicationRoute.INTRAMUSCULAR,
      administeredAt:   new Date().toISOString().slice(0, 10),
      administeredBy:   '',
      notes:            '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const payload: AddCaseTreatmentInput = {
        treatmentName:        values.treatmentName.trim(),
        dosage:               values.dosage.trim(),
        applicationRoute:     values.applicationRoute,
        administeredAt:       new Date(values.administeredAt).toISOString(),
        administeredBy:       values.administeredBy?.trim() || undefined,
        durationDays:         values.durationDays,
        withdrawalPeriodDays: values.withdrawalPeriodDays,
        notes:                values.notes?.trim() || undefined,
      };
      await mutation.mutateAsync(payload);
      toastSuccess('Tratamiento registrado');
      reset();
      onClose();
    } catch (err) {
      toastError('No se pudo registrar', (err as Error)?.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar tratamiento" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tratamiento / medicamento *"
            placeholder="p. ej. Oxitetraciclina LA"
            error={errors.treatmentName?.message}
            {...register('treatmentName')}
          />
          <Input
            label="Dosis *"
            placeholder="p. ej. 20 mg/kg"
            error={errors.dosage?.message}
            {...register('dosage')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Vía de aplicación *"
            options={ROUTE_OPTIONS}
            error={errors.applicationRoute?.message}
            {...register('applicationRoute')}
          />
          <Input
            type="date"
            label="Fecha de administración *"
            error={errors.administeredAt?.message}
            {...register('administeredAt')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Aplicado por"
            placeholder="Nombre"
            error={errors.administeredBy?.message}
            {...register('administeredBy')}
          />
          <Input
            type="number"
            min={0}
            label="Duración (días)"
            error={errors.durationDays?.message}
            {...register('durationDays')}
          />
          <Input
            type="number"
            min={0}
            label="Retiro (días)"
            error={errors.withdrawalPeriodDays?.message}
            {...register('withdrawalPeriodDays')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas</label>
          <textarea
            rows={2}
            placeholder="Observaciones, lote, vía secundaria, etc."
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('notes')}
          />
          {errors.notes && <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending} icon={<Save className="w-4 h-4" />}>
            Registrar tratamiento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
