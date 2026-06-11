/**
 * DTOs del módulo de Casos Clínicos (Fase 2 del backend).
 *
 * Un caso clínico es el registro de que un bovino específico padece una
 * enfermedad específica en un rancho específico. Ciclo de vida:
 *   SUSPECTED → CONFIRMED → RECOVERING → RECOVERED | DECEASED | DISCARDED
 *
 * Endpoints:
 *   POST   /api/bovine-cases
 *   GET    /api/bovine-cases
 *   GET    /api/bovine-cases/:id
 *   PATCH  /api/bovine-cases/:id
 *   POST   /api/bovine-cases/:id/close
 *   POST   /api/bovine-cases/:id/symptoms
 *   DELETE /api/bovine-cases/:id/symptoms/:symptomId
 *   POST   /api/bovine-cases/:id/treatments
 *   POST   /api/bovine-cases/:id/lab-tests
 *   PATCH  /api/bovine-cases/lab-tests/:labTestId
 */

import type { SymptomResponse } from './disease.dtos';

// ── Enums ───────────────────────────────────────────────────────────────────

export type CaseStatus =
  | 'SUSPECTED' | 'CONFIRMED' | 'RECOVERING'
  | 'RECOVERED' | 'DECEASED'  | 'DISCARDED';

export const CaseStatus = {
  SUSPECTED:  'SUSPECTED',
  CONFIRMED:  'CONFIRMED',
  RECOVERING: 'RECOVERING',
  RECOVERED:  'RECOVERED',
  DECEASED:   'DECEASED',
  DISCARDED:  'DISCARDED',
} as const;

