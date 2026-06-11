/**
 * Formulario de alta de enfermedad (catálogo global).
 *
 * Ruta: `/health/diseases/catalogo/nuevo`
 * Acceso: SUPER_ADMIN / OWNER (`MANAGE_DISEASES`).
 *
 * El componente protege a nivel de página *además* del guard de ruta:
 * si por cualquier razón un rol no autorizado llega aquí, mostramos un
 * mensaje en vez de renderizar el formulario y se le invita a volver.
 *
 * Nota: Sprint 2 sólo cubre **creación**. La edición (PATCH) ya está
 * disponible en `diseasesApi.update` + `useUpdateDisease` y se conectará
 * a una ruta `:slug/editar` en un sprint posterior cuando aterricemos
 * la UI de gestión completa.
 */

import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canManageDiseases } from '@/utils/permissions';
import { useCreateDisease } from '@/hooks/useDiseases';
import {
  DiseaseCategory,
  DiseaseSeverity,
  type CreateDiseaseInput,
} from '@/types/disease.dtos';
import {
  DISEASE_CATEGORY_LABELS,
  getDiseaseSeverityLabel,
} from '@/design-system/tokens/case-status.colors';
import { ArrowLeft, Save, Microscope } from 'lucide-react';

// ── Schema ──────────────────────────────────────────────────────────────────

/**
 * Helper para parsear un input tipo `chips` separado por comas. Lo usamos
 * para `aliases` y `affectedSystems`. Acepta strings vacíos → undefined.
 */
function parseCsv(input: string | undefined): string[] | undefined {
  if (!input) return undefined;
  const arr = input.split(',').map((s) => s.trim()).filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

const diseaseSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  description: z.string().max(2000).optional().or(z.literal('')),
  category: z.nativeEnum(DiseaseCategory, { error: 'Selecciona categoría' }),
  severity: z.nativeEnum(DiseaseSeverity, { error: 'Selecciona severidad' }),
  isContagious: z.boolean(),
  isZoonotic:   z.boolean(),
  // Números opcionales — preprocess vacío → undefined antes de validar.
  defaultQuarantineDays: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().int().min(0).max(365).optional(),
  ),
  incubationDaysMin: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().int().min(0).max(365).optional(),
  ),
  incubationDaysMax: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().int().min(0).max(365).optional(),
  ),
  recommendedAction: z.string().max(2000).optional().or(z.literal('')),
  // Inputs tipo CSV — los parseamos en submit.
  affectedSystemsCsv: z.string().max(500).optional().or(z.literal('')),
  aliasesCsv:         z.string().max(500).optional().or(z.literal('')),
}).refine(
  // Si ambos están definidos, min ≤ max.
  (d) =>
    d.incubationDaysMin == null ||
    d.incubationDaysMax == null ||
    d.incubationDaysMin <= d.incubationDaysMax,
  {
    message: 'El mínimo no puede ser mayor al máximo',
    path: ['incubationDaysMin'],
  },
);

type FormValues = z.infer<typeof diseaseSchema>;

// ── Opciones de selects ─────────────────────────────────────────────────────

const CATEGORY_OPTIONS = Object.values(DiseaseCategory).map((c) => ({
  value: c,
  label: DISEASE_CATEGORY_LABELS[c as keyof typeof DISEASE_CATEGORY_LABELS] ?? c,
}));

const SEVERITY_OPTIONS = Object.values(DiseaseSeverity).map((s) => ({
  value: s,
  label: getDiseaseSeverityLabel(s),
}));

// ────────────────────────────────────────────────────────────────────────────

