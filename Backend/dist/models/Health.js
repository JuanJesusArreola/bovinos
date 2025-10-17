"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BodySystem = exports.SeverityLevel = exports.TreatmentStatus = exports.DiagnosisStatus = exports.HealthStatus = exports.HealthRecordType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var HealthRecordType;
(function (HealthRecordType) {
    HealthRecordType["ROUTINE_CHECKUP"] = "ROUTINE_CHECKUP";
    HealthRecordType["EMERGENCY_VISIT"] = "EMERGENCY_VISIT";
    HealthRecordType["FOLLOW_UP"] = "FOLLOW_UP";
    HealthRecordType["VACCINATION"] = "VACCINATION";
    HealthRecordType["TREATMENT"] = "TREATMENT";
    HealthRecordType["SURGERY"] = "SURGERY";
    HealthRecordType["LABORATORY_TEST"] = "LABORATORY_TEST";
    HealthRecordType["PHYSICAL_EXAM"] = "PHYSICAL_EXAM";
    HealthRecordType["REPRODUCTIVE_EXAM"] = "REPRODUCTIVE_EXAM";
    HealthRecordType["NECROPSY"] = "NECROPSY";
    HealthRecordType["QUARANTINE_ASSESSMENT"] = "QUARANTINE_ASSESSMENT";
    HealthRecordType["PRE_TRANSPORT_EXAM"] = "PRE_TRANSPORT_EXAM";
    HealthRecordType["NUTRITION_ASSESSMENT"] = "NUTRITION_ASSESSMENT";
    HealthRecordType["BEHAVIORAL_ASSESSMENT"] = "BEHAVIORAL_ASSESSMENT";
    HealthRecordType["OTHER"] = "OTHER";
})(HealthRecordType || (exports.HealthRecordType = HealthRecordType = {}));
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["EXCELLENT"] = "EXCELLENT";
    HealthStatus["GOOD"] = "GOOD";
    HealthStatus["FAIR"] = "FAIR";
    HealthStatus["POOR"] = "POOR";
    HealthStatus["CRITICAL"] = "CRITICAL";
    HealthStatus["UNKNOWN"] = "UNKNOWN";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
