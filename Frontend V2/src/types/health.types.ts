// ─── Enums matching backend Health model ───────────────────────────────────

export enum HealthRecordType {
  ROUTINE_CHECKUP = 'ROUTINE_CHECKUP',
  EMERGENCY_VISIT = 'EMERGENCY_VISIT',
  FOLLOW_UP = 'FOLLOW_UP',
  VACCINATION = 'VACCINATION',
  TREATMENT = 'TREATMENT',
  SURGERY = 'SURGERY',
  LABORATORY_TEST = 'LABORATORY_TEST',
  PHYSICAL_EXAM = 'PHYSICAL_EXAM',
  REPRODUCTIVE_EXAM = 'REPRODUCTIVE_EXAM',
  NECROPSY = 'NECROPSY',
  QUARANTINE_ASSESSMENT = 'QUARANTINE_ASSESSMENT',
  PRE_TRANSPORT_EXAM = 'PRE_TRANSPORT_EXAM',
  NUTRITION_ASSESSMENT = 'NUTRITION_ASSESSMENT',
  BEHAVIORAL_ASSESSMENT = 'BEHAVIORAL_ASSESSMENT',
  OTHER = 'OTHER',
}

export enum DiagnosisStatus {
  CONFIRMED = 'CONFIRMED',
  RULED_OUT = 'RULED_OUT',
  DIFFERENTIAL = 'DIFFERENTIAL',
}

/**
 * Estado del bloque `treatment` dentro de un HealthRecord.
 *
 * Nota: el backend de Capa 3 emite IN_PROGRESS tras POST /treatment/start
 * y COMPLETED tras POST /treatment/complete. Los valores ACTIVE/SUSPENDED/
 * FAILED/CANCELLED son legacy del modelo monolitico original y siguen
 * siendo aceptados en escritura por compatibilidad.
 *
 * Para chequear "tratamiento en curso" usar el helper `isTreatmentActive`
 * que tolera ambos formatos (ACTIVE y IN_PROGRESS).
 */
export enum TreatmentStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  SUSPENDED = 'SUSPENDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/** Estados que cuentan como "tratamiento abierto" para la UI. */
export function isTreatmentActive(status: string | undefined | null): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return s === 'IN_PROGRESS' || s === 'ACTIVE';
}

/**
 * Resultado final de un tratamiento al cerrarlo via /treatment/complete.
 * El backend deriva el outcome del bovino y libera stock no consumido.
 */
export enum TreatmentOutcome {
  RECOVERED        = 'RECOVERED',
  PARTIAL_RECOVERY = 'PARTIAL_RECOVERY',
  FAILED           = 'FAILED',
  DECEASED         = 'DECEASED',
}

export enum SeverityLevel {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
  CRITICAL = 'CRITICAL',
  FATAL = 'FATAL',
}

export enum OverallHealthStatus {
  HEALTHY = 'HEALTHY',
  SICK = 'SICK',
  RECOVERING = 'RECOVERING',
  QUARANTINE = 'QUARANTINE',
  DECEASED = 'DECEASED',
  UNKNOWN = 'UNKNOWN',
}

// ─── Nested interfaces ─────────────────────────────────────────────────────

export interface VitalSigns {
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  bloodPressure?: { systolic: number; diastolic: number };
  pulseQuality?: 'STRONG' | 'WEAK' | 'IRREGULAR' | 'ABSENT';
  mucousMembranes?: 'PINK' | 'PALE' | 'YELLOW' | 'BLUE' | 'RED';
  capillaryRefillTime?: number;
  hydrationStatus?: 'NORMAL' | 'MILD_DEHYDRATION' | 'MODERATE_DEHYDRATION' | 'SEVERE_DEHYDRATION';
}

export interface PhysicalExamination {
  bodyConditionScore?: number;
  locomotionScore?: number;
  weight?: number;
  height?: number;
  skinCondition?: string;
  coatCondition?: string;
  eyeCondition?: string;
  hoofCondition?: string;
  udderCondition?: string;
  lymphNodes?: string;
}

