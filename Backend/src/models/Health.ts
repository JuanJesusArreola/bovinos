import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData } from './Bovine';

// Enums para registros de salud
export enum HealthRecordType {
  ROUTINE_CHECKUP = 'ROUTINE_CHECKUP',         // Chequeo rutinario
  EMERGENCY_VISIT = 'EMERGENCY_VISIT',         // Visita de emergencia
  FOLLOW_UP = 'FOLLOW_UP',                     // Seguimiento
  VACCINATION = 'VACCINATION',                 // Vacunación
  TREATMENT = 'TREATMENT',                     // Tratamiento
  SURGERY = 'SURGERY',                         // Cirugía
  LABORATORY_TEST = 'LABORATORY_TEST',         // Examen de laboratorio
  PHYSICAL_EXAM = 'PHYSICAL_EXAM',             // Examen físico
  REPRODUCTIVE_EXAM = 'REPRODUCTIVE_EXAM',     // Examen reproductivo
  NECROPSY = 'NECROPSY',                       // Necropsia
  QUARANTINE_ASSESSMENT = 'QUARANTINE_ASSESSMENT', // Evaluación de cuarentena
  PRE_TRANSPORT_EXAM = 'PRE_TRANSPORT_EXAM',   // Examen pre-transporte
  NUTRITION_ASSESSMENT = 'NUTRITION_ASSESSMENT', // Evaluación nutricional
  BEHAVIORAL_ASSESSMENT = 'BEHAVIORAL_ASSESSMENT', // Evaluación conductual
  OTHER = 'OTHER'                              // Otro tipo de registro
}

export enum HealthStatus {
  EXCELLENT = 'EXCELLENT',     // Excelente
  GOOD = 'GOOD',              // Bueno
  FAIR = 'FAIR',              // Regular
  POOR = 'POOR',              // Malo
  CRITICAL = 'CRITICAL',       // Crítico
  UNKNOWN = 'UNKNOWN'          // Desconocido
}

export enum DiagnosisStatus {
  SUSPECTED = 'SUSPECTED',     // Sospechoso
  CONFIRMED = 'CONFIRMED',     // Confirmado
  RULED_OUT = 'RULED_OUT',     // Descartado
  DIFFERENTIAL = 'DIFFERENTIAL', // Diferencial
  PENDING = 'PENDING'          // Pendiente
}

export enum TreatmentStatus {
  NOT_STARTED = 'NOT_STARTED', // No iniciado
  IN_PROGRESS = 'IN_PROGRESS', // En progreso
  COMPLETED = 'COMPLETED',     // Completado
  SUSPENDED = 'SUSPENDED',     // Suspendido
  FAILED = 'FAILED',           // Fallido
  CANCELLED = 'CANCELLED'      // Cancelado
}

export enum SeverityLevel {
  MILD = 'MILD',               // Leve
  MODERATE = 'MODERATE',       // Moderado
  SEVERE = 'SEVERE',           // Severo
  CRITICAL = 'CRITICAL',       // Crítico
  FATAL = 'FATAL'              // Fatal
}

export enum BodySystem {
  RESPIRATORY = 'RESPIRATORY',         // Respiratorio
  CARDIOVASCULAR = 'CARDIOVASCULAR',   // Cardiovascular
  DIGESTIVE = 'DIGESTIVE',             // Digestivo
  NERVOUS = 'NERVOUS',                 // Nervioso
  MUSCULOSKELETAL = 'MUSCULOSKELETAL', // Musculoesquelético
  REPRODUCTIVE = 'REPRODUCTIVE',       // Reproductivo
  URINARY = 'URINARY',                 // Urinario
  INTEGUMENTARY = 'INTEGUMENTARY',     // Tegumentario (piel)
  ENDOCRINE = 'ENDOCRINE',             // Endocrino
  IMMUNE = 'IMMUNE',                   // Inmunológico
  METABOLIC = 'METABOLIC',             // Metabólico
  OCULAR = 'OCULAR',                   // Ocular
  AUDITORY = 'AUDITORY',               // Auditivo
  DENTAL = 'DENTAL',                   // Dental
  SYSTEMIC = 'SYSTEMIC'                // Sistémico
}

