/**
 * Página de brote — timeline + grafo de contagio.
 *
 * Ruta: `/health/epidemiology/outbreak/:diseaseId`
 * Permisos: `VIEW_EPIDEMIOLOGY` (igual que el dashboard padre).
 *
 * Carga `useOutbreak(ranchId, diseaseId)` → resumen + timeline. El grafo
 * de contactos se carga aparte (`useCaseContacts(selectedCaseId)`) y se
 * dispara al seleccionar un caso de la timeline. La acción "Detectar
 * contactos" usa el hook idempotente del Sprint 1 (`useDetectCaseContacts`,
 * `isDetecting` + invalidación condicional según `newLinks > 0`).
 *
 * Si el rancho NO tiene casos de esta enfermedad, el backend probablemente
 * devuelve 404/empty → mostramos un mensaje amigable.
 */

import { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import {
  RanchFilterBanner, RanchFilterBannerEmpty,
} from '@/components/shared/RanchFilterBanner';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { PermissionGuard } from '@/components/ui/PermissionGuard';
import {
  ArrowLeft, Activity, Calendar, CheckCircle2, Skull, Clock,
  RefreshCw, Network, AlertTriangle, Bug, UserPlus,
} from 'lucide-react';
import {
  useOutbreak, useCaseContacts, useDetectCaseContacts,
} from '@/hooks/useEpidemiology';
import { OutbreakTimeline } from '@/components/outbreak/OutbreakTimeline';
import { ContactNetworkGraph } from '@/components/outbreak/ContactNetworkGraph';
import { ManualContactModal } from '@/components/outbreak/ManualContactModal';
import { formatDate } from '@/utils/formatters';

export function OutbreakPage() {
  const { diseaseId } = useParams<{ diseaseId: string }>();
  const { activeRanchId } = useAuth();
  const { success: toastSuccess, info: toastInfo, error: toastError } = useToast();

  const { data: outbreak, isLoading, isError, error } = useOutbreak(
    activeRanchId ?? undefined,
    diseaseId,
    { enabled: !!activeRanchId && !!diseaseId },
  );

  // ── Selección de caso para el grafo ──────────────────────────────────────
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // F-37 / Backend E-07: modal de captura manual de contacto.
  const [showManualContactModal, setShowManualContactModal] = useState(false);

  // Cuando cargan los datos por primera vez, seleccionamos el primer caso
  // (caso índice del brote) para que el grafo no arranque vacío.
  useEffect(() => {
    if (outbreak && outbreak.timeline.length > 0 && !selectedCaseId) {
      setSelectedCaseId(outbreak.timeline[0].caseId);
    }
  }, [outbreak, selectedCaseId]);

  // Si cambia el brote (diseaseId distinto), resetea la selección.
  useEffect(() => {
    setSelectedCaseId(null);
  }, [diseaseId]);

  const selectedCase = useMemo(
    () => outbreak?.timeline.find((c) => c.caseId === selectedCaseId) ?? null,
    [outbreak, selectedCaseId],
  );

  const { data: contacts, isLoading: isLoadingContacts } = useCaseContacts(
    selectedCaseId ?? undefined,
    { enabled: !!selectedCaseId },
  );

  const detectMutation = useDetectCaseContacts(selectedCaseId ?? '');

  async function handleDetect() {
    if (!selectedCaseId) return;
    try {
      const result = await detectMutation.mutateAsync();
      if (result.newLinks > 0) {
        // H-8: distinguir "contagiados" (targetCaseId != null) vs "expuestos" (isExposureOnly)
        const newItems = (result.data ?? []).filter((c) => c.isNew);
        const exposures = newItems.filter((c) => c.isExposureOnly ?? c.targetCaseId === null).length;
        const contagions = newItems.length - exposures;
        const parts: string[] = [];
        if (contagions > 0) parts.push(`${contagions} contagiado(s)`);
        if (exposures > 0) parts.push(`${exposures} expuesto(s) asintomático(s)`);
        toastSuccess(
          'Contactos detectados',
          `${parts.join(' · ')} — ${result.total} candidatos evaluados.`,
        );
      } else {
        toastInfo(
          'Sin nuevos contactos',
          `Se evaluaron ${result.total} candidatos y todos ya estaban registrados.`,
        );
      }
    } catch (err) {
      toastError('Error al detectar contactos', (err as Error)?.message);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Link
        to="/health/epidemiology"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al dashboard
      </Link>

      <RanchFilterBanner
        activeHint="Brote en este rancho."
        emptyHint="Selecciona un rancho para ver el brote."
      />

      {!activeRanchId && (
        <RanchFilterBannerEmpty
          title="Selecciona un rancho"
          description="El análisis de brote es por rancho × enfermedad. Elige uno arriba para continuar."
        />
      )}

      {activeRanchId && (
        <>
          {isLoading ? (
            <Card className="flex items-center justify-center h-64">
              <Spinner />
            </Card>
          ) : isError ? (
            <Alert variant="error" title="No se pudo cargar el brote">
              {(error as Error)?.message ?? 'Verifica que el rancho tenga casos de esta enfermedad.'}
            </Alert>
          ) : !outbreak ? (
            <Alert variant="info" title="Sin brote para esta enfermedad">
              El rancho no tiene casos registrados de la enfermedad solicitada.
            </Alert>
          ) : (
            <>
              {/* Header del brote */}
              <Card>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-7 h-7 text-primary-600" />
                        Brote: {outbreak.disease.name}
                      </h1>
                      {outbreak.disease.isContagious && (
                        <Badge variant="warning">
                          <Bug className="w-3 h-3 mr-1 inline" /> Contagiosa
                        </Badge>
                      )}
                      {outbreak.disease.isZoonotic && (
                        <Badge variant="danger" title="Transmisible al ser humano">
                          <AlertTriangle className="w-3 h-3 mr-1 inline" /> Zoonótica
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Rancho: <strong>{outbreak.ranchName}</strong>
                      {' · '}
                      Incubación documentada: {outbreak.disease.incubationDaysMin}–{outbreak.disease.incubationDaysMax} días
                    </p>
                  </div>
                  <Link
                    to={`/health/diseases/catalogo/${outbreak.disease.slug}`}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline shrink-0"
                  >
                    Ver enfermedad en catálogo →
                  </Link>
                </div>
              </Card>

              {/* KPIs del brote */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total casos"
                  value={outbreak.summary.totalCases}
                  icon={Activity}
                  color="primary"
                />
                <StatCard
                  title="Activos"
                  value={outbreak.summary.activeCases}
                  icon={AlertTriangle}
                  color="red"
                />
                <StatCard
                  title="Recuperados"
                  value={outbreak.summary.recoveredCases}
                  icon={CheckCircle2}
                  color="emerald"
                />
                <StatCard
                  title="Fallecidos"
                  value={outbreak.summary.deceasedCases}
                  icon={Skull}
                  color="gray"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <MetaTile
                  icon={<Calendar className="w-4 h-4" />}
                  label="Primer caso"
                  value={formatDate(outbreak.summary.firstCaseAt)}
                />
                <MetaTile
                  icon={<Calendar className="w-4 h-4" />}
                  label="Último caso"
                  value={formatDate(outbreak.summary.lastCaseAt)}
                />
                <MetaTile
                  icon={<Clock className="w-4 h-4" />}
                  label="Duración"
                  value={`${outbreak.summary.durationDays} ${outbreak.summary.durationDays === 1 ? 'día' : 'días'}`}
                />
              </div>

              {/* Timeline + Grafo lado a lado en lg, apilados en mobile */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary-600" />
                    Cronología
                  </h2>
                  <OutbreakTimeline
                    cases={outbreak.timeline}
                    selectedCaseId={selectedCaseId}
                    onCaseSelect={setSelectedCaseId}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Network className="w-5 h-5 text-primary-600" />
                      Red de contagio
                    </h2>
                    {selectedCase && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* F-37 / Backend E-07: captura manual de contacto
                            (contactos NO co-localizados que el motor
                            automatico no detecta). Mismo permiso que detect
                            para mantener UX consistente. */}
                        <PermissionGuard action="DETECT_CONTACTS">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<UserPlus className="w-3.5 h-3.5" />}
                            onClick={() => setShowManualContactModal(true)}
                            title="Capturar contacto manual (transporte, vecino, etc.)"
                          >
                            Agregar contacto
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard action="DETECT_CONTACTS">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<RefreshCw className={detectMutation.isDetecting ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />}
                            loading={detectMutation.isDetecting}
                            onClick={handleDetect}
                          >
                            Detectar contactos
                          </Button>
                        </PermissionGuard>
                      </div>
                    )}
                  </div>

                  {!selectedCase ? (
                    <Card className="text-center py-12">
                      <Network className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Selecciona un caso de la cronología para ver su red de contagio.
                      </p>
                    </Card>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Centrado en <strong>{selectedCase.bovineEarTag}
                        {selectedCase.bovineName && ` · ${selectedCase.bovineName}`}</strong>
                        {' · '}diagnosticado el {formatDate(selectedCase.diagnosedAt)}
                      </p>
                      {isLoadingContacts ? (
                        <Card className="flex items-center justify-center h-[420px]">
                          <Spinner />
                        </Card>
                      ) : (
                        <ContactNetworkGraph
                          centralCaseId={selectedCase.caseId}
                          centralLabel={`${selectedCase.bovineEarTag}${selectedCase.bovineName ? ` · ${selectedCase.bovineName}` : ''}`}
                          centralStatus={selectedCase.status}
                          contacts={contacts ?? null}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* F-37 / Backend E-07: modal de captura manual de contacto. Solo se
          monta cuando se abre desde el boton del header del grafo. El
          bovino destino se busca dentro del rancho activo; el bovino
          fuente se excluye automaticamente para evitar self-contact. */}
      {selectedCase && (
        <ManualContactModal
          open={showManualContactModal}
          onClose={() => setShowManualContactModal(false)}
          sourceCaseId={selectedCase.caseId}
          sourceBovineId={selectedCase.bovineId}
          ranchId={activeRanchId}
        />
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

interface MetaTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetaTile({ icon, label, value }: MetaTileProps) {
  return (
    <Card className="!p-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </Card>
  );
}
