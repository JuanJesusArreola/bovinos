/**
 * VaccinationSchedulesPage — CRUD del catálogo base de calendarios de vacunación.
 *
 * Ruta: /vaccinations/schedules
 * Permisos: SUPER_ADMIN, OWNER, VETERINARIAN (espeja los ADMIN_ROLES del backend).
 *
 * Este catálogo define qué vacunas le tocan a los bovinos según su edad/sexo/raza
 * y cada cuánto deben revacunarse. El engine de "Calendario sugerido" del detalle
 * del bovino (GET /api/bovines/:id/vaccination-schedule) lo consume.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  useVaccinationSchedules,
  useCreateVaccinationSchedule,
  useUpdateVaccinationSchedule,
  useDeleteVaccinationSchedule,
} from '@/hooks/useVaccinationSchedules';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { canUser } from '@/utils/permissions';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';

import { VaccineType } from '@/types/bovine.dtos';
import type {
  VaccinationScheduleEntry,
  CreateVaccinationScheduleInput,
} from '@/types/bovine.dtos';

import {
  Syringe, Plus, Pencil, Trash2, CheckCircle2, XCircle,
  RefreshCw, Info,
} from 'lucide-react';

// ─── Labels locales para los enums ───────────────────────────────────────────

const VACCINE_TYPE_LABELS: Record<VaccineType, string> = {
  BRUCELLOSIS:         'Brucelosis',
  FOOT_AND_MOUTH:      'Fiebre aftosa',
  ANTHRAX:             'Ántrax',
  RABIES:              'Rabia',
  BLACKLEG:            'Pierna negra',
  IBR:                 'Rinotraqueítis (IBR)',
  BVD:                 'Diarrea viral bovina (BVD)',
  LEPTOSPIROSIS:       'Leptospirosis',
  CLOSTRIDIAL:         'Clostridial',
  PASTEURELLA:         'Pasteurelosis',
  TUBERCULOSIS:        'Tuberculosis',
  TETANUS:             'Tétanos',
  VIRAL_DIARRHEA:      'Diarrea viral',
  PARAINFLUENZA:       'Parainfluenza',
  RSV:                 'Virus sincicial respiratorio (RSV)',
  OTHER:               'Otra',
  RESPIRATORY_COMPLEX: 'Complejo respiratorio',
  CAMPYLOBACTER:       'Campilobacteriosis',
  TRICHOMONIASIS:      'Tricomoniasis',
  PINKEYE:             'Queratoconjuntivitis (Ojo rosado)',
  NEONATAL_DIARRHEA:   'Diarrea neonatal',
  SALMONELLA:          'Salmonelosis',
  FUSOBACTERIUM:       'Podredumbre (Fusobacterium)',
  LUMPY_SKIN:          'Dermatosis nodular',
  BLUETONGUE:          'Lengua azul',
  THEILERIA:           'Theileriosis',
  BABESIA_ANAPLASMA:   'Babesia/Anaplasmosis',
  PARATUBERCULOSIS:    'Paratuberculosis (Johne)',
};

const GENDER_LABELS: Record<string, string> = {
  MALE:   'Machos',
  FEMALE: 'Hembras',
};

// ─── Zod schema para el formulario ───────────────────────────────────────────

const scheduleSchema = z.object({
  vaccineType: z.nativeEnum(VaccineType, { error: 'Selecciona el tipo de vacuna' }),
  fromAgeMonths: z.preprocess(
    (v) => (v === '' || v == null) ? undefined : v,
    z.coerce.number().int().min(0, 'Debe ser ≥ 0'),
  ),
  toAgeMonths: z.preprocess(
    (v) => (v === '' || v == null) ? null : v,
    z.coerce.number().int().min(0).nullable().optional(),
  ),
  frequencyMonths: z.preprocess(
    (v) => (v === '' || v == null) ? null : v,
    z.coerce.number().int().min(0).nullable().optional(),
  ),
  isRequired: z.boolean().optional().default(true),
  genderFilter: z.enum(['MALE', 'FEMALE', '']).optional(),
  breedFilter: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof scheduleSchema>;

// ─── Componente ───────────────────────────────────────────────────────────────

export function VaccinationSchedulesPage() {
  const { user } = useAuth();
  const toast    = useToast();

  const canManage = canUser(user?.role, 'MANAGE_BOVINE');

  const { data: schedules, isLoading, error } = useVaccinationSchedules();

  const createMutation = useCreateVaccinationSchedule();
  const updateMutation = useUpdateVaccinationSchedule();
  const deleteMutation = useDeleteVaccinationSchedule();

  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<VaccinationScheduleEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(scheduleSchema) as any,
    defaultValues: { isRequired: true, genderFilter: '' },
  });

  function openCreate() {
    setEditing(null);
    reset({ isRequired: true, genderFilter: '', fromAgeMonths: 0 });
    setShowForm(true);
  }

  function openEdit(entry: VaccinationScheduleEntry) {
    setEditing(entry);
    reset({
      vaccineType:      entry.vaccineType,
      fromAgeMonths:    entry.fromAgeMonths,
      toAgeMonths:      entry.toAgeMonths ?? null,
      frequencyMonths:  entry.frequencyMonths ?? null,
      isRequired:       entry.isRequired,
      genderFilter:     (entry.genderFilter as 'MALE' | 'FEMALE' | '') ?? '',
      breedFilter:      entry.breedFilter ?? '',
      notes:            entry.notes ?? '',
    });
    setShowForm(true);
  }

  async function onSubmit(values: FormValues) {
    const payload: CreateVaccinationScheduleInput = {
      vaccineType:     values.vaccineType,
      fromAgeMonths:   values.fromAgeMonths as number,
      toAgeMonths:     values.toAgeMonths ?? null,
      frequencyMonths: values.frequencyMonths ?? null,
      isRequired:      values.isRequired ?? true,
      genderFilter:    values.genderFilter || null,
      breedFilter:     values.breedFilter || null,
      notes:           values.notes || null,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload });
        toast.success('Calendario actualizado', 'La entrada fue modificada correctamente.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Calendario creado', 'La nueva entrada fue agregada al catálogo.');
      }
      setShowForm(false);
    } catch (err: unknown) {
      toast.error(
        editing ? 'Error al actualizar' : 'Error al crear',
        (err as Error)?.message ?? 'Intenta de nuevo.',
      );
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Entrada eliminada', 'La entrada fue removida del catálogo.');
    } catch (err: unknown) {
      toast.error('Error al eliminar', (err as Error)?.message ?? 'Intenta de nuevo.');
    } finally {
      setDeletingId(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/30 p-3">
            <Syringe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Calendario base de vacunación
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Define qué vacunas le tocan a cada bovino según edad, sexo y raza
            </p>
          </div>
        </div>
        {canManage && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Nueva entrada
          </Button>
        )}
      </div>

      {/* ── Info card ────────────────────────────────────────────────────── */}
      <Alert variant="info">
        <div className="flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            El motor de <strong>Calendario sugerido</strong> (pestaña Vacunación del bovino)
            usa estas entradas para clasificar cada vacuna como{' '}
            <em>PENDIENTE · VENCIDA · AL DÍA · DOSIS ÚNICA COMPLETA</em>.
            Las entradas inactivas no generan alertas nuevas.
          </span>
        </div>
      </Alert>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Card className="flex items-center justify-center h-48">
          <Spinner />
        </Card>
      ) : error ? (
        <Alert variant="error" title="Error al cargar el catálogo">
          {(error as Error)?.message ?? 'Intenta recargar la página.'}
        </Alert>
      ) : !schedules?.length ? (
        <Card className="text-center py-16">
          <Syringe className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            No hay entradas en el catálogo todavía.
          </p>
          {canManage && (
            <Button className="mt-4" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
              Crear primera entrada
            </Button>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Vacuna</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Edad (meses)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Frecuencia</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Aplicable a</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Obligatoria</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Estado</th>
                {canManage && (
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
              {schedules.map((entry) => (
                <tr
                  key={entry.id}
                  className={cn(
                    'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40',
                    !entry.isActive && 'opacity-50',
                  )}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {VACCINE_TYPE_LABELS[entry.vaccineType] ?? entry.vaccineType}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {entry.fromAgeMonths}
                    {entry.toAgeMonths != null ? ` – ${entry.toAgeMonths}` : '+'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {entry.frequencyMonths
                      ? `Cada ${entry.frequencyMonths} meses`
                      : <span className="text-gray-400 italic">Dosis única</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {entry.genderFilter
                      ? GENDER_LABELS[entry.genderFilter] ?? entry.genderFilter
                      : 'Todos'}
                    {entry.breedFilter && (
                      <span className="ml-1 text-xs text-gray-400">· {entry.breedFilter}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.isRequired ? (
                      <Badge variant="danger">Obligatoria</Badge>
                    ) : (
                      <Badge variant="default">Recomendada</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.isActive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" /> Inactiva
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(entry)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(entry.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: crear / editar ────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar entrada del calendario' : 'Nueva entrada del calendario'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo de vacuna */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Tipo de vacuna <span className="text-red-500">*</span>
            </label>
            <select
              {...register('vaccineType')}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            >
              <option value="">Selecciona...</option>
              {Object.values(VaccineType).map((v) => (
                <option key={v} value={v}>{VACCINE_TYPE_LABELS[v] ?? v}</option>
              ))}
            </select>
            {errors.vaccineType && (
              <p className="mt-1 text-xs text-red-500">{String(errors.vaccineType.message)}</p>
            )}
          </div>

          {/* Rango de edad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Edad mínima (meses) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                {...register('fromAgeMonths')}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              {errors.fromAgeMonths && (
                <p className="mt-1 text-xs text-red-500">{String(errors.fromAgeMonths.message)}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Edad máxima (meses)
                <span className="ml-1 text-xs text-gray-400 font-normal">dejar vacío = sin tope</span>
              </label>
              <input
                type="number"
                min={0}
                {...register('toAgeMonths')}
                placeholder="Sin límite"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Frecuencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Frecuencia de revacunación (meses)
              <span className="ml-1 text-xs text-gray-400 font-normal">dejar vacío = dosis única</span>
            </label>
            <input
              type="number"
              min={0}
              {...register('frequencyMonths')}
              placeholder="Dosis única"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          {/* Filtros opcionales */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Sexo aplicable
              </label>
              <select
                {...register('genderFilter')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="">Ambos sexos</option>
                <option value="MALE">Solo machos</option>
                <option value="FEMALE">Solo hembras</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Raza específica
                <span className="ml-1 text-xs text-gray-400 font-normal">opcional</span>
              </label>
              <input
                type="text"
                {...register('breedFilter')}
                placeholder="Todas las razas"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Obligatoria */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('isRequired')}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Vacuna obligatoria
              <span className="ml-1 text-xs text-gray-400 font-normal">
                (genera alerta PENDIENTE si no se aplica)
              </span>
            </span>
          </label>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Indicaciones adicionales, contraindicaciones, etc."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
          </div>

          {/* Si es edición, toggle isActive */}
          {editing && (
            <Alert variant="warning">
              Para desactivar esta entrada usa el botón de edición y desmarca "Obligatoria"
              — el campo <strong>isActive</strong> se puede cambiar en la tabla directamente
              contactando a soporte o via API.
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              icon={editing ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            >
              {editing ? 'Guardar cambios' : 'Crear entrada'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Confirm delete ───────────────────────────────────────────────── */}
      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Eliminar entrada del calendario"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            ¿Eliminar esta entrada? Los calendarios sugeridos de los bovinos ya no incluirán
            esta vacuna. Esta acción <strong>no se puede deshacer</strong>.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