// Interface para signos vitales
export interface VitalSigns {
  temperature?: number;          // Temperatura corporal (°C)
  heartRate?: number;           // Frecuencia cardíaca (latidos/min)
  respiratoryRate?: number;     // Frecuencia respiratoria (resp/min)
  bloodPressure?: {             // Presión arterial
    systolic: number;
    diastolic: number;
  };
  pulseQuality?: 'STRONG' | 'WEAK' | 'IRREGULAR' | 'ABSENT'; // Calidad del pulso
  mucousMembranes?: 'PINK' | 'PALE' | 'YELLOW' | 'BLUE' | 'RED'; // Membranas mucosas
  capillaryRefillTime?: number; // Tiempo de relleno capilar (segundos)
  hydrationStatus?: 'NORMAL' | 'MILD_DEHYDRATION' | 'MODERATE_DEHYDRATION' | 'SEVERE_DEHYDRATION';
  consciousnessLevel?: 'ALERT' | 'DEPRESSED' | 'STUPOROUS' | 'COMATOSE'; // Nivel de conciencia
}

// Interface para examen físico
export interface PhysicalExamination {
  bodyConditionScore?: number;   // Puntuación de condición corporal (1-9)
  locomotionScore?: number;      // Puntuación de locomoción (1-5)
  weight?: number;               // Peso en kg
  height?: number;               // Altura en cm
  bodyLength?: number;           // Longitud corporal en cm
  chestGirth?: number;          // Perímetro torácico en cm
  skinCondition?: 'NORMAL' | 'DRY' | 'OILY' | 'LESIONS' | 'PARASITES' | 'WOUNDS';
  coatCondition?: 'GLOSSY' | 'DULL' | 'ROUGH' | 'PATCHY' | 'MATTED';
  eyeCondition?: 'CLEAR' | 'DISCHARGE' | 'INFLAMMATION' | 'CLOUDINESS' | 'INJURY';
  noseCondition?: 'CLEAR' | 'DISCHARGE' | 'CRACKED' | 'LESIONS';
  mouthCondition?: 'NORMAL' | 'ULCERS' | 'EXCESSIVE_SALIVATION' | 'DENTAL_PROBLEMS';
  lymphNodes?: 'NORMAL' | 'ENLARGED' | 'PAINFUL'; // Estado de ganglios linfáticos
  udderCondition?: 'NORMAL' | 'MASTITIS' | 'INJURY' | 'ASYMMETRIC'; // Condición de ubre (hembras)
  hoofCondition?: 'NORMAL' | 'OVERGROWN' | 'CRACKED' | 'INFECTED' | 'LAME'; // Condición de pezuñas
}

// Interface para síntomas observados
export interface Symptoms {
  primary: string[];             // Síntomas principales
  secondary?: string[];          // Síntomas secundarios
  duration?: number;             // Duración en días
  severity?: SeverityLevel;      // Severidad de los síntomas
  progression?: 'IMPROVING' | 'WORSENING' | 'STABLE' | 'FLUCTUATING'; // Progresión
  onset?: 'SUDDEN' | 'GRADUAL' | 'CHRONIC'; // Inicio de síntomas
  affectedSystems?: BodySystem[]; // Sistemas corporales afectados
  behavioralChanges?: string[];   // Cambios de comportamiento
  appetiteChange?: 'NORMAL' | 'INCREASED' | 'DECREASED' | 'ABSENT'; // Cambio en apetito
  activityLevel?: 'NORMAL' | 'INCREASED' | 'DECREASED' | 'LETHARGIC'; // Nivel de actividad
}

// Interface para diagnósticos
export interface Diagnosis {
  primaryDiagnosis?: string;     // Diagnóstico principal
  secondaryDiagnoses?: string[]; // Diagnósticos secundarios
  differentialDiagnoses?: string[]; // Diagnósticos diferenciales
  diagnosticCode?: string;       // Código de diagnóstico (ICD, etc.)
  status: DiagnosisStatus;       // Estado del diagnóstico
  confidence?: number;           // Nivel de confianza (0-100)
  basedOn?: string[];           // En qué se basa el diagnóstico
  prognosis?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'GRAVE'; // Pronóstico
  expectedRecoveryTime?: number; // Tiempo esperado de recuperación (días)
}

