import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';
import { LocationData } from './Bovine';

// Enums para tipos de eventos
export enum EventType {
  VACCINATION = 'VACCINATION',
  DISEASE = 'DISEASE',
  HEALTH_CHECK = 'HEALTH_CHECK',
  TREATMENT = 'TREATMENT',
  REPRODUCTION = 'REPRODUCTION',
  MOVEMENT = 'MOVEMENT',
  FEEDING = 'FEEDING',
  WEIGHING = 'WEIGHING',
  BIRTH = 'BIRTH',
  DEATH = 'DEATH',
  INJURY = 'INJURY',
  QUARANTINE = 'QUARANTINE',
  MEDICATION = 'MEDICATION',
  SURGERY = 'SURGERY',
  OTHER = 'OTHER'
}

export enum EventStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  POSTPONED = 'POSTPONED',
  FAILED = 'FAILED'
}

export enum EventPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

export enum RecurrenceType {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM'
}

// Interface para información específica de vacunación
export interface VaccinationEventData {
  vaccineType: string; // Tipo de vacuna
  vaccineName: string; // Nombre comercial de la vacuna
  manufacturer?: string; // Fabricante
  batchNumber?: string; // Número de lote
  expirationDate?: Date; // Fecha de vencimiento
  dosage: number; // Dosis administrada
  dosageUnit: string; // Unidad de la dosis (ml, cc, etc.)
  applicationMethod: 'SUBCUTANEOUS' | 'INTRAMUSCULAR' | 'ORAL' | 'NASAL' | 'OTHER'; // Método de aplicación
  applicationSite?: string; // Sitio de aplicación
  nextDueDate?: Date; // Próxima fecha de aplicación
  reactions?: string; // Reacciones adversas observadas
  effectivenessRate?: number; // Tasa de efectividad esperada
}

// Interface para información específica de enfermedad
export interface DiseaseEventData {
  diseaseName: string; // Nombre de la enfermedad
  diseaseCode?: string; // Código de la enfermedad
  symptoms: string[]; // Síntomas observados
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL'; // Severidad
  contagious: boolean; // Si es contagiosa
  diagnosis: 'SUSPECTED' | 'CONFIRMED' | 'DIFFERENTIAL'; // Tipo de diagnóstico
  diagnosisMethod?: string; // Método de diagnóstico (visual, laboratorio, etc.)
  causativeAgent?: string; // Agente causante
  affectedSystems?: string[]; // Sistemas afectados
  chronicCondition: boolean; // Si es condición crónica
  recoveryTime?: number; // Tiempo de recuperación estimado (días)
  treatmentRequired: boolean; // Si requiere tratamiento
}

// Interface para información específica de tratamiento
export interface TreatmentEventData {
  treatmentType: 'MEDICATION' | 'SURGERY' | 'THERAPY' | 'ISOLATION' | 'OTHER';
  medicationName?: string; // Nombre del medicamento
  activeIngredient?: string; // Principio activo
  dosage?: number; // Dosis
  dosageUnit?: string; // Unidad de dosis
  frequency?: string; // Frecuencia de administración
  duration?: number; // Duración del tratamiento (días)
  administrationRoute?: 'ORAL' | 'INJECTABLE' | 'TOPICAL' | 'INTRAVENOUS' | 'OTHER';
  withdrawalPeriod?: number; // Período de retiro (días)
  sideEffects?: string; // Efectos secundarios observados
  effectiveness?: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT'; // Efectividad del tratamiento
}

// Interface para información específica de chequeo de salud
export interface HealthCheckEventData {
  checkType: 'ROUTINE' | 'FOLLOW_UP' | 'EMERGENCY' | 'PRE_BREEDING' | 'POST_TREATMENT';
  vitalSigns?: {
    temperature?: number; // Temperatura corporal
    heartRate?: number; // Frecuencia cardíaca
    respiratoryRate?: number; // Frecuencia respiratoria
    bloodPressure?: string; // Presión arterial
  };
  bodyConditionScore?: number; // Puntuación de condición corporal (1-9)
  locomotionScore?: number; // Puntuación de locomoción (1-5)
  hydrationStatus?: 'NORMAL' | 'MILD_DEHYDRATION' | 'MODERATE_DEHYDRATION' | 'SEVERE_DEHYDRATION';
  appetiteStatus?: 'NORMAL' | 'REDUCED' | 'ABSENT' | 'INCREASED';
  behaviorStatus?: 'NORMAL' | 'LETHARGIC' | 'AGGRESSIVE' | 'RESTLESS' | 'DEPRESSED';
  skinCondition?: 'NORMAL' | 'DRY' | 'LESIONS' | 'PARASITES' | 'WOUNDS';
  eyeCondition?: 'NORMAL' | 'DISCHARGE' | 'INFLAMMATION' | 'CLOUDINESS';
  musculoskeletalStatus?: 'NORMAL' | 'LAMENESS' | 'STIFFNESS' | 'SWELLING';
  reproductiveStatus?: 'NORMAL' | 'PREGNANT' | 'IN_HEAT' | 'POST_PARTUM' | 'ABNORMAL';
}