export interface SymptomsData {
  primary: string[];
  secondary?: string[];
  duration?: number;
  severity?: SeverityLevel;
  progression?: 'IMPROVING' | 'WORSENING' | 'STABLE' | 'FLUCTUATING';
  onset?: 'SUDDEN' | 'GRADUAL' | 'CHRONIC';
  appetiteChange?: 'NORMAL' | 'INCREASED' | 'DECREASED' | 'ABSENT';
  activityLevel?: 'NORMAL' | 'INCREASED' | 'DECREASED' | 'LETHARGIC';
}

export interface DiagnosisData {
  primaryDiagnosis?: string;
  secondaryDiagnoses?: string[];
  differentialDiagnoses?: string[];
  status: DiagnosisStatus;
  confidence?: number;
  prognosis?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'GRAVE';
}

/**
 * Una entrada de medicamento dentro del tratamiento de un HealthRecord.
 *
 * Importante sobre `administeredAt`:
 *   Es un array de timestamps ISO. Cada elemento representa UNA dosis
 *   efectivamente aplicada al bovino. El backend lo va llenando con
 *   `POST /api/health/treatment/medication/record` cada vez que el
 *   VET o encargado registra una aplicacion. Su `length` indica cuantas
 *   dosis se han dado hasta ahora. Es separado de `duration` (planeado)
 *   para que la UI pueda mostrar "2 / 5 dosis" en progreso.
 */
export interface TreatmentMedication {
  name: string;
  dosage: number;
  dosageUnit: string;
  frequency: string;
  duration: number;
  route: 'ORAL' | 'INJECTABLE' | 'TOPICAL' | 'INTRAVENOUS' | 'INTRAMUSCULAR' | 'SUBCUTANEOUS';
  withdrawalPeriod?: number;
  cost?: number;
  /**
   * Timestamps ISO de cada dosis efectivamente aplicada. Si esta vacio
   * o ausente, el tratamiento esta iniciado pero ninguna dosis ha sido
   * registrada todavia. La UI debe ofrecer un boton "Registrar dosis".
   */
  administeredAt?: string[];
  /**
   * Cantidad de dosis aplicadas. Algunos endpoints lo devuelven calculado
   * (response de /treatment/complete trae `administeredCount`). En general
   * podemos derivarlo de `administeredAt.length`, pero lo aceptamos por si
   * el backend lo expone explicitamente.
   */
  administeredCount?: number;
  /**
   * Cantidad reservada en inventario al iniciar el tratamiento. Lo expone
   * el backend cuando integra con `inventoryService.reserveStock`.
   */
  reservedQuantity?: number;
  /**
   * Cantidad NO consumida (devuelta al stock al completar el tratamiento).
   */
  unconsumedQuantity?: number;
  /**
   * Identificador del item de inventario referenciado al iniciar el
   * tratamiento. Permite trazabilidad con stock de medicamentos.
   */
  inventoryItemId?: string;
  notes?: string;
}

export interface TreatmentData {
  id?: string;
  treatmentPlan?: string;
  medications?: TreatmentMedication[];
  procedures?: Array<{
    name: string;
    description?: string;
    duration?: number;
    outcome?: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
  }>;
  status: TreatmentStatus;
  startDate?: string;
  endDate?: string;
  response?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NO_RESPONSE';
  sideEffects?: string[];
}

export interface LaboratoryResult {
  id?: string;
  healthRecordId?: string;
  testType?: string;
  sampleType?: 'BLOOD' | 'URINE' | 'FECES' | 'TISSUE' | 'MILK' | 'SWAB' | 'OTHER';
  sampleDate?: string;
  results?: Array<{
    parameter: string;
    value: string | number;
    unit?: string;
    referenceRange?: string;
    status?: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | 'PENDING';
  }>;
  interpretation?: string;
  cost?: number;
  createdAt?: string;
}

