"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetStatus = exports.RecurrenceFrequency = exports.TransactionStatus = exports.PaymentMethod = exports.ExpenseCategory = exports.IncomeCategory = exports.TransactionType = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var TransactionType;
(function (TransactionType) {
    TransactionType["INCOME"] = "INCOME";
    TransactionType["EXPENSE"] = "EXPENSE";
    TransactionType["TRANSFER"] = "TRANSFER";
    TransactionType["ADJUSTMENT"] = "ADJUSTMENT";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var IncomeCategory;
(function (IncomeCategory) {
    IncomeCategory["CATTLE_SALE"] = "CATTLE_SALE";
    IncomeCategory["MILK_PRODUCTION"] = "MILK_PRODUCTION";
    IncomeCategory["MEAT_PRODUCTION"] = "MEAT_PRODUCTION";
    IncomeCategory["BREEDING_SERVICES"] = "BREEDING_SERVICES";
    IncomeCategory["RENTAL_INCOME"] = "RENTAL_INCOME";
    IncomeCategory["GOVERNMENT_SUBSIDIES"] = "GOVERNMENT_SUBSIDIES";
    IncomeCategory["INSURANCE_CLAIMS"] = "INSURANCE_CLAIMS";
    IncomeCategory["CONSULTATION_SERVICES"] = "CONSULTATION_SERVICES";
    IncomeCategory["EQUIPMENT_SALE"] = "EQUIPMENT_SALE";
    IncomeCategory["OTHER_INCOME"] = "OTHER_INCOME";
})(IncomeCategory || (exports.IncomeCategory = IncomeCategory = {}));
var ExpenseCategory;
(function (ExpenseCategory) {
    ExpenseCategory["FEED_PURCHASE"] = "FEED_PURCHASE";
    ExpenseCategory["VETERINARY_SERVICES"] = "VETERINARY_SERVICES";
    ExpenseCategory["MEDICATION"] = "MEDICATION";
    ExpenseCategory["VACCINATION"] = "VACCINATION";
    ExpenseCategory["CATTLE_PURCHASE"] = "CATTLE_PURCHASE";
    ExpenseCategory["EQUIPMENT_PURCHASE"] = "EQUIPMENT_PURCHASE";
    ExpenseCategory["FACILITY_MAINTENANCE"] = "FACILITY_MAINTENANCE";
    ExpenseCategory["LABOR_COSTS"] = "LABOR_COSTS";
    ExpenseCategory["UTILITIES"] = "UTILITIES";
    ExpenseCategory["FUEL_COSTS"] = "FUEL_COSTS";
    ExpenseCategory["INSURANCE_PREMIUMS"] = "INSURANCE_PREMIUMS";
    ExpenseCategory["TRANSPORTATION"] = "TRANSPORTATION";
    ExpenseCategory["PROPERTY_TAXES"] = "PROPERTY_TAXES";
    ExpenseCategory["LICENSING_FEES"] = "LICENSING_FEES";
    ExpenseCategory["PROFESSIONAL_SERVICES"] = "PROFESSIONAL_SERVICES";
    ExpenseCategory["MARKETING_ADVERTISING"] = "MARKETING_ADVERTISING";
    ExpenseCategory["OFFICE_SUPPLIES"] = "OFFICE_SUPPLIES";
    ExpenseCategory["TECHNOLOGY_SOFTWARE"] = "TECHNOLOGY_SOFTWARE";
    ExpenseCategory["RESEARCH_DEVELOPMENT"] = "RESEARCH_DEVELOPMENT";
    ExpenseCategory["OTHER_EXPENSES"] = "OTHER_EXPENSES";
})(ExpenseCategory || (exports.ExpenseCategory = ExpenseCategory = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
    PaymentMethod["CHECK"] = "CHECK";
    PaymentMethod["CREDIT_CARD"] = "CREDIT_CARD";
    PaymentMethod["DEBIT_CARD"] = "DEBIT_CARD";
    PaymentMethod["DIGITAL_WALLET"] = "DIGITAL_WALLET";
    PaymentMethod["CRYPTOCURRENCY"] = "CRYPTOCURRENCY";
    PaymentMethod["BARTER"] = "BARTER";
    PaymentMethod["CREDIT_NOTE"] = "CREDIT_NOTE";
    PaymentMethod["OTHER"] = "OTHER";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "PENDING";
    TransactionStatus["COMPLETED"] = "COMPLETED";
    TransactionStatus["CANCELLED"] = "CANCELLED";
    TransactionStatus["FAILED"] = "FAILED";
    TransactionStatus["REFUNDED"] = "REFUNDED";
    TransactionStatus["PARTIAL"] = "PARTIAL";
    TransactionStatus["OVERDUE"] = "OVERDUE";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var RecurrenceFrequency;
(function (RecurrenceFrequency) {
    RecurrenceFrequency["NONE"] = "NONE";
    RecurrenceFrequency["DAILY"] = "DAILY";
    RecurrenceFrequency["WEEKLY"] = "WEEKLY";
    RecurrenceFrequency["MONTHLY"] = "MONTHLY";
    RecurrenceFrequency["QUARTERLY"] = "QUARTERLY";
    RecurrenceFrequency["YEARLY"] = "YEARLY";
})(RecurrenceFrequency || (exports.RecurrenceFrequency = RecurrenceFrequency = {}));
var BudgetStatus;
(function (BudgetStatus) {
    BudgetStatus["ACTIVE"] = "ACTIVE";
    BudgetStatus["INACTIVE"] = "INACTIVE";
    BudgetStatus["EXCEEDED"] = "EXCEEDED";
    BudgetStatus["COMPLETED"] = "COMPLETED";
})(BudgetStatus || (exports.BudgetStatus = BudgetStatus = {}));
class Finance extends sequelize_1.Model {
    getBaseAmount(baseCurrency = 'MXN') {
        if (this.currency === baseCurrency) {
            return this.amount;
        }
        if (this.baseAmount) {
            return this.baseAmount;
        }
        if (this.exchangeRate) {
            return this.amount * this.exchangeRate;
        }
        return this.amount;
    }
    isOverdue() {
        if (!this.dueDate || this.status === TransactionStatus.COMPLETED) {
            return false;
        }
        return new Date() > new Date(this.dueDate);
    }
    getDaysUntilDue() {
        if (!this.dueDate)
            return null;
        const now = new Date();
        const due = new Date(this.dueDate);
        const diffTime = due.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    getTransactionTypeLabel() {
        const labels = {
            [TransactionType.INCOME]: 'Ingreso',
            [TransactionType.EXPENSE]: 'Gasto',
            [TransactionType.TRANSFER]: 'Transferencia',
            [TransactionType.ADJUSTMENT]: 'Ajuste'
        };
        return labels[this.transactionType];
    }
    getCategoryLabel() {
        const incomeLabels = {
            [IncomeCategory.CATTLE_SALE]: 'Venta de Ganado',
            [IncomeCategory.MILK_PRODUCTION]: 'Producción de Leche',
            [IncomeCategory.MEAT_PRODUCTION]: 'Producción de Carne',
            [IncomeCategory.BREEDING_SERVICES]: 'Servicios de Reproducción',
            [IncomeCategory.RENTAL_INCOME]: 'Ingresos por Alquiler',
            [IncomeCategory.GOVERNMENT_SUBSIDIES]: 'Subsidios Gubernamentales',
            [IncomeCategory.INSURANCE_CLAIMS]: 'Reclamaciones de Seguro',
            [IncomeCategory.CONSULTATION_SERVICES]: 'Servicios de Consultoría',
            [IncomeCategory.EQUIPMENT_SALE]: 'Venta de Equipo',
            [IncomeCategory.OTHER_INCOME]: 'Otros Ingresos'
        };
        const expenseLabels = {
            [ExpenseCategory.FEED_PURCHASE]: 'Compra de Alimento',
            [ExpenseCategory.VETERINARY_SERVICES]: 'Servicios Veterinarios',
            [ExpenseCategory.MEDICATION]: 'Medicamentos',
            [ExpenseCategory.VACCINATION]: 'Vacunaciones',
            [ExpenseCategory.CATTLE_PURCHASE]: 'Compra de Ganado',
            [ExpenseCategory.EQUIPMENT_PURCHASE]: 'Compra de Equipo',
            [ExpenseCategory.FACILITY_MAINTENANCE]: 'Mantenimiento de Instalaciones',
            [ExpenseCategory.LABOR_COSTS]: 'Costos de Mano de Obra',
            [ExpenseCategory.UTILITIES]: 'Servicios Públicos',
            [ExpenseCategory.FUEL_COSTS]: 'Combustible',
            [ExpenseCategory.INSURANCE_PREMIUMS]: 'Primas de Seguro',
            [ExpenseCategory.TRANSPORTATION]: 'Transporte',
            [ExpenseCategory.PROPERTY_TAXES]: 'Impuestos sobre la Propiedad',
            [ExpenseCategory.LICENSING_FEES]: 'Tarifas de Licencias',
            [ExpenseCategory.PROFESSIONAL_SERVICES]: 'Servicios Profesionales',
            [ExpenseCategory.MARKETING_ADVERTISING]: 'Marketing y Publicidad',
            [ExpenseCategory.OFFICE_SUPPLIES]: 'Suministros de Oficina',
            [ExpenseCategory.TECHNOLOGY_SOFTWARE]: 'Tecnología y Software',
            [ExpenseCategory.RESEARCH_DEVELOPMENT]: 'Investigación y Desarrollo',
            [ExpenseCategory.OTHER_EXPENSES]: 'Otros Gastos'
        };
        if (this.transactionType === TransactionType.INCOME) {
            return incomeLabels[this.category] || 'Categoría Desconocida';
        }
        return expenseLabels[this.category] || 'Categoría Desconocida';
    }
    getStatusLabel() {
        const labels = {
            [TransactionStatus.PENDING]: 'Pendiente',
            [TransactionStatus.COMPLETED]: 'Completada',
            [TransactionStatus.CANCELLED]: 'Cancelada',
            [TransactionStatus.FAILED]: 'Fallida',
            [TransactionStatus.REFUNDED]: 'Reembolsada',
            [TransactionStatus.PARTIAL]: 'Parcial',
            [TransactionStatus.OVERDUE]: 'Vencida'
        };
        return labels[this.status];
    }
    getPaymentMethodLabel() {
        const labels = {
            [PaymentMethod.CASH]: 'Efectivo',
            [PaymentMethod.BANK_TRANSFER]: 'Transferencia Bancaria',
            [PaymentMethod.CHECK]: 'Cheque',
            [PaymentMethod.CREDIT_CARD]: 'Tarjeta de Crédito',
            [PaymentMethod.DEBIT_CARD]: 'Tarjeta de Débito',
            [PaymentMethod.DIGITAL_WALLET]: 'Billetera Digital',
            [PaymentMethod.CRYPTOCURRENCY]: 'Criptomoneda',
            [PaymentMethod.BARTER]: 'Trueque',
            [PaymentMethod.CREDIT_NOTE]: 'Nota de Crédito',
            [PaymentMethod.OTHER]: 'Otro'
        };
        return labels[this.paymentMethod];
    }
    isVeterinaryTransaction() {
        const veterinaryCategories = [
            ExpenseCategory.VETERINARY_SERVICES,
            ExpenseCategory.MEDICATION,
            ExpenseCategory.VACCINATION
        ];
        return veterinaryCategories.includes(this.category);
    }
    calculateProfitMargin(associatedCosts = 0) {
        if (this.transactionType !== TransactionType.INCOME)
            return null;
        if (this.amount <= associatedCosts)
            return 0;
        return ((this.amount - associatedCosts) / this.amount) * 100;
    }
    getBudgetStatus() {
        if (!this.budgetInfo?.allocatedAmount)
            return null;
        const percentageUsed = this.budgetInfo.percentageUsed || 0;
        const remainingAmount = this.budgetInfo.remainingAmount || 0;
        return {
            isWithinBudget: percentageUsed <= 100,
            percentageUsed,
            remainingAmount
        };
    }
    generateNextRecurringTransaction() {
        if (!this.isRecurring || !this.recurrence || this.recurrence.frequency === RecurrenceFrequency.NONE) {
            return null;
        }
        const nextDate = new Date(this.transactionDate);
        switch (this.recurrence.frequency) {
            case RecurrenceFrequency.DAILY:
                nextDate.setDate(nextDate.getDate() + (this.recurrence.interval || 1));
                break;
            case RecurrenceFrequency.WEEKLY:
                nextDate.setDate(nextDate.getDate() + (7 * (this.recurrence.interval || 1)));
                break;
            case RecurrenceFrequency.MONTHLY:
                nextDate.setMonth(nextDate.getMonth() + (this.recurrence.interval || 1));
                break;
            case RecurrenceFrequency.QUARTERLY:
                nextDate.setMonth(nextDate.getMonth() + (3 * (this.recurrence.interval || 1)));
                break;
            case RecurrenceFrequency.YEARLY:
                nextDate.setFullYear(nextDate.getFullYear() + (this.recurrence.interval || 1));
                break;
            default:
                return null;
        }
        if (this.recurrence.endDate && nextDate > this.recurrence.endDate) {
            return null;
        }
        return {
            transactionType: this.transactionType,
            category: this.category,
            title: this.title,
            description: this.description,
            amount: this.amount,
            currency: this.currency,
            paymentMethod: this.paymentMethod,
            status: TransactionStatus.PENDING,
            transactionDate: nextDate,
            location: this.location,
            bovineId: this.bovineId,
            eventId: this.eventId,
            farmId: this.farmId,
            contactInfo: this.contactInfo,
            budgetInfo: this.budgetInfo,
            recurrence: this.recurrence,
            parentTransactionId: this.parentTransactionId || this.id,
            tags: this.tags,
            notes: this.notes,
            isRecurring: true,
            isApproved: false,
            isActive: true,
            costCenter: this.costCenter,
            project: this.project,
            createdBy: this.createdBy
        };
    }
    calculateROI(investmentAmount) {
        if (this.transactionType !== TransactionType.INCOME || investmentAmount <= 0) {
            return null;
        }
        return ((this.amount - investmentAmount) / investmentAmount) * 100;
    }
    getFormattedAmount() {
        const currencySymbols = {
            'MXN': '$',
            'USD': '$',
            'EUR': '€',
            'GBP': '£'
        };
        const symbol = currencySymbols[this.currency] || this.currency;
        return `${symbol}${this.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    }
}
Finance.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único de la transacción financiera'
    },
    transactionType: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(TransactionType)),
        allowNull: false,
        comment: 'Tipo de transacción (ingreso, gasto, transferencia, ajuste)'
    },
    category: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            isValidCategory(value) {
                const allCategories = [...Object.values(IncomeCategory), ...Object.values(ExpenseCategory)];
                if (!allCategories.includes(value)) {
                    throw new Error('Categoría no válida');
                }
            }
        },
        comment: 'Categoría específica de la transacción'
    },
    title: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [3, 200]
        },
        comment: 'Título descriptivo de la transacción'
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción detallada de la transacción'
    },
    amount: {
        type: sequelize_1.DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
            min: 0.01
        },
        comment: 'Monto de la transacción'
    },
    currency: {
        type: sequelize_1.DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'MXN',
        validate: {
            len: [3, 3],
            isUppercase: true
        },
        comment: 'Código de moneda ISO 4217'
    },
    exchangeRate: {
        type: sequelize_1.DataTypes.DECIMAL(10, 6),
        allowNull: true,
        validate: {
            min: 0
        },
        comment: 'Tipo de cambio aplicado'
    },
    baseAmount: {
        type: sequelize_1.DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Monto convertido a moneda base'
    },
    paymentMethod: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(PaymentMethod)),
        allowNull: false,
        comment: 'Método de pago utilizado'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(TransactionStatus)),
        allowNull: false,
        defaultValue: TransactionStatus.PENDING,
        comment: 'Estado actual de la transacción'
    },
    transactionDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        comment: 'Fecha y hora de la transacción'
    },
    dueDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de vencimiento (para pagos pendientes)'
    },
    completedDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de completación de la transacción'
    },
    location: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Ubicación geográfica donde se realizó la transacción'
    },
    bovineId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'bovines',
            key: 'id'
        },
        comment: 'ID del bovino relacionado con la transacción'
    },
    eventId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'events',
            key: 'id'
        },
        comment: 'ID del evento relacionado con la transacción'
    },
    farmId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la finca relacionada'
    },
    contactInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información del contacto/proveedor'
    },
    invoiceInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de facturación'
    },
    budgetInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de presupuesto'
    },
    amortizationInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de amortización'
    },
    financialAnalysis: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Análisis financiero de la transacción'
    },
    recurrence: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Configuración de recurrencia'
    },
    parentTransactionId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'finances',
            key: 'id'
        },
        comment: 'ID de transacción padre (para recurrentes)'
    },
    relatedTransactions: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.UUID),
        allowNull: true,
        defaultValue: [],
        comment: 'IDs de transacciones relacionadas'
    },
    tags: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Etiquetas para categorización adicional'
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
        comment: 'URLs de fotos/recibos'
    },
    notes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales de la transacción'
    },
    internalNotes: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas internas no visibles para usuarios finales'
    },
    isRecurring: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si la transacción es recurrente'
    },
    isApproved: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si la transacción ha sido aprobada'
    },
    approvedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que aprobó la transacción'
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
        comment: 'Si la transacción está activa'
    },
    fiscalYear: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 2000,
            max: 3000
        },
        comment: 'Año fiscal de la transacción'
    },
    fiscalPeriod: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: true,
        comment: 'Período fiscal (Q1, Q2, Q3, Q4, etc.)'
    },
    costCenter: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        comment: 'Centro de costo asignado'
    },
    project: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Proyecto relacionado'
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        comment: 'ID del usuario que creó la transacción'
    },
    updatedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del usuario que actualizó la transacción'
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
    modelName: 'Finance',
    tableName: 'finances',
    timestamps: true,
    paranoid: true,
    indexes: [
        {
            fields: ['transaction_type']
        },
        {
            fields: ['category']
        },
        {
            fields: ['status']
        },
        {
            fields: ['transaction_date']
        },
        {
            fields: ['due_date']
        },
        {
            fields: ['bovine_id']
        },
        {
            fields: ['event_id']
        },
        {
            fields: ['farm_id']
        },
        {
            fields: ['created_by']
        },
        {
            fields: ['currency']
        },
        {
            fields: ['is_approved']
        },
        {
            fields: ['is_recurring']
        },
        {
            fields: ['fiscal_year']
        },
        {
            name: 'finances_type_status_date',
            fields: ['transaction_type', 'status', 'transaction_date']
        },
        {
            name: 'finances_category_date',
            fields: ['category', 'transaction_date']
        },
        {
            name: 'finances_amount_currency',
            fields: ['amount', 'currency']
        },
        {
            name: 'finances_location_gin',
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
        beforeUpdate: async (finance) => {
            if (finance.changed('status')) {
                if (finance.status === TransactionStatus.COMPLETED && !finance.completedDate) {
                    finance.completedDate = new Date();
                }
                if (finance.status === TransactionStatus.OVERDUE && finance.dueDate) {
                }
            }
        },
        beforeSave: async (finance) => {
            if (finance.exchangeRate && finance.currency !== 'MXN') {
                finance.baseAmount = finance.amount * finance.exchangeRate;
            }
            if (!finance.fiscalYear) {
                finance.fiscalYear = new Date(finance.transactionDate).getFullYear();
            }
            if (finance.dueDate && finance.completedDate) {
                if (finance.completedDate > finance.dueDate && finance.status !== TransactionStatus.OVERDUE) {
                }
            }
        }
    },
    comment: 'Tabla para el manejo de transacciones financieras relacionadas con el ganado bovino'
});
exports.default = Finance;
//# sourceMappingURL=Finance.js.map