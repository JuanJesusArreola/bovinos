"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageRequirement = exports.ControlledSubstanceClass = exports.PrescriptionStatus = exports.AdministrationRoute = exports.MedicationType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var MedicationType;
(function (MedicationType) {
    MedicationType["ANTIBIOTIC"] = "ANTIBIOTIC";
    MedicationType["ANTI_INFLAMMATORY"] = "ANTI_INFLAMMATORY";
    MedicationType["ANALGESIC"] = "ANALGESIC";
    MedicationType["ANTIPARASITIC"] = "ANTIPARASITIC";
    MedicationType["ANTIFUNGAL"] = "ANTIFUNGAL";
    MedicationType["ANTIVIRAL"] = "ANTIVIRAL";
    MedicationType["VACCINE"] = "VACCINE";
    MedicationType["VITAMIN"] = "VITAMIN";
    MedicationType["MINERAL"] = "MINERAL";
    MedicationType["HORMONE"] = "HORMONE";
    MedicationType["SEDATIVE"] = "SEDATIVE";
    MedicationType["ANESTHETIC"] = "ANESTHETIC";
    MedicationType["REPRODUCTIVE"] = "REPRODUCTIVE";
    MedicationType["NUTRITIONAL"] = "NUTRITIONAL";
    MedicationType["IMMUNOMODULATOR"] = "IMMUNOMODULATOR";
    MedicationType["ANTIDIARRHEAL"] = "ANTIDIARRHEAL";
    MedicationType["RESPIRATORY"] = "RESPIRATORY";
    MedicationType["CARDIOVASCULAR"] = "CARDIOVASCULAR";
    MedicationType["TOPICAL"] = "TOPICAL";
    MedicationType["DISINFECTANT"] = "DISINFECTANT";
    MedicationType["SUPPLEMENT"] = "SUPPLEMENT";
    MedicationType["PROBIOTIC"] = "PROBIOTIC";
    MedicationType["PREBIOTIC"] = "PREBIOTIC";
    MedicationType["OTHER"] = "OTHER";
})(MedicationType || (exports.MedicationType = MedicationType = {}));
var AdministrationRoute;
(function (AdministrationRoute) {
    AdministrationRoute["ORAL"] = "ORAL";
    AdministrationRoute["INTRAMUSCULAR"] = "INTRAMUSCULAR";
    AdministrationRoute["SUBCUTANEOUS"] = "SUBCUTANEOUS";
    AdministrationRoute["INTRAVENOUS"] = "INTRAVENOUS";
    AdministrationRoute["TOPICAL"] = "TOPICAL";
    AdministrationRoute["INHALATION"] = "INHALATION";
    AdministrationRoute["INTRANASAL"] = "INTRANASAL";
    AdministrationRoute["OPHTHALMIC"] = "OPHTHALMIC";
    AdministrationRoute["OTIC"] = "OTIC";
    AdministrationRoute["RECTAL"] = "RECTAL";
    AdministrationRoute["VAGINAL"] = "VAGINAL";
    AdministrationRoute["INTRAUTERINE"] = "INTRAUTERINE";
    AdministrationRoute["INTRAMAMMARY"] = "INTRAMAMMARY";
    AdministrationRoute["EPIDURAL"] = "EPIDURAL";
    AdministrationRoute["INTRADERMAL"] = "INTRADERMAL";
    AdministrationRoute["INTRAPERITONEAL"] = "INTRAPERITONEAL";
    AdministrationRoute["OTHER"] = "OTHER";
})(AdministrationRoute || (exports.AdministrationRoute = AdministrationRoute = {}));
var PrescriptionStatus;
(function (PrescriptionStatus) {
    PrescriptionStatus["DRAFT"] = "DRAFT";
    PrescriptionStatus["ACTIVE"] = "ACTIVE";
    PrescriptionStatus["COMPLETED"] = "COMPLETED";
    PrescriptionStatus["SUSPENDED"] = "SUSPENDED";
    PrescriptionStatus["CANCELLED"] = "CANCELLED";
    PrescriptionStatus["EXPIRED"] = "EXPIRED";
})(PrescriptionStatus || (exports.PrescriptionStatus = PrescriptionStatus = {}));
var ControlledSubstanceClass;
(function (ControlledSubstanceClass) {
    ControlledSubstanceClass["NONE"] = "NONE";
    ControlledSubstanceClass["CLASS_I"] = "CLASS_I";
    ControlledSubstanceClass["CLASS_II"] = "CLASS_II";
    ControlledSubstanceClass["CLASS_III"] = "CLASS_III";
    ControlledSubstanceClass["CLASS_IV"] = "CLASS_IV";
    ControlledSubstanceClass["CLASS_V"] = "CLASS_V";
})(ControlledSubstanceClass || (exports.ControlledSubstanceClass = ControlledSubstanceClass = {}));
var StorageRequirement;
(function (StorageRequirement) {
    StorageRequirement["ROOM_TEMPERATURE"] = "ROOM_TEMPERATURE";
    StorageRequirement["REFRIGERATED"] = "REFRIGERATED";
    StorageRequirement["FROZEN"] = "FROZEN";
    StorageRequirement["CONTROLLED_TEMPERATURE"] = "CONTROLLED_TEMPERATURE";
    StorageRequirement["PROTECT_FROM_LIGHT"] = "PROTECT_FROM_LIGHT";
    StorageRequirement["PROTECT_FROM_MOISTURE"] = "PROTECT_FROM_MOISTURE";
    StorageRequirement["STORE_UPRIGHT"] = "STORE_UPRIGHT";
    StorageRequirement["DO_NOT_SHAKE"] = "DO_NOT_SHAKE";
    StorageRequirement["SPECIAL_HANDLING"] = "SPECIAL_HANDLING";
})(StorageRequirement || (exports.StorageRequirement = StorageRequirement = {}));
class Medication extends sequelize_1.Model {
    getMedicationTypeLabel() {
        const labels = {
            [MedicationType.ANTIBIOTIC]: 'Antibiótico',
            [MedicationType.ANTI_INFLAMMATORY]: 'Antiinflamatorio',
            [MedicationType.ANALGESIC]: 'Analgésico',
            [MedicationType.ANTIPARASITIC]: 'Antiparasitario',
            [MedicationType.ANTIFUNGAL]: 'Antifúngico',
            [MedicationType.ANTIVIRAL]: 'Antiviral',
            [MedicationType.VACCINE]: 'Vacuna',
            [MedicationType.VITAMIN]: 'Vitamina',
            [MedicationType.MINERAL]: 'Mineral',
            [MedicationType.HORMONE]: 'Hormona',
            [MedicationType.SEDATIVE]: 'Sedante',
            [MedicationType.ANESTHETIC]: 'Anestésico',
            [MedicationType.REPRODUCTIVE]: 'Reproductivo',
            [MedicationType.NUTRITIONAL]: 'Nutricional',
            [MedicationType.IMMUNOMODULATOR]: 'Inmunomodulador',
            [MedicationType.ANTIDIARRHEAL]: 'Antidiarreico',
            [MedicationType.RESPIRATORY]: 'Respiratorio',
            [MedicationType.CARDIOVASCULAR]: 'Cardiovascular',
            [MedicationType.TOPICAL]: 'Tópico',
            [MedicationType.DISINFECTANT]: 'Desinfectante',
            [MedicationType.SUPPLEMENT]: 'Suplemento',
            [MedicationType.PROBIOTIC]: 'Probiótico',
            [MedicationType.PREBIOTIC]: 'Prebiótico',
            [MedicationType.OTHER]: 'Otro'
        };
        return labels[this.type];
    }
    requiresVeterinaryPrescription() {
        return this.regulatoryInfo.veterinaryPrescriptionOnly ||
            this.regulatoryInfo.prescriptionRequired ||
            this.isControlled;
    }
    getWithdrawalPeriod(productType = 'MEAT') {
        if (productType === 'MILK' && this.milkWithdrawalPeriod !== undefined) {
            return this.milkWithdrawalPeriod;
        }
        return this.withdrawalPeriod;
    }
    isCompatibleWithSpecies(species) {
        return this.targetSpecies.includes(species.toUpperCase()) ||
            this.targetSpecies.includes('ALL') ||
            this.targetSpecies.includes('BOVINE');
    }
    getDosageForSpecies(species, indication) {
        const compatibleDosages = this.dosageInfo.filter(dosage => dosage.species.includes(species.toUpperCase()) ||
            dosage.species.includes('ALL') ||
            dosage.species.includes('BOVINE'));
        if (indication) {
            const specificDosage = compatibleDosages.find(dosage => dosage.indication.toLowerCase().includes(indication.toLowerCase()));
            if (specificDosage)
                return specificDosage;
        }
        return compatibleDosages[0] || null;
    }
    calculateDoseForAnimal(weight, species, indication) {
        const dosageInfo = this.getDosageForSpecies(species, indication);
        if (!dosageInfo)
            return null;
        let calculatedDose = dosageInfo.dosage * weight;
        if (dosageInfo.maxDailyDose && calculatedDose > dosageInfo.maxDailyDose) {
            calculatedDose = dosageInfo.maxDailyDose;
        }
        return {
            dose: calculatedDose,
            unit: dosageInfo.dosageUnit,
            frequency: dosageInfo.frequency,
            route: dosageInfo.route,
            duration: dosageInfo.duration
        };
    }
    checkDrugInteractions(otherMedications) {
        const interactions = [];
        if (!this.adverseEffects?.drugInteractions)
            return interactions;
        otherMedications.forEach(med => {
            const genericInteraction = this.adverseEffects?.drugInteractions?.find(interaction => interaction.drug.toLowerCase() === med.genericName.toLowerCase());
            if (genericInteraction) {
                interactions.push({
                    medication: med.genericName,
                    interaction: genericInteraction.interaction,
                    severity: genericInteraction.severity,
                    management: genericInteraction.management
                });
            }
            med.activeIngredients.forEach(ingredient => {
                const ingredientInteraction = this.adverseEffects?.drugInteractions?.find(interaction => interaction.drug.toLowerCase() === ingredient.name.toLowerCase());
                if (ingredientInteraction) {
                    interactions.push({
                        medication: `${med.genericName} (${ingredient.name})`,
                        interaction: ingredientInteraction.interaction,
                        severity: ingredientInteraction.severity,
                        management: ingredientInteraction.management
                    });
                }
            });
        });
        return interactions;
    }
    isExpired(manufacturingDate) {
        const expirationDate = new Date(manufacturingDate);
        expirationDate.setMonth(expirationDate.getMonth() + this.shelfLife);
        return new Date() > expirationDate;
    }
    getStorageRequirementsLabels() {
        const labels = {
            [StorageRequirement.ROOM_TEMPERATURE]: 'Temperatura ambiente',
            [StorageRequirement.REFRIGERATED]: 'Refrigerado (2-8°C)',
            [StorageRequirement.FROZEN]: 'Congelado (-20°C)',
            [StorageRequirement.CONTROLLED_TEMPERATURE]: 'Temperatura controlada',
            [StorageRequirement.PROTECT_FROM_LIGHT]: 'Proteger de la luz',
            [StorageRequirement.PROTECT_FROM_MOISTURE]: 'Proteger de la humedad',
            [StorageRequirement.STORE_UPRIGHT]: 'Almacenar en posición vertical',
            [StorageRequirement.DO_NOT_SHAKE]: 'No agitar',
            [StorageRequirement.SPECIAL_HANDLING]: 'Manejo especial'
        };
        return this.storageRequirements.map(req => labels[req]);
    }
    getSafetyWarnings() {
        const warnings = [];
        if (this.isControlled) {
            warnings.push('Sustancia controlada - Manténgase fuera del alcance de personas no autorizadas');
        }
        if (this.isAntibiotic) {
            warnings.push('Uso responsable de antibióticos - Completar el tratamiento según prescripción');
        }
        if (this.requiresRefrigeration) {
            warnings.push('Mantener refrigerado - No exponer a temperatura ambiente por períodos prolongados');
        }
        if (this.withdrawalPeriod > 0) {
            warnings.push(`Período de retiro: ${this.withdrawalPeriod} días para carne`);
        }
        if (this.milkWithdrawalPeriod && this.milkWithdrawalPeriod > 0) {
            warnings.push(`Período de retiro: ${this.milkWithdrawalPeriod} días para leche`);
        }
        if (this.adverseEffects?.warnings) {
            warnings.push(...this.adverseEffects.warnings);
        }
        return warnings;
    }
    getMedicationSummary() {
        return {
            name: this.brandName || this.genericName,
            type: this.getMedicationTypeLabel(),
            isVaccine: this.isVaccine,
            isAntibiotic: this.isAntibiotic,
            requiresPrescription: this.requiresVeterinaryPrescription(),
            withdrawalPeriod: this.withdrawalPeriod,
            milkWithdrawalPeriod: this.milkWithdrawalPeriod,
            targetSpecies: this.targetSpecies,
            mainIndications: this.indications.slice(0, 3),
            safetyWarnings: this.getSafetyWarnings(),
            storageRequirements: this.getStorageRequirementsLabels(),
            isExpiredSoon: false
        };
    }
    isCompatibleWithConditions(conditions) {
        const warnings = [];
        let compatible = true;
        if (this.contraindications) {
            if (conditions.pregnancy && this.contraindications.some(c => c.toLowerCase().includes('pregnancy') || c.toLowerCase().includes('gestación'))) {
                compatible = false;
                warnings.push('Contraindicado en gestación');
            }
            if (conditions.lactation && this.contraindications.some(c => c.toLowerCase().includes('lactation') || c.toLowerCase().includes('lactancia'))) {
                compatible = false;
                warnings.push('Contraindicado en lactancia');
            }
        }
        if (this.adverseEffects?.precautions) {
            this.adverseEffects.precautions.forEach(precaution => {
                if (conditions.renalImpairment && precaution.toLowerCase().includes('renal')) {
                    warnings.push('Precaución en insuficiencia renal');
                }
                if (conditions.hepaticImpairment && precaution.toLowerCase().includes('hepátic')) {
                    warnings.push('Precaución en insuficiencia hepática');
                }
            });
        }
        return { compatible, warnings };
    }
}
Medication.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del medicamento'
    },
    medicationCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [3, 50]
        },
        comment: 'Código único del medicamento'
    },
    genericName: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 200]
        },
        comment: 'Nombre genérico del medicamento'
    },
    brandName: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: true,
        comment: 'Nombre comercial del medicamento'
    },
    type: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(MedicationType)),
        allowNull: false,
        comment: 'Tipo de medicamento'
    },
    activeIngredients: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidIngredients(value) {
                if (!Array.isArray(value) || value.length === 0) {
                    throw new Error('Debe tener al menos un principio activo');
                }
                value.forEach(ingredient => {
                    if (!ingredient.name || !ingredient.concentration) {
                        throw new Error('Cada principio activo debe tener nombre y concentración');
                    }
                });
            }
        },
        comment: 'Principios activos del medicamento'
    },
    strength: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Concentración o potencia del medicamento'
    },
    dosageForm: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Forma farmacéutica (tableta, inyección, etc.)'
    },
    presentation: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Presentación comercial'
    },
    dosageInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidDosage(value) {
                if (!Array.isArray(value) || value.length === 0) {
                    throw new Error('Debe tener al menos una información de dosificación');
                }
            }
        },
        comment: 'Información de dosificación por especie'
    },
    pharmacologicalInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información farmacológica detallada'
    },
    adverseEffects: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Efectos adversos e interacciones'
    },
    withdrawalPeriod: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 365
        },
        comment: 'Período de retiro para carne (días)'
    },
    milkWithdrawalPeriod: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 0,
            max: 365
        },
        comment: 'Período de retiro para leche (días)'
    },
    storageRequirements: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.ENUM(...Object.values(StorageRequirement))),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Requisitos de almacenamiento'
    },
    storageTemperatureMin: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Temperatura mínima de almacenamiento (°C)'
    },
    storageTemperatureMax: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Temperatura máxima de almacenamiento (°C)'
    },
    shelfLife: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 120
        },
        comment: 'Vida útil en meses'
    },
    regulatoryInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidRegulatory(value) {
                if (!value.controlledSubstance) {
                    throw new Error('Información de sustancia controlada es requerida');
                }
            }
        },
        comment: 'Información regulatoria'
    },
    commercialInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        validate: {
            notEmpty: true,
            isValidCommercial(value) {
                if (!value.manufacturer || !value.brandName) {
                    throw new Error('Fabricante y nombre comercial son requeridos');
                }
            }
        },
        comment: 'Información comercial'
    },
    qualityInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de control de calidad'
    },
    targetSpecies: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Especies objetivo del medicamento'
    },
    indications: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Indicaciones del medicamento'
    },
    contraindications: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        comment: 'Contraindicaciones del medicamento'
    },
    images: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de imágenes del medicamento'
    },
    documents: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de documentos relacionados'
    },
    safetyDataSheet: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL de la hoja de datos de seguridad'
    },
    productInsert: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL del inserto del producto'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales del medicamento'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el medicamento está activo'
    },
    isAvailable: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el medicamento está disponible'
    },
    isControlled: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si es sustancia controlada'
    },
    requiresRefrigeration: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si requiere refrigeración'
    },
    isVaccine: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si es una vacuna'
    },
    isAntibiotic: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si es un antibiótico'
    },
    isPrescriptionOnly: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si requiere receta médica'
    },
    lastUpdated: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de última actualización de información'
    },
    approvedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que aprobó el medicamento'
    },
    approvedDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de aprobación del medicamento'
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
    modelName: 'Medication',
    tableName: 'medications',
    timestamps: true,
    paranoid: true,
    indexes: [
        {
            unique: true,
            fields: ['medication_code']
        },
        {
            fields: ['generic_name']
        },
        {
            fields: ['brand_name']
        },
        {
            fields: ['type']
        },
        {
            fields: ['is_active']
        },
        {
            fields: ['is_available']
        },
        {
            fields: ['is_controlled']
        },
        {
            fields: ['is_vaccine']
        },
        {
            fields: ['is_antibiotic']
        },
        {
            fields: ['is_prescription_only']
        },
        {
            fields: ['withdrawal_period']
        },
        {
            name: 'medications_type_species',
            fields: ['type', 'target_species']
        },
        {
            name: 'medications_controlled_prescription',
            fields: ['is_controlled', 'is_prescription_only']
        },
        {
            name: 'medications_withdrawal_periods',
            fields: ['withdrawal_period', 'milk_withdrawal_period']
        }
    ],
    hooks: {
        beforeSave: async (medication) => {
            if (medication.type === MedicationType.VACCINE) {
                medication.isVaccine = true;
            }
            if (medication.type === MedicationType.ANTIBIOTIC) {
                medication.isAntibiotic = true;
            }
            if (medication.regulatoryInfo.controlledSubstance !== ControlledSubstanceClass.NONE) {
                medication.isControlled = true;
            }
            if (medication.regulatoryInfo.prescriptionRequired ||
                medication.regulatoryInfo.veterinaryPrescriptionOnly) {
                medication.isPrescriptionOnly = true;
            }
            if (medication.storageRequirements.includes(StorageRequirement.REFRIGERATED) ||
                medication.storageRequirements.includes(StorageRequirement.FROZEN)) {
                medication.requiresRefrigeration = true;
            }
            if (medication.storageTemperatureMin !== null && medication.storageTemperatureMin !== undefined &&
                medication.storageTemperatureMax !== null && medication.storageTemperatureMax !== undefined) {
                if (medication.storageTemperatureMin >= medication.storageTemperatureMax) {
                    throw new Error('La temperatura mínima debe ser menor a la temperatura máxima');
                }
            }
            medication.lastUpdated = new Date();
        }
    },
    comment: 'Tabla para el manejo completo de medicamentos veterinarios'
});
exports.default = Medication;
//# sourceMappingURL=Medication.js.map