// ─── Capa 4: Laboratory - upload de resultados con auto-interpretacion ───
//
// POST /api/health/laboratory/results recibe N resultados de UNA vez y
// los persiste como `laboratoryResults[]` dentro del JSONB del
// HealthRecord. El backend calcula `interpretation` per-item comparando
// `value` contra `referenceRange`.
//
// Formatos validos de referenceRange (los reconoce el backend):
//   - "24-46"   → rango cerrado inclusive
//   - ">0.5"    → mayor estricto
//   - ">=20"    → mayor o igual
//   - "<10"     → menor estricto
//   - "<=100"   → menor o igual
//
// Cualquier otro formato termina con interpretacion PENDING.

export interface LabResultEntry {
  /** Nombre del parametro (Hematocrito, Hemoglobina, etc.). Libre. */
  parameter:        string;
  /** Valor medido. Acepta numero o string para parametros cualitativos. */
  value:            number | string;
  unit?:            string;
  /** Formato esperado por el backend (ver doc arriba). */
  referenceRange?:  string;
  /** Test al que pertenece el parametro (Hemograma, Quimica, etc.). */
  testName?:        string;
  labName?:         string;
  /** ISO timestamp. Default backend = NOW. */
  testedAt?:        string;
  /** Notas libres por parametro. */
  notes?:           string;
}

export interface UploadLabResultsInput {
  healthId: string;
  results:  LabResultEntry[];
}

/**
 * Item del array `laboratoryResults` del HealthRecord tras el upload.
 * Lo distintivo es `interpretation`, que el backend setea automaticamente.
 */
export interface LaboratoryResultItem {
  parameter:        string;
  value:            number | string;
  unit?:            string;
  referenceRange?:  string;
  /** Calculado por el backend: NORMAL | ABNORMAL | CRITICAL | PENDING. */
  interpretation?:  'NORMAL' | 'ABNORMAL' | 'CRITICAL' | 'PENDING' | string;
  testName?:        string;
  labName?:         string;
  testedAt?:        string;
  notes?:           string;
}

export interface UploadLabResultsResponse {
  id: string;
  laboratoryResults?: LaboratoryResultItem[];
}

// ─── Capa 2: Diagnosis - registrar y confirmar ───────────────────────────
//
// POST /api/health/diagnosis/record
//   Persiste/actualiza el bloque JSONB `diagnosis` de un HealthRecord.
//   Recibe healthId + diseaseId opcional + diagnosisData con varios
//   campos clinicos. Si diseaseId viene presente con UUID, vincula al
//   catalogo; si viene `null`, desvincula; si se omite, no toca el FK.
//
// POST /api/health/diagnosis/confirm
//   Marca el diagnostico existente como CONFIRMADO. Anade
//   diagnosis.confirmedAt + confirmedBy al JSONB. No requiere mas body
//   que el healthId.

export interface DiagnosisData {
  primaryDiagnosis?:      string;
  differentialDiagnosis?: string[];
  /** Texto libre - frotis sanguineo, palpacion, lab, imagen, etc. */
  diagnosticMethod?:      string;
  /** Severidad clinica del diagnostico. El backend acepta strings libres;
   *  documentamos los valores conocidos sin restringir. */
  severity?:              'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  /** Codigo ICD-10 internacional (B60.0 para Anaplasmosis, etc.). */
  icd10Code?:             string;
  notes?:                 string;
}

export interface RegisterDiagnosisInput {
  healthId:       string;
  /**
   * UUID de la enfermedad del catalogo. Tres estados:
   *   - omitido    -> no toca el FK del record (preserva lo que haya).
   *   - "uuid-..." -> vincula al catalogo.
   *   - null       -> desvincula explicitamente.
   */
  diseaseId?:     string | null;
  diagnosisData:  DiagnosisData;
}