// Interface para información específica de reproducción
export interface ReproductionEventData {
  reproductionType: 'NATURAL_BREEDING' | 'ARTIFICIAL_INSEMINATION' | 'EMBRYO_TRANSFER' | 'PREGNANCY_CHECK' | 'BIRTH' | 'WEANING';
  maleId?: string; // ID del macho (para reproducción)
  semenSource?: string; // Fuente del semen
  semenBatch?: string; // Lote del semen
  inseminationMethod?: 'CERVICAL' | 'INTRAUTERINE' | 'DEEP_UTERINE';
  pregnancyStatus?: 'CONFIRMED' | 'SUSPECTED' | 'NEGATIVE' | 'UNKNOWN';
  gestationDay?: number; // Día de gestación
  expectedCalvingDate?: Date; // Fecha esperada de parto
  calfId?: string; // ID del ternero (para nacimientos)
  birthWeight?: number; // Peso al nacer
  calvingDifficulty?: 'EASY' | 'MODERATE' | 'DIFFICULT' | 'CESAREAN';
  placentaExpulsion?: 'NORMAL' | 'RETAINED' | 'INCOMPLETE';
  weaningWeight?: number; // Peso al destete
}

// Interface para información específica de movimiento
export interface MovementEventData {
  movementType: 'PASTURE_CHANGE' | 'FACILITY_TRANSFER' | 'TRANSPORT' | 'EXERCISE' | 'GRAZING';
  fromLocation?: LocationData; // Ubicación de origen
  toLocation?: LocationData; // Ubicación de destino
  transportMethod?: 'WALKING' | 'TRUCK' | 'TRAILER' | 'OTHER';
  distance?: number; // Distancia recorrida (km)
  duration?: number; // Duración del movimiento (minutos)
  reasonForMovement?: string; // Razón del movimiento
  accompanyingAnimals?: string[]; // IDs de animales que acompañan
  weatherConditions?: string; // Condiciones climáticas
  stress_level?: 'LOW' | 'MODERATE' | 'HIGH'; // Nivel de estrés observado
}

// Union type para datos específicos del evento
export type EventSpecificData = 
  | VaccinationEventData 
  | DiseaseEventData 
  | TreatmentEventData 
  | HealthCheckEventData 
  | ReproductionEventData 
  | MovementEventData;

// Interface para información de recurrencia
export interface RecurrenceConfig {
  type: RecurrenceType;
  interval?: number; // Intervalo personalizado
  endDate?: Date; // Fecha de fin de la recurrencia
  maxOccurrences?: number; // Máximo número de ocurrencias
  daysOfWeek?: number[]; // Días de la semana (0=domingo, 6=sábado)
  dayOfMonth?: number; // Día del mes
  monthsOfYear?: number[]; // Meses del año
}

// Interface para notificaciones
export interface NotificationConfig {
  enabled: boolean;
  advanceNotice?: number; // Notificar X días antes
  reminderFrequency?: 'DAILY' | 'WEEKLY' | 'CUSTOM'; // Frecuencia de recordatorios
  notificationMethods?: ('EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP')[]; // Métodos de notificación
  recipients?: string[]; // IDs de usuarios que reciben notificación
}

