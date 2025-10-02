import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database';

// Definición de enums para estados y tipos
export enum CattleType {
  CATTLE = 'CATTLE',
  BULL = 'BULL', 
  COW = 'COW',
  CALF = 'CALF'
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  SICK = 'SICK',
  RECOVERING = 'RECOVERING',
  QUARANTINE = 'QUARANTINE',
  DECEASED = 'DECEASED'
}

export enum VaccinationStatus {
  UP_TO_DATE = 'UP_TO_DATE',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  NONE = 'NONE'
}

export enum GenderType {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNKNOWN = 'UNKNOWN'
}

// Interface para la ubicación geográfica
export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  address?: string;
  municipality?: string;
  state?: string;
  country?: string;
  timestamp?: Date;
  source?: 'GPS' | 'MANUAL' | 'ESTIMATED';
}

// Interface para métricas físicas del bovino
export interface PhysicalMetrics {
  weight?: number; // Peso en kilogramos
  height?: number; // Altura en centímetros
  length?: number; // Longitud en centímetros
  bodyConditionScore?: number; // Puntuación de condición corporal (1-9)
  temperament?: 'CALM' | 'MODERATE' | 'AGGRESSIVE' | 'NERVOUS';
}

// Interface para información reproductiva
export interface ReproductiveInfo {
  isPregnant?: boolean;
  lastCalvingDate?: Date;
  expectedCalvingDate?: Date;
  breedingHistory?: Array<{
    date: Date;
    method: 'NATURAL' | 'ARTIFICIAL_INSEMINATION';
    sireId?: string;
    success: boolean;
  }>;
}

// Interface para configuración de tracking GPS
export interface TrackingConfig {
  isEnabled: boolean;
  deviceId?: string;
  batteryLevel?: number;
  signalStrength?: number;
  lastUpdate?: Date;
  updateInterval?: number; // minutos entre actualizaciones
  geofenceAlerts?: boolean;
}

// Atributos del modelo Bovine
export interface BovineAttributes {
  id: string;
  earTag: string; // Etiqueta de oreja única
  name?: string; // Nombre del animal (opcional)
  breed: string; // Raza del animal
  cattleType: CattleType; // Tipo de ganado
  gender: GenderType; // Sexo del animal
  birthDate: Date; // Fecha de nacimiento
  weight?: number; // Peso actual en kg
  healthStatus: HealthStatus; // Estado de salud actual
  vaccinationStatus: VaccinationStatus; // Estado de vacunación
  location: LocationData; // Ubicación geográfica actual
  physicalMetrics?: PhysicalMetrics; // Métricas físicas del animal
  reproductiveInfo?: ReproductiveInfo; // Información reproductiva
  trackingConfig?: TrackingConfig; // Configuración de rastreo GPS
  ownerId?: string; // ID del propietario/ganadero
  farmId?: string; // ID de la finca/rancho
  motherId?: string; // ID de la madre (si aplica)
  fatherId?: string; // ID del padre (si aplica)
  acquisitionDate?: Date; // Fecha de adquisición
  acquisitionPrice?: number; // Precio de adquisición
  currentValue?: number; // Valor actual estimado
  notes?: string; // Notas adicionales
  images?: string[]; // URLs de imágenes del animal
  qrCode?: string; // Código QR del animal
  rfidTag?: string; // Tag RFID del animal
  isActive: boolean; // Si el animal está activo en el sistema
  lastHealthCheck?: Date; // Fecha del último chequeo de salud
  nextHealthCheck?: Date; // Fecha del próximo chequeo programado
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Para soft delete
}

// Atributos opcionales al crear un nuevo bovino
export interface BovineCreationAttributes 
  extends Optional<BovineAttributes, 
    'id' | 'name' | 'weight' | 'physicalMetrics' | 'reproductiveInfo' | 
    'trackingConfig' | 'ownerId' | 'farmId' | 'motherId' | 'fatherId' | 
    'acquisitionDate' | 'acquisitionPrice' | 'currentValue' | 'notes' | 
    'images' | 'qrCode' | 'rfidTag' | 'lastHealthCheck' | 'nextHealthCheck' | 
    'createdAt' | 'updatedAt' | 'deletedAt'
  > {}

