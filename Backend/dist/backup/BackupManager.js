"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackupCLI = exports.createBackupManager = exports.BackupManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const cron = __importStar(require("node-cron"));
const environments_1 = require("../config/environments");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class BackupManager {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.config = (0, environments_1.getEnvironmentConfig)();
        this.backupPath = this.config.backup.storagePath;
        this.ensureBackupDirectory();
    }
    ensureBackupDirectory() {
        if (!fs_1.default.existsSync(this.backupPath)) {
            fs_1.default.mkdirSync(this.backupPath, { recursive: true });
            console.log(`📁 Directorio de backups creado: ${this.backupPath}`);
        }
    }
    generateBackupFileName(type) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const environment = this.config.database.database || 'unknown';
        return `${environment}_${type}_${timestamp}.sql`;
    }
    getPgDumpConfig() {
        const dbConfig = this.config.database;
        return `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database}`;
    }
    async createFullBackup(options = {}) {
        const startTime = new Date();
        try {
            console.log('💾 Iniciando backup completo...');
            const fileName = this.generateBackupFileName('full');
            const filePath = path_1.default.join(this.backupPath, fileName);
            let pgDumpCommand = this.getPgDumpConfig();
            if (options.includeSchema !== false) {
                pgDumpCommand += ' --schema-only';
            }
            if (options.includeData !== false) {
                pgDumpCommand += ' --data-only';
            }
            if (options.compression) {
                pgDumpCommand += ' --compress=9';
            }
            pgDumpCommand += ` > "${filePath}"`;
            console.log(`🔄 Ejecutando: ${pgDumpCommand.replace(/PGPASSWORD="[^"]*"/, 'PGPASSWORD="***"')}`);
            await execAsync(pgDumpCommand);
            if (!fs_1.default.existsSync(filePath)) {
                throw new Error('El archivo de backup no se creó correctamente');
            }
            const stats = fs_1.default.statSync(filePath);
            const size = stats.size;
            if (size === 0) {
                throw new Error('El archivo de backup está vacío');
            }
            console.log(`✅ Backup completo creado: ${fileName} (${this.formatFileSize(size)})`);
            return {
                success: true,
                filePath,
                size,
                timestamp: startTime
            };
        }
        catch (error) {
            console.error('❌ Error creando backup completo:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: startTime
            };
        }
    }
    async createSchemaBackup(options = {}) {
        const startTime = new Date();
        try {
            console.log('📋 Iniciando backup de esquema...');
            const fileName = this.generateBackupFileName('schema');
            const filePath = path_1.default.join(this.backupPath, fileName);
            let pgDumpCommand = this.getPgDumpConfig();
            pgDumpCommand += ' --schema-only --no-owner --no-privileges';
            if (options.compression) {
                pgDumpCommand += ' --compress=9';
            }
            pgDumpCommand += ` > "${filePath}"`;
            await execAsync(pgDumpCommand);
            const stats = fs_1.default.statSync(filePath);
            const size = stats.size;
            console.log(`✅ Backup de esquema creado: ${fileName} (${this.formatFileSize(size)})`);
            return {
                success: true,
                filePath,
                size,
                timestamp: startTime
            };
        }
        catch (error) {
            console.error('❌ Error creando backup de esquema:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: startTime
            };
        }
    }
    async createDataBackup(options = {}) {
        const startTime = new Date();
        try {
            console.log('📊 Iniciando backup de datos...');
            const fileName = this.generateBackupFileName('data');
            const filePath = path_1.default.join(this.backupPath, fileName);
            let pgDumpCommand = this.getPgDumpConfig();
            pgDumpCommand += ' --data-only --no-owner --no-privileges';
            if (options.compression) {
                pgDumpCommand += ' --compress=9';
            }
            pgDumpCommand += ` > "${filePath}"`;
            await execAsync(pgDumpCommand);
            const stats = fs_1.default.statSync(filePath);
            const size = stats.size;
            console.log(`✅ Backup de datos creado: ${fileName} (${this.formatFileSize(size)})`);
            return {
                success: true,
                filePath,
                size,
                timestamp: startTime
            };
        }
        catch (error) {
            console.error('❌ Error creando backup de datos:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: startTime
            };
        }
    }
    async restoreBackup(backupFilePath) {
        const startTime = new Date();
        try {
            console.log(`🔄 Iniciando restauración desde: ${backupFilePath}`);
            if (!fs_1.default.existsSync(backupFilePath)) {
                throw new Error(`El archivo de backup no existe: ${backupFilePath}`);
            }
            const dbConfig = this.config.database;
            const restoreCommand = `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} < "${backupFilePath}"`;
            console.log(`🔄 Ejecutando restauración...`);
            await execAsync(restoreCommand);
            console.log(`✅ Base de datos restaurada correctamente`);
            return {
                success: true,
                timestamp: startTime
            };
        }
        catch (error) {
            console.error('❌ Error restaurando backup:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: startTime
            };
        }
    }
    getBackupInfo() {
        const backups = [];
        if (!fs_1.default.existsSync(this.backupPath)) {
            return backups;
        }
        const files = fs_1.default.readdirSync(this.backupPath)
            .filter(file => file.endsWith('.sql'))
            .sort()
            .reverse();
        for (const file of files) {
            const filePath = path_1.default.join(this.backupPath, file);
            const stats = fs_1.default.statSync(filePath);
            const match = file.match(/^(.+)_(full|schema|data)_(.+)\.sql$/);
            if (match) {
                const [, environment, type, timestamp] = match;
                const backup = {
                    id: timestamp,
                    timestamp: new Date(timestamp.replace(/-/g, ':').replace('T', ' ')),
                    filePath,
                    size: stats.size,
                    type: type,
                    environment
                };
                backups.push(backup);
            }
        }
        return backups;
    }
    async cleanOldBackups(retentionDays) {
        const days = retentionDays || this.config.backup.retentionDays;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const backups = this.getBackupInfo();
        const toDelete = backups.filter(backup => backup.timestamp < cutoffDate);
        let deleted = 0;
        const errors = [];
        console.log(`🧹 Limpiando backups anteriores a ${cutoffDate.toISOString()} (${days} días)`);
        for (const backup of toDelete) {
            try {
                fs_1.default.unlinkSync(backup.filePath);
                deleted++;
                console.log(`🗑️ Eliminado: ${path_1.default.basename(backup.filePath)}`);
            }
            catch (error) {
                const errorMsg = `Error eliminando ${backup.filePath}: ${error}`;
                console.error(`❌ ${errorMsg}`);
                errors.push(errorMsg);
            }
        }
        console.log(`✅ Limpieza completada: ${deleted} archivos eliminados, ${errors.length} errores`);
        return { deleted, errors };
    }
    scheduleBackups() {
        if (!this.config.backup.enabled) {
            console.log('📋 Backups automáticos deshabilitados');
            return;
        }
        const schedule = this.config.backup.schedule;
        console.log(`⏰ Programando backups automáticos: ${schedule}`);
        this.cronJob = cron.schedule(schedule, async () => {
            console.log('🕐 Ejecutando backup programado...');
            try {
                const result = await this.createFullBackup({
                    compression: true,
                    retentionDays: this.config.backup.retentionDays
                });
                if (result.success) {
                    console.log('✅ Backup programado completado exitosamente');
                    await this.cleanOldBackups();
                }
                else {
                    console.error('❌ Error en backup programado:', result.error);
                }
            }
            catch (error) {
                console.error('❌ Error en backup programado:', error);
            }
        }, {
            timezone: 'America/Mexico_City'
        });
        console.log('✅ Backups automáticos programados correctamente');
    }
    stopScheduledBackups() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = undefined;
            console.log('⏹️ Backups automáticos detenidos');
        }
    }
    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0)
            return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    getBackupStats() {
        const backups = this.getBackupInfo();
        const stats = {
            totalBackups: backups.length,
            totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
            oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : undefined,
            newestBackup: backups.length > 0 ? backups[0].timestamp : undefined,
            byType: {}
        };
        for (const backup of backups) {
            stats.byType[backup.type] = (stats.byType[backup.type] || 0) + 1;
        }
        return stats;
    }
}
exports.BackupManager = BackupManager;
function createBackupManager(sequelize) {
    return new BackupManager(sequelize);
}
exports.createBackupManager = createBackupManager;
async function runBackupCLI() {
    const { sequelize } = await Promise.resolve().then(() => __importStar(require('../models')));
    const backupManager = createBackupManager(sequelize);
    const args = process.argv.slice(2);
    const command = args[0];
    try {
        switch (command) {
            case 'full':
                const fullResult = await backupManager.createFullBackup({
                    compression: true
                });
                if (!fullResult.success) {
                    process.exit(1);
                }
                break;
            case 'schema':
                const schemaResult = await backupManager.createSchemaBackup({
                    compression: true
                });
                if (!schemaResult.success) {
                    process.exit(1);
                }
                break;
            case 'data':
                const dataResult = await backupManager.createDataBackup({
                    compression: true
                });
                if (!dataResult.success) {
                    process.exit(1);
                }
                break;
            case 'list':
                const backups = backupManager.getBackupInfo();
                console.log('📋 Backups disponibles:');
                console.log('================================');
                for (const backup of backups) {
                    const size = backupManager['formatFileSize'](backup.size);
                    console.log(`${backup.timestamp.toISOString()} - ${backup.type} - ${size}`);
                }
                break;
            case 'clean':
                const retentionDays = args[1] ? parseInt(args[1]) : undefined;
                await backupManager.cleanOldBackups(retentionDays);
                break;
            case 'stats':
                const stats = backupManager.getBackupStats();
                console.log('📊 Estadísticas de backups:');
                console.log('================================');
                console.log(`Total de backups: ${stats.totalBackups}`);
                console.log(`Tamaño total: ${backupManager['formatFileSize'](stats.totalSize)}`);
                console.log(`Backup más antiguo: ${stats.oldestBackup?.toISOString() || 'N/A'}`);
                console.log(`Backup más reciente: ${stats.newestBackup?.toISOString() || 'N/A'}`);
                console.log('Por tipo:');
                for (const [type, count] of Object.entries(stats.byType)) {
                    console.log(`  ${type}: ${count}`);
                }
                break;
            default:
                console.log('📋 Comandos disponibles:');
                console.log('  full              - Crear backup completo');
                console.log('  schema            - Crear backup de esquema');
                console.log('  data              - Crear backup de datos');
                console.log('  list              - Listar backups disponibles');
                console.log('  clean [days]      - Limpiar backups antiguos');
                console.log('  stats             - Mostrar estadísticas');
                break;
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
    finally {
        await sequelize.close();
    }
}
exports.runBackupCLI = runBackupCLI;
exports.default = BackupManager;
//# sourceMappingURL=BackupManager.js.map