// Atributos del modelo Event
export interface EventAttributes {
  id: string;
  bovineId: string; // ID del bovino relacionado
  eventType: EventType; // Tipo de evento
  title: string; // Título del evento
  description?: string; // Descripción detallada
  status: EventStatus; // Estado del evento
  priority: EventPriority; // Prioridad del evento
  scheduledDate: Date; // Fecha programada
  startDate?: Date; // Fecha de inicio real
  endDate?: Date; // Fecha de finalización
  location: LocationData; // Ubicación donde ocurrió el evento
  performedBy?: string; // ID del usuario que realizó el evento
  veterinarianId?: string; // ID del veterinario (si aplica)
  cost?: number; // Costo del evento
  currency?: string; // Moneda del costo
  eventData?: EventSpecificData; // Datos específicos del tipo de evento
  recurrence?: RecurrenceConfig; // Configuración de recurrencia
  parentEventId?: string; // ID del evento padre (para eventos recurrentes)
  notifications?: NotificationConfig; // Configuración de notificaciones
  attachments?: string[]; // URLs de archivos adjuntos
  photos?: string[]; // URLs de fotos del evento
  results?: string; // Resultados del evento
  complications?: string; // Complicaciones observadas
  followUpRequired: boolean; // Si requiere seguimiento
  followUpDate?: Date; // Fecha de seguimiento
  followUpNotes?: string; // Notas de seguimiento
  publicNotes?: string; // Notas visibles para todos
  privateNotes?: string; // Notas privadas del veterinario/responsable
  weatherConditions?: string; // Condiciones climáticas durante el evento
  temperature?: number; // Temperatura ambiente
  humidity?: number; // Humedad relativa
  isActive: boolean; // Si el evento está activo
  createdBy: string; // ID del usuario que creó el evento
  updatedBy?: string; // ID del usuario que actualizó el evento
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Para soft delete
}

// Atributos opcionales al crear un nuevo evento
export interface EventCreationAttributes 
  extends Optional<EventAttributes, 
    'id' | 'description' | 'startDate' | 'endDate' | 'performedBy' | 
    'veterinarianId' | 'cost' | 'currency' | 'eventData' | 'recurrence' | 
    'parentEventId' | 'notifications' | 'attachments' | 'photos' | 'results' | 
    'complications' | 'followUpDate' | 'followUpNotes' | 'publicNotes' | 
    'privateNotes' | 'weatherConditions' | 'temperature' | 'humidity' | 
    'updatedBy' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > {}

