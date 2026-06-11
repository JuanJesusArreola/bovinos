/**
 * Formulario de creación de caso clínico.
 *
 * Ruta: `/health/cases/nuevo`
 * Permisos: `RECORD_CASE` (VETERINARIAN o superior).
 *
 * Requiere `activeRanchId` — el caso siempre nace dentro de un rancho.
 * Si no hay rancho activo, mostramos un mensaje + CTA al picker en vez
 * de un form que no podría enviarse válidamente.
 *
 * Edición (PATCH status/severity/notes) NO se hace aquí — se gestiona en
 * la página de detalle vía modal. Esta pantalla es solo para "crear".
 */

import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canRecordCase } from '@/utils/permissions';
import { useCreateBovineCase } from '@/hooks/useBovineCases';
import { useActiveDiseases } from '@/hooks/useDiseases';
import {
  CaseSeverity, CaseStatus,
  type CreateBovineCaseInput,
} from '@/types/bovineCase.dtos';
import {
  CASE_SEVERITY_LABELS, CASE_STATUS_LABELS,
} from '@/design-system/tokens/case-status.colors';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { BovineSelector } from '@/components/ui/BovineSelector';
import { ArrowLeft, Save, Stethoscope } from 'lucide-react';

// ── Zod schema ──────────────────────────────────────────────────────────────