// Clase del modelo Bovine
class Bovine extends Model<BovineAttributes, BovineCreationAttributes> 
  implements BovineAttributes {
  public id!: string;
  public earTag!: string;
  public name?: string;
  public breed!: string;
  public cattleType!: CattleType;
  public gender!: GenderType;
  public birthDate!: Date;
  public weight?: number;
  public healthStatus!: HealthStatus;
  public vaccinationStatus!: VaccinationStatus;
  public location!: LocationData;
  public physicalMetrics?: PhysicalMetrics;
  public reproductiveInfo?: ReproductiveInfo;
  public trackingConfig?: TrackingConfig;
  public ownerId?: string;
  public farmId?: string;
  public motherId?: string;
  public fatherId?: string;
  public acquisitionDate?: Date;
  public acquisitionPrice?: number;
  public currentValue?: number;
  public notes?: string;
  public images?: string[];
  public qrCode?: string;
  public rfidTag?: string;
  public isActive!: boolean;
  public lastHealthCheck?: Date;
  public nextHealthCheck?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt?: Date;

  // Métodos de instancia para cálculos útiles
  
  /**
   * Calcula la edad del bovino en meses
   * @returns Edad en meses
   */
  public getAgeInMonths(): number {
    const now = new Date();
    const birthDate = new Date(this.birthDate);
    const diffTime = Math.abs(now.getTime() - birthDate.getTime());
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    return diffMonths;
  }

  /**
   * Calcula la edad del bovino en años y meses
   * @returns Objeto con años y meses
   */
  public getAgeInYearsAndMonths(): { years: number; months: number } {
    const totalMonths = this.getAgeInMonths();
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return { years, months };
  }

  /**
   * Verifica si el bovino es adulto (mayor a 24 meses)
   * @returns True si es adulto
   */
  public isAdult(): boolean {
    return this.getAgeInMonths() >= 24;
  }

  /**
   * Obtiene el estado de salud en español
   * @returns Estado de salud traducido
   */
  public getHealthStatusLabel(): string {
    const labels = {
      [HealthStatus.HEALTHY]: 'Saludable',
      [HealthStatus.SICK]: 'Enfermo',
      [HealthStatus.RECOVERING]: 'Recuperándose',
      [HealthStatus.QUARANTINE]: 'Cuarentena',
      [HealthStatus.DECEASED]: 'Fallecido'
    };
    return labels[this.healthStatus];
  }

  /**
   * Obtiene el tipo de ganado en español
   * @returns Tipo de ganado traducido
   */
  public getCattleTypeLabel(): string {
    const labels = {
      [CattleType.CATTLE]: 'Ganado General',
      [CattleType.BULL]: 'Toro',
      [CattleType.COW]: 'Vaca',
      [CattleType.CALF]: 'Ternero'
    };
    return labels[this.cattleType];
  }

  /**
   * Verifica si necesita chequeo de salud
   * @returns True si necesita chequeo
   */
  public needsHealthCheck(): boolean {
    if (!this.nextHealthCheck) return true;
    return new Date() >= new Date(this.nextHealthCheck);
  }

  /**
   * Obtiene la información de tracking GPS
   * @returns Estado del GPS
   */
  public getTrackingStatus(): { 
    isTracking: boolean; 
    batteryLevel?: number; 
    signalStrength?: number;
    lastUpdate?: Date;
  } {
    return {
      isTracking: this.trackingConfig?.isEnabled || false,
      batteryLevel: this.trackingConfig?.batteryLevel,
      signalStrength: this.trackingConfig?.signalStrength,
      lastUpdate: this.trackingConfig?.lastUpdate
    };
  }

  /**
   * Genera un código QR único para el bovino
   * @returns Código QR generado
   */
  public generateQRCode(): string {
    return `BOVINE-${this.earTag}-${this.id}`;
  }
}

