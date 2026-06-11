/**
 * ClinicalDataForm — captura los datos clinicos de un caso inicial.
 *
 * Reusado en dos lugares (Modulo 7):
 *   1. `BovineFormPage` paso 2, como seccion condicional cuando el usuario
 *      marca el bovino como enfermo (F-22).
 *   2. `BovineDetailPage`, dentro del modal "Marcar enfermo" (F-24) para
 *      abrir un caso en un bovino existente.
 *
 * Estrategia: componente controlado. El padre maneja el valor como
 * `InitialCaseInput | null` y este componente solo emite cambios via
 * `onChange`. No usa RHF internamente para no acoplarse al schema del
 * padre — cada caller decide como validar (wizard via Zod refinement,
 * modal via guard simple antes del submit).
 */

import { useMemo } from 'react';
import { useActiveDiseases, useDiseaseSymptoms } from '@/hooks/useDiseases';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Activity, Plus, X, AlertTriangle } from 'lucide-react';
import type { InitialCaseInput, InitialCaseSymptomInput } from '@/types/bovine.dtos';

// ─── Constantes ─────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS: { value: InitialCaseInput['severity']; label: string; helper: string }[] = [
  { value: 'LOW',      label: 'Leve',     helper: 'Sintomas mínimos, no afecta producción' },
  { value: 'MODERATE', label: 'Moderada', helper: 'Sintomas claros, requiere tratamiento' },
  { value: 'HIGH',     label: 'Alta',     helper: 'Sintomas severos, riesgo de complicación' },
  { value: 'CRITICAL', label: 'Crítica',  helper: 'Vida en riesgo, atención urgente' },
];

const INTENSITY_OPTIONS: { value: InitialCaseSymptomInput['intensity']; label: string }[] = [
  { value: 'MILD',     label: 'Leve' },
  { value: 'MODERATE', label: 'Moderada' },
  { value: 'SEVERE',   label: 'Severa' },
];

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ClinicalDataFormProps {
  value: InitialCaseInput | null;
  onChange: (value: InitialCaseInput) => void;
  /** Errores por campo desde el padre (cuando el backend rechaza). */
  errors?: Partial<Record<keyof InitialCaseInput, string>>;
  /** Compact: usa stack vertical en lugar de grid 2 cols (modal angosto). */
  compact?: boolean;
  /** Texto del header de la seccion. Default: "Datos clínicos del caso". */
  title?: string;
  /** Texto secundario debajo del header. */
  subtitle?: string;
}

// ─── Helper para construir el value parcial ─────────────────────────────────

