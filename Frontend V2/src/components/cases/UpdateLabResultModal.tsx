/**
 * Modal: registrar el resultado de un laboratorio pendiente.
 *
 * Endpoint distinto del resto de sub-recursos:
 * `PATCH /bovine-cases/lab-tests/:labTestId` (NO incluye `:caseId`).
 * El hook `useUpdateLabTestResult(caseId, bovineId)` se encarga del
 * fan-out de invalidaciones (caso + bovino + epidemiología).
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/store/ToastContext';
import { useUpdateLabTestResult } from '@/hooks/useBovineCases';
import {
  LabResultStatus, type UpdateLabTestResultInput,
} from '@/types/bovineCase.dtos';
import { LAB_RESULT_STATUS_LABELS } from '@/design-system/tokens/case-status.colors';
import { Save } from 'lucide-react';

interface UpdateLabResultModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  bovineId: string;
  labTestId: string;
  testName: string;
}

// PENDING no se elige aquí — es el estado inicial. Solo permitimos los
// resultados terminales.
const RESULT_OPTIONS = [
  { value: LabResultStatus.POSITIVE,     label: LAB_RESULT_STATUS_LABELS.POSITIVE },
  { value: LabResultStatus.NEGATIVE,     label: LAB_RESULT_STATUS_LABELS.NEGATIVE },
  { value: LabResultStatus.INCONCLUSIVE, label: LAB_RESULT_STATUS_LABELS.INCONCLUSIVE },
];

const schema = z.object({
  resultStatus: z.enum([
    LabResultStatus.POSITIVE,
    LabResultStatus.NEGATIVE,
    LabResultStatus.INCONCLUSIVE,
  ], { error: 'Selecciona el resultado' }),
  resultAt:     z.string().min(1, 'Fecha requerida'),
  resultDetail: z.string().max(2000).optional().or(z.literal('')),
  notes:        z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function UpdateLabResultModal({
  open, onClose, caseId, bovineId, labTestId, testName,
}: UpdateLabResultModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useUpdateLabTestResult(caseId, bovineId);

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      resultStatus: LabResultStatus.NEGATIVE,
      resultAt:     new Date().toISOString().slice(0, 10),
      resultDetail: '',
      notes:        '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const payload: UpdateLabTestResultInput = {
        resultStatus: values.resultStatus,
        resultAt:     new Date(values.resultAt).toISOString(),
        resultDetail: values.resultDetail?.trim() || undefined,
        notes:        values.notes?.trim() || undefined,
      };
      await mutation.mutateAsync({ labTestId, data: payload });
      toastSuccess('Resultado registrado');
      reset();
      onClose();
    } catch (err) {
      toastError('No se pudo registrar', (err as Error)?.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Resultado: ${testName}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Resultado *"
            options={RESULT_OPTIONS}
            error={errors.resultStatus?.message}
            {...register('resultStatus')}
          />
          <Input
            type="date"
            label="Fecha del resultado *"
            error={errors.resultAt?.message}
            {...register('resultAt')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Detalle</label>
          <textarea
            rows={3}
            placeholder="Valores, hallazgos, interpretación clínica…"
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('resultDetail')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas</label>
          <textarea
            rows={2}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending} icon={<Save className="w-4 h-4" />}>
            Guardar resultado
          </Button>
        </div>
      </form>
    </Modal>
  );
}