export type CaseSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export const CaseSeverity = {
  LOW:      'LOW',
  MODERATE: 'MODERATE',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type CaseOutcome = 'RECOVERED' | 'DECEASED' | 'TRANSFERRED' | 'UNKNOWN';

export const CaseOutcome = {
  RECOVERED:   'RECOVERED',
  DECEASED:    'DECEASED',
  TRANSFERRED: 'TRANSFERRED',
  UNKNOWN:     'UNKNOWN',
} as const;

export type SymptomIntensity = 'MILD' | 'MODERATE' | 'SEVERE';

export const SymptomIntensity = {
  MILD:     'MILD',
  MODERATE: 'MODERATE',
  SEVERE:   'SEVERE',
} as const;

export type ApplicationRoute =
  | 'INTRAMUSCULAR' | 'SUBCUTANEOUS' | 'INTRANASAL'
  | 'ORAL'          | 'INTRADERMAL'  | 'OTHER';

export const ApplicationRoute = {
  INTRAMUSCULAR: 'INTRAMUSCULAR',
  SUBCUTANEOUS:  'SUBCUTANEOUS',
  INTRANASAL:    'INTRANASAL',
  ORAL:          'ORAL',
  INTRADERMAL:   'INTRADERMAL',
  OTHER:         'OTHER',
} as const;

export type LabResultStatus = 'PENDING' | 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';

export const LabResultStatus = {
  PENDING:      'PENDING',
  POSITIVE:     'POSITIVE',
  NEGATIVE:     'NEGATIVE',
  INCONCLUSIVE: 'INCONCLUSIVE',
} as const;

// ── Sub-types embebidos en el detalle del caso ──────────────────────────────

export interface CaseSymptomResponse {
  id:          string;
  symptom:     SymptomResponse;
  intensity:   SymptomIntensity;
  observedAt:  string;        // ISO date
  notes?:      string;
}

export interface CaseTreatmentResponse {
  id:                    string;
  treatmentName:         string;
  dosage:                string;
  applicationRoute:      ApplicationRoute | string;
  administeredAt:        string;
  administeredBy?:       string;
  durationDays?:         number;
  withdrawalPeriodDays?: number;
  notes?:                string;
}

export interface CaseLabTestResponse {
  id:            string;
  testName:      string;
  requestedAt:   string;
  labName?:      string;
  resultStatus?: LabResultStatus;
  resultAt?:     string | null;
  resultDetail?: string;
  notes?:        string;
}

// ── Mini-DTOs eager-loaded ──────────────────────────────────────────────────

export interface BovineMini {
  id:      string;
  earTag:  string;
  name?:   string | null;
  breed?:  string;
}

export interface DiseaseMini {
  id:            string;
  name:          string;
  slug:          string;
  severity?:     CaseSeverity | string;
  isContagious?: boolean;
}

// ── List response (lite) ────────────────────────────────────────────────────

export interface BovineCaseListItem {
  id:           string;
  bovineId:     string;
  diseaseId:    string;
  ranchId:      string;
  bovine:       BovineMini;
  disease:      DiseaseMini;
  status:       CaseStatus;
  severity:     CaseSeverity;
  diagnosedAt:  string;
  diagnosedBy?: string;
  resolvedAt?:  string | null;
  outcome?:     CaseOutcome | null;
  isOpen?:      boolean;
  notes?:       string;
  /**
   * True si el bovino estaba VACUNADO contra esta enfermedad al momento
   * del diagnostico (fallo vacunal / breakthrough infection).
   *
   * Calculado por el backend en `POST /bovine-cases` cruzando contra
   * `BovineHealthSnapshot.protectedDiseases`. El frontend NO lo envia.
   *
   * Cuando `true`, mostrar un badge prominente (warning/orange) para
   * que el VET sepa que requiere atencion especial: revisar lote de la
   * vacuna, protocolo de aplicacion, refuerzo, etc.
   */
  isBreakthrough?: boolean;
}

// ── Detail response (con sub-collections) ───────────────────────────────────

export interface BovineCaseDetailResponse extends BovineCaseListItem {
  symptoms:   CaseSymptomResponse[];
  treatments: CaseTreatmentResponse[];
  labTests:   CaseLabTestResponse[];
}

// ── Filtros del listado ─────────────────────────────────────────────────────

export interface BovineCaseFilters {
  bovineId?:  string;
  diseaseId?: string;
  ranchId?:   string;
  /** Acepta uno o varios separados por coma → el API lo serializa. */
  status?:    CaseStatus[];
  severity?:  CaseSeverity[];
  fromDate?:  string;
  toDate?:    string;
  search?:    string;
  page?:      number;
  limit?:     number;
}

// ── Inputs (create / update / close / sub-collections) ──────────────────────

export interface CreateBovineCaseInput {
  bovineId:     string;
  diseaseId:    string;
  ranchId:      string;
  severity:     CaseSeverity;
  status?:      CaseStatus;       // default SUSPECTED
  diagnosedBy?: string;
  diagnosedAt?: string;           // ISO; default now
  notes?:       string;
  /**
   * UUID opcional de la fuente de contagio (catalogo `DiseaseSource`
   * del backend). Tipos comunes: ANIMAL, ENVIRONMENT, VECTOR, FOOD,
   * WATER, FOMITE, HUMAN, UNKNOWN. Util para el grafo de contagios y
   * analisis epidemiologico. Si no se conoce, omitir.
   *
   * Cuando el backend exponga un endpoint de listado de DiseaseSource,
   * el form puede pasar a Select; por ahora es input UUID libre.
   */
  sourceId?:    string;
}

export interface UpdateBovineCaseInput {
  status?:   CaseStatus;
  severity?: CaseSeverity;
  notes?:    string;
}

export interface CloseBovineCaseInput {
  outcome:     CaseOutcome;
  resolvedAt?: string;
  notes?:      string;
}

export interface AddCaseSymptomInput {
  symptomId:  string;
  intensity:  SymptomIntensity;
  observedAt?: string;
  notes?:     string;
}

export interface AddCaseTreatmentInput {
  treatmentName:         string;
  dosage:                string;
  applicationRoute:      ApplicationRoute;
  administeredAt:        string;
  administeredBy?:       string;
  durationDays?:         number;
  withdrawalPeriodDays?: number;
  notes?:                string;
}

export interface AddCaseLabTestInput {
  testName:    string;
  requestedAt: string;
  labName?:    string;
  notes?:      string;
}

export interface UpdateLabTestResultInput {
  resultStatus: LabResultStatus;
  resultAt:     string;
  resultDetail?: string;
  notes?:       string;
}
