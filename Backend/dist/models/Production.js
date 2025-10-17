"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeatCut = exports.MilkingMethod = exports.QualityGrade = exports.ProductionStatus = exports.ProductionType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var ProductionType;
(function (ProductionType) {
    ProductionType["MILK"] = "MILK";
    ProductionType["MEAT"] = "MEAT";
    ProductionType["BREEDING"] = "BREEDING";
    ProductionType["CALVES"] = "CALVES";
    ProductionType["LEATHER"] = "LEATHER";
    ProductionType["MANURE"] = "MANURE";
    ProductionType["BIOGAS"] = "BIOGAS";
    ProductionType["SERVICES"] = "SERVICES";
    ProductionType["OTHER"] = "OTHER";
})(ProductionType || (exports.ProductionType = ProductionType = {}));
var ProductionStatus;
(function (ProductionStatus) {
    ProductionStatus["PLANNED"] = "PLANNED";
    ProductionStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ProductionStatus["COMPLETED"] = "COMPLETED";
    ProductionStatus["SUSPENDED"] = "SUSPENDED";
    ProductionStatus["CANCELLED"] = "CANCELLED";
    ProductionStatus["DELAYED"] = "DELAYED";
})(ProductionStatus || (exports.ProductionStatus = ProductionStatus = {}));
var QualityGrade;
(function (QualityGrade) {
    QualityGrade["PREMIUM"] = "PREMIUM";
    QualityGrade["GRADE_A"] = "GRADE_A";
    QualityGrade["GRADE_B"] = "GRADE_B";
    QualityGrade["GRADE_C"] = "GRADE_C";
    QualityGrade["SUBSTANDARD"] = "SUBSTANDARD";
    QualityGrade["REJECTED"] = "REJECTED";
})(QualityGrade || (exports.QualityGrade = QualityGrade = {}));
var MilkingMethod;
(function (MilkingMethod) {
    MilkingMethod["MANUAL"] = "MANUAL";
    MilkingMethod["MECHANICAL"] = "MECHANICAL";
    MilkingMethod["AUTOMATED"] = "AUTOMATED";
    MilkingMethod["ROBOTIC"] = "ROBOTIC";
})(MilkingMethod || (exports.MilkingMethod = MilkingMethod = {}));
var MeatCut;
(function (MeatCut) {
    MeatCut["CARCASS"] = "CARCASS";
    MeatCut["FOREQUARTER"] = "FOREQUARTER";
    MeatCut["HINDQUARTER"] = "HINDQUARTER";
    MeatCut["CHUCK"] = "CHUCK";
    MeatCut["RIB"] = "RIB";
    MeatCut["LOIN"] = "LOIN";
    MeatCut["ROUND"] = "ROUND";
    MeatCut["BRISKET"] = "BRISKET";
    MeatCut["PLATE"] = "PLATE";
    MeatCut["FLANK"] = "FLANK";
    MeatCut["ORGANS"] = "ORGANS";
    MeatCut["OTHER"] = "OTHER";
})(MeatCut || (exports.MeatCut = MeatCut = {}));
class Production extends sequelize_1.Model {
    getProductionTypeLabel() {
        const labels = {
            [ProductionType.MILK]: 'Leche',
            [ProductionType.MEAT]: 'Carne',
            [ProductionType.BREEDING]: 'Reproducción/Cría',
            [ProductionType.CALVES]: 'Terneros',
            [ProductionType.LEATHER]: 'Cuero',
            [ProductionType.MANURE]: 'Estiércol',
            [ProductionType.BIOGAS]: 'Biogás',
            [ProductionType.SERVICES]: 'Servicios',
            [ProductionType.OTHER]: 'Otro'
        };
        return labels[this.productionType];
    }
    getStatusLabel() {
        const labels = {
            [ProductionStatus.PLANNED]: 'Planeada',
            [ProductionStatus.IN_PROGRESS]: 'En Proceso',
            [ProductionStatus.COMPLETED]: 'Completada',
            [ProductionStatus.SUSPENDED]: 'Suspendida',
            [ProductionStatus.CANCELLED]: 'Cancelada',
            [ProductionStatus.DELAYED]: 'Retrasada'
        };
        return labels[this.status];
    }
    getTotalEconomicValue() {
        if (!this.marketInfo)
            return null;
        return this.marketInfo.totalValue;
    }
    getProfitabilityMetrics() {
        if (!this.economicAnalysis)
            return null;
        return {
            grossProfit: this.economicAnalysis.profitability.grossProfit,
            grossMargin: this.economicAnalysis.profitability.grossMargin,
            netProfit: this.economicAnalysis.profitability.netProfit,
            netMargin: this.economicAnalysis.profitability.netMargin,
            roi: this.economicAnalysis.profitability.roi
        };
    }
    meetsQualityStandards() {
        if (!this.qualityMetrics)
            return true;
        return this.qualityMetrics.complianceStatus === 'COMPLIANT' &&
            this.qualityGrade !== QualityGrade.REJECTED &&
            this.qualityGrade !== QualityGrade.SUBSTANDARD;
    }
    getValidCertifications() {
        if (!this.qualityMetrics?.certifications)
            return null;
        const now = new Date();
        return this.qualityMetrics.certifications
            .filter(cert => cert.status === 'VALID' && cert.expirationDate > now)
            .map(cert => ({
            type: cert.type,
            certifyingBody: cert.certifyingBody,
            expirationDate: cert.expirationDate
        }));
    }
    getProductionEfficiency() {
        if (!this.economicAnalysis)
            return null;
        return this.economicAnalysis.efficiency.productionPerAnimal;
    }
    isInPeakSeason() {
        const month = this.productionDate.getMonth();
        if (this.productionType === ProductionType.MILK) {
            return month >= 2 && month <= 4;
        }
        if (this.productionType === ProductionType.MEAT) {
            return month >= 8 && month <= 10;
        }
        return false;
    }
    getSustainabilityScore() {
        if (!this.sustainabilityMetrics)
            return null;
        let score = 0;
        const improvements = [];
        if (this.sustainabilityMetrics.carbonFootprint !== undefined) {
            if (this.sustainabilityMetrics.carbonFootprint < 10)
                score += 30;
            else if (this.sustainabilityMetrics.carbonFootprint < 20)
                score += 20;
            else if (this.sustainabilityMetrics.carbonFootprint < 30)
                score += 10;
            else
                improvements.push('Reducir huella de carbono');
        }
        if (this.sustainabilityMetrics.waterUsage !== undefined) {
            if (this.sustainabilityMetrics.waterUsage < 1000)
                score += 25;
            else if (this.sustainabilityMetrics.waterUsage < 2000)
                score += 15;
            else if (this.sustainabilityMetrics.waterUsage < 3000)
                score += 5;
            else
                improvements.push('Optimizar uso de agua');
        }
        if (this.sustainabilityMetrics.recyclableContent !== undefined) {
            if (this.sustainabilityMetrics.recyclableContent > 80)
                score += 20;
            else if (this.sustainabilityMetrics.recyclableContent > 60)
                score += 15;
            else if (this.sustainabilityMetrics.recyclableContent > 40)
                score += 10;
            else
                improvements.push('Aumentar contenido reciclable');
        }
        if (this.sustainabilityMetrics.organicCertification) {
            score += 25;
        }
        else {
            improvements.push('Considerar certificación orgánica');
        }
        let category;
        if (score >= 80)
            category = 'EXCELLENT';
        else if (score >= 60)
            category = 'GOOD';
        else if (score >= 40)
            category = 'FAIR';
        else
            category = 'POOR';
        return { score, category, improvements };
    }
    generateTraceabilityCode() {
        const date = this.productionDate.toISOString().split('T')[0].replace(/-/g, '');
        const type = this.productionType.substring(0, 3);
        const bovineCode = this.bovineId.substring(0, 8);
        return `${type}-${date}-${bovineCode}-${this.id.substring(0, 6)}`.toUpperCase();
    }
    needsQualityInspection() {
        if (this.marketInfo?.targetMarket === 'EXPORT')
            return true;
        if ((this.productionType === ProductionType.MILK || this.productionType === ProductionType.MEAT) &&
            this.qualityGrade === QualityGrade.PREMIUM)
            return true;
        if (!this.compliance?.inspectionDate)
            return true;
        if (this.compliance.inspectionDate) {
            const daysSinceInspection = Math.floor((new Date().getTime() - new Date(this.compliance.inspectionDate).getTime()) /
                (1000 * 60 * 60 * 24));
            return daysSinceInspection > 30;
        }
        return false;
    }
    getDaysToExpiration() {
        if (!this.storageInfo?.expectedShelfLife)
            return null;
        const storageDate = new Date(this.storageInfo.storageDate);
        const expirationDate = new Date(storageDate);
        expirationDate.setDate(expirationDate.getDate() + this.storageInfo.expectedShelfLife);
        const now = new Date();
        const diffTime = expirationDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    getProductionSummary() {
        const alerts = [];
        if (this.needsQualityInspection()) {
            alerts.push('Requiere inspección de calidad');
        }
        const daysToExpiration = this.getDaysToExpiration();
        if (daysToExpiration !== null && daysToExpiration <= 7) {
            alerts.push(`Vence en ${daysToExpiration} días`);
        }
        if (!this.meetsQualityStandards()) {
            alerts.push('No cumple estándares de calidad');
        }
        const sustainability = this.getSustainabilityScore();
        const profitability = this.getProfitabilityMetrics();
        const validCertifications = this.getValidCertifications();
        return {
            basic: {
                type: this.getProductionTypeLabel(),
                quantity: this.quantity,
                unit: this.unit,
                date: this.productionDate,
                status: this.getStatusLabel()
            },
            quality: {
                grade: this.qualityGrade,
                meetsStandards: this.meetsQualityStandards(),
                certifications: validCertifications?.length || 0
            },
            economic: {
                totalValue: this.getTotalEconomicValue() || undefined,
                profitMargin: profitability?.grossMargin,
                efficiency: this.getProductionEfficiency() || undefined
            },
            sustainability: {
                score: sustainability?.score,
                category: sustainability?.category
            },
            compliance: {
                status: this.compliance?.complianceStatus,
                needsInspection: this.needsQualityInspection()
            },
            alerts
        };
    }
}
Production.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del registro de producción'
    },
    productionCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [3, 50]
        },
        comment: 'Código único de producción'
    },
    productionType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ProductionType)),
        allowNull: false,
        comment: 'Tipo de producción'
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
        comment: 'ID del bovino productor'
    },
    productionDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha de producción'
    },
    quantity: {
        type: sequelize_1.DataTypes.DECIMAL(12, 3),
        allowNull: false,
        validate: {
            min: 0
        },
        comment: 'Cantidad producida'
    },
    unit: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Unidad de medida'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ProductionStatus)),
        allowNull: false,
        defaultValue: ProductionStatus.PLANNED,
        comment: 'Estado de la producción'
    },
    qualityGrade: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(QualityGrade)),
        allowNull: true,
        comment: 'Grado de calidad del producto'
    },
    location: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Ubicación geográfica de la producción'
    },
    milkInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información específica de producción de leche'
    },
    meatInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información específica de producción de carne'
    },
    breedingInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de reproducción y cría'
    },
    qualityMetrics: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Métricas de calidad del producto'
    },
    marketInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de mercado y comercialización'
    },
    economicAnalysis: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Análisis económico de la producción'
    },
    batchNumber: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        comment: 'Número de lote de producción'
    },
    productionShift: {
        type: sequelize_1.DataTypes.ENUM('MORNING', 'AFTERNOON', 'NIGHT'),
        allowNull: true,
        comment: 'Turno de producción'
    },
    weather: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Condiciones climáticas durante la producción'
    },
    equipmentUsed: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Equipos utilizados en la producción'
    },
    personnelInvolved: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Personal involucrado en la producción'
    },
    supervisorId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del supervisor de producción'
    },
    inspectionResults: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Resultados de inspección'
    },
    certifications: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Certificaciones aplicables'
    },
    traceabilityCode: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'Código de trazabilidad único'
    },
    storageInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de almacenamiento'
    },
    processingInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de procesamiento'
    },
    packaging: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de empaque'
    },
    distributionInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de distribución'
    },
    rejectionInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de rechazos'
    },
    compliance: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de cumplimiento regulatorio'
    },
    sustainabilityMetrics: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Métricas de sostenibilidad'
    },
    images: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de imágenes de la producción'
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
        comment: 'URLs de videos de la producción'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales de la producción'
    },
    isCompleted: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si la producción está completa'
    },
    isApproved: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si la producción está aprobada'
    },
    approvedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que aprobó'
    },
    approvedDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de aprobación'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el registro está activo'
    },
    farmId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la finca'
    },
    seasonId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la temporada'
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
    modelName: 'Production',
    tableName: 'production',
    timestamps: true,
    paranoid: true,
    indexes: [
        {
            unique: true,
            fields: ['production_code']
        },
        {
            fields: ['production_type']
        },
        {
            fields: ['bovine_id']
        },
        {
            fields: ['production_date']
        },
        {
            fields: ['status']
        },
        {
            fields: ['quality_grade']
        },
        {
            fields: ['is_completed']
        },
        {
            fields: ['is_approved']
        },
        {
            fields: ['farm_id']
        },
        {
            fields: ['season_id']
        },
        {
            fields: ['traceability_code']
        },
        {
            name: 'production_bovine_date',
            fields: ['bovine_id', 'production_date']
        },
        {
            name: 'production_type_date',
            fields: ['production_type', 'production_date']
        },
        {
            name: 'production_status_date',
            fields: ['status', 'production_date']
        },
        {
            name: 'production_location_gin',
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
        beforeSave: async (production) => {
            if (!production.traceabilityCode) {
                production.traceabilityCode = production.generateTraceabilityCode();
            }
            if (production.productionDate > new Date()) {
                throw new Error('La fecha de producción no puede ser futura');
            }
            if (production.quantity <= 0) {
                throw new Error('La cantidad debe ser mayor a cero');
            }
            if (production.status === ProductionStatus.COMPLETED && !production.isCompleted) {
                production.isCompleted = true;
            }
            if (production.productionType === ProductionType.MILK && production.milkInfo) {
                if (production.milkInfo.volume <= 0) {
                    throw new Error('El volumen de leche debe ser mayor a cero');
                }
            }
            if (production.productionType === ProductionType.MEAT && production.meatInfo) {
                if (production.meatInfo.liveWeight <= 0 || production.meatInfo.carcassWeight <= 0) {
                    throw new Error('Los pesos deben ser mayores a cero');
                }
                if (production.meatInfo.carcassWeight > production.meatInfo.liveWeight) {
                    throw new Error('El peso de canal no puede ser mayor al peso vivo');
                }
            }
        }
    },
    comment: 'Tabla para el manejo completo de la producción ganadera'
});
exports.default = Production;
//# sourceMappingURL=Production.js.map