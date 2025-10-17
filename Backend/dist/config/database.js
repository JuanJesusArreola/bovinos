"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = exports.closeDatabase = exports.initializeDatabase = exports.getDatabaseManager = exports.DatabaseManager = void 0;
const sequelize_1 = require("sequelize");
const environments_1 = require("./environments");
const MigrationManager_1 = require("../migrations/MigrationManager");
const BackupManager_1 = require("../backup/BackupManager");
const logger_1 = __importDefault(require("../utils/logger"));
class DatabaseManager {
    constructor(managerConfig) {
        const validation = (0, environments_1.validateEnvironmentVariables)();
        if (!validation.isValid) {
            throw new Error(`❌ Variables de entorno faltantes: ${validation.missing.join(', ')}`);
        }
        this.config = (0, environments_1.getEnvironmentConfig)();
        this.managerConfig = {
            enableMigrations: managerConfig?.enableMigrations ?? this.config.features.enableMigrations,
            enableBackup: managerConfig?.enableBackup ?? this.config.features.enableBackup,
            enableLogging: managerConfig?.enableLogging ?? true,
            autoSync: managerConfig?.autoSync ?? true,
            forceSync: managerConfig?.forceSync ?? false,
            alterSync: managerConfig?.alterSync ?? false
        };
        this.sequelize = new sequelize_1.Sequelize(this.config.database);
        this.initializeManagers();
        logger_1.default.info('🗄️ DatabaseManager inicializado', 'Database', {
            environment: this.config.database.database,
            host: this.config.database.host,
            features: this.managerConfig
        });
    }
    initializeManagers() {
        if (this.managerConfig.enableMigrations) {
            this.migrationManager = new MigrationManager_1.MigrationManager(this.sequelize);
            logger_1.default.info('📋 MigrationManager inicializado', 'Database');
        }
        if (this.managerConfig.enableBackup) {
            this.backupManager = new BackupManager_1.BackupManager(this.sequelize);
            logger_1.default.info('💾 BackupManager inicializado', 'Database');
        }
    }
    getSequelize() {
        return this.sequelize;
    }
    getMigrationManager() {
        return this.migrationManager;
    }
    getBackupManager() {
        return this.backupManager;
    }
    async initialize() {
        try {
            logger_1.default.start('Inicialización completa de base de datos', 'Database');
            await this.testConnection();
            if (this.managerConfig.enableMigrations && this.migrationManager) {
                await this.runMigrations();
            }
            if (this.managerConfig.autoSync) {
                await this.syncDatabase();
            }
            if (this.managerConfig.enableBackup && this.backupManager) {
                this.scheduleBackups();
            }
            logger_1.default.end('Inicialización completa de base de datos', 'Database');
        }
        catch (error) {
            logger_1.default.fail('Inicialización completa de base de datos', error, 'Database');
            throw error;
        }
    }
    async testConnection() {
        try {
            await this.sequelize.authenticate();
            logger_1.default.info('Conexión a base de datos establecida', 'Database', {
                host: this.config.database.host,
                database: this.config.database.database
            });
            return true;
        }
        catch (error) {
            logger_1.default.fail('Conexión a base de datos', error, 'Database');
            return false;
        }
    }
    async syncDatabase() {
        try {
            logger_1.default.start('Sincronización de base de datos', 'Database');
            const options = {
                force: this.managerConfig.forceSync,
                alter: this.managerConfig.alterSync,
                logging: this.managerConfig.enableLogging ? console.log : false
            };
            if (options.force) {
                logger_1.default.warn('Eliminando y recreando todas las tablas', 'Database');
            }
            else if (options.alter) {
                logger_1.default.info('Modificando tablas existentes', 'Database');
            }
            else {
                logger_1.default.info('Creando tablas que no existen', 'Database');
            }
            await this.sequelize.sync(options);
            logger_1.default.end('Sincronización de base de datos', 'Database');
        }
        catch (error) {
            logger_1.default.fail('Sincronización de base de datos', error, 'Database');
            throw error;
        }
    }
    async runMigrations() {
        if (!this.migrationManager) {
            logger_1.default.warn('MigrationManager no disponible', 'Database');
            return;
        }
        try {
            logger_1.default.start('Ejecución de migraciones', 'Database');
            const result = await this.migrationManager.runMigrations();
            if (result.success) {
                logger_1.default.end('Ejecución de migraciones', 'Database', {
                    executed: result.executed.length,
                    failed: result.failed.length
                });
            }
            else {
                logger_1.default.fail('Ejecución de migraciones', new Error(result.errors.join(', ')), 'Database');
            }
        }
        catch (error) {
            logger_1.default.fail('Ejecución de migraciones', error, 'Database');
            throw error;
        }
    }
    scheduleBackups() {
        if (!this.backupManager) {
            logger_1.default.warn('BackupManager no disponible', 'Database');
            return;
        }
        this.backupManager.scheduleBackups();
        logger_1.default.info('Backups automáticos programados', 'Database');
    }
    async closeConnection() {
        try {
            if (this.backupManager) {
                this.backupManager.stopScheduledBackups();
            }
            await this.sequelize.close();
            logger_1.default.info('Conexión a base de datos cerrada', 'Database');
        }
        catch (error) {
            logger_1.default.fail('Cerrar conexión a base de datos', error, 'Database');
            throw error;
        }
    }
    getConnectionInfo() {
        return {
            environment: this.config.database.database,
            host: this.config.database.host,
            port: this.config.database.port,
            database: this.config.database.database,
            username: this.config.database.username,
            isConnected: true,
            poolInfo: this.config.database.pool,
            features: {
                migrations: this.managerConfig.enableMigrations,
                backup: this.managerConfig.enableBackup,
                logging: this.managerConfig.enableLogging
            }
        };
    }
    async getDatabaseStats() {
        try {
            const [results] = await this.sequelize.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables 
        ORDER BY schemaname, tablename
      `);
            return {
                tables: results,
                connectionInfo: this.getConnectionInfo(),
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            logger_1.default.error('Error obteniendo estadísticas de base de datos', 'Database', {}, error);
            throw error;
        }
    }
}
exports.DatabaseManager = DatabaseManager;
let databaseManager;
function getDatabaseManager() {
    if (!databaseManager) {
        databaseManager = new DatabaseManager();
    }
    return databaseManager;
}
exports.getDatabaseManager = getDatabaseManager;
async function initializeDatabase() {
    const manager = getDatabaseManager();
    await manager.initialize();
    return manager;
}
exports.initializeDatabase = initializeDatabase;
async function closeDatabase() {
    if (databaseManager) {
        await databaseManager.closeConnection();
    }
}
exports.closeDatabase = closeDatabase;
exports.sequelize = getDatabaseManager().getSequelize();
exports.default = exports.sequelize;
//# sourceMappingURL=database.js.map