var DiagnosisStatus;
(function (DiagnosisStatus) {
    DiagnosisStatus["SUSPECTED"] = "SUSPECTED";
    DiagnosisStatus["CONFIRMED"] = "CONFIRMED";
    DiagnosisStatus["RULED_OUT"] = "RULED_OUT";
    DiagnosisStatus["DIFFERENTIAL"] = "DIFFERENTIAL";
    DiagnosisStatus["PENDING"] = "PENDING";
})(DiagnosisStatus || (exports.DiagnosisStatus = DiagnosisStatus = {}));
var TreatmentStatus;
(function (TreatmentStatus) {
    TreatmentStatus["NOT_STARTED"] = "NOT_STARTED";
    TreatmentStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TreatmentStatus["COMPLETED"] = "COMPLETED";
    TreatmentStatus["SUSPENDED"] = "SUSPENDED";
    TreatmentStatus["FAILED"] = "FAILED";
    TreatmentStatus["CANCELLED"] = "CANCELLED";
})(TreatmentStatus || (exports.TreatmentStatus = TreatmentStatus = {}));
var SeverityLevel;
(function (SeverityLevel) {
    SeverityLevel["MILD"] = "MILD";
    SeverityLevel["MODERATE"] = "MODERATE";
    SeverityLevel["SEVERE"] = "SEVERE";
    SeverityLevel["CRITICAL"] = "CRITICAL";
    SeverityLevel["FATAL"] = "FATAL";
})(SeverityLevel || (exports.SeverityLevel = SeverityLevel = {}));
var BodySystem;
(function (BodySystem) {
    BodySystem["RESPIRATORY"] = "RESPIRATORY";
    BodySystem["CARDIOVASCULAR"] = "CARDIOVASCULAR";
    BodySystem["DIGESTIVE"] = "DIGESTIVE";
    BodySystem["NERVOUS"] = "NERVOUS";
    BodySystem["MUSCULOSKELETAL"] = "MUSCULOSKELETAL";
    BodySystem["REPRODUCTIVE"] = "REPRODUCTIVE";
    BodySystem["URINARY"] = "URINARY";
    BodySystem["INTEGUMENTARY"] = "INTEGUMENTARY";
    BodySystem["ENDOCRINE"] = "ENDOCRINE";
    BodySystem["IMMUNE"] = "IMMUNE";
    BodySystem["METABOLIC"] = "METABOLIC";
    BodySystem["OCULAR"] = "OCULAR";
    BodySystem["AUDITORY"] = "AUDITORY";
    BodySystem["DENTAL"] = "DENTAL";
    BodySystem["SYSTEMIC"] = "SYSTEMIC";
})(BodySystem || (exports.BodySystem = BodySystem = {}));
class Health extends sequelize_1.Model {
    getRecordTypeLabel() {
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
    getHealthStatusLabel() {
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
    needsFollowUp() {
        if (!this.followUpRequired)
            return false;
        if (!this.followUpDate)
            return true;
        return new Date() >= new Date(this.followUpDate);
    }
    getDaysSinceRecord() {
        const now = new Date();
        const recordDate = new Date(this.recordDate);
        const diffTime = now.getTime() - recordDate.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    hasAbnormalVitalSigns() {
        if (!this.vitalSigns)
            return false;
        const vs = this.vitalSigns;
        const normalRanges = {
            temperature: { min: 38.0, max: 39.5 },
            heartRate: { min: 60, max: 80 },
            respiratoryRate: { min: 24, max: 36 }
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
    getAffectedSystems() {
        return this.symptoms?.affectedSystems || [];
    }
    hasConfirmedDiagnosis() {
        return this.diagnosis?.status === DiagnosisStatus.CONFIRMED;
    }
    getPrimaryDiagnosis() {
        return this.diagnosis?.primaryDiagnosis || null;
    }
    isTreatmentInProgress() {
        return this.treatment?.status === TreatmentStatus.IN_PROGRESS;
    }
    getActiveMedications() {
        if (!this.treatment?.medications)
            return [];
        return this.treatment.medications.map(med => ({
            name: med.name,
            dosage: `${med.dosage} ${med.dosageUnit}`,
            frequency: med.frequency
        }));
    }
    getAverageBodyConditionScore() {
        const scores = [];
        if (this.physicalExam?.bodyConditionScore) {
            scores.push(this.physicalExam.bodyConditionScore);
        }
        if (this.nutritionalAssessment?.bodyConditionScore) {
            scores.push(this.nutritionalAssessment.bodyConditionScore);
        }
        if (scores.length === 0)
            return null;
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
    isCompleteMedicalRecord() {
        return !!(this.vitalSigns &&
            this.physicalExam &&
            this.diagnosis &&
            this.overallHealthStatus !== HealthStatus.UNKNOWN);
    }
    getFollowUpRecommendations() {
        const recommendations = [];
        if (this.recommendations) {
            recommendations.push(...this.recommendations);
        }
        if (this.laboratoryResults?.recommendations) {
            recommendations.push(...this.laboratoryResults.recommendations);
        }
        if (this.nutritionalAssessment?.recommendations) {
            recommendations.push(...this.nutritionalAssessment.recommendations);
        }
        return [...new Set(recommendations)];
    }
    getTotalCost() {
        let total = this.cost || 0;
        if (this.treatment?.medications) {
            total += this.treatment.medications.reduce((sum, med) => sum + (med.cost || 0), 0);
        }
        if (this.laboratoryResults?.cost) {
            total += this.laboratoryResults.cost;
        }
        return total;
    }
    getHealthSummary() {
        const keyFindings = [];
        let riskLevel = 'LOW';
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
Health.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del registro de salud'
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
        comment: 'ID del bovino relacionado'
    },
    recordType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(HealthRecordType)),
        allowNull: false,
        comment: 'Tipo de registro de salud'
    },
    recordDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha y hora del registro'
    },
    veterinarianId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del veterinario responsable'
    },
    technicianId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del técnico que asistió'
    },
    location: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Ubicación geográfica del examen'
    },
    chiefComplaint: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Queja principal o motivo de consulta'
    },
    historyPresent: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Historia de la enfermedad actual'
    },
    historyPast: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Historia médica pasada'
    },
    vitalSigns: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Signos vitales registrados'
    },
    physicalExam: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Hallazgos del examen físico'
    },
    symptoms: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Síntomas observados'
    },
    diagnosis: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Diagnósticos realizados'
    },
    treatment: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Tratamientos prescritos y realizados'
    },
    laboratoryResults: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Resultados de exámenes de laboratorio'
    },
    nutritionalAssessment: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Evaluación nutricional'
    },
    reproductiveAssessment: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Evaluación reproductiva'
    },
    overallHealthStatus: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(HealthStatus)),
        allowNull: false,
        defaultValue: HealthStatus.UNKNOWN,
        comment: 'Estado general de salud'
    },
    recommendations: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.TEXT),
        allowNull: true,
        defaultValue: [],
        comment: 'Recomendaciones médicas'
    },
    nextAppointment: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de próxima cita'
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
        comment: 'URLs de fotos del examen'
    },
    xrays: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de radiografías'
    },
    videos: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de videos del examen'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales del examen'
    },
    privateNotes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas privadas del veterinario'
    },
    cost: {
        type: sequelize_1.DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: {
            min: 0
        },
        comment: 'Costo del examen/tratamiento'
    },
    currency: {
        type: sequelize_1.DataTypes.STRING(3),
        allowNull: true,
        defaultValue: 'MXN',
        comment: 'Moneda del costo'
    },
    followUpRequired: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si requiere seguimiento'
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
    isEmergency: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si fue una emergencia'
    },
    isCompleted: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el registro está completo'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el registro está activo'
    },
    weatherConditions: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Condiciones climáticas durante el examen'
    },
    environmentalFactors: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Factores ambientales relevantes'
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        comment: 'ID del usuario que creó el registro'
    },
    updatedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que actualizó el registro'
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de creación del registro'
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de última actualización'
    },
    deletedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de eliminación (soft delete)'
    }
}, {
    sequelize: database_1.default,
    modelName: 'Health',
    tableName: 'health_records',
    timestamps: true,
    paranoid: true,
    indexes: [
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
                    [sequelize_1.Op.ne]: null
                }
            }
        }
    ],
    hooks: {
        beforeSave: async (health) => {
            if (health.vitalSigns && health.physicalExam && health.overallHealthStatus !== HealthStatus.UNKNOWN) {
                health.isCompleted = true;
            }
            if (health.followUpDate && health.followUpDate <= new Date(health.recordDate)) {
                throw new Error('La fecha de seguimiento debe ser posterior a la fecha del registro');
            }
            if (health.nextAppointment && health.nextAppointment <= new Date(health.recordDate)) {
                throw new Error('La próxima cita debe ser posterior a la fecha del registro');
            }
        },
        beforeCreate: async (health) => {
            if (health.isEmergency) {
                health.overallHealthStatus = health.overallHealthStatus === HealthStatus.UNKNOWN
                    ? HealthStatus.POOR
                    : health.overallHealthStatus;
            }
        }
    },
    comment: 'Tabla para almacenar registros completos de salud y exámenes médicos de bovinos'
});
exports.default = Health;
//# sourceMappingURL=Health.js.map