const caseSchema = z.object({
  bovineId:    z.string().min(1, 'Selecciona un bovino'),
  diseaseId:   z.string().min(1, 'Selecciona una enfermedad'),
  severity:    z.nativeEnum(CaseSeverity, { error: 'Selecciona severidad' }),
  status:      z.nativeEnum(CaseStatus).optional(),
  diagnosedAt: z.string().optional().or(z.literal('')),
  diagnosedBy: z.string().max(150).optional().or(z.literal('')),
  notes:       z.string().max(2000).optional().or(z.literal('')),
  /**
   * UUID de la fuente de contagio (catalogo DiseaseSource). Acepta
   * formato uuid v4. Si esta vacio se omite del payload.
   */
  sourceId:    z.string().uuid('Debe ser un UUID valido (formato 8-4-4-4-12)').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof caseSchema>;

// Solo permitimos status iniciales que tienen sentido al crear
// (no podés crear un caso "RECOVERED" — eso es un cierre con outcome).
const INITIAL_STATUS_OPTIONS = [
  { value: CaseStatus.SUSPECTED,  label: CASE_STATUS_LABELS.SUSPECTED }  ,
  { value: CaseStatus.CONFIRMED,  label: CASE_STATUS_LABELS.CONFIRMED }  ,
  { value: CaseStatus.RECOVERING, label: CASE_STATUS_LABELS.RECOVERING } ,
];

const SEVERITY_OPTIONS = Object.values(CaseSeverity).map((s) => ({
  value: s, label: CASE_SEVERITY_LABELS[s],
}));

// ────────────────────────────────────────────────────────────────────────────

export function CaseFormPage() {
  const navigate = useNavigate();
  const { user, activeRanchId } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const createMutation = useCreateBovineCase();

  // Catálogo de enfermedades activas para el select.
  const { data: diseases = [], isLoading: isLoadingDiseases } = useActiveDiseases();

  const {
    register, handleSubmit, control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      bovineId:    '',
      diseaseId:   '',
      severity:    CaseSeverity.MODERATE,
      status:      CaseStatus.SUSPECTED,
      diagnosedAt: new Date().toISOString().slice(0, 10),
      diagnosedBy: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '',
      notes:       '',
    },
  });

  // ── Guards previas al render del form ────────────────────────────────────

  if (!user || !canRecordCase(user.role)) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="warning" title="Acceso restringido">
          No tienes permiso para reportar casos clínicos.
        </Alert>
      </div>
    );
  }

  if (!activeRanchId) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="warning" title="Selecciona un rancho">
          Los casos clínicos se registran dentro de un rancho. Elige uno desde
          el picker superior antes de continuar.
        </Alert>
      </div>
    );
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    try {
      const payload: CreateBovineCaseInput = {
        bovineId:    values.bovineId,
        diseaseId:   values.diseaseId,
        ranchId:     activeRanchId!,
        severity:    values.severity,
        status:      values.status,
        diagnosedBy: values.diagnosedBy?.trim() || undefined,
        diagnosedAt: values.diagnosedAt
          ? new Date(values.diagnosedAt).toISOString()
          : undefined,
        notes:       values.notes?.trim() || undefined,
        sourceId:    values.sourceId?.trim() || undefined,
      };
      const created = await createMutation.mutateAsync(payload);
      toastSuccess('Caso reportado', `Se registró el caso #${created.id.slice(0, 8)}.`);
      navigate(`/health/cases/${created.id}`);
    } catch (err) {
      toastError(
        'No se pudo registrar',
        (err as Error)?.message ?? 'Verifica los datos e intenta nuevamente.',
      );
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <BackLink />

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3">
          <Stethoscope className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportar caso clínico</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Diagnóstico inicial — luego podrás añadir síntomas, tratamientos y laboratorios.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Bovino + enfermedad */}
        <Card>
          <CardTitle className="mb-4">Identificación</CardTitle>
          <div className="space-y-4">
            <Controller
              control={control}
              name="bovineId"
              render={({ field }) => (
                <BovineSelector
                  label="Bovino afectado *"
                  ranchId={activeRanchId}
                  value={field.value}
                  onChange={(id) => field.onChange(id ?? '')}
                  error={errors.bovineId?.message}
                />
              )}
            />

            <Select
              label="Enfermedad *"
              disabled={isLoadingDiseases}
              options={[
                { value: '', label: isLoadingDiseases ? 'Cargando catálogo…' : 'Selecciona una enfermedad' },
                ...diseases.map((d) => ({ value: d.id, label: d.name })),
              ]}
              error={errors.diseaseId?.message}
              {...register('diseaseId')}
            />
          </div>
        </Card>

        {/* Clasificación clínica */}
        <Card>
          <CardTitle className="mb-4">Clasificación inicial</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Severidad *"
              options={SEVERITY_OPTIONS}
              error={errors.severity?.message}
              {...register('severity')}
            />
            <Select
              label="Estado inicial"
              options={INITIAL_STATUS_OPTIONS}
              error={errors.status?.message}
              {...register('status')}
            />
          </div>
        </Card>

        {/* Datos del diagnóstico */}
        <Card>
          <CardTitle className="mb-4">Diagnóstico</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="date"
              label="Fecha del diagnóstico"
              error={errors.diagnosedAt?.message}
              {...register('diagnosedAt')}
            />
            <Input
              label="Diagnosticado por"
              placeholder="Nombre del veterinario"
              error={errors.diagnosedBy?.message}
              {...register('diagnosedBy')}
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notas
            </label>
            <textarea
              rows={3}
              placeholder="Observaciones clínicas iniciales, contexto del hallazgo…"
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
              {...register('notes')}
            />
            {errors.notes && (
              <p className="text-xs text-red-500 mt-1">{errors.notes.message}</p>
            )}
          </div>

          {/* Datos epidemiologicos opcionales.
              Por ahora el sourceId es un input UUID libre porque el backend
              no expone aun un endpoint para listar el catalogo DiseaseSource.
              Cuando exista, se convierte a Select sin tocar la mutacion. */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Input
              label="Fuente de contagio (UUID, opcional)"
              placeholder="Ej. uuid-fuente-garrapatas"
              error={errors.sourceId?.message}
              {...register('sourceId')}
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
              UUID del catalogo de fuentes de infeccion (vector, agua, fomite,
              animal externo, etc.). Util para el grafo de contagios y analisis
              epidemiologico. Si no se conoce, dejar vacio.
            </p>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/health/cases')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={isSubmitting || createMutation.isPending}
            icon={<Save className="w-4 h-4" />}
          >
            Crear caso
          </Button>
        </div>
      </form>
    </div>
  );
}

function BackLink() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
    >
      <ArrowLeft className="w-4 h-4" />
      Atrás
    </button>
  );
}
