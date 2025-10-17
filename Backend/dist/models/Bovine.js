"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenderType = exports.VaccinationStatus = exports.HealthStatus = exports.CattleType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var CattleType;
(function (CattleType) {
    CattleType["CATTLE"] = "CATTLE";
    CattleType["BULL"] = "BULL";
    CattleType["COW"] = "COW";
    CattleType["CALF"] = "CALF";
})(CattleType || (exports.CattleType = CattleType = {}));
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["HEALTHY"] = "HEALTHY";
    HealthStatus["SICK"] = "SICK";
    HealthStatus["RECOVERING"] = "RECOVERING";
    HealthStatus["QUARANTINE"] = "QUARANTINE";
    HealthStatus["DECEASED"] = "DECEASED";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
var VaccinationStatus;
(function (VaccinationStatus) {
    VaccinationStatus["UP_TO_DATE"] = "UP_TO_DATE";
    VaccinationStatus["PENDING"] = "PENDING";
    VaccinationStatus["OVERDUE"] = "OVERDUE";
    VaccinationStatus["NONE"] = "NONE";
})(VaccinationStatus || (exports.VaccinationStatus = VaccinationStatus = {}));
var GenderType;
(function (GenderType) {
    GenderType["MALE"] = "MALE";
    GenderType["FEMALE"] = "FEMALE";
    GenderType["UNKNOWN"] = "UNKNOWN";
})(GenderType || (exports.GenderType = GenderType = {}));
class Bovine extends sequelize_1.Model {
    getAgeInMonths() {
        const now = new Date();
        const birthDate = new Date(this.birthDate);
        const diffTime = Math.abs(now.getTime() - birthDate.getTime());
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        return diffMonths;
    }
    getAgeInYearsAndMonths() {
        const totalMonths = this.getAgeInMonths();
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        return { years, months };
    }
    isAdult() {
        return this.getAgeInMonths() >= 24;
    }
    getHealthStatusLabel() {
        const labels = {
            [HealthStatus.HEALTHY]: 'Saludable',
            [HealthStatus.SICK]: 'Enfermo',
            [HealthStatus.RECOVERING]: 'Recuperándose',
            [HealthStatus.QUARANTINE]: 'Cuarentena',
            [HealthStatus.DECEASED]: 'Fallecido'
        };
        return labels[this.healthStatus];
    }
    getCattleTypeLabel() {
        const labels = {
            [CattleType.CATTLE]: 'Ganado General',
            [CattleType.BULL]: 'Toro',
            [CattleType.COW]: 'Vaca',
            [CattleType.CALF]: 'Ternero'
        };
        return labels[this.cattleType];
    }
    needsHealthCheck() {
        if (!this.nextHealthCheck)
            return true;
        return new Date() >= new Date(this.nextHealthCheck);
    }
    getTrackingStatus() {
        return {
            isTracking: this.trackingConfig?.isEnabled || false,
            batteryLevel: this.trackingConfig?.batteryLevel,
            signalStrength: this.trackingConfig?.signalStrength,
            lastUpdate: this.trackingConfig?.lastUpdate
        };
    }
    generateQRCode() {
        return `BOVINE-${this.earTag}-${this.id}`;
    }
}
Bovine.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del bovino'
    },
    earTag: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [3, 50]
        },
        comment: 'Etiqueta de oreja única del bovino'
    },
    name: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        validate: {
            len: [2, 100]
        },
        comment: 'Nombre del animal (opcional)'
    },
    breed: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 100]
        },
        comment: 'Raza del animal'
    },
    cattleType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(CattleType)),
        allowNull: false,
        comment: 'Tipo de ganado (toro, vaca, ternero, etc.)'
    },
    gender: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(GenderType)),
        allowNull: false,
        comment: 'Sexo del animal'
    },
    birthDate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: false,
        validate: {
            isDate: true,
            isBefore: new Date().toISOString().split('T')[0]
        },
        comment: 'Fecha de nacimiento del animal'
    },
    weight: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        validate: {
            min: 1,
            max: 2000
        },
        comment: 'Peso actual del animal en kilogramos'
    },
    healthStatus: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(HealthStatus)),
        allowNull: false,
        defaultValue: HealthStatus.HEALTHY,
        comment: 'Estado de salud actual del animal'
    },
    vaccinationStatus: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(VaccinationStatus)),
        allowNull: false,
        defaultValue: VaccinationStatus.NONE,
        comment: 'Estado de vacunación del animal'
    },
    location: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            isValidLocation(value) {
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
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Métricas físicas del animal (peso, altura, etc.)'
    },
    reproductiveInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información reproductiva del animal'
    },
    trackingConfig: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Configuración de rastreo GPS del animal'
    },
    ownerId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del propietario del animal'
    },
    farmId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la finca donde se encuentra el animal'
    },
    motherId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la madre del animal'
    },
    fatherId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del padre del animal'
    },
    acquisitionDate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha de adquisición del animal'
    },
    acquisitionPrice: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: {
            min: 0
        },
        comment: 'Precio de adquisición del animal'
    },
    currentValue: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: {
            min: 0
        },
        comment: 'Valor actual estimado del animal'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales sobre el animal'
    },
    images: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de imágenes del animal'
    },
    qrCode: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'Código QR del animal'
    },
    rfidTag: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        unique: true,
        comment: 'Tag RFID del animal'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el animal está activo en el sistema'
    },
    lastHealthCheck: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del último chequeo de salud'
    },
    nextHealthCheck: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del próximo chequeo programado'
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de creación del registro'
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de última actualización del registro'
    },
    deletedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de eliminación (soft delete)'
    }
}, {
    sequelize: database_1.default,
    modelName: 'Bovine',
    tableName: 'bovines',
    timestamps: true,
    paranoid: true,
    indexes: [
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
                    [sequelize_1.Op.ne]: null
                }
            }
        }
    ],
    hooks: {
        beforeCreate: async (bovine) => {
            if (!bovine.qrCode) {
                bovine.qrCode = bovine.generateQRCode();
            }
        },
        beforeUpdate: async (bovine) => {
            if (bovine.changed('location')) {
                bovine.location = {
                    ...bovine.location,
                    timestamp: new Date()
                };
            }
        }
    },
    comment: 'Tabla para almacenar información de bovinos con geolocalización'
});
exports.default = Bovine;
//# sourceMappingURL=Bovine.js.map