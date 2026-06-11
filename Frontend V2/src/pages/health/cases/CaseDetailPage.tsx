/**
 * Detalle de caso clínico.
 *
 * Ruta: `/health/cases/:id`
 * Lectura abierta a todo rol autenticado. Acciones (editar, cerrar, añadir
 * síntoma/tratamiento/lab, registrar resultado) cada una con su propio
 * PermissionGuard correspondiente.
 *
 * Esta página es el orquestador — toda la lógica de mutación vive en los
 * modales (`components/cases/*Modal.tsx`). Aquí solo:
 *   - Cargar `useBovineCase(id)`.
 *   - Render header + secciones (Síntomas / Tratamientos / Laboratorios).
 *   - Controlar visibilidad de modales.
 *   - Eliminar síntomas (acción atómica, no requiere modal).
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { PageLoader } from '@/components/ui/Spinner';
import { PermissionGuard } from '@/components/ui/PermissionGuard';
import {
  ArrowLeft, Edit3, CheckCircle2, Plus, Stethoscope, Pill, FlaskConical,
  Trash2, Calendar, User, FileText, ClipboardEdit, ShieldOff,
} from 'lucide-react';
import { useBovineCase, useRemoveCaseSymptom } from '@/hooks/useBovineCases';
import type {
  CaseSymptomResponse, CaseTreatmentResponse, CaseLabTestResponse,
} from '@/types/bovineCase.dtos';
import {
  getCaseStatusBadgeVariant, getCaseStatusLabel,
  getCaseSeverityBadgeVariant, getCaseSeverityLabel,
  getCaseOutcomeBadgeVariant, getCaseOutcomeLabel,
  getSymptomIntensityBadgeVariant, getSymptomIntensityLabel,
  getLabResultStatusBadgeVariant, getLabResultStatusLabel,
  isCaseOpen,
} from '@/design-system/tokens/case-status.colors';
import { formatDate, formatRelative } from '@/utils/formatters';
import { useToast } from '@/store/ToastContext';

import { UpdateCaseModal }       from '@/components/cases/UpdateCaseModal';
import { CloseCaseModal }        from '@/components/cases/CloseCaseModal';
import { AddSymptomModal }       from '@/components/cases/AddSymptomModal';
import { AddTreatmentModal }     from '@/components/cases/AddTreatmentModal';
import { AddLabTestModal }       from '@/components/cases/AddLabTestModal';
import { UpdateLabResultModal }  from '@/components/cases/UpdateLabResultModal';
import { LabResultStatus } from '@/types/bovineCase.dtos';

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: caseDto, isLoading, isError, error } = useBovineCase(id);

  // ── Estado de modales ────────────────────────────────────────────────────
  const [editOpen, setEditOpen]               = useState(false);
  const [closeOpen, setCloseOpen]             = useState(false);
  const [addSymptomOpen, setAddSymptomOpen]   = useState(false);
  const [addTreatmentOpen, setAddTreatmentOpen] = useState(false);
  const [addLabOpen, setAddLabOpen]           = useState(false);
  const [labResultTarget, setLabResultTarget] = useState<CaseLabTestResponse | null>(null);

  if (isLoading) return <PageLoader />;

  if (isError || !caseDto) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="error" title="No se pudo cargar el caso">
          {(error as Error)?.message ?? 'El caso no existe o fue eliminado.'}
        </Alert>
      </div>
    );
  }

  const open = isCaseOpen(caseDto.status);

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                <Link
                  to={`/health/diseases/catalogo/${caseDto.disease.slug}`}
                  className="hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {caseDto.disease.name}
                </Link>
              </h1>
              <Badge variant={getCaseStatusBadgeVariant(caseDto.status)}>
                {getCaseStatusLabel(caseDto.status)}
              </Badge>
              <Badge variant={getCaseSeverityBadgeVariant(caseDto.severity)}>
                {getCaseSeverityLabel(caseDto.severity)}
              </Badge>
              {caseDto.outcome && (
                <Badge variant={getCaseOutcomeBadgeVariant(caseDto.outcome)}>
                  {getCaseOutcomeLabel(caseDto.outcome)}
                </Badge>
              )}
              {caseDto.isBreakthrough && (
                <Badge
                  variant="warning"
                  className="inline-flex items-center gap-1"
                  title="El bovino estaba vacunado contra esta enfermedad al momento del diagnostico. Revisa el lote de la vacuna y el protocolo aplicado."
                >
                  <ShieldOff className="w-3 h-3" />
                  Fallo vacunal
                </Badge>
              )}
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bovino:{' '}
              <Link
                to={`/bovines/${caseDto.bovineId}`}
                className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                {caseDto.bovine.earTag}
                {caseDto.bovine.name && ` · ${caseDto.bovine.name}`}
              </Link>
              {caseDto.bovine.breed && (
                <span className="text-gray-500 dark:text-gray-500"> · {caseDto.bovine.breed}</span>
              )}
            </p>
          </div>

          {/* Acciones del header — solo si el caso está abierto */}
          {open && (
            <div className="flex flex-wrap gap-2">
              <PermissionGuard action="MANAGE_CASE">
                <Button
                  variant="outline"
                  icon={<Edit3 className="w-4 h-4" />}
                  onClick={() => setEditOpen(true)}
                >
                  Editar
                </Button>
              </PermissionGuard>
              <PermissionGuard action="CLOSE_CASE">
                <Button
                  variant="primary"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => setCloseOpen(true)}
                >
                  Cerrar caso
                </Button>
              </PermissionGuard>
            </div>
          )}
        </div>

        {/* Meta info en grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <Meta
            icon={<Calendar className="w-4 h-4" />}
            label="Diagnosticado"
            value={formatDate(caseDto.diagnosedAt)}
            hint={formatRelative(caseDto.diagnosedAt)}
          />
          <Meta
            icon={<User className="w-4 h-4" />}
            label="Por"
            value={caseDto.diagnosedBy ?? '—'}
          />
          <Meta
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Resolución"
            value={caseDto.resolvedAt ? formatDate(caseDto.resolvedAt) : 'En curso'}
            hint={caseDto.resolvedAt ? formatRelative(caseDto.resolvedAt) : undefined}
          />
          <Meta
            icon={<Stethoscope className="w-4 h-4" />}
            label="Estado"
            value={open ? 'Activo' : 'Cerrado'}
          />
        </div>

        {caseDto.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Notas
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {caseDto.notes}
            </p>
          </div>
        )}
      </Card>

      {/* Síntomas */}
      <SymptomsSection
        caseId={caseDto.id}
        bovineId={caseDto.bovineId}
        symptoms={caseDto.symptoms ?? []}
        canManage={open}
        onAdd={() => setAddSymptomOpen(true)}
      />

      {/* Tratamientos */}
      <TreatmentsSection
        treatments={caseDto.treatments ?? []}
        canManage={open}
        onAdd={() => setAddTreatmentOpen(true)}
      />

      {/* Laboratorios */}
      <LabTestsSection
        labTests={caseDto.labTests ?? []}
        canManage={open}
        onAdd={() => setAddLabOpen(true)}
        onRegisterResult={(lab) => setLabResultTarget(lab)}
      />

      {/* ── Modales ─────────────────────────────────────────────────────── */}
      {open && (
        <>
          <UpdateCaseModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            caseId={caseDto.id}
            bovineId={caseDto.bovineId}
            initial={{
              status:   caseDto.status,
              severity: caseDto.severity,
              notes:    caseDto.notes,
            }}
          />
          <CloseCaseModal
            open={closeOpen}
            onClose={() => setCloseOpen(false)}
            caseId={caseDto.id}
            bovineId={caseDto.bovineId}
          />
          <AddSymptomModal
            open={addSymptomOpen}
            onClose={() => setAddSymptomOpen(false)}
            caseId={caseDto.id}
            bovineId={caseDto.bovineId}
            diseaseId={caseDto.diseaseId}
          />
          <AddTreatmentModal
            open={addTreatmentOpen}
            onClose={() => setAddTreatmentOpen(false)}
            caseId={caseDto.id}
            bovineId={caseDto.bovineId}
          />
          <AddLabTestModal
            open={addLabOpen}
            onClose={() => setAddLabOpen(false)}
            caseId={caseDto.id}
            bovineId={caseDto.bovineId}
          />
        </>
      )}

      {labResultTarget && (
        <UpdateLabResultModal
          open={!!labResultTarget}
          onClose={() => setLabResultTarget(null)}
          caseId={caseDto.id}
          bovineId={caseDto.bovineId}
          labTestId={labResultTarget.id}
          testName={labResultTarget.testName}
        />
      )}
    </div>
  );
}

