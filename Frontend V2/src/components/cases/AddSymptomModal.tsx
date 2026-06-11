/**
 * Modal: añadir síntoma observado a un caso clínico.
 *
 * El catálogo de síntomas seleccionables sale del propio detalle de la
 * enfermedad (`disease.symptoms` eager-loaded por el backend). Si el caso
 * trae una enfermedad sin síntomas catalogados, mostramos un mensaje en
 * vez de un select vacío.
 */

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/store/ToastContext';
import { useAddCaseSymptom } from '@/hooks/useBovineCases';
import { useDisease } from '@/hooks/useDiseases';
import {
  SymptomIntensity, type AddCaseSymptomInput,
} from '@/types/bovineCase.dtos';
import { SYMPTOM_INTENSITY_LABELS } from '@/design-system/tokens/case-status.colors';
import { Save } from 'lucide-react';

interface AddSymptomModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  bovineId: string;
  diseaseId: string;
}

const schema = z.object({
  symptomId:  z.string().min(1, 'Selecciona un síntoma'),
  intensity:  z.nativeEnum(SymptomIntensity, { error: 'Selecciona la intensidad' }),
  observedAt: z.string().optional().or(z.literal('')),
  notes:      z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

const INTENSITY_OPTIONS = Object.values(SymptomIntensity).map((v) => ({
  value: v, label: SYMPTOM_INTENSITY_LABELS[v],
}));

export function AddSymptomModal({ open, onClose, caseId, bovineId, diseaseId }: AddSymptomModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { data: disease, isLoading } = useDisease(diseaseId, { enabled: open });
  const mutation = useAddCaseSymptom(caseId, bovineId);

  const {
    register, handleSubmit, control, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      symptomId:  '',
      intensity:  SymptomIntensity.MODERATE,
      observedAt: new Date().toISOString().slice(0, 10),
      notes:      '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const payload: AddCaseSymptomInput = {
        symptomId: values.symptomId,
        intensity: values.intensity,
        observedAt: values.observedAt ? new Date(values.observedAt).toISOString() : undefined,
        notes:      values.notes?.trim() || undefined,
      };
      await mutation.mutateAsync(payload);
      toastSuccess('Síntoma registrado');
      reset();
      onClose();
    } catch (err) {
      toastError('No se pudo registrar', (err as Error)?.message);
    }
  }

  const symptomOptions = disease?.symptoms ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Registrar síntoma observado">
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando síntomas del catálogo…</p>
      ) : symptomOptions.length === 0 ? (
        <Alert variant="warning" title="Sin síntomas catalogados">
          La enfermedad asociada a este caso aún no tiene síntomas en el catálogo.
          Pide al Super-Administrador que añada síntomas a la entrada para poder registrarlos aquí.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="symptomId"
            render={({ field }) => (
              <Select
                label="Síntoma *"
                options={[
                  { value: '', label: 'Selecciona un síntoma' },
                  ...symptomOptions.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={errors.symptomId?.message}
              />
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Intensidad *"
              options={INTENSITY_OPTIONS}
              error={errors.intensity?.message}
              {...register('intensity')}
            />
            <Input
              type="date"
              label="Observado el"
              error={errors.observedAt?.message}
              {...register('observedAt')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas</label>
            <textarea
              rows={2}
              placeholder="Detalles de la observación…"
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
              {...register('notes')}
            />
            {errors.notes && <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending} icon={<Save className="w-4 h-4" />}>
              Registrar síntoma
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
