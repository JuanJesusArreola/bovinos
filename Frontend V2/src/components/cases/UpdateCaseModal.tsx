/**
 * Modal: actualizar status / severity / notes de un caso ABIERTO.
 *
 * Para cerrar el caso (outcome final) hay un flujo separado en
 * `CloseCaseModal`, porque cerrar requiere un outcome obligatorio que
 * este modal NO debería pedir.
 *
 * Solo permitimos saltar entre status ABIERTOS aquí:
 *   SUSPECTED ↔ CONFIRMED ↔ RECOVERING
 * Pasar a RECOVERED / DECEASED / DISCARDED → usar "Cerrar caso".
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/store/ToastContext';
import { useUpdateBovineCase } from '@/hooks/useBovineCases';
import {
  CaseStatus, CaseSeverity, type UpdateBovineCaseInput,
} from '@/types/bovineCase.dtos';
import {
  CASE_STATUS_LABELS, CASE_SEVERITY_LABELS,
} from '@/design-system/tokens/case-status.colors';
import { Save } from 'lucide-react';

interface UpdateCaseModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  bovineId: string;
  initial: {
    status:   CaseStatus;
    severity: CaseSeverity;
    notes?:   string;
  };
}

const OPEN_STATUS_OPTIONS = [
  { value: CaseStatus.SUSPECTED,  label: CASE_STATUS_LABELS.SUSPECTED  },
  { value: CaseStatus.CONFIRMED,  label: CASE_STATUS_LABELS.CONFIRMED  },
  { value: CaseStatus.RECOVERING, label: CASE_STATUS_LABELS.RECOVERING },
];

const SEVERITY_OPTIONS = Object.values(CaseSeverity).map((s) => ({
  value: s, label: CASE_SEVERITY_LABELS[s],
}));

const schema = z.object({
  status:   z.enum([CaseStatus.SUSPECTED, CaseStatus.CONFIRMED, CaseStatus.RECOVERING]),
  severity: z.nativeEnum(CaseSeverity),
  notes:    z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function UpdateCaseModal({ open, onClose, caseId, bovineId, initial }: UpdateCaseModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useUpdateBovineCase(caseId, bovineId);

  const {
    register, handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Si el caso ya está en un status terminal, normalmente el modal no se
    // abre — pero por seguridad casteamos al primer open status.
    defaultValues: {
      status:   OPEN_STATUS_OPTIONS.some((o) => o.value === initial.status)
        ? (initial.status as CaseStatus.SUSPECTED | CaseStatus.CONFIRMED | CaseStatus.RECOVERING)
        : CaseStatus.SUSPECTED,
      severity: initial.severity,
      notes:    initial.notes ?? '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const payload: UpdateBovineCaseInput = {
        status:   values.status,
        severity: values.severity,
        notes:    values.notes?.trim() || undefined,
      };
      await mutation.mutateAsync(payload);
      toastSuccess('Caso actualizado');
      onClose();
    } catch (err) {
      toastError('No se pudo actualizar', (err as Error)?.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Actualizar caso">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Estado *"
            options={OPEN_STATUS_OPTIONS}
            error={errors.status?.message}
            {...register('status')}
          />
          <Select
            label="Severidad *"
            options={SEVERITY_OPTIONS}
            error={errors.severity?.message}
            {...register('severity')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas</label>
          <textarea
            rows={3}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending} icon={<Save className="w-4 h-4" />}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
