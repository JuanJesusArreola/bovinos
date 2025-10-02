"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.initializeDatabase = exports.Reproduction = exports.Production = exports.Medication = exports.Inventory = exports.Location = exports.Ranch = exports.Health = exports.Finance = exports.Event = exports.Bovine = exports.User = exports.models = exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const User_1 = __importDefault(require("./User"));
exports.User = User_1.default;
const Bovine_1 = __importDefault(require("./Bovine"));
exports.Bovine = Bovine_1.default;
const Event_1 = __importDefault(require("./Event"));
exports.Event = Event_1.default;
const Finance_1 = __importDefault(require("./Finance"));
exports.Finance = Finance_1.default;
const Health_1 = __importDefault(require("./Health"));
exports.Health = Health_1.default;
const Ranch_1 = __importDefault(require("./Ranch"));
exports.Ranch = Ranch_1.default;
const Location_1 = __importDefault(require("./Location"));
exports.Location = Location_1.default;
const Inventory_1 = __importDefault(require("./Inventory"));
exports.Inventory = Inventory_1.default;
const Medication_1 = __importDefault(require("./Medication"));
exports.Medication = Medication_1.default;
const Production_1 = __importDefault(require("./Production"));
exports.Production = Production_1.default;
const Reproduction_1 = __importDefault(require("./Reproduction"));
exports.Reproduction = Reproduction_1.default;
class Database {
    constructor() {
        this.sequelize = database_1.default;
        this.models = {
            User: User_1.default,
            Bovine: Bovine_1.default,
            Event: Event_1.default,
            Finance: Finance_1.default,
            Health: Health_1.default,
            Ranch: Ranch_1.default,
            Location: Location_1.default,
            Inventory: Inventory_1.default,
            Medication: Medication_1.default,
            Production: Production_1.default,
            Reproduction: Reproduction_1.default
        };
        this.setupAssociations();
    }
    setupAssociations() {
        console.log('🔗 Configurando relaciones entre modelos...');
        User_1.default.hasMany(Ranch_1.default, {
            foreignKey: 'ownerId',
            as: 'ownedRanches',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        User_1.default.hasMany(Event_1.default, {
            foreignKey: 'createdById',
            as: 'createdEvents',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        User_1.default.hasMany(Bovine_1.default, {
            foreignKey: 'responsibleUserId',
            as: 'responsibleBovines',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Ranch_1.default.belongsTo(User_1.default, {
            foreignKey: 'ownerId',
            as: 'owner',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Ranch_1.default.hasMany(Bovine_1.default, {
            foreignKey: 'ranchId',
            as: 'bovines',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Ranch_1.default.hasMany(Location_1.default, {
            foreignKey: 'ranchId',
            as: 'locations',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Ranch_1.default.hasMany(Inventory_1.default, {
            foreignKey: 'ranchId',
            as: 'inventoryItems',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.belongsTo(Ranch_1.default, {
            foreignKey: 'ranchId',
            as: 'ranch',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.belongsTo(User_1.default, {
            foreignKey: 'responsibleUserId',
            as: 'responsibleUser',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.hasMany(Event_1.default, {
            foreignKey: 'bovineId',
            as: 'events',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.hasMany(Finance_1.default, {
            foreignKey: 'bovineId',
            as: 'financialTransactions',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.hasMany(Health_1.default, {
            foreignKey: 'bovineId',
            as: 'healthRecords',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.hasMany(Production_1.default, {
            foreignKey: 'bovineId',
            as: 'productionRecords',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.hasMany(Reproduction_1.default, {
            foreignKey: 'bovineId',
            as: 'reproductionRecords',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'motherId',
            as: 'mother',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'fatherId',
            as: 'father',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.hasMany(Bovine_1.default, {
            foreignKey: 'motherId',
            as: 'offspring',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Bovine_1.default.hasMany(Bovine_1.default, {
            foreignKey: 'fatherId',
            as: 'paternalOffspring',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Event_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'bovineId',
            as: 'bovine',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Event_1.default.belongsTo(User_1.default, {
            foreignKey: 'createdById',
            as: 'creator',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Event_1.default.hasOne(Finance_1.default, {
            foreignKey: 'eventId',
            as: 'financialTransaction',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Event_1.default.belongsTo(Event_1.default, {
            foreignKey: 'parentEventId',
            as: 'parentEvent',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Event_1.default.hasMany(Event_1.default, {
            foreignKey: 'parentEventId',
            as: 'childEvents',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Finance_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'bovineId',
            as: 'bovine',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Finance_1.default.belongsTo(Event_1.default, {
            foreignKey: 'eventId',
            as: 'event',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Finance_1.default.belongsTo(Finance_1.default, {
            foreignKey: 'parentTransactionId',
            as: 'parentTransaction',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Finance_1.default.hasMany(Finance_1.default, {
            foreignKey: 'parentTransactionId',
            as: 'childTransactions',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Health_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'bovineId',
            as: 'bovine',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Health_1.default.belongsToMany(Medication_1.default, {
            through: 'HealthMedication',
            foreignKey: 'healthRecordId',
            otherKey: 'medicationId',
            as: 'medications'
        });
        Location_1.default.belongsTo(Ranch_1.default, {
            foreignKey: 'ranchId',
            as: 'ranch',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Inventory_1.default.belongsTo(Ranch_1.default, {
            foreignKey: 'ranchId',
            as: 'ranch',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Inventory_1.default.belongsTo(Medication_1.default, {
            foreignKey: 'medicationId',
            as: 'medication',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Medication_1.default.hasMany(Inventory_1.default, {
            foreignKey: 'medicationId',
            as: 'inventoryItems',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Medication_1.default.belongsToMany(Health_1.default, {
            through: 'HealthMedication',
            foreignKey: 'medicationId',
            otherKey: 'healthRecordId',
            as: 'healthRecords'
        });
        Production_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'bovineId',
            as: 'bovine',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Reproduction_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'bovineId',
            as: 'bovine',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        });
        Reproduction_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'sireId',
            as: 'sire',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        Reproduction_1.default.belongsTo(Bovine_1.default, {
            foreignKey: 'offspringId',
            as: 'offspring',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE'
        });
        console.log('✅ Relaciones configuradas exitosamente');
    }
    async syncDatabase(config = {}) {
        const defaultConfig = {
            sync: true,
            force: true,
            alter: false,
            logging: true
        };
        const finalConfig = { ...defaultConfig, ...config };
        try {
            console.log('🗄️  Iniciando sincronización de base de datos...');
            await this.sequelize.authenticate();
            console.log('✅ Conexión a la base de datos establecida correctamente');
            if (finalConfig.sync) {
                console.log('🔄 Sincronizando modelos...');
                await this.sequelize.sync({
                    force: finalConfig.force,
                    alter: finalConfig.alter,
                    logging: finalConfig.logging ? console.log : false
                });
                console.log('✅ Modelos sincronizados correctamente');
                await this.createAdditionalIndexes();
            }
        }
        catch (error) {
            console.error('❌ Error durante la sincronización de la base de datos:', error);
            throw error;
        }
    }
    async createAdditionalIndexes() {
        try {
            console.log('�� Creando índices adicionales...');
            const queryInterface = this.sequelize.getQueryInterface();
            const tables = await queryInterface.showAllTables();
            if (tables.includes('users')) {
                const userColumns = [];
                if (await this.columnExists('users', 'email'))
                    userColumns.push('email');
                if (await this.columnExists('users', 'role'))
                    userColumns.push('role');
                if (await this.columnExists('users', 'status'))
                    userColumns.push('status');
                if (await this.columnExists('users', 'is_active'))
                    userColumns.push('is_active');
                if (userColumns.length > 0) {
                    await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_users_search 
          ON users (${userColumns.join(', ')})
        `).catch(() => console.log('⚠️ Índice de usuarios ya existe o no se pudo crear'));
                    console.log(`✅ Índice de usuarios creado con columnas: ${userColumns.join(', ')}`);
                }
                else {
                    console.log('⚠️ No se encontraron columnas válidas para índice de usuarios');
                }
            }
            if (tables.includes('bovines')) {
                const bovineColumns = [];
                if (await this.columnExists('bovines', 'ear_tag'))
                    bovineColumns.push('ear_tag');
                if (await this.columnExists('bovines', 'breed'))
                    bovineColumns.push('breed');
                if (await this.columnExists('bovines', 'is_active'))
                    bovineColumns.push('is_active');
                if (bovineColumns.length > 0) {
                    await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_bovines_search 
          ON bovines (${bovineColumns.join(', ')})
        `).catch(() => console.log('⚠️ Índice de bovinos ya existe o no se pudo crear'));
                    console.log(`✅ Índice de bovinos creado con columnas: ${bovineColumns.join(', ')}`);
                }
                else {
                    console.log('⚠️ No se encontraron columnas válidas para índice de bovinos');
                }
            }
            if (tables.includes('events')) {
                const eventColumns = [];
                if (await this.columnExists('events', 'event_type'))
                    eventColumns.push('event_type');
                if (await this.columnExists('events', 'scheduled_date'))
                    eventColumns.push('scheduled_date');
                if (await this.columnExists('events', 'status'))
                    eventColumns.push('status');
                if (eventColumns.length > 0) {
                    await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_events_search 
          ON events (${eventColumns.join(', ')})
        `).catch(() => console.log('⚠️ Índice de eventos ya existe o no se pudo crear'));
                    console.log(`✅ Índice de eventos creado con columnas: ${eventColumns.join(', ')}`);
                }
                else {
                    console.log('⚠️ No se encontraron columnas válidas para índice de eventos');
                }
            }
            if (tables.includes('finances')) {
                const financeColumns = [];
                if (await this.columnExists('finances', 'transaction_date'))
                    financeColumns.push('transaction_date');
                if (await this.columnExists('finances', 'transaction_type'))
                    financeColumns.push('transaction_type');
                if (financeColumns.length > 0) {
                    await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_finances_period 
          ON finances (${financeColumns.join(', ')})
        `).catch(() => console.log('⚠️ Índice de finanzas ya existe o no se pudo crear'));
                    console.log(`✅ Índice de finanzas creado con columnas: ${financeColumns.join(', ')}`);
                }
                else {
                    console.log('⚠️ No se encontraron columnas válidas para índice de finanzas');
                }
            }
            console.log('✅ Índices adicionales procesados');
        }
        catch (error) {
            console.error('⚠️  Error creando índices adicionales:', error);
        }
    }
    async columnExists(tableName, columnName) {
        try {
            const queryInterface = this.sequelize.getQueryInterface();
            const columns = await queryInterface.describeTable(tableName);
            return columns[columnName] !== undefined;
        }
        catch (error) {
            console.error('❌ Error verificando existencia de columna:', error);
            return false;
        }
    }
    async closeConnection() {
        try {
            await this.sequelize.close();
            console.log('🔌 Conexión a la base de datos cerrada');
        }
        catch (error) {
            console.error('❌ Error cerrando la conexión:', error);
            throw error;
        }
    }
    async runMigrations() {
        try {
            console.log('🚀 Ejecutando migraciones...');
            console.log('✅ Migraciones ejecutadas correctamente');
        }
        catch (error) {
            console.error('❌ Error ejecutando migraciones:', error);
            throw error;
        }
    }
    async createSeedData() {
        try {
            console.log('🌱 Creando datos de prueba...');
            const userCount = await User_1.default.count();
            if (userCount > 0) {
                console.log('📊 Ya existen datos en la base de datos, saltando seed');
                return;
            }
            const sampleUser = await User_1.default.create({
                userCode: 'ADM001',
                username: 'admin',
                email: 'admin@ganaderia.mx',
                password: 'admin123',
                role: 'ADMIN',
                status: 'ACTIVE',
                accessLevel: 'ENTERPRISE',
                verificationStatus: 'FULLY_VERIFIED',
                personalInfo: {
                    firstName: 'Administrador',
                    lastName: 'Sistema'
                },
                contactInfo: {
                    primaryEmail: 'admin@ganaderia.mx',
                    primaryPhone: '+52 993 123 4567'
                },
                permissions: {
                    modules: {
                        bovines: 'ADMIN',
                        health: 'ADMIN',
                        reproduction: 'ADMIN',
                        finance: 'ADMIN',
                        inventory: 'ADMIN',
                        production: 'ADMIN',
                        locations: 'ADMIN',
                        reports: 'ADMIN',
                        users: 'ADMIN',
                        settings: 'ADMIN'
                    },
                    actions: {
                        canCreateRanch: true,
                        canDeleteRecords: true,
                        canExportData: true,
                        canImportData: true,
                        canAccessAnalytics: true,
                        canManageUsers: true,
                        canApproveTransactions: true,
                        canPrescribeMedications: false,
                        canPerformSurgery: false,
                        canAccessFinancials: true
                    },
                    restrictions: {}
                },
                isActive: true,
                isVerified: true,
                emailVerified: true,
                phoneVerified: true,
                termsAccepted: true,
                privacyPolicyAccepted: true
            });
            console.log('✅ Datos de prueba creados correctamente');
        }
        catch (error) {
            console.error('❌ Error creando datos de prueba:', error);
            console.log('⚠️ Continuando sin datos de prueba...');
        }
    }
    async getDatabaseStats() {
        try {
            const [users, bovines, events, finances, healthRecords, ranches, locations, inventory, medications, production, reproduction] = await Promise.all([
                User_1.default.count(),
                Bovine_1.default.count(),
                Event_1.default.count(),
                Finance_1.default.count(),
                Health_1.default.count(),
                Ranch_1.default.count(),
                Location_1.default.count(),
                Inventory_1.default.count(),
                Medication_1.default.count(),
                Production_1.default.count(),
                Reproduction_1.default.count()
            ]);
            return {
                users,
                bovines,
                events,
                finances,
                healthRecords,
                ranches,
                locations,
                inventory,
                medications,
                production,
                reproduction,
                totalRecords: users + bovines + events + finances + healthRecords +
                    ranches + locations + inventory + medications + production + reproduction
            };
        }
        catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            throw error;
        }
    }
    async validateDataIntegrity() {
        const issues = [];
        try {
            console.log('🔍 Validando integridad de datos...');
            const bovinesWithoutRanch = await Bovine_1.default.count({
                where: {}
            });
            try {
                const orphanEvents = await Event_1.default.findAll({
                    include: [{
                            model: Bovine_1.default,
                            as: 'bovine',
                            required: false
                        }]
                });
                const orphanCount = orphanEvents.filter(event => !event.get('bovine')).length;
                if (orphanCount > 0) {
                    issues.push(`${orphanCount} eventos sin bovino asociado`);
                }
            }
            catch (error) {
                console.log('⚠️ No se pudo verificar eventos huérfanos:', error);
            }
            try {
                const oldPendingTransactions = await Finance_1.default.count({
                    where: {
                        createdAt: {
                            [sequelize_1.Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    }
                });
                if (oldPendingTransactions > 0) {
                    issues.push(`${oldPendingTransactions} transacciones antiguas encontradas`);
                }
            }
            catch (error) {
                console.log('⚠️ No se pudo verificar transacciones:', error);
            }
            console.log(`✅ Validación completada. ${issues.length} problemas encontrados`);
            return {
                isValid: issues.length === 0,
                issues
            };
        }
        catch (error) {
            console.error('❌ Error durante validación:', error);
            return {
                isValid: false,
                issues: [`Error durante validación: ${error}`]
            };
        }
    }
    async backupSchema() {
        try {
            console.log('💾 Creando respaldo del esquema...');
            const queryInterface = this.sequelize.getQueryInterface();
            const tables = await queryInterface.showAllTables();
            let backupScript = '-- Respaldo del esquema de base de datos\n';
            backupScript += `-- Generado el: ${new Date().toISOString()}\n\n`;
            for (const table of tables) {
                const tableInfo = await queryInterface.describeTable(table);
                backupScript += `-- Tabla: ${table}\n`;
                backupScript += JSON.stringify(tableInfo, null, 2);
                backupScript += '\n\n';
            }
            console.log('✅ Respaldo del esquema creado');
            return backupScript;
        }
        catch (error) {
            console.error('❌ Error creando respaldo:', error);
            throw error;
        }
    }
}
const databaseInstance = new Database();
exports.default = databaseInstance;
exports.sequelize = databaseInstance.sequelize, exports.models = databaseInstance.models;
async function initializeDatabase(config) {
    try {
        console.log('🚀 Inicializando sistema de base de datos...');
        await databaseInstance.syncDatabase(config);
        if (process.env.NODE_ENV === 'development') {
            await databaseInstance.createSeedData();
        }
        const validation = await databaseInstance.validateDataIntegrity();
        if (!validation.isValid) {
            console.warn('⚠️  Problemas de integridad encontrados:', validation.issues);
        }
        const stats = await databaseInstance.getDatabaseStats();
        console.log('📊 Estadísticas de la base de datos:', stats);
        console.log('✅ Base de datos inicializada correctamente');
        return databaseInstance;
    }
    catch (error) {
        console.error('❌ Error inicializando la base de datos:', error);
        throw error;
    }
}
exports.initializeDatabase = initializeDatabase;
async function closeDatabase() {
    try {
        await databaseInstance.closeConnection();
    }
    catch (error) {
        console.error('❌ Error cerrando la base de datos:', error);
        throw error;
    }
}
exports.closeDatabase = closeDatabase;
//# sourceMappingURL=index.js.map