// Clase del modelo Event
class Event extends Model<EventAttributes, EventCreationAttributes> 
  implements EventAttributes {
  public id!: string;
  public bovineId!: string;
  public eventType!: EventType;
  public title!: string;
  public description?: string;
  public status!: EventStatus;
  public priority!: EventPriority;
  public scheduledDate!: Date;
  public startDate?: Date;
  public endDate?: Date;
  public location!: LocationData;
  public performedBy?: string;
  public veterinarianId?: string;
  public cost?: number;
  public currency?: string;
  public eventData?: EventSpecificData;
  public recurrence?: RecurrenceConfig;
  public parentEventId?: string;
  public notifications?: NotificationConfig;
  public attachments?: string[];
  public photos?: string[];
  public results?: string;
  public complications?: string;
  public followUpRequired!: boolean;
  public followUpDate?: Date;
  public followUpNotes?: string;
  public publicNotes?: string;
  public privateNotes?: string;
  public weatherConditions?: string;
  public temperature?: number;
  public humidity?: number;
  public isActive!: boolean;
  public createdBy!: string;
  public updatedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // Métodos de instancia

  /**
   * Verifica si el evento está vencido
   * @returns True si el evento está vencido
   */
  public isOverdue(): boolean {
    if (this.status === EventStatus.COMPLETED || this.status === EventStatus.CANCELLED) {
      return false;
    }
    return new Date() > new Date(this.scheduledDate);
  }

  /**
   * Calcula la duración del evento en minutos
   * @returns Duración en minutos o null si no está completado
   */
  public getDurationInMinutes(): number | null {
    if (!this.startDate || !this.endDate) return null;
    const diffTime = new Date(this.endDate).getTime() - new Date(this.startDate).getTime();
    return Math.round(diffTime / (1000 * 60));
  }

  /**
   * Obtiene el tipo de evento en español
   * @returns Tipo de evento traducido
   */
  public getEventTypeLabel(): string {
    const labels = {
      [EventType.VACCINATION]: 'Vacunación',
      [EventType.DISEASE]: 'Enfermedad',
      [EventType.HEALTH_CHECK]: 'Chequeo de Salud',
      [EventType.TREATMENT]: 'Tratamiento',
      [EventType.REPRODUCTION]: 'Reproducción',
      [EventType.MOVEMENT]: 'Movimiento',
      [EventType.FEEDING]: 'Alimentación',
      [EventType.WEIGHING]: 'Pesaje',
      [EventType.BIRTH]: 'Nacimiento',
      [EventType.DEATH]: 'Muerte',
      [EventType.INJURY]: 'Lesión',
      [EventType.QUARANTINE]: 'Cuarentena',
      [EventType.MEDICATION]: 'Medicación',
      [EventType.SURGERY]: 'Cirugía',
      [EventType.OTHER]: 'Otro'
    };
    return labels[this.eventType];
  }

  /**
   * Obtiene el estado del evento en español
   * @returns Estado del evento traducido
   */
  public getStatusLabel(): string {
    const labels = {
      [EventStatus.SCHEDULED]: 'Programado',
      [EventStatus.IN_PROGRESS]: 'En Progreso',
      [EventStatus.COMPLETED]: 'Completado',
      [EventStatus.CANCELLED]: 'Cancelado',
      [EventStatus.POSTPONED]: 'Pospuesto',
      [EventStatus.FAILED]: 'Fallido'
    };
    return labels[this.status];
  }

  /**
   * Obtiene la prioridad del evento en español
   * @returns Prioridad del evento traducida
   */
  public getPriorityLabel(): string {
    const labels = {
      [EventPriority.LOW]: 'Baja',
      [EventPriority.MEDIUM]: 'Media',
      [EventPriority.HIGH]: 'Alta',
      [EventPriority.CRITICAL]: 'Crítica',
      [EventPriority.EMERGENCY]: 'Emergencia'
    };
    return labels[this.priority];
  }

  /**
   * Verifica si el evento requiere seguimiento
   * @returns True si requiere seguimiento
   */
  public needsFollowUp(): boolean {
    if (!this.followUpRequired) return false;
    if (!this.followUpDate) return true;
    return new Date() >= new Date(this.followUpDate);
  }

  /**
   * Calcula los días hasta el evento programado
   * @returns Número de días (negativo si ya pasó)
   */
  public getDaysUntilScheduled(): number {
    const now = new Date();
    const scheduled = new Date(this.scheduledDate);
    const diffTime = scheduled.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Verifica si el evento es de tipo médico
   * @returns True si es evento médico
   */
  public isMedicalEvent(): boolean {
    const medicalTypes = [
      EventType.VACCINATION,
      EventType.DISEASE,
      EventType.HEALTH_CHECK,
      EventType.TREATMENT,
      EventType.MEDICATION,
      EventType.SURGERY,
      EventType.INJURY
    ];
    return medicalTypes.includes(this.eventType);
  }

  /**
   * Obtiene información específica de vacunación
   * @returns Datos de vacunación si aplica
   */
  public getVaccinationData(): VaccinationEventData | null {
    if (this.eventType !== EventType.VACCINATION) return null;
    return this.eventData as VaccinationEventData;
  }

  /**
   * Obtiene información específica de enfermedad
   * @returns Datos de enfermedad si aplica
   */
  public getDiseaseData(): DiseaseEventData | null {
    if (this.eventType !== EventType.DISEASE) return null;
    return this.eventData as DiseaseEventData;
  }

  /**
   * Genera el próximo evento recurrente
   * @returns Configuración del próximo evento
   */
  public generateNextRecurrentEvent(): Partial<EventCreationAttributes> | null {
    if (!this.recurrence || this.recurrence.type === RecurrenceType.NONE) {
      return null;
    }

    // Lógica simplificada para demostración
    const nextDate = new Date(this.scheduledDate);
    
    switch (this.recurrence.type) {
      case RecurrenceType.DAILY:
        nextDate.setDate(nextDate.getDate() + (this.recurrence.interval || 1));
        break;
      case RecurrenceType.WEEKLY:
        nextDate.setDate(nextDate.getDate() + (7 * (this.recurrence.interval || 1)));
        break;
      case RecurrenceType.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + (this.recurrence.interval || 1));
        break;
      case RecurrenceType.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + (this.recurrence.interval || 1));
        break;
      default:
        return null;
    }

    // Verificar si ha alcanzado la fecha límite o máximo de ocurrencias
    if (this.recurrence.endDate && nextDate > this.recurrence.endDate) {
      return null;
    }

    return {
      bovineId: this.bovineId,
      eventType: this.eventType,
      title: this.title,
      description: this.description,
      status: EventStatus.SCHEDULED,
      priority: this.priority,
      scheduledDate: nextDate,
      location: this.location,
      eventData: this.eventData,
      recurrence: this.recurrence,
      parentEventId: this.parentEventId || this.id,
      notifications: this.notifications,
      followUpRequired: this.followUpRequired,
      isActive: true,
      createdBy: this.createdBy
    };
  }
}