function emptyCase(): InitialCaseInput {
  return {
    diseaseId:   '',
    severity:    'MODERATE',
    diagnosedAt: todayISO(),
    diagnosedBy: '',
    notes:       '',
    symptoms:    [],
  };
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function ClinicalDataForm({
  value, onChange, errors, compact = false,
  title = 'Datos clínicos del caso',
  subtitle = 'El backend abrirá un caso clínico atómicamente con esta información.',
}: ClinicalDataFormProps) {
  // Garantizar un value valido — los padres pueden pasar null antes de hidratar.
  const current = value ?? emptyCase();

  // Lista de enfermedades para el select. Hook ya cachea 10 min.
  const { data: diseases = [], isLoading: loadingDiseases } = useActiveDiseases();

  // Sintomas del catalogo de la enfermedad elegida. Si no hay disease, no
  // se pide (el hook se queda en `enabled: false`).
  const { data: catalogSymptoms = [], isLoading: loadingSymptoms } = useDiseaseSymptoms(
    current.diseaseId || undefined,
    { enabled: !!current.diseaseId },
  );

  const diseaseOptions = useMemo(
    () => [
      { value: '', label: loadingDiseases ? 'Cargando...' : 'Selecciona la enfermedad...' },
      ...diseases.map((d) => ({ value: d.id, label: d.name })),
    ],
    [diseases, loadingDiseases],
  );

  // Helpers para emitir cambios parciales.
  function patch(partial: Partial<InitialCaseInput>) {
    onChange({ ...current, ...partial });
  }

  function addSymptom(symptomId: string) {
    if (!symptomId) return;
    // Evitar duplicado del mismo sintoma.
    if ((current.symptoms ?? []).some((s) => s.symptomId === symptomId)) return;
    patch({
      symptoms: [
        ...(current.symptoms ?? []),
        { symptomId, intensity: 'MODERATE' },
      ],
    });
  }

  function removeSymptom(symptomId: string) {
    patch({
      symptoms: (current.symptoms ?? []).filter((s) => s.symptomId !== symptomId),
    });
  }

  function updateSymptomIntensity(symptomId: string, intensity: InitialCaseSymptomInput['intensity']) {
    patch({
      symptoms: (current.symptoms ?? []).map((s) =>
        s.symptomId === symptomId ? { ...s, intensity } : s,
      ),
    });
  }

  // Catalog symptoms ya agregados — se ocultan del dropdown "agregar".
  const addedSymptomIds = new Set((current.symptoms ?? []).map((s) => s.symptomId));
  const availableSymptoms = catalogSymptoms.filter((s) => !addedSymptomIds.has(s.id));

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
          <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{title}</p>
          <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Disease + severity */}
      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Enfermedad <span className="text-red-500">*</span>
          </label>
          <Select
            options={diseaseOptions}
            value={current.diseaseId}
            onChange={(e) => patch({ diseaseId: e.target.value })}
            error={errors?.diseaseId}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Severidad <span className="text-red-500">*</span>
          </label>
          <Select
            options={SEVERITY_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
            value={current.severity}
            onChange={(e) => patch({ severity: e.target.value as InitialCaseInput['severity'] })}
            error={errors?.severity}
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            {SEVERITY_OPTIONS.find((s) => s.value === current.severity)?.helper}
          </p>
        </div>
      </div>

      {/* Diagnosed at + diagnosed by */}
      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
        <Input
          label="Fecha de diagnóstico *"
          type="date"
          max={todayISO()}
          value={current.diagnosedAt}
          onChange={(e) => patch({ diagnosedAt: e.target.value })}
          error={errors?.diagnosedAt}
        />
        <Input
          label="Diagnosticado por"
          placeholder="Nombre del veterinario..."
          value={current.diagnosedBy ?? ''}
          onChange={(e) => patch({ diagnosedBy: e.target.value })}
          error={errors?.diagnosedBy}
        />
      </div>

      {/* Symptoms (opcionales) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Síntomas observados <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          {current.diseaseId && (
            <span className="text-[11px] text-gray-500">
              {(current.symptoms ?? []).length} de {catalogSymptoms.length}
            </span>
          )}
        </div>

        {!current.diseaseId ? (
          <p className="text-xs text-gray-500 italic py-2">
            Selecciona primero la enfermedad para ver los síntomas del catálogo.
          </p>
        ) : loadingSymptoms ? (
          <div className="flex items-center gap-2 py-2"><Spinner /> <span className="text-xs text-gray-500">Cargando síntomas...</span></div>
        ) : catalogSymptoms.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Esta enfermedad no tiene síntomas catalogados. Captura los detalles en las notas.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Lista de sintomas agregados con su intensidad */}
            {(current.symptoms ?? []).map((s) => {
              const symptom = catalogSymptoms.find((cs) => cs.id === s.symptomId);
              return (
                <div
                  key={s.symptomId}
                  className="flex items-center gap-2 p-2 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {symptom?.name ?? '(sin catalogar)'}
                    </p>
                    {symptom?.description && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {symptom.description}
                      </p>
                    )}
                  </div>
                  <div className="w-32 shrink-0">
                    <Select
                      options={INTENSITY_OPTIONS}
                      value={s.intensity}
                      onChange={(e) => updateSymptomIntensity(s.symptomId, e.target.value as InitialCaseSymptomInput['intensity'])}
                      className="!py-1 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSymptom(s.symptomId)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Quitar síntoma"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Agregar siguiente sintoma */}
            {availableSymptoms.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Select
                  options={[
                    { value: '', label: 'Agregar síntoma...' },
                    ...availableSymptoms.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  value=""
                  onChange={(e) => addSymptom(e.target.value)}
                  className="flex-1 !py-1.5 text-xs"
                />
                <Plus className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </div>
            )}

            {availableSymptoms.length === 0 && (current.symptoms ?? []).length > 0 && (
              <Badge variant="info" className="text-[10px]">
                Todos los síntomas del catálogo ya están agregados
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas clínicas
        </label>
        <textarea
          value={current.notes ?? ''}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={2}
          placeholder="Observaciones del veterinario, hallazgos lab, plan de tratamiento..."
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
        />
        {errors?.notes && <p className="mt-1 text-xs text-red-500">{errors.notes}</p>}
      </div>
    </div>
  );
}

// ─── Validador helper ───────────────────────────────────────────────────────
//
// Util para que los callers chequeen rapido si los datos clinicos minimos
// estan completos antes de enviar. El backend valida tambien (C-03), pero
// la UX es mejor si bloqueamos el submit en cliente.

export function isClinicalDataValid(value: InitialCaseInput | null | undefined): boolean {
  if (!value) return false;
  return !!value.diseaseId
    && !!value.severity
    && !!value.diagnosedAt
    && !Number.isNaN(new Date(value.diagnosedAt).getTime());
}