// ── Sub-componentes de secciones ───────────────────────────────────────────

interface SymptomsSectionProps {
  caseId: string;
  bovineId: string;
  symptoms: CaseSymptomResponse[];
  canManage: boolean;
  onAdd: () => void;
}

function SymptomsSection({ caseId, bovineId, symptoms, canManage, onAdd }: SymptomsSectionProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const removeMutation = useRemoveCaseSymptom(caseId, bovineId);

  async function handleRemove(symptomId: string) {
    if (!confirm('¿Quitar este síntoma del caso?')) return;
    try {
      await removeMutation.mutateAsync(symptomId);
      toastSuccess('Síntoma eliminado');
    } catch (err) {
      toastError('No se pudo eliminar', (err as Error)?.message);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle className="flex items-center gap-2 mb-0">
          <Stethoscope className="w-5 h-5 text-primary-600" />
          Síntomas observados
          {symptoms.length > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({symptoms.length})
            </span>
          )}
        </CardTitle>
        {canManage && (
          <PermissionGuard action="MANAGE_CASE">
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onAdd}>
              Añadir
            </Button>
          </PermissionGuard>
        )}
      </div>

      {symptoms.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No se han registrado síntomas para este caso.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {symptoms.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900 dark:text-white">{s.symptom.name}</p>
                  <Badge variant={getSymptomIntensityBadgeVariant(s.intensity)}>
                    {getSymptomIntensityLabel(s.intensity)}
                  </Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    · Observado {formatRelative(s.observedAt)}
                  </span>
                </div>
                {s.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{s.notes}</p>
                )}
              </div>
              {canManage && (
                <PermissionGuard action="MANAGE_CASE">
                  <button
                    type="button"
                    onClick={() => handleRemove(s.id)}
                    disabled={removeMutation.isPending}
                    className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                    title="Eliminar síntoma"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </PermissionGuard>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

interface TreatmentsSectionProps {
  treatments: CaseTreatmentResponse[];
  canManage: boolean;
  onAdd: () => void;
}

function TreatmentsSection({ treatments, canManage, onAdd }: TreatmentsSectionProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle className="flex items-center gap-2 mb-0">
          <Pill className="w-5 h-5 text-primary-600" />
          Tratamientos
          {treatments.length > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({treatments.length})
            </span>
          )}
        </CardTitle>
        {canManage && (
          <PermissionGuard action="MANAGE_CASE">
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onAdd}>
              Registrar
            </Button>
          </PermissionGuard>
        )}
      </div>

      {treatments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Sin tratamientos registrados.
        </p>
      ) : (
        <ul className="space-y-3">
          {treatments.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                <p className="font-medium text-gray-900 dark:text-white">{t.treatmentName}</p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(t.administeredAt)}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t.dosage} · {t.applicationRoute}
                {t.administeredBy && <span className="text-gray-500"> · por {t.administeredBy}</span>}
              </p>
              {(t.durationDays || t.withdrawalPeriodDays) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t.durationDays != null && <>Duración: {t.durationDays} días · </>}
                  {t.withdrawalPeriodDays != null && <>Retiro: {t.withdrawalPeriodDays} días</>}
                </p>
              )}
              {t.notes && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">{t.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

interface LabTestsSectionProps {
  labTests: CaseLabTestResponse[];
  canManage: boolean;
  onAdd: () => void;
  onRegisterResult: (lab: CaseLabTestResponse) => void;
}

function LabTestsSection({ labTests, canManage, onAdd, onRegisterResult }: LabTestsSectionProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardTitle className="flex items-center gap-2 mb-0">
          <FlaskConical className="w-5 h-5 text-primary-600" />
          Laboratorios
          {labTests.length > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({labTests.length})
            </span>
          )}
        </CardTitle>
        {canManage && (
          <PermissionGuard action="MANAGE_CASE">
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onAdd}>
              Solicitar
            </Button>
          </PermissionGuard>
        )}
      </div>

      {labTests.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Sin laboratorios solicitados.
        </p>
      ) : (
        <ul className="space-y-3">
          {labTests.map((lab) => {
            const pending = !lab.resultStatus || lab.resultStatus === LabResultStatus.PENDING;
            return (
              <li
                key={lab.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                  <p className="font-medium text-gray-900 dark:text-white">{lab.testName}</p>
                  <Badge variant={getLabResultStatusBadgeVariant(lab.resultStatus)}>
                    {getLabResultStatusLabel(lab.resultStatus ?? LabResultStatus.PENDING)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Solicitado: {formatDate(lab.requestedAt)}
                  {lab.labName && <> · {lab.labName}</>}
                  {lab.resultAt && <> · Resultado: {formatDate(lab.resultAt)}</>}
                </p>
                {lab.resultDetail && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">
                    {lab.resultDetail}
                  </p>
                )}
                {lab.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">{lab.notes}</p>
                )}

                {/* CTA registrar resultado: solo si el lab sigue pendiente y
                    el caso permite gestionarse (el padre ya filtra `canManage`). */}
                {pending && canManage && (
                  <div className="mt-3">
                    <PermissionGuard action="MANAGE_CASE">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<ClipboardEdit className="w-3.5 h-3.5" />}
                        onClick={() => onRegisterResult(lab)}
                      >
                        Registrar resultado
                      </Button>
                    </PermissionGuard>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ── Sub-componentes utilitarios ────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      to="/health/cases"
      className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
    >
      <ArrowLeft className="w-4 h-4" />
      Volver a casos
    </Link>
  );
}

interface MetaProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}

function Meta({ icon, label, value, hint }: MetaProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{value}</p>
      {hint && <p className="text-xs text-gray-400 truncate">{hint}</p>}
    </div>
  );
}