export interface ConfirmDiagnosisInput {
  healthId: string;
}

// ─── Capa 2: Diagnosis - estadisticas agregadas ──────────────────────────
//
// GET /api/health/diagnosis/stats?ranchId=...&startDate=...&endDate=...
//
// Devuelve un agregado de los diagnosticos registrados en la ventana de
// tiempo. La UI lo consume en dos formas:
//   1. Widget compacto en /health/epidemiology
//   2. Pagina dedicada /health/diagnosis/stats con todos los charts
//
// Para calcular delta vs periodo anterior, el hook hace 2 fetches
// paralelos con rangos de la misma duracion adyacentes.

export interface DiagnosisStatsFilters {
  ranchId?:   string;
  /** ISO date (YYYY-MM-DD). */
  startDate?: string;
  endDate?:   string;
}

export interface DiagnosisStatsResponse {
  totalDiagnoses: number;
  /** Conteo por overallHealthStatus del record asociado al diagnostico. */
  byHealthStatus: Record<string, number>;
  /** Top N diagnosticos del periodo, ordenados desc por count. */
  topDiagnoses:   Array<{ diagnosis: string; count: number }>;
  confirmedVsSuspected: {
    confirmed: number;
    suspected: number;
  };
}

/**
 * Resultado del hook que combina periodo actual + periodo anterior para
 * mostrar delta. El periodo anterior es el rango inmediatamente previo
 * de la MISMA duracion (e.g. si actual = 30 dias, previous = los 30 dias
 * antes del startDate del actual).
 */
export interface DiagnosisStatsWithDelta {
  current:  DiagnosisStatsResponse;
  /** Null si no se pudo calcular (e.g. error en el fetch del periodo anterior). */
  previous: DiagnosisStatsResponse | null;
}

// ─── Capa 1: Health Records - summary por bovino ─────────────────────────
//
// GET /api/health/bovine/:bovineId/summary
//
// Snapshot agregado del estado de salud del bovino. Lo usa la UI como
// hero card encima del historial: el VET ve estado, total registros,
// caso activo y emergencias recientes de un solo vistazo, sin tener que
// expandir cada record.
//
// `activeCase` puede ser null cuando el bovino no tiene casos abiertos.
// `recordsByType` es un mapa libre (las keys siguen el enum
// HealthRecordType del backend, pero declaramos string para tolerar
// valores futuros sin romper el tipo).

export interface BovineHealthSummary {
  bovineId:             string;
  currentHealthStatus?: OverallHealthStatus | string;
  totalRecords:         number;
  lastVisitDate?:       string;
  activeCase?: {
    id:          string;
    diseaseName: string;
    /** Status del BovineDiseaseCase (SUSPECTED|CONFIRMED|RECOVERING|...). */
    status:      string;
    /** ISO date del diagnostico. */
    diagnosedAt: string;
  } | null;
  /** Cantidad de records con `followUpRequired: true` aun sin completar. */
  pendingFollowUps:      number;
  /** Emergencias (isEmergency=true) en los ultimos 90 dias. */
  emergenciesLast90Days: number;
  /** Conteo por tipo de registro. Keys son strings de HealthRecordType. */
  recordsByType:         Record<string, number>;
}

// ─── Capa 4: Laboratory - historico anormal por bovino ───────────────────
//
// GET /api/health/laboratory/bovine/:bovineId/abnormal?limit=N
//
// Devuelve los HealthRecords del bovino que contienen al menos un
// resultado ABNORMAL o CRITICAL, ordenados por fecha desc. Cada record
// trae solo el subset de resultados anormales (los NORMAL se filtran
// del lado del backend).
//
// IMPORTANTE: como solo trae anormales, cuando un parametro vuelve a
// NORMAL deja de aparecer en records posteriores. La interpretacion
// clinica de "ausencia" es "recuperado" (no "olvidado").

