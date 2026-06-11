/**
 * DTOs del módulo de Epidemiología (Fases 4 y 5 del backend).
 *
 * - Snapshots (Fase 4): persistencia nocturna de métricas por
 *   rancho × enfermedad para graficar tendencias.
 * - Brote/Outbreak (Fase 5): timeline clínica + grafo de contagio.
 *
 * Endpoints:
 *   GET  /api/epidemiology/snapshots
 *   GET  /api/epidemiology/snapshots/latest
 *   GET  /api/epidemiology/top-diseases/:ranchId
 *   GET  /api/epidemiology/trend/:ranchId
 *   POST /api/epidemiology/compute
 *   GET  /api/epidemiology/outbreak/:ranchId/:diseaseId
 *   POST /api/epidemiology/cases/:caseId/detect-contacts
 *   GET  /api/epidemiology/cases/:caseId/contacts
 */

import type { CaseStatus, CaseSeverity, CaseOutcome, BovineMini } from './bovineCase.dtos';
import type { DiseaseCategory, DiseaseSeverity } from './disease.dtos';

// ─── Snapshot ───────────────────────────────────────────────────────────────

export interface EpidemiologySnapshot {
  id:                  string;
  ranchId:             string;
  /** `null` ⇒ snapshot global del rancho (todas las enfermedades). */
  diseaseId:           string | null;
  snapshotDate:        string;        // YYYY-MM-DD
  activeCases:         number;
  affectedBovines:     number;
  newCases7d:          number;
  newCases30d:         number;
  closedCases30d:      number;
  recoveredCount:      number;
  deceasedCount:       number;
  totalBovinesInRanch: number;
  incidenceRate:       number;        // 0..100 %
  mortalityRate:       number;
  avgResolutionDays:   number | null;
  computedAt:          string;        // ISO timestamp
  /**
   * Bovinos con proteccion vacunal activa contra esta enfermedad.
   * Solo presente en snapshots por-enfermedad (diseaseId !== null).
   */
  vaccinatedBovines?:    number;
  /** Total - vacunados. Solo en snapshots por-enfermedad. */
  susceptibleBovines?:   number;
  /**
   * Porcentaje 0-100 de cobertura vacunal. `null` en snapshots globales
   * (donde no aplica al no estar acotado por enfermedad) o cuando
   * totalBovinesInRanch === 0.
   */
  vaccinationCoverage?:  number | null;
  // Eager-loaded relations
  disease?: { id: string; name: string; slug: string } | null;
  ranch?:   { id: string; name: string };
}

export interface SnapshotFilters {
  ranchId?:   string;
  /**
   * UUID de enfermedad O la cadena literal `"null"` para snapshots
   * globales del rancho. ⚠️ NO omitir el param para "global" — el backend
   * usa `"null"` como string para distinguir "global" de "no filtrar".
   */
  diseaseId?: string | 'null';
  fromDate?:  string;
  toDate?:    string;
  limit?:     number;
  offset?:    number;
}

// ─── Top diseases ───────────────────────────────────────────────────────────

export interface TopDiseaseItem {
  diseaseId:           string;
  diseaseName:         string;
  diseaseSlug:         string;
  activeCases:         number;
  affectedBovines:     number;
  newCases7d:          number;
  incidenceRate:       number;
  /** Bovinos con proteccion vacunal activa contra la enfermedad. */
  vaccinatedBovines?:  number;
  /** Porcentaje 0-100. `null` si totalBovinesInRanch === 0. */
  vaccinationCoverage?: number | null;
}

// ─── Trend (serie temporal) ────────────────────────────────────────────────

export interface TrendPoint {
  snapshotDate:   string;
  activeCases:    number;
  newCases7d:     number;
  newCases30d:    number;
  incidenceRate:  number;
  mortalityRate:  number;
  /**
   * Porcentaje 0-100 de cobertura vacunal en ese snapshot. `null` cuando
   * el snapshot es global (sin diseaseId) o cuando no se pudo calcular.
   */
  vaccinationCoverage?: number | null;
}

// ─── Outbreak (Fase 5) ─────────────────────────────────────────────────────

export interface OutbreakDisease {
  id:                string;
  name:              string;
  slug:              string;
  category:          DiseaseCategory | string;
  severity:          DiseaseSeverity | string;
  isContagious:      boolean;
  isZoonotic:        boolean;
  incubationDaysMin: number;
  incubationDaysMax: number;
}

export interface OutbreakSummary {
  totalCases:     number;
  activeCases:    number;
  recoveredCases: number;
  deceasedCases:  number;
  firstCaseAt:    string;
  lastCaseAt:     string;
  durationDays:   number;
}

export interface OutbreakTimelineCase {
  caseId:         string;
  bovineId:       string;
  bovineEarTag:   string;
  bovineName:     string | null;
  breed?:         string;
  status:         CaseStatus;
  severity:       CaseSeverity;
  diagnosedAt:    string;
  resolvedAt:     string | null;
  outcome:        CaseOutcome | null;
  diagnosedBy?:   string;
  /** `null` cuando el caso sigue abierto — la UI debe mostrar "En curso". */
  durationDays:   number | null;
  notes?:         string | null;
}

