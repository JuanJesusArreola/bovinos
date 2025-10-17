"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecurrenceType = exports.EventPriority = exports.EventStatus = exports.EventType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var EventType;
(function (EventType) {
    EventType["VACCINATION"] = "VACCINATION";
    EventType["DISEASE"] = "DISEASE";
    EventType["HEALTH_CHECK"] = "HEALTH_CHECK";
    EventType["TREATMENT"] = "TREATMENT";
    EventType["REPRODUCTION"] = "REPRODUCTION";
    EventType["MOVEMENT"] = "MOVEMENT";
    EventType["FEEDING"] = "FEEDING";
    EventType["WEIGHING"] = "WEIGHING";
    EventType["BIRTH"] = "BIRTH";
    EventType["DEATH"] = "DEATH";
    EventType["INJURY"] = "INJURY";
    EventType["QUARANTINE"] = "QUARANTINE";
    EventType["MEDICATION"] = "MEDICATION";
    EventType["SURGERY"] = "SURGERY";
    EventType["OTHER"] = "OTHER";
})(EventType || (exports.EventType = EventType = {}));
var EventStatus;
(function (EventStatus) {
    EventStatus["SCHEDULED"] = "SCHEDULED";
    EventStatus["IN_PROGRESS"] = "IN_PROGRESS";
    EventStatus["COMPLETED"] = "COMPLETED";
    EventStatus["CANCELLED"] = "CANCELLED";
    EventStatus["POSTPONED"] = "POSTPONED";
    EventStatus["FAILED"] = "FAILED";
})(EventStatus || (exports.EventStatus = EventStatus = {}));
var EventPriority;
(function (EventPriority) {
    EventPriority["LOW"] = "LOW";
    EventPriority["MEDIUM"] = "MEDIUM";
    EventPriority["HIGH"] = "HIGH";
    EventPriority["CRITICAL"] = "CRITICAL";
    EventPriority["EMERGENCY"] = "EMERGENCY";
})(EventPriority || (exports.EventPriority = EventPriority = {}));
var RecurrenceType;
(function (RecurrenceType) {
    RecurrenceType["NONE"] = "NONE";
    RecurrenceType["DAILY"] = "DAILY";
    RecurrenceType["WEEKLY"] = "WEEKLY";
    RecurrenceType["MONTHLY"] = "MONTHLY";
    RecurrenceType["QUARTERLY"] = "QUARTERLY";
    RecurrenceType["YEARLY"] = "YEARLY";
    RecurrenceType["CUSTOM"] = "CUSTOM";
})(RecurrenceType || (exports.RecurrenceType = RecurrenceType = {}));
class Event extends sequelize_1.Model {
    isOverdue() {
        if (this.status === EventStatus.COMPLETED || this.status === EventStatus.CANCELLED) {
            return false;
        }
        return new Date() > new Date(this.scheduledDate);
    }
    getDurationInMinutes() {
        if (!this.startDate || !this.endDate)
            return null;
        const diffTime = new Date(this.endDate).getTime() - new Date(this.startDate).getTime();
        return Math.round(diffTime / (1000 * 60));
    }
    getEventTypeLabel() {
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
    getStatusLabel() {
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
    getPriorityLabel() {
        const labels = {
            [EventPriority.LOW]: 'Baja',
            [EventPriority.MEDIUM]: 'Media',
            [EventPriority.HIGH]: 'Alta',
            [EventPriority.CRITICAL]: 'Crítica',
            [EventPriority.EMERGENCY]: 'Emergencia'
        };
        return labels[this.priority];
    }
    needsFollowUp() {
        if (!this.followUpRequired)
            return false;
        if (!this.followUpDate)
            return true;
        return new Date() >= new Date(this.followUpDate);
    }
    getDaysUntilScheduled() {
        const now = new Date();
        const scheduled = new Date(this.scheduledDate);
        const diffTime = scheduled.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    isMedicalEvent() {
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
    getVaccinationData() {
        if (this.eventType !== EventType.VACCINATION)
            return null;
        return this.eventData;
    }
    getDiseaseData() {
        if (this.eventType !== EventType.DISEASE)
            return null;
        return this.eventData;
    }
    generateNextRecurrentEvent() {
        if (!this.recurrence || this.recurrence.type === RecurrenceType.NONE) {
            return null;
        }
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
Event.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del evento'
    },
    bovineId: {
        type: sequelize_1.DataTypes.UUID,
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
        type: sequelize_1.DataTypes.ENUM(...Object.values(EventType)),
        allowNull: false,
        comment: 'Tipo de evento (vacunación, enfermedad, etc.)'
    },
    title: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [3, 200]
        },
        comment: 'Título descriptivo del evento'
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción detallada del evento'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(EventStatus)),
        allowNull: false,
        defaultValue: EventStatus.SCHEDULED,
        comment: 'Estado actual del evento'
    },
    priority: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(EventPriority)),
        allowNull: false,
        defaultValue: EventPriority.MEDIUM,
        comment: 'Prioridad del evento'
    },
    scheduledDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha y hora programada del evento'
    },
    startDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha y hora de inicio real del evento'
    },
    endDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha y hora de finalización del evento'
    },
    location: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            isValidLocation(value) {
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
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que realizó el evento'
    },
    veterinarianId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del veterinario responsable (si aplica)'
    },
    cost: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: {
            min: 0
        },
        comment: 'Costo del evento'
    },
    currency: {
        type: sequelize_1.DataTypes.STRING(3),
        allowNull: true,
        defaultValue: 'MXN',
        validate: {
            len: [3, 3]
        },
        comment: 'Moneda del costo (código ISO)'
    },
    eventData: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Datos específicos del tipo de evento'
    },
    recurrence: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Configuración de recurrencia del evento'
    },
    parentEventId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'events',
            key: 'id'
        },
        comment: 'ID del evento padre (para eventos recurrentes)'
    },
    notifications: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Configuración de notificaciones'
    },
    attachments: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de archivos adjuntos'
    },
    photos: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de fotos del evento'
    },
    results: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Resultados del evento'
    },
    complications: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Complicaciones observadas durante el evento'
    },
    followUpRequired: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el evento requiere seguimiento'
    },
    followUpDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha programada para seguimiento'
    },
    followUpNotes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas de seguimiento'
    },
    publicNotes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas visibles para todos los usuarios'
    },
    privateNotes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas privadas del veterinario/responsable'
    },
    weatherConditions: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Condiciones climáticas durante el evento'
    },
    temperature: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: -50,
            max: 60
        },
        comment: 'Temperatura ambiente en grados Celsius'
    },
    humidity: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 100
        },
        comment: 'Humedad relativa en porcentaje'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el evento está activo en el sistema'
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        comment: 'ID del usuario que creó el evento'
    },
    updatedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que actualizó el evento'
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
    modelName: 'Event',
    tableName: 'events',
    timestamps: true,
    paranoid: true,
    indexes: [
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
        beforeUpdate: async (event) => {
            if (event.changed('status')) {
                if (event.status === EventStatus.IN_PROGRESS && !event.startDate) {
                    event.startDate = new Date();
                }
                if (event.status === EventStatus.COMPLETED && !event.endDate) {
                    event.endDate = new Date();
                }
            }
        },
        beforeSave: async (event) => {
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
});
exports.default = Event;
//# sourceMappingURL=Event.js.map