export interface BovineAbnormalLabRecord {
  healthRecordId: string;
  recordDate:     string;
  abnormalResults: Array<{
    parameter:      string;
    value:          number | string;
    unit?:          string;
    referenceRange?: string;
    interpretation: 'ABNORMAL' | 'CRITICAL' | string;
  }>;
}

// ─── Capa 4: Laboratory - vigilancia por rancho ───────────────────────────
//
// GET /api/health/laboratory/ranch/:ranchId/abnormal?days=N
//
// Devuelve un agregado de los parametros que cayeron como ABNORMAL o
// CRITICAL en el rancho durante los ultimos N dias. Util para detectar
// patrones epidemiologicos: el caso clasico es "Hematocrito + Hemoglobina
// bajos en multiples animales" como signo temprano de Anaplasmosis o
// Babesiosis circulando en el hato.
//
// El backend agrupa por parametro y devuelve count + valor promedio
// (de los valores anormales). El frontend interpreta los patrones
// conocidos y muestra hints clinicos.

export interface RanchAbnormalByParameter {
  /** Cantidad de RESULTADOS anormales para este parametro en la ventana. */
  count:    number;
  /** Promedio de los valores reportados como anormales (no de todos). */
  avgValue: number;
  unit?:    string;
}

export interface RanchAbnormalStats {
  ranchId:                   string;
  /** Ventana de tiempo evaluada (en dias). */
  periodDays:                number;
  /** Bovinos UNICOS con al menos un resultado anormal en la ventana. */
  totalBovinesWithAbnormal:  number;
  /** Suma de TODOS los resultados anormales (un bovino puede aportar varios). */
  totalAbnormalResults:      number;
  /** Mapa parametro -> stats. Clave es el nombre del parametro tal cual lo
   *  capturo el VET (no hay catalogo unificado todavia). */
  byParameter:               Record<string, RanchAbnormalByParameter>;
}

// ─── Capa 1: Health Records - listado paginado global ────────────────────
//
// Filtros aceptados por GET /api/health/records. Los campos tipo CSV los
// serializa el API client como cadena separada por comas — recibe
// arrays aqui y los junta. Booleanos van como 'true'/'false' (querystring).
//
// El backend ordena por recordDate DESC por default; sortBy/sortOrder
// permiten cambiarlo. No exponemos veterinarianId en el filtro de UI
// todavia (no hay selector de veterinarios).

export interface HealthRecordsListFilters {
  ranchId?:             string;
  bovineId?:            string;
  recordType?:          HealthRecordType[];
  overallHealthStatus?: OverallHealthStatus[];
  diseaseId?:           string;
  isEmergency?:         boolean;
  followUpRequired?:    boolean;
  /**
   * Filtra por estado de confirmacion del diagnostico:
   *   - true  -> solo records con diagnosis.confirmedAt presente
   *   - false -> solo records con diagnosis presuntivo (sin confirmedAt)
   *   - undefined -> sin filtrar
   * Requiere que el backend de GET /health/records lo exponga. Si el
   * backend lo ignora, el frontend lo envia igual y se descarta en server.
   */
  diagnosisConfirmed?:  boolean;
  search?:              string;
  /** ISO date string (YYYY-MM-DD acepta el backend). */
  startDate?:           string;
  endDate?:             string;
  veterinarianId?:      string;
  sortBy?:              string;
  sortOrder?:           'ASC' | 'DESC';
  page?:                number;
  limit?:               number;
}

/**
 * Item del listado paginado. Incluye `bovine` y `disease` eager-loaded
 * (mejora 3 del backend) para evitar N+1 al renderizar cada fila.
 */
export interface HealthRecordListItem extends HealthRecord {
  bovine?: {
    id:     string;
    earTag: string;
    name?:  string | null;
  };
  disease?: {
    id:       string;
    name:     string;
    slug:     string;
    severity: string;
  } | null;
}