export interface OutbreakResponse {
  ranchId:   string;
  ranchName: string;
  disease:   OutbreakDisease;
  summary:   OutbreakSummary;
  timeline:  OutbreakTimelineCase[];
}

// ─── Contact tracing ────────────────────────────────────────────────────────

export type ContactType =
  | 'SAME_LOCATION' | 'SHARED_PASTURE' | 'DIRECT_CONTACT'
  | 'SHARED_WATER'  | 'AUTO_DETECTED';

export const ContactType = {
  SAME_LOCATION:   'SAME_LOCATION',
  SHARED_PASTURE:  'SHARED_PASTURE',
  DIRECT_CONTACT:  'DIRECT_CONTACT',
  SHARED_WATER:    'SHARED_WATER',
  AUTO_DETECTED:   'AUTO_DETECTED',
} as const;

export type ContactDetectedBy = 'AUTO' | 'MANUAL';

/**
 * Resultado de detectar contactos para un caso.
 * Devuelto por `POST /epidemiology/cases/:caseId/detect-contacts`.
 */
export interface DetectedContactItem {
  sourceCaseId:        string;
  /**
   * Backend E-04: `null` cuando el contacto es una **exposicion asintomatica**
   * — el bovino destino estuvo co-localizado en la ventana de exposicion
   * pero NO tiene caso clinico abierto todavia. La UI debe mostrar badge
   * "Expuesto" (amber) en lugar de "Contagiado" (rojo).
   */
  targetCaseId:        string | null;
  /**
   * Backend E-04: para exposiciones asintomaticas el `targetBovineId` viene
   * llenado (el caso aun no existe, pero el bovino si). Permite navegar al
   * detalle del bovino expuesto desde el grafo.
   */
  targetBovineId?:     string;
  targetBovineEarTag:  string;
  targetBovineName?:   string | null;
  contactType:         ContactType;
  contactDate:         string;
  locationId:          string;
  /**
   * 0..1. NOTA: el backend reduce este valor a la mitad (con minimo 0.1)
   * cuando `wasProtected: true` — la vacunacion baja la probabilidad de
   * contagio efectivo. Para exposiciones asintomaticas el valor default
   * que emite el backend es 0.3 (ajustado tambien por proteccion).
   */
  confidence:          number;
  isNew:               boolean;
  /**
   * Backend E-04: true cuando es una exposicion asintomatica (sin caso).
   * Equivalente a `targetCaseId === null` pero explicito para no depender
   * de un null-check ambiguo.
   */
  isExposureOnly?:     boolean;
  /**
   * True si el bovino destino estaba VACUNADO contra la enfermedad en
   * la ventana de exposicion. La UI debe distinguirlo visualmente
   * (opacidad reducida + icono escudo) para que el VET priorice los
   * contactos NO protegidos en su investigacion.
   */
  wasProtected?:       boolean;
}

export interface DetectContactsResult {
  message:  string;
  data:     DetectedContactItem[];
  total:    number;
  newLinks: number;
}

// ─── Read contacts for a case ──────────────────────────────────────────────

export interface CaseContactLink {
  id:           string;
  contactType:  ContactType;
  contactDate:  string;
  detectedBy:   ContactDetectedBy;
  /**
   * 0..1. Si el contacto fue detectado con wasProtected=true, ya viene
   * reducido (a la mitad, minimo 0.1) por el backend.
   */
  confidence:   number;
  /**
   * True si el bovino del lado opuesto del enlace estaba vacunado
   * contra la enfermedad en la ventana de exposicion. Cuando es
   * true, el frontend lo pinta atenuado en el grafo y agrega icono
   * de escudo en el tooltip.
   */
  wasProtected?: boolean;
}

export interface CaseContactAsSource extends CaseContactLink {
  /**
   * Backend E-04: `null` cuando es exposicion asintomatica.
   * En ese caso `targetBovine` viene llenado y `targetCase` es `null`.
   */
  targetCaseId: string | null;
  /** Backend E-04: solo presente para exposiciones (targetCaseId=null). */
  targetBovineId?: string | null;
  /** Backend E-04: bovino destino cuando aun no tiene caso (exposicion). */
  targetBovine?: BovineMini | null;
  targetCase: {
    id:          string;
    status:      CaseStatus;
    diagnosedAt: string;
    bovine:      BovineMini;
  } | null;
  /** Backend E-04: derivado de targetCaseId === null. */
  isExposureOnly?: boolean;
}

export interface CaseContactAsTarget extends CaseContactLink {
  sourceCaseId: string;
  sourceCase: {
    id:          string;
    status:      CaseStatus;
    bovine:      BovineMini;
  };
}

export interface CaseContactsResponse {
  asSource:       CaseContactAsSource[];
  asTarget:       CaseContactAsTarget[];
  totalAsSource:  number;
  totalAsTarget:  number;
}