// Definición del modelo en Sequelize
Bovine.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
      comment: 'ID único del bovino'
    },
    earTag: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [3, 50]
      },
      comment: 'Etiqueta de oreja única del bovino'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [2, 100]
      },
      comment: 'Nombre del animal (opcional)'
    },
    breed: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      },
      comment: 'Raza del animal'
    },
    cattleType: {
      type: DataTypes.ENUM(...Object.values(CattleType)),
      allowNull: false,
      comment: 'Tipo de ganado (toro, vaca, ternero, etc.)'
    },
    gender: {
      type: DataTypes.ENUM(...Object.values(GenderType)),
      allowNull: false,
      comment: 'Sexo del animal'
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0] // No puede nacer en el futuro
      },
      comment: 'Fecha de nacimiento del animal'
    },
    weight: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      validate: {
        min: 1,
        max: 2000 // Peso máximo razonable en kg
      },
      comment: 'Peso actual del animal en kilogramos'
    },
    healthStatus: {
      type: DataTypes.ENUM(...Object.values(HealthStatus)),
      allowNull: false,
      defaultValue: HealthStatus.HEALTHY,
      comment: 'Estado de salud actual del animal'
    },
    vaccinationStatus: {
      type: DataTypes.ENUM(...Object.values(VaccinationStatus)),
      allowNull: false,
      defaultValue: VaccinationStatus.NONE,
      comment: 'Estado de vacunación del animal'
    },
    location: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidLocation(value: LocationData) {
          if (!value.latitude || !value.longitude) {
            throw new Error('Latitud y longitud son requeridas');
          }
          if (value.latitude < -90 || value.latitude > 90) {
            throw new Error('Latitud debe estar entre -90 y 90');
          }
          if (value.longitude < -180 || value.longitude > 180) {
            throw new Error('Longitud debe estar entre -180 y 180');
          }
        }
      },
      comment: 'Ubicación geográfica actual del animal'
    },
    physicalMetrics: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Métricas físicas del animal (peso, altura, etc.)'
    },
    reproductiveInfo: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Información reproductiva del animal'
    },
    trackingConfig: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Configuración de rastreo GPS del animal'
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del propietario del animal'
    },
    farmId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la finca donde se encuentra el animal'
    },
    motherId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la madre del animal'
    },
    fatherId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del padre del animal'
    },
    acquisitionDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de adquisición del animal'
    },
    acquisitionPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Precio de adquisición del animal'
    },
    currentValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Valor actual estimado del animal'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales sobre el animal'
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: 'URLs de imágenes del animal'
    },
    qrCode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      comment: 'Código QR del animal'
    },
    rfidTag: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'Tag RFID del animal'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si el animal está activo en el sistema'
    },
    lastHealthCheck: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último chequeo de salud'
    },
    nextHealthCheck: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del próximo chequeo programado'
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
    modelName: 'Bovine',
    tableName: 'bovines',
    timestamps: true,
    paranoid: true, // Habilita soft delete
    indexes: [
      // Índices para mejorar el rendimiento de las consultas
      {
        unique: true,
        fields: ['ear_tag']
      },
      {
        fields: ['health_status']
      },
      {
        fields: ['cattle_type']
      },
      {
        fields: ['vaccination_status']
      },
      {
        fields: ['owner_id']
      },
      {
        fields: ['farm_id']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['birth_date']
      },
      {
        name: 'bovines_location_gin',
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
      // Hook para generar código QR antes de crear
      beforeCreate: async (bovine: Bovine) => {
        if (!bovine.qrCode) {
          bovine.qrCode = bovine.generateQRCode();
        }
      },
      
      // Hook para actualizar el timestamp de ubicación
      beforeUpdate: async (bovine: Bovine) => {
        if (bovine.changed('location')) {
          bovine.location = {
            ...bovine.location,
            timestamp: new Date()
          };
        }
      }
    },
    comment: 'Tabla para almacenar información de bovinos con geolocalización'
  }
);

export default Bovine;