/**
 * Envelope completo del response paginado. A diferencia del envelope
 * estandar `ApiResponse<T>` (que solo tiene `success` + `data`), este
 * endpoint expone `pagination` a la raiz del cuerpo, paralelo a `data`.
 * Por eso lo modelamos como envelope separado y NO usamos ApiResponse<T>
 * al llamar a apiClient.get.
 */
export interface HealthRecordsListEnvelope {
  success:    true;
  data:       HealthRecordListItem[];
  pagination: {
    page:       number;
    limit:      number;
    total:      number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
}

// ─── Capa 1: Health Records - PATCH y DELETE ──────────────────────────────
//
// PATCH /api/health/records/:id — solo campos clinicos editables.
// El backend RECHAZA cualquier intento de modificar bovineId, recordType,
// recordDate o createdBy. Esos son "identidad inmutable" del registro.
//
// Para "corregir" un recordType mal capturado, hay que eliminar y crear
// uno nuevo (soft delete + POST). Lo documentamos en el JSDoc del campo
// para que el caller no se confunda.
//
// `diseaseId: null` desvincula el FK al catalogo de enfermedades.
// `diseaseId: undefined` (omitir) NO toca el campo (preserva valor previo).

export interface UpdateHealthRecordInput {
  /** Estado clinico general del bovino tras este registro. */
  overallHealthStatus?: OverallHealthStatus;
  chiefComplaint?:      string | null;
  /**
   * Mejora 4: vincular el record a una enfermedad del catalogo.
   * - `string` (UUID) → vincula.
   * - `null`          → desvincula (FK pasa a NULL en BD).
   * - omitido         → no toca el campo.
   */
  diseaseId?:           string | null;
  isEmergency?:         boolean;
  cost?:                number | null;

  /** Estos campos son JSONB libres en el backend. La UI envia el
   *  objeto completo (no patch parcial dentro del JSONB). */
  vitalSigns?:    Record<string, unknown>;
  physicalExam?:  Record<string, unknown>;
  symptoms?:      Record<string, unknown>;
  diagnosis?:     Record<string, unknown>;
  treatment?:     Record<string, unknown>;

  followUpRequired?: boolean;
  followUpDate?:     string | null;
  followUpNotes?:    string | null;

