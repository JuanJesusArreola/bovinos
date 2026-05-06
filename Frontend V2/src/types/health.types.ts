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

export enum TreatmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  SUSPENDED = 'SUSPENDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
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

export interface TreatmentData {
  id?: string;
  treatmentPlan?: string;
  medications?: Array<{
    name: string;
    dosage: number;
    dosageUnit: string;
    frequency: string;
    duration: number;
    route: 'ORAL' | 'INJECTABLE' | 'TOPICAL' | 'INTRAVENOUS' | 'INTRAMUSCULAR' | 'SUBCUTANEOUS';
    withdrawalPeriod?: number;
    cost?: number;
  }>;
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
