/**
 * Modal para registrar o actualizar el diagnostico de un HealthRecord.
 *
 * Diferente del form de "Nuevo registro" (que crea el record entero):
 * este modal SOLO toca el bloque JSONB `diagnosis` de un record YA
 * existente. Pensado para el flujo "captura visita -> esperar lab ->
 * registrar diagnostico final".
 *
 * Campos:
 *   - primaryDiagnosis (texto libre)
 *   - differentialDiagnosis (texto libre, CSV en input - se parsea
 *     a string[] en submit)
 *   - diagnosticMethod (texto libre)
 *   - severity (Select)
 *   - icd10Code (texto libre - B60.0 para Anaplasmosis, etc.)
 *   - notes (textarea)
 *   - diseaseId (Select del catalogo, opt-in)
 *
 * Si el record YA tiene un diagnosis, los campos vienen pre-llenados.
 * El boton dira "Actualizar" en lugar de "Registrar".
 */

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Stethoscope, Save } from 'lucide-react';
import { useToast } from '@/store/ToastContext';
import { useRegisterDiagnosis } from '@/hooks/useBovineHealth';
import { useActiveDiseases } from '@/hooks/useDiseases';
import type {
  HealthRecord,
  DiagnosisData,
  RegisterDiagnosisInput,
} from '@/types/health.types';

interface RegisterDiagnosisModalProps {
  open: boolean;
  onClose: () => void;
  record: HealthRecord;
  bovineId: string;
}

const SEVERITY_OPTIONS = [
  { value: 'LOW',      label: 'Baja' },
  { value: 'MEDIUM',   label: 'Media' },
  { value: 'HIGH',     label: 'Alta' },
  { value: 'CRITICAL', label: 'Critica' },
];

const schema = z.object({
  primaryDiagnosis:        z.string().min(1, 'Diagnostico principal requerido').max(500),
  differentialDiagnosisCsv: z.string().max(500).optional().or(z.literal('')),
  diagnosticMethod:        z.string().max(300).optional().or(z.literal('')),
  severity:                z.string().optional().or(z.literal('')),
  icd10Code:               z.string().max(20).optional().or(z.literal('')),
  notes:                   z.string().max(2000).optional().or(z.literal('')),
  diseaseId:               z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function parseCsv(s: string | undefined): string[] | undefined {
  if (!s) return undefined;
  const arr = s.split(',').map((x) => x.trim()).filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

export function RegisterDiagnosisModal({
  open, onClose, record, bovineId,
}: RegisterDiagnosisModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const mutation = useRegisterDiagnosis({ bovineId });
  const { data: diseases = [] } = useActiveDiseases({ enabled: open });

  const existing = (record as any).diagnosis ?? {};
  const hasExisting = !!existing.primaryDiagnosis;

  const {
    register, handleSubmit, control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      primaryDiagnosis:         existing.primaryDiagnosis ?? '',
      differentialDiagnosisCsv: Array.isArray(existing.differentialDiagnosis)
        ? existing.differentialDiagnosis.join(', ')
        : '',
      diagnosticMethod:         existing.diagnosticMethod ?? '',
      severity:                 existing.severity ?? '',
      icd10Code:                existing.icd10Code ?? '',
      notes:                    existing.notes ?? '',
      diseaseId:                (record as any).diseaseId ?? '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const diagnosisData: DiagnosisData = {
        primaryDiagnosis:      values.primaryDiagnosis.trim(),
        differentialDiagnosis: parseCsv(values.differentialDiagnosisCsv),
        diagnosticMethod:      values.diagnosticMethod?.trim() || undefined,
        severity:              values.severity?.trim() || undefined,
        icd10Code:             values.icd10Code?.trim() || undefined,
        notes:                 values.notes?.trim() || undefined,
      };
      // diseaseId con semantica de 3 estados:
      //   - '' (vacio en el form) -> mandamos null para DESVINCULAR explicito.
      //   - UUID -> vinculamos.
      // Caso "no tocar el FK" (omitir) no se ofrece desde la UI: el VET
      // siempre toma una decision explicita al guardar.
      const payload: RegisterDiagnosisInput = {
        healthId:      record.id,
        diseaseId:     values.diseaseId === '' ? null : values.diseaseId,
        diagnosisData,
      };
      await mutation.mutateAsync(payload);
      toastSuccess(
        hasExisting ? 'Diagnostico actualizado' : 'Diagnostico registrado',
        hasExisting
          ? 'Se actualizo el diagnostico del registro.'
          : 'Se registro el diagnostico. Puedes confirmarlo cuando tengas certeza clinica.',
      );
      onClose();
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.error?.message
        ?? (err as Error)?.message
        ?? 'Verifica los datos e intenta nuevamente.';
      toastError('No se pudo guardar el diagnostico', msg);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={hasExisting ? 'Actualizar diagnostico' : 'Registrar diagnostico'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert variant="info">
          <div className="flex items-start gap-2">
            <Stethoscope className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {hasExisting
                ? 'El diagnostico actual sera reemplazado. Si quieres mantener el historico, considera duplicar el registro antes de editar.'
                : 'Captura el diagnostico clinico del registro. Si todavia tienes dudas, marcalo como presuntivo - despues podras "Confirmar" cuando llegue informacion adicional.'}
            </span>
          </div>
        </Alert>

        <Input
          label="Diagnostico principal *"
          placeholder="Anaplasmosis bovina"
          error={errors.primaryDiagnosis?.message}
          {...register('primaryDiagnosis')}
        />

        <Input
          label="Diagnosticos diferenciales (separados por coma)"
          placeholder="Babesiosis, Theileriosis, Tristeza bovina"
          error={errors.differentialDiagnosisCsv?.message}
          {...register('differentialDiagnosisCsv')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Metodo diagnostico"
            placeholder="Frotis sanguineo + clinica"
            {...register('diagnosticMethod')}
          />
          <Select
            label="Severidad"
            options={[
              { value: '', label: 'Sin especificar' },
              ...SEVERITY_OPTIONS,
            ]}
            {...register('severity')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Codigo ICD-10"
            placeholder="B60.0"
            error={errors.icd10Code?.message}
            {...register('icd10Code')}
          />
          <Controller
            control={control}
            name="diseaseId"
            render={({ field }) => (
              <Select
                label="Enfermedad del catalogo"
                options={[
                  { value: '', label: 'Sin vincular' },
                  ...diseases.map((d) => ({ value: d.id, label: d.name })),
                ]}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Notas clinicas
          </label>
          <textarea
            rows={3}
            placeholder="Hematocrito 18.5% — critico. Iniciar oxitetraciclina de inmediato."
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
            icon={<Save className="w-4 h-4" />}
          >
            {hasExisting ? 'Actualizar' : 'Registrar diagnostico'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