  recommendations?: string[];
  notes?:           string | null;
}

// ─── Capa 3: Treatment - iniciar tratamiento ──────────────────────────────
//
// Cuerpo del POST /api/health/treatment/start. El endpoint INICIA un
// tratamiento sobre un HealthRecord existente y RESERVA stock en el
// inventario para cada medicamento que apunte a `inventoryItemId`.
//
// Diferencias con el schema legacy que ya usa HealthListPage al crear
// el record:
//   - `dosageAmount` (number) separado de `dosageUnit` (string).
//     Permite calculos numericos (totales, retiros).
//   - `durationDays` (number) en vez de `duration` (legacy).
//   - `withdrawalPeriodDays` en vez de `withdrawalPeriod`.
//   - `applicationRoute` enum (acepta los mismos valores que la modal
//     de BovineCases para uniformidad).
//   - `targetSite` (texto libre) para registrar donde se aplico
//     (cuello izquierdo, ancas, ubre, etc.).
//   - `inventoryItemId` opcional: si esta presente, el backend reserva
//     stock; si no, el tratamiento se registra sin tocar inventario.

export type TreatmentApplicationRoute =
  | 'ORAL' | 'INJECTABLE' | 'TOPICAL' | 'INTRAVENOUS'
  | 'INTRAMUSCULAR' | 'SUBCUTANEOUS' | 'INTRANASAL' | 'INTRADERMAL' | 'OTHER';

export interface StartTreatmentMedicationInput {
  name:                  string;
  /** UUID del item del inventario. Sin esto, NO se reserva stock. */
  inventoryItemId?:      string;
  /** Texto libre tipo "20 mg/kg" — coexiste con dosageAmount + unit. */
  dosage?:               string;
  /** Cantidad numerica por dosis (e.g. 7.6). */
  dosageAmount?:         number;
  /** Unidad (mL, mg, UI, etc.). */
  dosageUnit?:           string;
  /** Texto libre: "cada 48h", "una vez al dia". */
  frequency?:            string;
  /** Dias totales de tratamiento. Usado por el backend para calcular
   *  cantidad total a reservar = dosageAmount * (durationDays/intervalo). */
  durationDays:          number;
  applicationRoute:      TreatmentApplicationRoute;
  /** Dias entre la ultima dosis y "apto para consumo humano". */
  withdrawalPeriodDays?: number;
  /** Sitio anatomico donde se aplica. */
  targetSite?:           string;
  notes?:                string;
}

export interface StartTreatmentInput {
  healthId:         string;
  /** Diagnostico que justifica el tratamiento (texto libre). */
  diagnosis?:       string;
  /** Inicio. ISO. Default backend = NOW. */
  startDate?:       string;
  veterinarianName?: string;
  medications:      StartTreatmentMedicationInput[];
  notes?:           string;
}

/**
 * Forma del response. El backend devuelve el HealthRecord actualizado
 * con `treatment.status: IN_PROGRESS` y cada medicamento extendido con
 * `reservedQuantity` cuando aplica reserva de stock.
 */
export interface StartTreatmentResponse {
  id: string;
  treatment?: {
    status:      string;       // "IN_PROGRESS"
    startDate?:  string;
    diagnosis?:  string;
    veterinarianName?: string;
    medications?: TreatmentMedication[];
  };
}

// ─── Capa 3: Treatment - completar tratamiento ────────────────────────────
//
// Cuerpo del POST /api/health/treatment/complete. Al completar, el
// backend:
//   1. Marca `treatment.status: COMPLETED` y persiste `endDate` + `outcome`.
//   2. Calcula `unconsumedQuantity` por medicamento (reservedQuantity -
//      cantidad efectivamente aplicada segun `administeredAt.length`).
//   3. Llama a `inventoryService.releaseStock` para devolver el sobrante
//      al stock disponible.
//
// IMPORTANTE: no se puede completar dos veces el mismo tratamiento. Si
// el VET se equivoco, debe usar PATCH del record (cuando exista UI) para
// corregir el outcome.

export interface CompleteTreatmentInput {
  healthId: string;
  outcome:  TreatmentOutcome | string;
  /** Fecha de cierre. ISO. Default backend = NOW. */
  endDate?: string;
  notes?:   string;
}

export interface CompleteTreatmentResponse {
  id: string;
  treatment?: {
    status:    string;  // "COMPLETED"
    endDate?:  string;
    outcome?:  string;
    medications?: TreatmentMedication[];
  };
}

// ─── Capa 3: Treatment - registrar dosis aplicada ─────────────────────────
//
// Cuerpo del POST /api/health/treatment/medication/record.
//
// `medicationIndex` es la POSICION del medicamento dentro del array
// `treatment.medications` del HealthRecord. Si el record tiene 3
// medicamentos, sus indices son 0, 1, 2. El backend usa el indice
// (no un id) porque las medicaciones viven en una columna JSONB y no
// tienen identidad propia en BD.
export interface RecordMedicationDoseInput {
  healthId:        string;
  medicationIndex: number;
  /** ISO timestamp. Si se omite, el backend toma NOW(). */
  administeredAt?: string;
  notes?:          string;
}

/**
 * Forma minima del response. El backend devuelve el HealthRecord
 * actualizado con el array `administeredAt[]` del medicamento extendido.
 * Solo modelamos los campos que la UI consume tras la mutacion.
 */
export interface RecordMedicationDoseResponse {
  id: string;
  treatment?: {
    medications?: TreatmentMedication[];
  };
}

// ─── Withdrawal periods (Capa 3 — período de retiro) ──────────────────────
//
// Shape devuelto por `GET /api/health/treatment/withdrawal/:healthId`.
// CRÍTICO LEGALMENTE: si `isWithdrawn === false` el animal NO puede ir al
// matadero ni aprovecharse su leche — riesgo de residuos farmacológicos
// en producto destinado a consumo humano.
//
// El backend calcula:
//   withdrawalEndDate = lastAdministrationDate + withdrawalPeriodDays
//   isWithdrawn       = NOW() >= withdrawalEndDate
//   daysRemaining     = max(0, days from NOW() to withdrawalEndDate)

export interface WithdrawalPeriodItem {
  medicationName:         string;
  lastAdministrationDate: string;        // ISO timestamp
  withdrawalPeriodDays:   number;
  withdrawalEndDate:      string;        // ISO timestamp
  isWithdrawn:            boolean;       // true = ya cumplió, OK para consumo
  daysRemaining:          number;        // 0 si ya cumplió
}

/**
 * Estado agregado del bovino — composición de todos los withdrawals de
 * sus registros recientes. Lo calcula el frontend en `useBovineWithdrawalStatus`
 * porque el backend solo expone el endpoint por-healthId.
 */
export interface BovineWithdrawalAggregate {
  /** True si hay ≥1 medicamento todavía en período de retiro. */
  hasActiveWithdrawal: boolean;
  /** Cantidad de medicamentos activos en retiro. */
  activeCount:         number;
  /** Próxima fecha en que termina algún período de retiro (la MÁS cercana). */
  nextEndsAt:          string | null;
  /** Última fecha en que termina el retiro (la MÁS LEJANA — fecha real de "ya liberado"). */
  finalClearedAt:      string | null;
  /** Items detallados, solo los todavía activos (isWithdrawn=false). */
  active:              WithdrawalPeriodItem[];
  /** Items ya cumplidos en los últimos 90 días — útil para historial. */
  recentlyCleared:     WithdrawalPeriodItem[];
}

// ─── Health Record (full backend response) ─────────────────────────────────

export interface HealthRecord {
  id: string;
  bovineId: string;
  bovineEarTag?: string;
  bovineName?: string;
  recordType: HealthRecordType;
  recordDate: string;
  isEmergency: boolean;
  isCompleted: boolean;
  chiefComplaint?: string;
  historyPresent?: string;
  veterinarianId?: string;
  veterinarianName?: string;
  vitalSigns?: VitalSigns;
  physicalExam?: PhysicalExamination;
  symptoms?: SymptomsData;
  diagnosis: DiagnosisData;
  treatment?: TreatmentData;
  laboratoryResults?: LaboratoryResult[];
  overallHealthStatus: OverallHealthStatus;
  recommendations?: string[];
  followUpRequired: boolean;
  followUpDate?: string;
  followUpNotes?: string;
  photos?: string[];
  notes?: string;
  cost?: number;
  currency?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Compat aliases
  type?: string;
  status?: string;
  temperature?: number;
  weight?: number;
}

// ─── Form data for creating health records ─────────────────────────────────

export interface HealthCheckFormData {
  bovineId: string;
  recordType: HealthRecordType;
  recordDate: string;
  isEmergency?: boolean;
  chiefComplaint?: string;
  overallHealthStatus: OverallHealthStatus;
  vitalSigns?: Partial<VitalSigns>;
  physicalExam?: Partial<PhysicalExamination>;
  symptoms?: Partial<SymptomsData>;
  diagnosis: DiagnosisData;
  treatment?: Partial<TreatmentData>;
  notes?: string;
  cost?: number;
  followUpRequired?: boolean;
  followUpDate?: string;
  followUpNotes?: string;
  recommendations?: string[];
}

export interface HealthStats {
  total: number;
  healthy: number;
  sick: number;
  critical: number;
  recovering: number;
  underTreatment: number;
}

export interface HealthTimeline {
  date: string;
  type: string;
  description: string;
  status: string;
}
