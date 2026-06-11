/**
 * Modal: solicitar un laboratorio para el caso.
 *
 * Se crea con `resultStatus = PENDING` por defecto (el backend ya lo
 * gestiona). Cuando llegue el resultado, se registra desde
 * `UpdateLabResultModal`, no aquí.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/store/ToastContext';
import { useAddCaseLabTest } from '@/hooks/useBovineCases';
import type { AddCaseLabTestInput } from '@/types/bovineCase.dtos';
import { Save } from 'lucide-react';

interface AddLabTestModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  bovineId: string;
}

const schema = z.object({
  testName:    z.string().min(1, 'Nombre requerido').max(150),
  requestedAt: z.string().min(1, 'Fecha requerida'),
  labName:     z.string().max(150).optional().or(z.literal('')),
  notes:       z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function AddLabTestModal({ open, onClose, caseId, bovineId }: AddLabTestModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useAddCaseLabTest(caseId, bovineId);

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      testName:    '',
      requestedAt: new Date().toISOString().slice(0, 10),
      labName:     '',
      notes:       '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const payload: AddCaseLabTestInput = {
        testName:    values.testName.trim(),
        requestedAt: new Date(values.requestedAt).toISOString(),
        labName:     values.labName?.trim() || undefined,
        notes:       values.notes?.trim() || undefined,
      };
      await mutation.mutateAsync(payload);
      toastSuccess('Laboratorio solicitado', 'Quedará en estado "Pendiente" hasta registrar resultado.');
      reset();
      onClose();
    } catch (err) {
      toastError('No se pudo solicitar', (err as Error)?.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Solicitar laboratorio">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Nombre del análisis *"
          placeholder="p. ej. PCR Brucella, Hemograma"
          error={errors.testName?.message}
          {...register('testName')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="Solicitado el *"
            error={errors.requestedAt?.message}
            {...register('requestedAt')}
          />
          <Input
            label="Laboratorio"
            placeholder="Nombre del lab"
            error={errors.labName?.message}
            {...register('labName')}
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
            Solicitar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