// Interface para tratamientos
export interface Treatment {
  treatmentPlan?: string;        // Plan de tratamiento
  medications?: Array<{          // Medicamentos prescritos
    name: string;
    activeIngredient?: string;
    dosage: number;
    dosageUnit: string;
    frequency: string;
    duration: number; // días
    route: 'ORAL' | 'INJECTABLE' | 'TOPICAL' | 'INTRAVENOUS' | 'INTRAMUSCULAR' | 'SUBCUTANEOUS';
    withdrawalPeriod?: number; // días
    cost?: number;
  }>;
  procedures?: Array<{           // Procedimientos realizados
    name: string;
    description?: string;
    duration?: number; // minutos
    anesthesia?: boolean;
    complications?: string;
    outcome?: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
  }>;
  status: TreatmentStatus;       // Estado del tratamiento
  startDate?: Date;              // Fecha de inicio
  endDate?: Date;                // Fecha de finalización
  response?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NO_RESPONSE'; // Respuesta al tratamiento
  sideEffects?: string[];        // Efectos secundarios observados
  complications?: string[];      // Complicaciones del tratamiento
  followUpRequired?: boolean;    // Si requiere seguimiento
  followUpDate?: Date;           // Fecha de seguimiento
}

// Interface para resultados de laboratorio
export interface LaboratoryResults {
  testType?: string;             // Tipo de examen
  sampleType?: 'BLOOD' | 'URINE' | 'FECES' | 'TISSUE' | 'MILK' | 'SWAB' | 'OTHER'; // Tipo de muestra
  sampleDate?: Date;             // Fecha de toma de muestra
  testDate?: Date;               // Fecha de análisis
  laboratory?: string;           // Laboratorio que realizó el análisis
  results?: Array<{              // Resultados individuales
    parameter: string;
    value: string | number;
    unit?: string;
    referenceRange?: string;
    status?: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | 'PENDING';
    notes?: string;
  }>;
  interpretation?: string;       // Interpretación de resultados
  recommendations?: string[];    // Recomendaciones basadas en resultados
  cost?: number;                 // Costo del examen
}

// Interface para evaluación nutricional
export interface NutritionalAssessment {
  bodyConditionScore?: number;   // Puntuación de condición corporal
  weightChange?: number;         // Cambio de peso (kg)
  appetiteAssessment?: 'NORMAL' | 'INCREASED' | 'DECREASED' | 'ABSENT';
  feedIntake?: number;           // Consumo de alimento (kg/día)
  waterIntake?: number;          // Consumo de agua (litros/día)
  supplementsGiven?: Array<{     // Suplementos administrados
    name: string;
    dosage: number;
    unit: string;
    frequency: string;
  }>;
  nutritionalDeficiencies?: string[]; // Deficiencias identificadas
  recommendations?: string[];    // Recomendaciones nutricionales
}

// Interface para evaluación reproductiva
export interface ReproductiveAssessment {
  reproductiveStatus?: 'CYCLING' | 'PREGNANT' | 'LACTATING' | 'DRY' | 'ANESTRUS';
  gestationDay?: number;         // Día de gestación
  expectedCalvingDate?: Date;    // Fecha esperada de parto
  breedingSoundness?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNSOUND';
  reproductiveAbnormalities?: string[]; // Anormalidades reproductivas
  uterineHealth?: 'NORMAL' | 'INFECTION' | 'INFLAMMATION' | 'ABNORMAL_DISCHARGE';
  ovaryCondition?: 'NORMAL' | 'CYSTS' | 'INACTIVE' | 'ABNORMAL';
  milkProduction?: number;       // Producción de leche (litros/día)
  milkQuality?: 'NORMAL' | 'ABNORMAL' | 'MASTITIS_PRESENT';
}

