"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeaningMethod = exports.CalfViability = exports.CalvingDifficulty = exports.PregnancyDiagnosisMethod = exports.HeatDetectionMethod = exports.ServiceStatus = exports.ReproductionType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var ReproductionType;
(function (ReproductionType) {
    ReproductionType["NATURAL_SERVICE"] = "NATURAL_SERVICE";
    ReproductionType["ARTIFICIAL_INSEMINATION"] = "ARTIFICIAL_INSEMINATION";
    ReproductionType["EMBRYO_TRANSFER"] = "EMBRYO_TRANSFER";
    ReproductionType["IN_VITRO_FERTILIZATION"] = "IN_VITRO_FERTILIZATION";
    ReproductionType["CLONING"] = "CLONING";
    ReproductionType["SYNCHRONIZED_BREEDING"] = "SYNCHRONIZED_BREEDING";
    ReproductionType["MULTIPLE_OVULATION"] = "MULTIPLE_OVULATION";
})(ReproductionType || (exports.ReproductionType = ReproductionType = {}));
var ServiceStatus;
(function (ServiceStatus) {
    ServiceStatus["PLANNED"] = "PLANNED";
    ServiceStatus["IN_HEAT"] = "IN_HEAT";
    ServiceStatus["SERVICED"] = "SERVICED";
    ServiceStatus["CONFIRMED_PREGNANT"] = "CONFIRMED_PREGNANT";
    ServiceStatus["OPEN"] = "OPEN";
    ServiceStatus["REPEAT_BREEDING"] = "REPEAT_BREEDING";
    ServiceStatus["ABORTED"] = "ABORTED";
    ServiceStatus["CALVED"] = "CALVED";
    ServiceStatus["WEANED"] = "WEANED";
    ServiceStatus["CULLED"] = "CULLED";
})(ServiceStatus || (exports.ServiceStatus = ServiceStatus = {}));
var HeatDetectionMethod;
(function (HeatDetectionMethod) {
    HeatDetectionMethod["VISUAL_OBSERVATION"] = "VISUAL_OBSERVATION";
    HeatDetectionMethod["HEAT_DETECTOR"] = "HEAT_DETECTOR";
    HeatDetectionMethod["PEDOMETER"] = "PEDOMETER";
    HeatDetectionMethod["ACTIVITY_MONITOR"] = "ACTIVITY_MONITOR";
    HeatDetectionMethod["PROGESTERONE_TEST"] = "PROGESTERONE_TEST";
    HeatDetectionMethod["ULTRASOUND"] = "ULTRASOUND";
    HeatDetectionMethod["MOUNTING_BEHAVIOR"] = "MOUNTING_BEHAVIOR";
    HeatDetectionMethod["VAGINAL_DISCHARGE"] = "VAGINAL_DISCHARGE";
    HeatDetectionMethod["TEMPERATURE_MONITORING"] = "TEMPERATURE_MONITORING";
    HeatDetectionMethod["HORMONE_ANALYSIS"] = "HORMONE_ANALYSIS";
})(HeatDetectionMethod || (exports.HeatDetectionMethod = HeatDetectionMethod = {}));
var PregnancyDiagnosisMethod;
(function (PregnancyDiagnosisMethod) {
    PregnancyDiagnosisMethod["RECTAL_PALPATION"] = "RECTAL_PALPATION";
    PregnancyDiagnosisMethod["ULTRASOUND"] = "ULTRASOUND";
    PregnancyDiagnosisMethod["BLOOD_TEST"] = "BLOOD_TEST";
    PregnancyDiagnosisMethod["MILK_TEST"] = "MILK_TEST";
    PregnancyDiagnosisMethod["URINE_TEST"] = "URINE_TEST";
    PregnancyDiagnosisMethod["HORMONE_ASSAY"] = "HORMONE_ASSAY";
    PregnancyDiagnosisMethod["PREGNANCY_ASSOCIATED_GLYCOPROTEINS"] = "PREGNANCY_ASSOCIATED_GLYCOPROTEINS";
})(PregnancyDiagnosisMethod || (exports.PregnancyDiagnosisMethod = PregnancyDiagnosisMethod = {}));
var CalvingDifficulty;
(function (CalvingDifficulty) {
    CalvingDifficulty["EASY"] = "EASY";
    CalvingDifficulty["SLIGHT_ASSISTANCE"] = "SLIGHT_ASSISTANCE";
    CalvingDifficulty["MODERATE_ASSISTANCE"] = "MODERATE_ASSISTANCE";
    CalvingDifficulty["DIFFICULT"] = "DIFFICULT";
    CalvingDifficulty["CESAREAN"] = "CESAREAN";
    CalvingDifficulty["EMBRYOTOMY"] = "EMBRYOTOMY";
    CalvingDifficulty["VETERINARY_ASSISTANCE"] = "VETERINARY_ASSISTANCE";
})(CalvingDifficulty || (exports.CalvingDifficulty = CalvingDifficulty = {}));
var CalfViability;
(function (CalfViability) {
    CalfViability["ALIVE_NORMAL"] = "ALIVE_NORMAL";
    CalfViability["ALIVE_WEAK"] = "ALIVE_WEAK";
    CalfViability["STILLBORN"] = "STILLBORN";
    CalfViability["DIED_WITHIN_24H"] = "DIED_WITHIN_24H";
    CalfViability["DIED_WITHIN_WEEK"] = "DIED_WITHIN_WEEK";
    CalfViability["CONGENITAL_DEFECTS"] = "CONGENITAL_DEFECTS";
})(CalfViability || (exports.CalfViability = CalfViability = {}));
var WeaningMethod;
(function (WeaningMethod) {
    WeaningMethod["NATURAL"] = "NATURAL";
    WeaningMethod["EARLY_WEANING"] = "EARLY_WEANING";
    WeaningMethod["GRADUAL_WEANING"] = "GRADUAL_WEANING";
    WeaningMethod["ABRUPT_WEANING"] = "ABRUPT_WEANING";
    WeaningMethod["FENCE_LINE_WEANING"] = "FENCE_LINE_WEANING";
    WeaningMethod["TWO_STAGE_WEANING"] = "TWO_STAGE_WEANING";
})(WeaningMethod || (exports.WeaningMethod = WeaningMethod = {}));
class Reproduction extends sequelize_1.Model {
    getReproductionTypeLabel() {
        const labels = {
            [ReproductionType.NATURAL_SERVICE]: 'Monta Natural',
            [ReproductionType.ARTIFICIAL_INSEMINATION]: 'Inseminación Artificial',
            [ReproductionType.EMBRYO_TRANSFER]: 'Transferencia de Embriones',
            [ReproductionType.IN_VITRO_FERTILIZATION]: 'Fertilización in Vitro',
            [ReproductionType.CLONING]: 'Clonación',
            [ReproductionType.SYNCHRONIZED_BREEDING]: 'Reproducción Sincronizada',
            [ReproductionType.MULTIPLE_OVULATION]: 'Ovulación Múltiple'
        };
        return labels[this.reproductionType];
    }
    getStatusLabel() {
        const labels = {
            [ServiceStatus.PLANNED]: 'Planeado',
            [ServiceStatus.IN_HEAT]: 'En Celo',
            [ServiceStatus.SERVICED]: 'Servida',
            [ServiceStatus.CONFIRMED_PREGNANT]: 'Preñez Confirmada',
            [ServiceStatus.OPEN]: 'Vacía',
            [ServiceStatus.REPEAT_BREEDING]: 'Repetición de Servicio',
            [ServiceStatus.ABORTED]: 'Aborto',
            [ServiceStatus.CALVED]: 'Parida',
            [ServiceStatus.WEANED]: 'Destetada',
            [ServiceStatus.CULLED]: 'Descartada'
        };
        return labels[this.status];
    }
    getDaysSinceService() {
        const now = new Date();
        const serviceDate = new Date(this.serviceInfo.serviceDate);
        const diffTime = now.getTime() - serviceDate.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    getEstimatedCalvingDate() {
        if (!this.pregnancyInfo?.pregnancyDiagnosis.expectedCalvingDate) {
            const serviceDate = new Date(this.serviceInfo.serviceDate);
            serviceDate.setDate(serviceDate.getDate() + 280);
            return serviceDate;
        }
        return new Date(this.pregnancyInfo.pregnancyDiagnosis.expectedCalvingDate);
    }
    isNearCalving(days = 14) {
        const estimatedDate = this.getEstimatedCalvingDate();
        if (!estimatedDate)
            return false;
        const now = new Date();
        const diffTime = estimatedDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= days && diffDays >= 0;
    }
    calculateReproductiveEfficiency() {
        let score = 0;
        let factors = 0;
        if (this.serviceInfo.serviceNumber === 1 && this.status === ServiceStatus.CONFIRMED_PREGNANT) {
            score += 30;
        }
        else if (this.serviceInfo.serviceNumber <= 2 && this.status === ServiceStatus.CONFIRMED_PREGNANT) {
            score += 20;
        }
        else if (this.status === ServiceStatus.CONFIRMED_PREGNANT) {
            score += 10;
        }
        factors++;
        if (this.calvingInfo?.gestationLength) {
            const gestationDays = this.calvingInfo.gestationLength;
            if (gestationDays >= 275 && gestationDays <= 285) {
                score += 20;
            }
            else if (gestationDays >= 270 && gestationDays <= 290) {
                score += 15;
            }
            else {
                score += 5;
            }
        }
        factors++;
        if (this.calvingInfo?.calvingDifficulty) {
            if (this.calvingInfo.calvingDifficulty === CalvingDifficulty.EASY) {
                score += 15;
            }
            else if (this.calvingInfo.calvingDifficulty === CalvingDifficulty.SLIGHT_ASSISTANCE) {
                score += 10;
            }
            else {
                score += 2;
            }
        }
        factors++;
        if (this.calfInfo?.viability) {
            if (this.calfInfo.viability === CalfViability.ALIVE_NORMAL) {
                score += 20;
            }
            else if (this.calfInfo.viability === CalfViability.ALIVE_WEAK) {
                score += 10;
            }
            else {
                score += 0;
            }
        }
        factors++;
        if (this.calfInfo?.birthWeight) {
            const birthWeight = this.calfInfo.birthWeight;
            if (birthWeight >= 30 && birthWeight <= 45) {
                score += 15;
            }
            else if (birthWeight >= 25 && birthWeight <= 50) {
                score += 10;
            }
            else {
                score += 2;
            }
        }
        factors++;
        return factors > 0 ? Math.round(score / factors * (100 / 20)) : 0;
    }
    getEconomicROI() {
        if (!this.economicAnalysis)
            return null;
        return this.economicAnalysis.roi;
    }
    isReproductiveCycleComplete() {
        return this.status === ServiceStatus.WEANED ||
            this.status === ServiceStatus.CULLED ||
            (this.isCompleted && this.weaningInfo !== undefined);
    }
    getReproductiveAlerts() {
        const alerts = [];
        if (this.isNearCalving(7)) {
            alerts.push({
                type: 'WARNING',
                category: 'Parto',
                message: 'Parto próximo en menos de 7 días',
                priority: 1
            });
        }
        else if (this.isNearCalving(14)) {
            alerts.push({
                type: 'INFO',
                category: 'Parto',
                message: 'Parto próximo en menos de 14 días',
                priority: 3
            });
        }
        const estimatedDate = this.getEstimatedCalvingDate();
        if (estimatedDate && new Date() > estimatedDate) {
            const overdueDays = Math.ceil((new Date().getTime() - estimatedDate.getTime()) / (1000 * 60 * 60 * 24));
            alerts.push({
                type: overdueDays > 5 ? 'CRITICAL' : 'WARNING',
                category: 'Gestación',
                message: `Gestación prolongada: ${overdueDays} días de retraso`,
                priority: overdueDays > 5 ? 1 : 2
            });
        }
        if (this.serviceInfo.serviceNumber > 3) {
            alerts.push({
                type: 'WARNING',
                category: 'Fertilidad',
                message: `Múltiples servicios: ${this.serviceInfo.serviceNumber}`,
                priority: 2
            });
        }
        if (this.calvingInfo?.calvingComplications && this.calvingInfo.calvingComplications.length > 0) {
            alerts.push({
                type: 'WARNING',
                category: 'Parto',
                message: 'Complicaciones durante el parto',
                priority: 2
            });
        }
        if (this.calfInfo?.viability === CalfViability.ALIVE_WEAK) {
            alerts.push({
                type: 'WARNING',
                category: 'Ternero',
                message: 'Ternero nacido débil, requiere atención',
                priority: 1
            });
        }
        const efficiency = this.calculateReproductiveEfficiency();
        if (efficiency < 60) {
            alerts.push({
                type: 'WARNING',
                category: 'Eficiencia',
                message: `Eficiencia reproductiva baja: ${efficiency}%`,
                priority: 2
            });
        }
        return alerts.sort((a, b) => a.priority - b.priority);
    }
    getReproductiveSummary() {
        const daysSinceService = this.getDaysSinceService();
        const estimatedCalvingDate = this.getEstimatedCalvingDate();
        const daysToCalving = estimatedCalvingDate ?
            Math.ceil((estimatedCalvingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) :
            undefined;
        const efficiency = this.calculateReproductiveEfficiency();
        let efficiencyCategory;
        if (efficiency >= 85)
            efficiencyCategory = 'EXCELLENT';
        else if (efficiency >= 70)
            efficiencyCategory = 'GOOD';
        else if (efficiency >= 50)
            efficiencyCategory = 'FAIR';
        else
            efficiencyCategory = 'POOR';
        const alerts = this.getReproductiveAlerts();
        return {
            basic: {
                code: this.reproductionCode,
                type: this.getReproductionTypeLabel(),
                status: this.getStatusLabel(),
                serviceDate: this.serviceInfo.serviceDate,
                serviceNumber: this.serviceInfo.serviceNumber
            },
            timeline: {
                daysSinceService,
                estimatedCalvingDate: estimatedCalvingDate || undefined,
                daysToCalving,
                isNearCalving: this.isNearCalving()
            },
            genetics: {
                sireName: this.sireInfo.sireName,
                sireBreed: this.sireInfo.sireBreed,
                expectedPerformance: this.geneticAnalysis?.expectedPerformance
            },
            efficiency: {
                score: efficiency,
                category: efficiencyCategory,
                isComplete: this.isReproductiveCycleComplete(),
                isSuccessful: this.isSuccessful
            },
            economic: this.economicAnalysis ? {
                totalCosts: this.economicAnalysis.totalCosts,
                expectedValue: this.economicAnalysis.calfValue,
                roi: this.economicAnalysis.roi
            } : undefined,
            alerts
        };
    }
    calculateCalvingInterval(previousCalvingDate) {
        if (!this.calvingInfo?.calvingDate)
            return null;
        const currentCalving = new Date(this.calvingInfo.calvingDate);
        const diffTime = currentCalving.getTime() - previousCalvingDate.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    needsVeterinaryAttention() {
        const alerts = this.getReproductiveAlerts();
        return alerts.some(alert => alert.type === 'CRITICAL' ||
            (alert.type === 'WARNING' && alert.priority <= 2));
    }
}
Reproduction.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del registro de reproducción'
    },
    reproductionCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [3, 50]
        },
        comment: 'Código único de reproducción'
    },
    damId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'bovines',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID de la madre/vaca'
    },
    reproductionType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ReproductionType)),
        allowNull: false,
        comment: 'Tipo de reproducción'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ServiceStatus)),
        allowNull: false,
        defaultValue: ServiceStatus.PLANNED,
        comment: 'Estado del servicio reproductivo'
    },
    breedingSeasonId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la temporada reproductiva'
    },
    sireInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidSire(value) {
                if (!value.sireName || !value.sireBreed) {
                    throw new Error('Nombre y raza del semental son requeridos');
                }
            }
        },
        comment: 'Información completa del semental'
    },
    germplasmInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de semen/embrión utilizado'
    },
    heatInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información del celo detectado'
    },
    serviceInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidService(value) {
                if (!value.serviceDate || !value.serviceMethod) {
                    throw new Error('Fecha y método de servicio son requeridos');
                }
            }
        },
        comment: 'Información detallada del servicio'
    },
    pregnancyInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de gestación y monitoreo'
    },
    calvingInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información completa del parto'
    },
    calfInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información completa del ternero'
    },
    weaningInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información del destete'
    },
    reproductiveEfficiency: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Métricas de eficiencia reproductiva'
    },
    economicAnalysis: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Análisis económico del ciclo reproductivo'
    },
    geneticAnalysis: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Análisis genético y mejoramiento'
    },
    healthRecords: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Registros de salud durante el ciclo'
    },
    images: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de imágenes del proceso reproductivo'
    },
    documents: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de documentos relacionados'
    },
    videos: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de videos del proceso'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas generales del ciclo reproductivo'
    },
    isCompleted: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el ciclo reproductivo está completo'
    },
    isSuccessful: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el ciclo fue exitoso'
    },
    qualityScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 100
        },
        comment: 'Puntuación de calidad del ciclo (0-100)'
    },
    ranchId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del rancho'
    },
    seasonYear: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 2000,
            max: 3000
        },
        comment: 'Año de la temporada reproductiva'
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
    modelName: 'Reproduction',
    tableName: 'reproduction',
    timestamps: true,
    paranoid: true,
    indexes: [
        {
            unique: true,
            fields: ['reproduction_code']
        },
        {
            fields: ['dam_id']
        },
        {
            fields: ['reproduction_type']
        },
        {
            fields: ['status']
        },
        {
            fields: ['breeding_season_id']
        },
        {
            fields: ['is_completed']
        },
        {
            fields: ['is_successful']
        },
        {
            fields: ['ranch_id']
        },
        {
            fields: ['season_year']
        },
        {
            name: 'reproduction_dam_season',
            fields: ['dam_id', 'season_year']
        },
        {
            name: 'reproduction_status_date',
            fields: ['status', 'created_at']
        },
        {
            name: 'reproduction_type_success',
            fields: ['reproduction_type', 'is_successful']
        },
        {
            name: 'reproduction_sire_analysis',
            fields: ['sire_info'],
            using: 'gin'
        }
    ],
    hooks: {
        beforeSave: async (reproduction) => {
            if (!reproduction.qualityScore) {
                reproduction.qualityScore = reproduction.calculateReproductiveEfficiency();
            }
            if (reproduction.calfInfo?.viability === CalfViability.ALIVE_NORMAL &&
                reproduction.status === ServiceStatus.WEANED) {
                reproduction.isSuccessful = true;
                reproduction.isCompleted = true;
            }
            const serviceDate = new Date(reproduction.serviceInfo.serviceDate);
            if (reproduction.pregnancyInfo?.pregnancyDiagnosis.diagnosisDate) {
                const diagnosisDate = new Date(reproduction.pregnancyInfo.pregnancyDiagnosis.diagnosisDate);
                if (diagnosisDate < serviceDate) {
                    throw new Error('La fecha de diagnóstico no puede ser anterior al servicio');
                }
            }
            if (reproduction.calvingInfo?.calvingDate) {
                const calvingDate = new Date(reproduction.calvingInfo.calvingDate);
                if (calvingDate < serviceDate) {
                    throw new Error('La fecha de parto no puede ser anterior al servicio');
                }
            }
            if (reproduction.weaningInfo?.weaningDate && reproduction.calvingInfo?.calvingDate) {
                const weaningDate = new Date(reproduction.weaningInfo.weaningDate);
                const calvingDate = new Date(reproduction.calvingInfo.calvingDate);
                if (weaningDate < calvingDate) {
                    throw new Error('La fecha de destete no puede ser anterior al parto');
                }
            }
            if (reproduction.serviceInfo.serviceNumber < 1) {
                throw new Error('El número de servicio debe ser mayor a 0');
            }
            if (reproduction.calfInfo?.birthWeight) {
                if (reproduction.calfInfo.birthWeight < 15 || reproduction.calfInfo.birthWeight > 80) {
                    throw new Error('Peso al nacer fuera de rango normal (15-80 kg)');
                }
            }
            if (!reproduction.seasonYear) {
                reproduction.seasonYear = new Date(reproduction.serviceInfo.serviceDate).getFullYear();
            }
        }
    },
    comment: 'Tabla para el manejo completo de ciclos reproductivos bovinos'
});
exports.default = Reproduction;
//# sourceMappingURL=Reproduction.js.map