export function DiseaseFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const createMutation = useCreateDisease();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(diseaseSchema),
    defaultValues: {
      name: '',
      description: '',
      category: DiseaseCategory.BACTERIAL,
      severity: DiseaseSeverity.MODERATE,
      isContagious: false,
      isZoonotic: false,
      recommendedAction: '',
      affectedSystemsCsv: '',
      aliasesCsv: '',
    },
  });

  // Doble check del permiso (la ruta ya lo protege; esto evita renderizar
  // el form si un futuro change rompe el guard del router).
  if (!user || !canManageDiseases(user.role)) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="warning" title="Acceso restringido">
          Solo los Super-Administradores pueden crear nuevas entradas del
          catálogo de enfermedades.
        </Alert>
      </div>
    );
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload: CreateDiseaseInput = {
        name:                  values.name.trim(),
        description:           values.description || undefined,
        category:              values.category,
        severity:              values.severity,
        isContagious:          values.isContagious,
        isZoonotic:            values.isZoonotic,
        defaultQuarantineDays: values.defaultQuarantineDays,
        incubationDaysMin:     values.incubationDaysMin,
        incubationDaysMax:     values.incubationDaysMax,
        recommendedAction:     values.recommendedAction || undefined,
        affectedSystems:       parseCsv(values.affectedSystemsCsv),
        aliases:               parseCsv(values.aliasesCsv),
      };
      const created = await createMutation.mutateAsync(payload);
      toastSuccess(
        'Enfermedad creada',
        `«${created.name}» se añadió al catálogo. Sube imágenes para ilustrarla.`,
      );
      // `?addMedia=1` hace que DiseaseDetailPage abra automáticamente el
      // modal de gestión de imágenes — flujo de un solo click para que el
      // SUPER_ADMIN suba fotos del caso recién creado sin buscar el botón.
      navigate(`/health/diseases/catalogo/${created.slug}?addMedia=1`);
    } catch (err) {
      // El interceptor de axios ya mostró un toast genérico para 4xx/5xx.
      // Si querés mensajes más finos por código, aquí va el switch.
      toastError(
        'No se pudo crear',
        (err as Error)?.message ?? 'Verifica los datos e intenta nuevamente.',
      );
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Microscope className="w-7 h-7 text-primary-600" />
          Nueva enfermedad
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Añade una entrada al catálogo global. Estará disponible inmediatamente
          para reportar casos clínicos en todos los ranchos.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Identificación */}
        <Card>
          <CardTitle className="mb-4">Identificación</CardTitle>
          <div className="space-y-4">
            <Input
              label="Nombre *"
              placeholder="p.ej. Brucelosis bovina"
              error={errors.name?.message}
              {...register('name')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Descripción
              </label>
              <textarea
                rows={3}
                placeholder="Breve descripción clínica y epidemiológica…"
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>
              )}
            </div>
            <Input
              label="Aliases (separados por coma)"
              placeholder="Fiebre de Malta, Bang's disease"
              error={errors.aliasesCsv?.message}
              {...register('aliasesCsv')}
            />
          </div>
        </Card>

        {/* Clasificación */}
        <Card>
          <CardTitle className="mb-4">Clasificación</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Categoría *"
              options={CATEGORY_OPTIONS}
              error={errors.category?.message}
              {...register('category')}
            />
            <Select
              label="Severidad *"
              options={SEVERITY_OPTIONS}
              error={errors.severity?.message}
              {...register('severity')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <Controller
              control={control}
              name="isContagious"
              render={({ field }) => (
                <CheckboxField
                  label="Es contagiosa"
                  description="Se transmite entre bovinos."
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="isZoonotic"
              render={({ field }) => (
                <CheckboxField
                  label="Es zoonótica"
                  description="Puede transmitirse al ser humano."
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </Card>

        {/* Clínico */}
        <Card>
          <CardTitle className="mb-4">Datos clínicos</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              type="number"
              min={0}
              max={365}
              label="Incubación mín. (días)"
              error={errors.incubationDaysMin?.message}
              {...register('incubationDaysMin')}
            />
            <Input
              type="number"
              min={0}
              max={365}
              label="Incubación máx. (días)"
              error={errors.incubationDaysMax?.message}
              {...register('incubationDaysMax')}
            />
            <Input
              type="number"
              min={0}
              max={365}
              label="Cuarentena por defecto"
              error={errors.defaultQuarantineDays?.message}
              {...register('defaultQuarantineDays')}
            />
          </div>

          <div className="mt-4">
            <Input
              label="Sistemas afectados (separados por coma)"
              placeholder="Reproductor, Musculoesquelético"
              error={errors.affectedSystemsCsv?.message}
              {...register('affectedSystemsCsv')}
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Acción recomendada
            </label>
            <textarea
              rows={3}
              placeholder="Protocolo sugerido al detectar un caso (cuarentena, lab, etc.)…"
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
              {...register('recommendedAction')}
            />
            {errors.recommendedAction && (
              <p className="text-xs text-red-500 mt-1">{errors.recommendedAction.message}</p>
            )}
          </div>
        </Card>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/health/diseases/catalogo')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={isSubmitting || createMutation.isPending}
            icon={<Save className="w-4 h-4" />}
          >
            Crear enfermedad
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

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

interface CheckboxFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function CheckboxField({ label, description, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700">
      <input
        type="checkbox"
        className="mt-0.5 w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}
