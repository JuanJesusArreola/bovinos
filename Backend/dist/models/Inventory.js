"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertType = exports.UnitOfMeasure = exports.MovementType = exports.StorageCondition = exports.StockStatus = exports.InventoryCategory = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
var InventoryCategory;
(function (InventoryCategory) {
    InventoryCategory["FEED"] = "FEED";
    InventoryCategory["MEDICATION"] = "MEDICATION";
    InventoryCategory["VACCINES"] = "VACCINES";
    InventoryCategory["EQUIPMENT"] = "EQUIPMENT";
    InventoryCategory["TOOLS"] = "TOOLS";
    InventoryCategory["SUPPLIES"] = "SUPPLIES";
    InventoryCategory["BREEDING_MATERIALS"] = "BREEDING_MATERIALS";
    InventoryCategory["CLEANING_PRODUCTS"] = "CLEANING_PRODUCTS";
    InventoryCategory["SAFETY_EQUIPMENT"] = "SAFETY_EQUIPMENT";
    InventoryCategory["OFFICE_SUPPLIES"] = "OFFICE_SUPPLIES";
    InventoryCategory["FUEL"] = "FUEL";
    InventoryCategory["SEEDS"] = "SEEDS";
    InventoryCategory["FERTILIZERS"] = "FERTILIZERS";
    InventoryCategory["PESTICIDES"] = "PESTICIDES";
    InventoryCategory["SPARE_PARTS"] = "SPARE_PARTS";
    InventoryCategory["OTHER"] = "OTHER";
})(InventoryCategory || (exports.InventoryCategory = InventoryCategory = {}));
var StockStatus;
(function (StockStatus) {
    StockStatus["IN_STOCK"] = "IN_STOCK";
    StockStatus["LOW_STOCK"] = "LOW_STOCK";
    StockStatus["OUT_OF_STOCK"] = "OUT_OF_STOCK";
    StockStatus["BACKORDERED"] = "BACKORDERED";
    StockStatus["DISCONTINUED"] = "DISCONTINUED";
    StockStatus["EXPIRED"] = "EXPIRED";
    StockStatus["DAMAGED"] = "DAMAGED";
    StockStatus["RESERVED"] = "RESERVED";
})(StockStatus || (exports.StockStatus = StockStatus = {}));
var StorageCondition;
(function (StorageCondition) {
    StorageCondition["AMBIENT"] = "AMBIENT";
    StorageCondition["REFRIGERATED"] = "REFRIGERATED";
    StorageCondition["FROZEN"] = "FROZEN";
    StorageCondition["DRY"] = "DRY";
    StorageCondition["HUMID"] = "HUMID";
    StorageCondition["CONTROLLED_ATMOSPHERE"] = "CONTROLLED_ATMOSPHERE";
    StorageCondition["HAZMAT"] = "HAZMAT";
    StorageCondition["SPECIAL"] = "SPECIAL";
})(StorageCondition || (exports.StorageCondition = StorageCondition = {}));
var MovementType;
(function (MovementType) {
    MovementType["PURCHASE"] = "PURCHASE";
    MovementType["SALE"] = "SALE";
    MovementType["USE"] = "USE";
    MovementType["TRANSFER"] = "TRANSFER";
    MovementType["ADJUSTMENT"] = "ADJUSTMENT";
    MovementType["RETURN"] = "RETURN";
    MovementType["WASTE"] = "WASTE";
    MovementType["DONATION"] = "DONATION";
    MovementType["THEFT"] = "THEFT";
    MovementType["EXPIRATION"] = "EXPIRATION";
    MovementType["DAMAGE"] = "DAMAGE";
    MovementType["PRODUCTION"] = "PRODUCTION";
})(MovementType || (exports.MovementType = MovementType = {}));
var UnitOfMeasure;
(function (UnitOfMeasure) {
    UnitOfMeasure["KG"] = "KG";
    UnitOfMeasure["G"] = "G";
    UnitOfMeasure["LB"] = "LB";
    UnitOfMeasure["OZ"] = "OZ";
    UnitOfMeasure["TON"] = "TON";
    UnitOfMeasure["L"] = "L";
    UnitOfMeasure["ML"] = "ML";
    UnitOfMeasure["GAL"] = "GAL";
    UnitOfMeasure["QT"] = "QT";
    UnitOfMeasure["PT"] = "PT";
    UnitOfMeasure["M"] = "M";
    UnitOfMeasure["CM"] = "CM";
    UnitOfMeasure["MM"] = "MM";
    UnitOfMeasure["FT"] = "FT";
    UnitOfMeasure["IN"] = "IN";
    UnitOfMeasure["M2"] = "M2";
    UnitOfMeasure["FT2"] = "FT2";
    UnitOfMeasure["HA"] = "HA";
    UnitOfMeasure["ACRE"] = "ACRE";
    UnitOfMeasure["UNIT"] = "UNIT";
    UnitOfMeasure["DOZEN"] = "DOZEN";
    UnitOfMeasure["BOX"] = "BOX";
    UnitOfMeasure["PACK"] = "PACK";
    UnitOfMeasure["BOTTLE"] = "BOTTLE";
    UnitOfMeasure["BAG"] = "BAG";
    UnitOfMeasure["ROLL"] = "ROLL";
    UnitOfMeasure["SHEET"] = "SHEET";
    UnitOfMeasure["DAY"] = "DAY";
    UnitOfMeasure["WEEK"] = "WEEK";
    UnitOfMeasure["MONTH"] = "MONTH";
    UnitOfMeasure["YEAR"] = "YEAR";
})(UnitOfMeasure || (exports.UnitOfMeasure = UnitOfMeasure = {}));
var AlertType;
(function (AlertType) {
    AlertType["LOW_STOCK"] = "LOW_STOCK";
    AlertType["EXPIRATION_WARNING"] = "EXPIRATION_WARNING";
    AlertType["EXPIRED"] = "EXPIRED";
    AlertType["DAMAGED"] = "DAMAGED";
    AlertType["TEMPERATURE_ALERT"] = "TEMPERATURE_ALERT";
    AlertType["UNAUTHORIZED_ACCESS"] = "UNAUTHORIZED_ACCESS";
    AlertType["MISSING_ITEM"] = "MISSING_ITEM";
    AlertType["QUALITY_ISSUE"] = "QUALITY_ISSUE";
    AlertType["RECALL"] = "RECALL";
    AlertType["MAINTENANCE_DUE"] = "MAINTENANCE_DUE";
})(AlertType || (exports.AlertType = AlertType = {}));
class Inventory extends sequelize_1.Model {
    updateAvailableStock() {
        this.availableStock = this.currentStock - this.reservedStock;
    }
    updateTotalValue() {
        this.totalValue = this.currentStock * this.unitCost;
    }
    needsReorder() {
        return this.availableStock <= this.reorderPoint;
    }
    isLowStock() {
        return this.availableStock <= this.minimumStock;
    }
    isExpired() {
        if (!this.expirationDate)
            return false;
        return new Date() > new Date(this.expirationDate);
    }
    isNearExpiration(days = 30) {
        if (!this.expirationDate)
            return false;
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() + days);
        return new Date(this.expirationDate) <= warningDate;
    }
    getCategoryLabel() {
        const labels = {
            [InventoryCategory.FEED]: 'Alimentos',
            [InventoryCategory.MEDICATION]: 'Medicamentos',
            [InventoryCategory.VACCINES]: 'Vacunas',
            [InventoryCategory.EQUIPMENT]: 'Equipos',
            [InventoryCategory.TOOLS]: 'Herramientas',
            [InventoryCategory.SUPPLIES]: 'Suministros',
            [InventoryCategory.BREEDING_MATERIALS]: 'Materiales de Reproducción',
            [InventoryCategory.CLEANING_PRODUCTS]: 'Productos de Limpieza',
            [InventoryCategory.SAFETY_EQUIPMENT]: 'Equipo de Seguridad',
            [InventoryCategory.OFFICE_SUPPLIES]: 'Suministros de Oficina',
            [InventoryCategory.FUEL]: 'Combustible',
            [InventoryCategory.SEEDS]: 'Semillas',
            [InventoryCategory.FERTILIZERS]: 'Fertilizantes',
            [InventoryCategory.PESTICIDES]: 'Pesticidas',
            [InventoryCategory.SPARE_PARTS]: 'Repuestos',
            [InventoryCategory.OTHER]: 'Otros'
        };
        return labels[this.category];
    }
    getStatusLabel() {
        const labels = {
            [StockStatus.IN_STOCK]: 'En Stock',
            [StockStatus.LOW_STOCK]: 'Stock Bajo',
            [StockStatus.OUT_OF_STOCK]: 'Sin Stock',
            [StockStatus.BACKORDERED]: 'Pedido Pendiente',
            [StockStatus.DISCONTINUED]: 'Descontinuado',
            [StockStatus.EXPIRED]: 'Vencido',
            [StockStatus.DAMAGED]: 'Dañado',
            [StockStatus.RESERVED]: 'Reservado'
        };
        return labels[this.status];
    }
    getUnitLabel() {
        const labels = {
            [UnitOfMeasure.KG]: 'Kilogramos',
            [UnitOfMeasure.G]: 'Gramos',
            [UnitOfMeasure.LB]: 'Libras',
            [UnitOfMeasure.OZ]: 'Onzas',
            [UnitOfMeasure.TON]: 'Toneladas',
            [UnitOfMeasure.L]: 'Litros',
            [UnitOfMeasure.ML]: 'Mililitros',
            [UnitOfMeasure.GAL]: 'Galones',
            [UnitOfMeasure.QT]: 'Cuartos',
            [UnitOfMeasure.PT]: 'Pintas',
            [UnitOfMeasure.M]: 'Metros',
            [UnitOfMeasure.CM]: 'Centímetros',
            [UnitOfMeasure.MM]: 'Milímetros',
            [UnitOfMeasure.FT]: 'Pies',
            [UnitOfMeasure.IN]: 'Pulgadas',
            [UnitOfMeasure.M2]: 'Metros Cuadrados',
            [UnitOfMeasure.FT2]: 'Pies Cuadrados',
            [UnitOfMeasure.HA]: 'Hectáreas',
            [UnitOfMeasure.ACRE]: 'Acres',
            [UnitOfMeasure.UNIT]: 'Unidades',
            [UnitOfMeasure.DOZEN]: 'Docenas',
            [UnitOfMeasure.BOX]: 'Cajas',
            [UnitOfMeasure.PACK]: 'Paquetes',
            [UnitOfMeasure.BOTTLE]: 'Botellas',
            [UnitOfMeasure.BAG]: 'Bolsas',
            [UnitOfMeasure.ROLL]: 'Rollos',
            [UnitOfMeasure.SHEET]: 'Hojas',
            [UnitOfMeasure.DAY]: 'Días',
            [UnitOfMeasure.WEEK]: 'Semanas',
            [UnitOfMeasure.MONTH]: 'Meses',
            [UnitOfMeasure.YEAR]: 'Años'
        };
        return labels[this.unitOfMeasure];
    }
    getDaysToExpiration() {
        if (!this.expirationDate)
            return null;
        const now = new Date();
        const expiration = new Date(this.expirationDate);
        const diffTime = expiration.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    calculateTurnoverRate(periodicUsage) {
        if (this.currentStock === 0)
            return 0;
        return periodicUsage / this.currentStock;
    }
    getFormattedValue() {
        const currencySymbols = {
            'MXN': '$',
            'USD': '$',
            'EUR': '€',
            'GBP': '£'
        };
        const symbol = currencySymbols[this.currency] || this.currency;
        return `${symbol}${this.totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    }
    getActiveAlerts() {
        const alerts = [];
        if (this.isLowStock()) {
            alerts.push({
                type: AlertType.LOW_STOCK,
                message: `Stock bajo: ${this.availableStock} ${this.getUnitLabel()}`,
                severity: 'HIGH'
            });
        }
        if (this.isExpired()) {
            alerts.push({
                type: AlertType.EXPIRED,
                message: 'Artículo vencido',
                severity: 'CRITICAL'
            });
        }
        else if (this.isNearExpiration()) {
            const days = this.getDaysToExpiration();
            alerts.push({
                type: AlertType.EXPIRATION_WARNING,
                message: `Vence en ${days} días`,
                severity: days && days <= 7 ? 'HIGH' : 'MEDIUM'
            });
        }
        if (this.status === StockStatus.DAMAGED) {
            alerts.push({
                type: AlertType.DAMAGED,
                message: 'Artículo dañado',
                severity: 'HIGH'
            });
        }
        return alerts;
    }
    isMedication() {
        return this.category === InventoryCategory.MEDICATION ||
            this.category === InventoryCategory.VACCINES;
    }
    isFeed() {
        return this.category === InventoryCategory.FEED;
    }
    getStockPercentage() {
        if (this.maximumStock && this.maximumStock > 0) {
            return (this.availableStock / this.maximumStock) * 100;
        }
        if (this.reorderPoint > 0) {
            return Math.min((this.availableStock / (this.reorderPoint * 2)) * 100, 100);
        }
        return this.availableStock > 0 ? 100 : 0;
    }
    getInventorySummary() {
        const alerts = this.getActiveAlerts();
        let stockLevel = 'NORMAL';
        if (this.availableStock <= 0) {
            stockLevel = 'CRITICAL';
        }
        else if (this.isLowStock()) {
            stockLevel = 'LOW';
        }
        else if (this.maximumStock && this.availableStock >= this.maximumStock * 0.8) {
            stockLevel = 'HIGH';
        }
        return {
            status: this.getStatusLabel(),
            stockLevel,
            alerts,
            needsAttention: alerts.length > 0 || this.needsReorder(),
            daysToExpiration: this.getDaysToExpiration() || undefined,
            reorderNeeded: this.needsReorder()
        };
    }
}
Inventory.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único del artículo de inventario'
    },
    itemCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [3, 50]
        },
        comment: 'Código único del artículo'
    },
    itemName: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 200]
        },
        comment: 'Nombre del artículo'
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción detallada del artículo'
    },
    category: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(InventoryCategory)),
        allowNull: false,
        comment: 'Categoría del inventario'
    },
    brand: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Marca del artículo'
    },
    model: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Modelo del artículo'
    },
    barcode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        unique: true,
        comment: 'Código de barras'
    },
    qrCode: {
        type: sequelize_1.DataTypes.STRING(200),
        allowNull: true,
        unique: true,
        comment: 'Código QR'
    },
    currentStock: {
        type: sequelize_1.DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        },
        comment: 'Stock actual disponible'
    },
    reservedStock: {
        type: sequelize_1.DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        },
        comment: 'Stock reservado'
    },
    availableStock: {
        type: sequelize_1.DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        comment: 'Stock disponible (actual - reservado)'
    },
    minimumStock: {
        type: sequelize_1.DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        },
        comment: 'Stock mínimo requerido'
    },
    maximumStock: {
        type: sequelize_1.DataTypes.DECIMAL(12, 3),
        allowNull: true,
        validate: {
            min: 0
        },
        comment: 'Stock máximo permitido'
    },
    reorderPoint: {
        type: sequelize_1.DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        },
        comment: 'Punto de reorden'
    },
    reorderQuantity: {
        type: sequelize_1.DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        },
        comment: 'Cantidad de reorden'
    },
    unitOfMeasure: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(UnitOfMeasure)),
        allowNull: false,
        comment: 'Unidad de medida'
    },
    unitCost: {
        type: sequelize_1.DataTypes.DECIMAL(12, 4),
        allowNull: false,
        validate: {
            min: 0
        },
        comment: 'Costo unitario'
    },
    totalValue: {
        type: sequelize_1.DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        },
        comment: 'Valor total del inventario'
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
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(StockStatus)),
        allowNull: false,
        defaultValue: StockStatus.IN_STOCK,
        comment: 'Estado del stock'
    },
    storageLocation: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'Ubicación de almacenamiento'
    },
    storageCondition: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(StorageCondition)),
        allowNull: false,
        defaultValue: StorageCondition.AMBIENT,
        comment: 'Condiciones de almacenamiento'
    },
    location: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Ubicación geográfica del almacén'
    },
    supplierInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información del proveedor'
    },
    purchaseDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de compra'
    },
    expirationDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de vencimiento'
    },
    manufacturingDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de fabricación'
    },
    batchNumber: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        comment: 'Número de lote'
    },
    serialNumbers: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Números de serie'
    },
    nutritionalInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información nutricional (para alimentos)'
    },
    medicationInfo: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Información de medicamentos'
    },
    technicalSpecs: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Especificaciones técnicas'
    },
    qualityControl: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: true,
        comment: 'Control de calidad'
    },
    images: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de imágenes del artículo'
    },
    documents: {
        type: sequelize_1.DataTypes.ARRAY(sequelize_1.DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'URLs de documentos relacionados'
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
        comment: 'Notas adicionales'
    },
    lastInventoryDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del último inventario físico'
    },
    lastMovementDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del último movimiento'
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Si el artículo está activo'
    },
    trackSerial: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si se rastrean números de serie'
    },
    trackExpiration: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si se rastrea fecha de vencimiento'
    },
    trackBatch: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si se rastrean lotes'
    },
    allowNegativeStock: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si permite stock negativo'
    },
    isCritical: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si es artículo crítico'
    },
    isHazardous: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si es material peligroso'
    },
    temperatureMin: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Temperatura mínima de almacenamiento (°C)'
    },
    temperatureMax: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Temperatura máxima de almacenamiento (°C)'
    },
    humidityMin: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 100
        },
        comment: 'Humedad mínima (%)'
    },
    humidityMax: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 100
        },
        comment: 'Humedad máxima (%)'
    },
    farmId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID de la finca'
    },
    warehouseId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        comment: 'ID del almacén'
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
    modelName: 'Inventory',
    tableName: 'inventory',
    timestamps: true,
    paranoid: true,
    indexes: [
        {
            unique: true,
            fields: ['item_code']
        },
        {
            fields: ['category']
        },
        {
            fields: ['status']
        },
        {
            fields: ['is_active']
        },
        {
            fields: ['is_critical']
        },
        {
            fields: ['expiration_date']
        },
        {
            fields: ['current_stock']
        },
        {
            fields: ['farm_id']
        },
        {
            fields: ['warehouse_id']
        },
        {
            fields: ['storage_location']
        },
        {
            name: 'inventory_stock_status',
            fields: ['current_stock', 'minimum_stock', 'status']
        },
        {
            name: 'inventory_expiration_warning',
            fields: ['expiration_date', 'track_expiration']
        },
        {
            name: 'inventory_location_category',
            fields: ['storage_location', 'category']
        },
        {
            name: 'inventory_location_gin',
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
        beforeSave: async (inventory) => {
            inventory.updateAvailableStock();
            inventory.updateTotalValue();
            if (inventory.currentStock <= 0) {
                inventory.status = StockStatus.OUT_OF_STOCK;
            }
            else if (inventory.isLowStock()) {
                inventory.status = StockStatus.LOW_STOCK;
            }
            else if (inventory.isExpired()) {
                inventory.status = StockStatus.EXPIRED;
            }
            else {
                inventory.status = StockStatus.IN_STOCK;
            }
            if (inventory.maximumStock && inventory.minimumStock >= inventory.maximumStock) {
                throw new Error('El stock mínimo no puede ser mayor o igual al stock máximo');
            }
            if (inventory.reservedStock > inventory.currentStock) {
                throw new Error('El stock reservado no puede ser mayor al stock actual');
            }
            if (inventory.expirationDate && inventory.manufacturingDate) {
                if (inventory.expirationDate <= inventory.manufacturingDate) {
                    throw new Error('La fecha de vencimiento debe ser posterior a la fecha de fabricación');
                }
            }
            if (inventory.changed('currentStock') || inventory.changed('reservedStock')) {
                inventory.lastMovementDate = new Date();
            }
        }
    },
    comment: 'Tabla para el manejo completo del inventario de la operación ganadera'
});
exports.default = Inventory;
//# sourceMappingURL=Inventory.js.map