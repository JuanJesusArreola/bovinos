"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificationType = exports.ClimateZone = exports.LandTenure = exports.RanchStatus = exports.RanchType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var RanchType;
(function (RanchType) {
    RanchType["DAIRY"] = "DAIRY";
    RanchType["BEEF"] = "BEEF";
    RanchType["MIXED"] = "MIXED";
    RanchType["BREEDING"] = "BREEDING";
    RanchType["FEEDLOT"] = "FEEDLOT";
    RanchType["ORGANIC"] = "ORGANIC";
    RanchType["SUSTAINABLE"] = "SUSTAINABLE";
    RanchType["COMMERCIAL"] = "COMMERCIAL";
    RanchType["FAMILY_FARM"] = "FAMILY_FARM";
    RanchType["COOPERATIVE"] = "COOPERATIVE";
    RanchType["CORPORATE"] = "CORPORATE";
    RanchType["RESEARCH"] = "RESEARCH";
    RanchType["EDUCATIONAL"] = "EDUCATIONAL";
})(RanchType || (exports.RanchType = RanchType = {}));
var RanchStatus;
(function (RanchStatus) {
    RanchStatus["ACTIVE"] = "ACTIVE";
    RanchStatus["INACTIVE"] = "INACTIVE";
    RanchStatus["UNDER_CONSTRUCTION"] = "UNDER_CONSTRUCTION";
    RanchStatus["RENOVATION"] = "RENOVATION";
    RanchStatus["TEMPORARY_CLOSURE"] = "TEMPORARY_CLOSURE";
    RanchStatus["PERMANENT_CLOSURE"] = "PERMANENT_CLOSURE";
    RanchStatus["QUARANTINE"] = "QUARANTINE";
    RanchStatus["SUSPENDED"] = "SUSPENDED";
    RanchStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
})(RanchStatus || (exports.RanchStatus = RanchStatus = {}));
var LandTenure;
(function (LandTenure) {
    LandTenure["OWNED"] = "OWNED";
    LandTenure["LEASED"] = "LEASED";
    LandTenure["SHARED"] = "SHARED";
    LandTenure["EJIDAL"] = "EJIDAL";
    LandTenure["COMMUNAL"] = "COMMUNAL";
    LandTenure["CONCESSION"] = "CONCESSION";
    LandTenure["COOPERATIVE"] = "COOPERATIVE";
    LandTenure["MIXED_TENURE"] = "MIXED_TENURE";
})(LandTenure || (exports.LandTenure = LandTenure = {}));
var ClimateZone;
(function (ClimateZone) {
    ClimateZone["TROPICAL"] = "TROPICAL";
    ClimateZone["SUBTROPICAL"] = "SUBTROPICAL";
    ClimateZone["TEMPERATE"] = "TEMPERATE";
    ClimateZone["ARID"] = "ARID";
    ClimateZone["SEMI_ARID"] = "SEMI_ARID";
    ClimateZone["HUMID"] = "HUMID";
    ClimateZone["SEMI_HUMID"] = "SEMI_HUMID";
    ClimateZone["HIGHLAND"] = "HIGHLAND";
    ClimateZone["COASTAL"] = "COASTAL";
})(ClimateZone || (exports.ClimateZone = ClimateZone = {}));
var CertificationType;
(function (CertificationType) {
    CertificationType["ORGANIC"] = "ORGANIC";
    CertificationType["FAIR_TRADE"] = "FAIR_TRADE";
    CertificationType["ANIMAL_WELFARE"] = "ANIMAL_WELFARE";
    CertificationType["ENVIRONMENTAL"] = "ENVIRONMENTAL";
    CertificationType["QUALITY_ASSURANCE"] = "QUALITY_ASSURANCE";
    CertificationType["HALAL"] = "HALAL";
    CertificationType["KOSHER"] = "KOSHER";
    CertificationType["NON_GMO"] = "NON_GMO";
    CertificationType["SUSTAINABLE"] = "SUSTAINABLE";
    CertificationType["CARBON_NEUTRAL"] = "CARBON_NEUTRAL";
    CertificationType["GRASS_FED"] = "GRASS_FED";
    CertificationType["ANTIBIOTIC_FREE"] = "ANTIBIOTIC_FREE";
})(CertificationType || (exports.CertificationType = CertificationType = {}));
class Ranch extends sequelize_1.Model {
    getRanchTypeLabel() {
        const labels = {
            [RanchType.DAIRY]: 'Lechero',
            [RanchType.BEEF]: 'Carne',
            [RanchType.MIXED]: 'Mixto',
            [RanchType.BREEDING]: 'Reproducción/Cría',
            [RanchType.FEEDLOT]: 'Engorda',
            [RanchType.ORGANIC]: 'Orgánico',
            [RanchType.SUSTAINABLE]: 'Sostenible',
            [RanchType.COMMERCIAL]: 'Comercial',
            [RanchType.FAMILY_FARM]: 'Familiar',
            [RanchType.COOPERATIVE]: 'Cooperativa',
            [RanchType.CORPORATE]: 'Corporativo',
            [RanchType.RESEARCH]: 'Investigación',
            [RanchType.EDUCATIONAL]: 'Educativo'
        };
        return labels[this.type];
    }
    getStatusLabel() {
        const labels = {
            [RanchStatus.ACTIVE]: 'Activo',
            [RanchStatus.INACTIVE]: 'Inactivo',
            [RanchStatus.UNDER_CONSTRUCTION]: 'En Construcción',
            [RanchStatus.RENOVATION]: 'En Renovación',
            [RanchStatus.TEMPORARY_CLOSURE]: 'Cierre Temporal',
            [RanchStatus.PERMANENT_CLOSURE]: 'Cierre Permanente',
            [RanchStatus.QUARANTINE]: 'En Cuarentena',
            [RanchStatus.SUSPENDED]: 'Suspendido',
            [RanchStatus.PENDING_APPROVAL]: 'Pendiente de Aprobación'
        };
        return labels[this.status];
    }
    getOccupancyRate() {
        if (this.capacity.maxCattleCapacity === 0)
            return 0;
        return (this.capacity.currentCattleCount / this.capacity.maxCattleCapacity) * 100;
    }
    getAvailableCapacity() {
        return Math.max(0, this.capacity.maxCattleCapacity - this.capacity.currentCattleCount);
    }
    isAtCapacity() {
        return this.capacity.currentCattleCount >= this.capacity.maxCattleCapacity;
    }
    getCattleDensity() {
        if (this.capacity.grazingArea === 0)
            return 0;
        return this.capacity.currentCattleCount / this.capacity.grazingArea;
    }
    getValidCertifications() {
        if (!this.certifications)
            return [];
        const now = new Date();
        return this.certifications
            .filter(cert => cert.status === 'VALID' && cert.expirationDate > now)
            .map(cert => ({
            type: cert.type,
            certifyingBody: cert.certifyingBody,
            expirationDate: cert.expirationDate,
            daysToExpiration: Math.ceil((cert.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        }));
    }
    getValidLicenses() {
        if (!this.licenses)
            return [];
        const now = new Date();
        return this.licenses
            .filter(license => license.status === 'VALID' && license.expirationDate > now)
            .map(license => ({
            type: license.type,
            authority: license.authority,
            expirationDate: license.expirationDate,
            daysToExpiration: Math.ceil((license.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        }));
    }
    getSustainabilityScore() {
        if (!this.sustainabilityInfo) {
            return {
                score: 0,
                category: 'POOR',
                breakdown: { carbon: 0, water: 0, energy: 0, waste: 0, biodiversity: 0 }
            };
        }
        const breakdown = {
            carbon: this.sustainabilityInfo.carbonFootprint ? Math.max(0, 100 - (this.sustainabilityInfo.carbonFootprint / 10)) : 50,
            water: this.sustainabilityInfo.waterUsageEfficiency ? this.sustainabilityInfo.waterUsageEfficiency : 50,
            energy: this.sustainabilityInfo.renewableEnergyPercentage || 0,
            waste: this.sustainabilityInfo.wasteManagement.recyclingRate || 0,
            biodiversity: this.sustainabilityInfo.biodiversityIndex ? this.sustainabilityInfo.biodiversityIndex * 10 : 50
        };
        const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0) / 5;
        let category;
        if (score >= 80)
            category = 'EXCELLENT';
        else if (score >= 60)
            category = 'GOOD';
        else if (score >= 40)
            category = 'FAIR';
        else
            category = 'POOR';
        return { score: Math.round(score), category, breakdown };
    }
    getEconomicEfficiency() {
        if (!this.financialInfo || !this.productionMetrics)
            return null;
        const profitability = this.financialInfo.profitMargin || 0;
        const revenuePerAnimal = this.financialInfo.annualRevenue ?
            this.financialInfo.annualRevenue / this.capacity.currentCattleCount : 0;
        const efficiency = (profitability + (revenuePerAnimal / 1000)) / 2;
        let category;
        if (efficiency >= 70)
            category = 'HIGH';
        else if (efficiency >= 40)
            category = 'MEDIUM';
        else
            category = 'LOW';
        return {
            profitability: Math.round(profitability),
            efficiency: Math.round(efficiency),
            category
        };
    }
    needsInspection() {
        if (!this.nextInspectionDate)
            return true;
        return new Date() >= new Date(this.nextInspectionDate);
    }
    getActiveAlerts() {
        const alerts = [];
        const occupancy = this.getOccupancyRate();
        if (occupancy >= 95) {
            alerts.push({
                type: 'CRITICAL',
                category: 'Capacidad',
                message: 'Rancho en capacidad máxima',
                priority: 1
            });
        }
        else if (occupancy >= 85) {
            alerts.push({
                type: 'WARNING',
                category: 'Capacidad',
                message: 'Capacidad del rancho alta',
                priority: 2
            });
        }
        const validCertifications = this.getValidCertifications();
        validCertifications.forEach(cert => {
            if (cert.daysToExpiration <= 30) {
                alerts.push({
                    type: cert.daysToExpiration <= 7 ? 'CRITICAL' : 'WARNING',
                    category: 'Certificación',
                    message: `Certificación ${cert.type} vence en ${cert.daysToExpiration} días`,
                    priority: cert.daysToExpiration <= 7 ? 1 : 2
                });
            }
        });
        const validLicenses = this.getValidLicenses();
        validLicenses.forEach(license => {
            if (license.daysToExpiration <= 30) {
                alerts.push({
                    type: license.daysToExpiration <= 7 ? 'CRITICAL' : 'WARNING',
                    category: 'Licencia',
                    message: `Licencia ${license.type} vence en ${license.daysToExpiration} días`,
                    priority: license.daysToExpiration <= 7 ? 1 : 2
                });
            }
        });
        if (this.needsInspection()) {
            alerts.push({
                type: 'WARNING',
                category: 'Inspección',
                message: 'Inspección vencida o programada',
                priority: 2
            });
        }
        if (this.complianceScore !== undefined && this.complianceScore < 70) {
            alerts.push({
                type: this.complianceScore < 50 ? 'CRITICAL' : 'WARNING',
                category: 'Cumplimiento',
                message: `Puntuación de cumplimiento baja: ${this.complianceScore}%`,
                priority: this.complianceScore < 50 ? 1 : 2
            });
        }
        return alerts.sort((a, b) => a.priority - b.priority);
    }
    getRanchSummary() {
        const sustainability = this.getSustainabilityScore();
        const economic = this.getEconomicEfficiency();
        const alerts = this.getActiveAlerts();
        return {
            basic: {
                name: this.name,
                type: this.getRanchTypeLabel(),
                status: this.getStatusLabel(),
                area: this.capacity.totalArea,
                location: `${this.city}, ${this.state}, ${this.country}`
            },
            capacity: {
                current: this.capacity.currentCattleCount,
                maximum: this.capacity.maxCattleCapacity,
                occupancyRate: Math.round(this.getOccupancyRate()),
                available: this.getAvailableCapacity(),
                density: Math.round(this.getCattleDensity() * 100) / 100
            },
            compliance: {
                isVerified: this.isVerified,
                certifications: this.getValidCertifications().length,
                licenses: this.getValidLicenses().length,
                complianceScore: this.complianceScore,
                needsInspection: this.needsInspection()
            },
            sustainability: {
                score: sustainability.score,
                category: sustainability.category
            },
            economic: economic ? {
                profitability: economic.profitability,
                efficiency: economic.efficiency,
                category: economic.category
            } : undefined,
            alerts
        };
    }
    getFullAddress() {
        const parts = [this.address, this.city, this.state, this.country];
        if (this.postalCode)
            parts.splice(-1, 0, this.postalCode);
        return parts.join(', ');
    }
    isOperational() {
        return this.isActive &&
            this.status === RanchStatus.ACTIVE &&
            this.isVerified;
    }
}
Ranch.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del rancho'
    },
    ranchCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [3, 50]
        },
        comment: 'Código único del rancho'
    },
    name: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [3, 200]
        },
        comment: 'Nombre del rancho'
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción del rancho'
    },
    type: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(RanchType)),
        allowNull: false,
        comment: 'Tipo de rancho'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(RanchStatus)),
        allowNull: false,
        defaultValue: RanchStatus.ACTIVE,
        comment: 'Estado del rancho'
    },
    coordinates: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            isValidCoordinates(value) {
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
        comment: 'Coordenadas geográficas principales del rancho'
    },
    address: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Dirección física del rancho'
    },
    city: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Ciudad donde se ubica el rancho'
    },
    state: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Estado o provincia del rancho'
    },
    country: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'México',
        comment: 'País donde se ubica el rancho'
    },
    postalCode: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: true,
        comment: 'Código postal'
    },
    timezone: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'America/Mexico_City',
        comment: 'Zona horaria del rancho'
    },
    landTenure: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(LandTenure)),
        allowNull: false,
        comment: 'Tipo de tenencia de la tierra'
    },
    climateZone: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ClimateZone)),
        allowNull: false,
        comment: 'Zona climática del rancho'
    },
    elevation: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        comment: 'Elevación sobre el nivel del mar (metros)'
    },
    annualRainfall: {
        type: sequelize_1.DataTypes.DECIMAL(8, 2),
        allowNull: true,
        validate: {
            min: 0
        },
        comment: 'Precipitación anual promedio (mm)'
    },
    averageTemperature: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Temperatura promedio anual (°C)'
    },
    ownershipInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidOwnership(value) {
                if (!value.ownerName || !value.ownerContact) {
                    throw new Error('Información del propietario es requerida');
                }
            }
        },
        comment: 'Información del propietario y estructura legal'
    },
    capacity: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidCapacity(value) {
                if (value.totalArea <= 0 || value.maxCattleCapacity <= 0) {
                    throw new Error('Área total y capacidad máxima deben ser mayores a cero');
                }
                if (value.currentCattleCount > value.maxCattleCapacity) {
                    throw new Error('El ganado actual no puede exceder la capacidad máxima');
                }
            }
        },
        comment: 'Capacidades e infraestructura del rancho'
    },
    productionMetrics: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Métricas de producción del rancho'
    },
    financialInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información financiera del rancho'
    },
    sustainabilityInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de sostenibilidad y medio ambiente'
    },
    technologyInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de tecnología e innovación'
    },
    hrInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de recursos humanos'
    },
    certifications: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Certificaciones del rancho'
    },
    licenses: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Licencias y permisos del rancho'
    },
    insurance: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de seguros'
    },
    emergencyPlan: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Plan de emergencias del rancho'
    },
    qualityStandards: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Estándares de calidad aplicados'
    },
    marketPosition: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Posición en el mercado'
    },
    images: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de imágenes del rancho'
    },
    documents: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de documentos relacionados'
    },
    maps: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de mapas del rancho'
    },
    videos: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de videos del rancho'
    },
    website: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        validate: {
            isUrl: true
        },
        comment: 'Sitio web del rancho'
    },
    socialMedia: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Perfiles de redes sociales'
    },
    tags: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Etiquetas para categorización'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales del rancho'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el rancho está activo'
    },
    isVerified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si el rancho está verificado'
    },
    verifiedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que verificó'
    },
    verifiedDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de verificación'
    },
    lastInspectionDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de la última inspección'
    },
    nextInspectionDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de la próxima inspección'
    },
    complianceScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 100
        },
        comment: 'Puntuación de cumplimiento (0-100)'
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        comment: 'ID del usuario que creó el rancho'
    },
    updatedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que actualizó el rancho'
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
    modelName: 'Ranch',
    tableName: 'ranches',
    timestamps: true,
    paranoid: true,
    indexes: [
        {
            unique: true,
            fields: ['ranch_code']
        },
        {
            fields: ['name']
        },
        {
            fields: ['type']
        },
        {
            fields: ['status']
        },
        {
            fields: ['land_tenure']
        },
        {
            fields: ['climate_zone']
        },
        {
            fields: ['city']
        },
        {
            fields: ['state']
        },
        {
            fields: ['country']
        },
        {
            fields: ['is_active']
        },
        {
            fields: ['is_verified']
        },
        {
            fields: ['next_inspection_date']
        },
        {
            fields: ['compliance_score']
        },
        {
            name: 'ranches_coordinates_gin',
            fields: ['coordinates'],
            using: 'gin'
        },
        {
            name: 'ranches_type_status',
            fields: ['type', 'status']
        },
        {
            name: 'ranches_location_search',
            fields: ['city', 'state', 'country']
        },
        {
            name: 'ranches_capacity_search',
            fields: ['type', 'is_active'],
            where: {
                is_active: true
            }
        }
    ],
    hooks: {
        beforeSave: async (ranch) => {
            if (ranch.lastInspectionDate && ranch.nextInspectionDate) {
                if (ranch.nextInspectionDate <= ranch.lastInspectionDate) {
                    throw new Error('La próxima inspección debe ser posterior a la última');
                }
            }
            if (ranch.isVerified) {
                if (!ranch.verifiedBy || !ranch.verifiedDate) {
                    throw new Error('Rancho verificado debe tener información de verificación');
                }
            }
            if (ranch.financialInfo) {
                const fi = ranch.financialInfo;
                if (fi.annualRevenue && fi.annualExpenses && fi.netProfit) {
                    const calculatedProfit = fi.annualRevenue - fi.annualExpenses;
                    if (Math.abs(calculatedProfit - fi.netProfit) > 1000) {
                        throw new Error('Ganancia neta no coincide con ingresos menos gastos');
                    }
                }
            }
            if (ranch.capacity.grazingArea > ranch.capacity.totalArea) {
                throw new Error('Área de pastoreo no puede ser mayor al área total');
            }
            if (ranch.country === 'México') {
                const { latitude, longitude } = ranch.coordinates;
                if (latitude < 14.5 || latitude > 32.7 || longitude < -118.4 || longitude > -86.7) {
                    throw new Error('Coordenadas fuera del territorio mexicano');
                }
            }
        }
    },
    comment: 'Tabla principal para el manejo de ranchos/fincas ganaderas'
});
exports.default = Ranch;
//# sourceMappingURL=Ranch.js.map