// Definición del modelo en Sequelize
Event.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del evento'
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
      comment: 'ID del bovino relacionado con el evento'
    },
    eventType: {
      type: DataTypes.ENUM(...Object.values(EventType)),
      allowNull: false,
      comment: 'Tipo de evento (vacunación, enfermedad, etc.)'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200]
      },
      comment: 'Título descriptivo del evento'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada del evento'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(EventStatus)),
      allowNull: false,
      defaultValue: EventStatus.SCHEDULED,
      comment: 'Estado actual del evento'
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(EventPriority)),
      allowNull: false,
      defaultValue: EventPriority.MEDIUM,
      comment: 'Prioridad del evento'
    },
    scheduledDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha y hora programada del evento'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de inicio real del evento'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de finalización del evento'
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidLocation(value: LocationData) {
          if (!value.latitude || !value.longitude) {
            throw new Error('Latitud y longitud son requeridas para el evento');
          }
          if (value.latitude < -90 || value.latitude > 90) {
            throw new Error('Latitud debe estar entre -90 y 90');
          }
          if (value.longitude < -180 || value.longitude > 180) {
            throw new Error('Longitud debe estar entre -180 y 180');
          }
        }
      },
      comment: 'Ubicación geográfica donde ocurrió el evento'
    },
    performedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que realizó el evento'
    },
    veterinarianId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del veterinario responsable (si aplica)'
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Costo del evento'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'MXN',
      validate: {
        len: [3, 3]
      },
      comment: 'Moneda del costo (código ISO)'
    },
    eventData: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Datos específicos del tipo de evento'
    },
    recurrence: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de recurrencia del evento'
    },
    parentEventId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'events',
        key: 'id'
      },
      comment: 'ID del evento padre (para eventos recurrentes)'
    },
    notifications: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de notificaciones'
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
      comment: 'URLs de fotos del evento'
    },
    results: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Resultados del evento'
    },
    complications: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Complicaciones observadas durante el evento'
    },
    followUpRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si el evento requiere seguimiento'
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
    publicNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas visibles para todos los usuarios'
    },
    privateNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas privadas del veterinario/responsable'
    },
    weatherConditions: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Condiciones climáticas durante el evento'
    },
    temperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: -50,
        max: 60
      },
      comment: 'Temperatura ambiente en grados Celsius'
    },
    humidity: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 100
      },
      comment: 'Humedad relativa en porcentaje'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el evento está activo en el sistema'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID del usuario que creó el evento'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del usuario que actualizó el evento'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de creación del registro'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de última actualización del registro'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de eliminación (soft delete)'
    }
  },
  {
    sequelize,
    modelName: 'Event',
    tableName: 'events',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para mejorar el rendimiento
      {
        fields: ['bovine_id']
      },
      {
        fields: ['event_type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['scheduled_date']
      },
      {
        fields: ['created_by']
      },
      {
        fields: ['veterinarian_id']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['parent_event_id']
      },
      {
        name: 'events_scheduled_date_status',
        fields: ['scheduled_date', 'status']
      },
      {
        name: 'events_bovine_type_date',
        fields: ['bovine_id', 'event_type', 'scheduled_date']
      },
      {
        name: 'events_location_gin',
        fields: ['location'],
        using: 'gin'
      }
    ],
    hooks: {
      // Hook para establecer fechas de inicio al cambiar estado
      beforeUpdate: async (event: Event) => {
        if (event.changed('status')) {
          if (event.status === EventStatus.IN_PROGRESS && !event.startDate) {
            event.startDate = new Date();
          }
          if (event.status === EventStatus.COMPLETED && !event.endDate) {
            event.endDate = new Date();
          }
        }
      },

      // Hook para validar fechas
      beforeSave: async (event: Event) => {
        if (event.startDate && event.endDate) {
          if (event.startDate > event.endDate) {
            throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin');
          }
        }
        
        if (event.followUpDate && event.followUpDate < new Date()) {
          if (event.status === EventStatus.SCHEDULED) {
            throw new Error('La fecha de seguimiento no puede ser anterior a la fecha actual');
          }
        }
      }
    },
    comment: 'Tabla para almacenar eventos relacionados con bovinos (vacunaciones, enfermedades, etc.)'
  }
);

export default Event;