// ─── Compute (manual trigger, solo SUPER_ADMIN) ────────────────────────────

export interface ComputeEpidemiologyInput {
  /** YYYY-MM-DD. Si se omite usa hoy. */
  date?: string;
}

// ─── Herd Health Index (Backend E-02 / Modulo 10) ──────────────────────────

/**
 * Desglose por estado clinico para el indice de salud.
 * Backend: GET /api/epidemiology/herd-health/:ranchId
 */
export interface HerdHealthStatusItem {
  count:      number;
  /** 0..100. */
  percentage: number;
}

/**
 * Indice ejecutivo de salud del hato (Backend E-02).
 * Score 0-100 ponderado:
 *   HEALTHY=100 · RECOVERING=70 · UNKNOWN=50 · QUARANTINE=40 · SICK=20
 *
 * `vaccinationCoveragePct` = % de bovinos activos con vaccinationStatus
 * UP_TO_DATE (de la tabla derivada bovine_vaccination_status).
 */
export interface HerdHealthIndex {
  /** Total de bovinos activos en el rancho (denominador). */
  totalActive:              number;
  /** Score ponderado 0-100. Mas alto = mejor salud agregada. */
  healthScore:              number;
  /** Cobertura vacunal 0-100. */
  vaccinationCoveragePct:   number;
  /** Conteo y % por cada HealthStatus. Claves opcionales: el backend
   *  puede omitir las que tengan count=0. */
  byStatus: {
    HEALTHY?:     HerdHealthStatusItem;
    SICK?:        HerdHealthStatusItem;
    RECOVERING?:  HerdHealthStatusItem;
    QUARANTINE?:  HerdHealthStatusItem;
    UNKNOWN?:     HerdHealthStatusItem;
    DECEASED?:    HerdHealthStatusItem;
  };
  /** ISO timestamp de cuando se calculo el indice. */
  computedAt?: string;
}

// ─── Epidemiology Alerts (NEW-3) ────────────────────────────────────────────

export type AlertType =
  | 'HIGH_INCIDENCE'
  | 'OUTBREAK_DETECTED'
  | 'VACCINATION_GAP'
  | 'ZOONOTIC_RISK'
  | 'MORTALITY_SPIKE'
  | 'NEW_CASES_SPIKE';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus    = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface EpidemiologyAlert {
  id:          string;
  ranchId:     string;
  diseaseId:   string | null;
  /** El backend serializa este campo como `type` (underscored: true). */
  type:        AlertType;
  severity:    AlertSeverity;
  status:      AlertStatus;
  title:       string;
  /** El backend usa `message`, no `description`. */
  message:     string;
  metadata?:   Record<string, unknown> | null;
  acknowledgedBy?:  string | null;
  acknowledgedAt?:  string | null;
  /** snake_case por underscored: true en el modelo. */
  created_at:  string;
  updated_at:  string;
  resolvedAt?: string | null;
  disease?:    { id: string; name: string; slug: string } | null;
  ranch?:      { id: string; name: string } | null;
}

export interface AlertFilters {
  ranchId?: string;
  status?:  AlertStatus | string;
  severity?: AlertSeverity | string;
  limit?:   number;
  offset?:  number;
}

// ─── Epidemiology Heatmap (NEW-2) ────────────────────────────────────────────

export interface EpidemiologyHeatmapCell {
  lat:         number;
  lng:         number;
  weight:      number;   // 0..1 — intensidad normalizada
  activeCases: number;
  diseaseId?:  string | null;
}

export interface EpidemiologyHeatmapFilters {
  ranchId:    string;
  diseaseId?: string;
  cellSize?:  number;   // metros — default backend
}

// ─── Manual contact (Backend E-07) ──────────────────────────────────────────

/**
 * Payload del `POST /api/epidemiology/contacts` (Backend E-07).
 * Permite al VET capturar contactos NO co-localizados que el motor
 * automatico (detectPotentialContacts) no detectaria.
 *
 * Tipos validos: DIRECT_CONTACT, SHARED_WATER, SHARED_PASTURE.
 *
 * Reglas:
 *   - Al menos uno de `targetCaseId` / `targetBovineId` requerido.
 *   - `confidence` 0..1 (default backend: 0.7 para entradas manuales).
 *   - El backend agrega detectedBy=MANUAL automaticamente y deduplica por
 *     (sourceCaseId, targetCaseId|targetBovineId, contactType).
 */
export interface CreateManualContactInput {
  sourceCaseId:   string;
  /** Al menos uno de los dos siguientes es requerido. */
  targetCaseId?:  string | null;
  targetBovineId?: string | null;
  contactType:    Extract<ContactType, 'DIRECT_CONTACT' | 'SHARED_WATER' | 'SHARED_PASTURE'>;
  contactDate?:   string;          // ISO; default backend: now
  /** 0..1 — default backend 0.7 para entradas MANUAL. */
  confidence?:    number;
  locationId?:    string;
  notes?:         string;
}