// Atributos del modelo Health
export interface HealthAttributes {
  id: string;
  bovineId: string;                    // ID del bovino
  recordType: HealthRecordType;        // Tipo de registro de salud
  recordDate: Date;                    // Fecha del registro
  veterinarianId?: string;             // ID del veterinario
  technicianId?: string;               // ID del técnico
  location?: LocationData;             // Ubicación del examen
  chiefComplaint?: string;             // Queja principal
  historyPresent?: string;             // Historia de la enfermedad actual
  historyPast?: string;                // Historia médica pasada
  vitalSigns?: VitalSigns;             // Signos vitales
  physicalExam?: PhysicalExamination;  // Examen físico
  symptoms?: Symptoms;                 // Síntomas observados
  diagnosis?: Diagnosis;               // Diagnósticos
  treatment?: Treatment;               // Tratamientos
  laboratoryResults?: LaboratoryResults; // Resultados de laboratorio
  nutritionalAssessment?: NutritionalAssessment; // Evaluación nutricional
  reproductiveAssessment?: ReproductiveAssessment; // Evaluación reproductiva
  overallHealthStatus: HealthStatus;   // Estado general de salud
  recommendations?: string[];          // Recomendaciones
  nextAppointment?: Date;              // Próxima cita
  attachments?: string[];              // Archivos adjuntos
  photos?: string[];                   // Fotos del examen
  xrays?: string[];                    // Radiografías
  videos?: string[];                   // Videos del examen
  notes?: string;                      // Notas adicionales
  privateNotes?: string;               // Notas privadas del veterinario
  cost?: number;                       // Costo del examen/tratamiento
  currency?: string;                   // Moneda del costo
  followUpRequired: boolean;           // Si requiere seguimiento
  followUpDate?: Date;                 // Fecha de seguimiento
  followUpNotes?: string;              // Notas de seguimiento
  isEmergency: boolean;                // Si fue una emergencia
  isCompleted: boolean;                // Si el registro está completo
  isActive: boolean;                   // Si el registro está activo
  weatherConditions?: string;          // Condiciones climáticas
  environmentalFactors?: string[];     // Factores ambientales
  createdBy: string;                   // ID del usuario que creó
  updatedBy?: string;                  // ID del usuario que actualizó
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Atributos opcionales al crear un nuevo registro de salud
export interface HealthCreationAttributes 
  extends Optional<HealthAttributes, 
    'id' | 'veterinarianId' | 'technicianId' | 'location' | 'chiefComplaint' | 
    'historyPresent' | 'historyPast' | 'vitalSigns' | 'physicalExam' | 
    'symptoms' | 'diagnosis' | 'treatment' | 'laboratoryResults' | 
    'nutritionalAssessment' | 'reproductiveAssessment' | 'recommendations' | 
    'nextAppointment' | 'attachments' | 'photos' | 'xrays' | 'videos' | 
    'notes' | 'privateNotes' | 'cost' | 'currency' | 'followUpDate' | 
    'followUpNotes' | 'weatherConditions' | 'environmentalFactors' | 
    'updatedBy' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > {}

// Clase del modelo Health
class Health extends Model<HealthAttributes, HealthCreationAttributes> 
  implements HealthAttributes {
  public id!: string;
  public bovineId!: string;
  public recordType!: HealthRecordType;
  public recordDate!: Date;
  public veterinarianId?: string;
  public technicianId?: string;
  public location?: LocationData;
  public chiefComplaint?: string;
  public historyPresent?: string;
  public historyPast?: string;
  public vitalSigns?: VitalSigns;
  public physicalExam?: PhysicalExamination;
  public symptoms?: Symptoms;
  public diagnosis?: Diagnosis;
  public treatment?: Treatment;
  public laboratoryResults?: LaboratoryResults;
  public nutritionalAssessment?: NutritionalAssessment;
  public reproductiveAssessment?: ReproductiveAssessment;
  public overallHealthStatus!: HealthStatus;
  public recommendations?: string[];
  public nextAppointment?: Date;
  public attachments?: string[];
  public photos?: string[];
  public xrays?: string[];
  public videos?: string[];
  public notes?: string;
  public privateNotes?: string;
  public cost?: number;
  public currency?: string;
  public followUpRequired!: boolean;
  public followUpDate?: Date;
  public followUpNotes?: string;
  public isEmergency!: boolean;
  public isCompleted!: boolean;
  public isActive!: boolean;
  public weatherConditions?: string;
  public environmentalFactors?: string[];
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // Métodos de instancia

  /**
   * Obtiene el tipo de registro en español
   * @returns Tipo de registro traducido
   */
  public getRecordTypeLabel(): string {
    const labels = {
      [HealthRecordType.ROUTINE_CHECKUP]: 'Chequeo Rutinario',
      [HealthRecordType.EMERGENCY_VISIT]: 'Visita de Emergencia',
      [HealthRecordType.FOLLOW_UP]: 'Seguimiento',
      [HealthRecordType.VACCINATION]: 'Vacunación',
      [HealthRecordType.TREATMENT]: 'Tratamiento',
      [HealthRecordType.SURGERY]: 'Cirugía',
      [HealthRecordType.LABORATORY_TEST]: 'Examen de Laboratorio',
      [HealthRecordType.PHYSICAL_EXAM]: 'Examen Físico',
      [HealthRecordType.REPRODUCTIVE_EXAM]: 'Examen Reproductivo',
      [HealthRecordType.NECROPSY]: 'Necropsia',
      [HealthRecordType.QUARANTINE_ASSESSMENT]: 'Evaluación de Cuarentena',
      [HealthRecordType.PRE_TRANSPORT_EXAM]: 'Examen Pre-transporte',
      [HealthRecordType.NUTRITION_ASSESSMENT]: 'Evaluación Nutricional',
      [HealthRecordType.BEHAVIORAL_ASSESSMENT]: 'Evaluación Conductual',
      [HealthRecordType.OTHER]: 'Otro'
    };
    return labels[this.recordType];
  }

  /**
   * Obtiene el estado de salud en español
   * @returns Estado de salud traducido
   */
  public getHealthStatusLabel(): string {
    const labels = {
      [HealthStatus.EXCELLENT]: 'Excelente',
      [HealthStatus.GOOD]: 'Bueno',
      [HealthStatus.FAIR]: 'Regular',
      [HealthStatus.POOR]: 'Malo',
      [HealthStatus.CRITICAL]: 'Crítico',
      [HealthStatus.UNKNOWN]: 'Desconocido'
    };
    return labels[this.overallHealthStatus];
  }

  /**
   * Verifica si el registro necesita seguimiento
   * @returns True si necesita seguimiento
   */
  public needsFollowUp(): boolean {
    if (!this.followUpRequired) return false;
    if (!this.followUpDate) return true;
    return new Date() >= new Date(this.followUpDate);
  }

  /**
   * Calcula los días desde el registro
   * @returns Número de días desde el registro
   */
  public getDaysSinceRecord(): number {
    const now = new Date();
    const recordDate = new Date(this.recordDate);
    const diffTime = now.getTime() - recordDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Verifica si hay signos vitales anormales
   * @returns True si hay signos vitales fuera de rango normal
   */
  public hasAbnormalVitalSigns(): boolean {
    if (!this.vitalSigns) return false;

    const vs = this.vitalSigns;
    
    // Rangos normales para bovinos adultos
    const normalRanges = {
      temperature: { min: 38.0, max: 39.5 }, // °C
      heartRate: { min: 60, max: 80 },       // latidos/min
      respiratoryRate: { min: 24, max: 36 }  // resp/min
    };

    if (vs.temperature && (vs.temperature < normalRanges.temperature.min || vs.temperature > normalRanges.temperature.max)) {
      return true;
    }
    if (vs.heartRate && (vs.heartRate < normalRanges.heartRate.min || vs.heartRate > normalRanges.heartRate.max)) {
      return true;
    }
    if (vs.respiratoryRate && (vs.respiratoryRate < normalRanges.respiratoryRate.min || vs.respiratoryRate > normalRanges.respiratoryRate.max)) {
      return true;
    }

    return false;
  }

  /**
   * Obtiene la lista de sistemas corporales afectados
   * @returns Array de sistemas afectados
   */
  public getAffectedSystems(): BodySystem[] {
    return this.symptoms?.affectedSystems || [];
  }

  /**
   * Verifica si tiene diagnóstico confirmado
   * @returns True si tiene diagnóstico confirmado
   */
  public hasConfirmedDiagnosis(): boolean {
    return this.diagnosis?.status === DiagnosisStatus.CONFIRMED;
  }

  /**
   * Obtiene el diagnóstico principal
   * @returns Diagnóstico principal o null
   */
  public getPrimaryDiagnosis(): string | null {
    return this.diagnosis?.primaryDiagnosis || null;
  }

  /**
   * Verifica si el tratamiento está en progreso
   * @returns True si el tratamiento está en progreso
   */
  public isTreatmentInProgress(): boolean {
    return this.treatment?.status === TreatmentStatus.IN_PROGRESS;
  }

  /**
   * Obtiene el resumen de medicamentos activos
   * @returns Array de medicamentos activos
   */
  public getActiveMedications(): Array<{name: string; dosage: string; frequency: string}> {
    if (!this.treatment?.medications) return [];
    
    return this.treatment.medications.map(med => ({
      name: med.name,
      dosage: `${med.dosage} ${med.dosageUnit}`,
      frequency: med.frequency
    }));
  }

  /**
   * Calcula el índice de condición corporal promedio
   * @returns Índice promedio o null
   */
  public getAverageBodyConditionScore(): number | null {
    const scores: number[] = [];
    
    if (this.physicalExam?.bodyConditionScore) {
      scores.push(this.physicalExam.bodyConditionScore);
    }
    if (this.nutritionalAssessment?.bodyConditionScore) {
      scores.push(this.nutritionalAssessment.bodyConditionScore);
    }
    
    if (scores.length === 0) return null;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Verifica si es un registro médico completo
   * @returns True si tiene información médica completa
   */
  public isCompleteMedicalRecord(): boolean {
    return !!(
      this.vitalSigns &&
      this.physicalExam &&
      this.diagnosis &&
      this.overallHealthStatus !== HealthStatus.UNKNOWN
    );
  }

  /**
   * Obtiene las recomendaciones de seguimiento
   * @returns Array de recomendaciones
   */
  public getFollowUpRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Agregar recomendaciones generales
    if (this.recommendations) {
      recommendations.push(...this.recommendations);
    }
    
    // Agregar recomendaciones específicas de laboratorio
    if (this.laboratoryResults?.recommendations) {
      recommendations.push(...this.laboratoryResults.recommendations);
    }
    
    // Agregar recomendaciones nutricionales
    if (this.nutritionalAssessment?.recommendations) {
      recommendations.push(...this.nutritionalAssessment.recommendations);
    }
    
    return [...new Set(recommendations)]; // Eliminar duplicados
  }

  /**
   * Calcula el costo total del registro (incluyendo medicamentos)
   * @returns Costo total
   */
  public getTotalCost(): number {
    let total = this.cost || 0;
    
    // Agregar costos de medicamentos
    if (this.treatment?.medications) {
      total += this.treatment.medications.reduce((sum, med) => sum + (med.cost || 0), 0);
    }
    
    // Agregar costo de exámenes de laboratorio
    if (this.laboratoryResults?.cost) {
      total += this.laboratoryResults.cost;
    }
    
    return total;
  }

  /**
   * Genera un resumen del estado de salud
   * @returns Objeto con resumen del estado
   */
  public getHealthSummary(): {
    status: string;
    keyFindings: string[];
    recommendations: string[];
    followUpNeeded: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const keyFindings: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    
    // Determinar hallazgos clave
    if (this.hasAbnormalVitalSigns()) {
      keyFindings.push('Signos vitales anormales');
      riskLevel = 'MEDIUM';
    }
    
    if (this.diagnosis?.primaryDiagnosis) {
      keyFindings.push(`Diagnóstico: ${this.diagnosis.primaryDiagnosis}`);
    }
    
    if (this.symptoms?.severity === SeverityLevel.SEVERE || this.symptoms?.severity === SeverityLevel.CRITICAL) {
      riskLevel = 'HIGH';
    }
    
    if (this.overallHealthStatus === HealthStatus.CRITICAL) {
      riskLevel = 'CRITICAL';
    }
    
    if (this.isEmergency) {
      riskLevel = 'CRITICAL';
    }
    
    return {
      status: this.getHealthStatusLabel(),
      keyFindings,
      recommendations: this.getFollowUpRecommendations(),
      followUpNeeded: this.needsFollowUp(),
      riskLevel
    };
  }
}

// Definición del modelo en Sequelize
Health.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del registro de salud'
    },
    bovineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'bovines',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'ID del bovino relacionado'
    },
    recordType: {
      type: DataTypes.ENUM(...Object.values(HealthRecordType)),
      allowNull: false,
      comment: 'Tipo de registro de salud'
    },
    recordDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha y hora del registro'
    },
    veterinarianId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del veterinario responsable'
    },
    technicianId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del técnico que asistió'
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Ubicación geográfica del examen'
    },
    chiefComplaint: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Queja principal o motivo de consulta'
    },
    historyPresent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Historia de la enfermedad actual'
    },
    historyPast: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Historia médica pasada'
    },
    vitalSigns: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Signos vitales registrados'
    },
    physicalExam: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Hallazgos del examen físico'
    },
    symptoms: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Síntomas observados'
    },
    diagnosis: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Diagnósticos realizados'
    },
    treatment: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Tratamientos prescritos y realizados'
    },
    laboratoryResults: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Resultados de exámenes de laboratorio'
    },
    nutritionalAssessment: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Evaluación nutricional'
    },
    reproductiveAssessment: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Evaluación reproductiva'
    },
    overallHealthStatus: {
      type: DataTypes.ENUM(...Object.values(HealthStatus)),
      allowNull: false,
      defaultValue: HealthStatus.UNKNOWN,
      comment: 'Estado general de salud'
    },
    recommendations: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      defaultValue: [],
      comment: 'Recomendaciones médicas'
    },
    nextAppointment: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de próxima cita'
    },
    attachments: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de archivos adjuntos'
    },
    photos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de fotos del examen'
    },
    xrays: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de radiografías'
    },
    videos: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de videos del examen'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales del examen'
    },
    privateNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas privadas del veterinario'
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Costo del examen/tratamiento'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'MXN',
      comment: 'Moneda del costo'
    },
    followUpRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si requiere seguimiento'
    },
    followUpDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha programada para seguimiento'
    },
    followUpNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas de seguimiento'
    },
    isEmergency: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si fue una emergencia'
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el registro está completo'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el registro está activo'
    },
    weatherConditions: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Condiciones climáticas durante el examen'
    },
    environmentalFactors: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'Factores ambientales relevantes'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó el registro'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó el registro'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de creación del registro'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de última actualización'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'Health',
    tableName: 'health_records',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para optimizar consultas
      {
        fields: ['bovine_id']
      },
      {
        fields: ['record_type']
      },
      {
        fields: ['record_date']
      },
      {
        fields: ['overall_health_status']
      },
      {
        fields: ['veterinarian_id']
      },
      {
        fields: ['is_emergency']
      },
      {
        fields: ['is_completed']
      },
      {
        fields: ['follow_up_required']
      },
      {
        fields: ['follow_up_date']
      },
      {
        fields: ['next_appointment']
      },
      {
        name: 'health_bovine_date',
        fields: ['bovine_id', 'record_date']
      },
      {
        name: 'health_status_date',
        fields: ['overall_health_status', 'record_date']
      },
      {
        name: 'health_emergency_date',
        fields: ['is_emergency', 'record_date']
      },
      {
        name: 'health_followup_date',
        fields: ['follow_up_required', 'follow_up_date']
      },
      {
        name: 'health_location_gin',
        fields: ['location'],
        using: 'gin',
        where: {
          location: {
            [Op.ne]: null
          }
        }
      }
    ],
    hooks: {
      // Hook para actualizar estado de completación
      beforeSave: async (health: Health) => {
        // Considerar completo si tiene información básica
        if (health.vitalSigns && health.physicalExam && health.overallHealthStatus !== HealthStatus.UNKNOWN) {
          health.isCompleted = true;
        }

        // Validar fechas de seguimiento
        if (health.followUpDate && health.followUpDate <= new Date(health.recordDate)) {
          throw new Error('La fecha de seguimiento debe ser posterior a la fecha del registro');
        }

        // Validar próxima cita
        if (health.nextAppointment && health.nextAppointment <= new Date(health.recordDate)) {
          throw new Error('La próxima cita debe ser posterior a la fecha del registro');
        }
      },

      // Hook para validaciones adicionales
      beforeCreate: async (health: Health) => {
        // Si es emergencia, establecer prioridad alta automáticamente
        if (health.isEmergency) {
          health.overallHealthStatus = health.overallHealthStatus === HealthStatus.UNKNOWN 
            ? HealthStatus.POOR 
            : health.overallHealthStatus;
        }
      }
    },
    comment: 'Tabla para almacenar registros completos de salud y exámenes médicos de bovinos'
  }
);

export default Health;