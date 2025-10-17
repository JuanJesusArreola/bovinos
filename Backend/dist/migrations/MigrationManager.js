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
exports.runMigrationsCLI = exports.createMigrationManager = exports.MigrationManager = void 0;
const sequelize_1 = require("sequelize");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const environments_1 = require("../config/environments");
class MigrationManager {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.queryInterface = sequelize.getQueryInterface();
        this.migrationsPath = path_1.default.join(process.cwd(), 'src', 'migrations', 'files');
        this.config = (0, environments_1.getEnvironmentConfig)();
        this.ensureMigrationsDirectory();
    }
    ensureMigrationsDirectory() {
        if (!fs_1.default.existsSync(this.migrationsPath)) {
            fs_1.default.mkdirSync(this.migrationsPath, { recursive: true });
            console.log(`📁 Directorio de migraciones creado: ${this.migrationsPath}`);
        }
    }
    async createMigrationsTable() {
        try {
            await this.queryInterface.createTable('sequelize_migrations', {
                id: {
                    type: sequelize_1.DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true
                },
                migration_id: {
                    type: sequelize_1.DataTypes.STRING(255),
                    allowNull: false,
                    unique: true
                },
                name: {
                    type: sequelize_1.DataTypes.STRING(255),
                    allowNull: false
                },
                executed_at: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: sequelize_1.DataTypes.NOW
                },
                created_at: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: sequelize_1.DataTypes.NOW
                },
                updated_at: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: sequelize_1.DataTypes.NOW
                }
            });
            console.log('✅ Tabla de migraciones creada');
        }
        catch (error) {
            console.log('📋 Tabla de migraciones ya existe');
        }
    }
    generateMigrationId() {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        return `${timestamp}`;
    }
    async createMigration(name) {
        const migrationId = this.generateMigrationId();
        const fileName = `${migrationId}_${name}.ts`;
        const filePath = path_1.default.join(this.migrationsPath, fileName);
        const template = `// ============================================================================
// MIGRACIÓN: ${name}
// ID: ${migrationId}
// Fecha: ${new Date().toISOString()}
// ============================================================================

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🚀 Ejecutando migración: ${name}');
  
  // =============================================
  // AQUÍ VA TU CÓDIGO DE MIGRACIÓN
  // =============================================
  
  // Ejemplo: Crear tabla
  // await queryInterface.createTable('nueva_tabla', {
  //   id: {
  //     type: DataTypes.INTEGER,
  //     primaryKey: true,
  //     autoIncrement: true
  //   },
  //   nombre: {
  //     type: DataTypes.STRING(255),
  //     allowNull: false
  //   },
  //   created_at: {
  //     type: DataTypes.DATE,
  //     allowNull: false,
  //     defaultValue: DataTypes.NOW
  //   },
  //   updated_at: {
  //     type: DataTypes.DATE,
  //     allowNull: false,
  //     defaultValue: DataTypes.NOW
  //   }
  // });

  console.log('✅ Migración ${name} ejecutada correctamente');
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  console.log('🔄 Revirtiendo migración: ${name}');
  
  // =============================================
  // AQUÍ VA TU CÓDIGO DE ROLLBACK
  // =============================================
  
  // Ejemplo: Eliminar tabla
  // await queryInterface.dropTable('nueva_tabla');

  console.log('✅ Migración ${name} revertida correctamente');
};

export const info = {
  id: '${migrationId}',
  name: '${name}',
  description: 'Descripción de la migración',
  author: 'Sistema de Migraciones',
  version: '1.0.0'
};
`;
        fs_1.default.writeFileSync(filePath, template);
        console.log(`✅ Migración creada: ${fileName}`);
        console.log(`📁 Ubicación: ${filePath}`);
        return migrationId;
    }
    getAvailableMigrations() {
        const migrations = [];
        if (!fs_1.default.existsSync(this.migrationsPath)) {
            return migrations;
        }
        const files = fs_1.default.readdirSync(this.migrationsPath)
            .filter(file => file.endsWith('.ts'))
            .sort();
        for (const file of files) {
            const match = file.match(/^(\d{14})_(.+)\.ts$/);
            if (match) {
                const [, timestamp, name] = match;
                const migration = {
                    id: timestamp,
                    name,
                    timestamp: new Date(parseInt(timestamp.slice(0, 4)), parseInt(timestamp.slice(4, 6)) - 1, parseInt(timestamp.slice(6, 8)), parseInt(timestamp.slice(8, 10)), parseInt(timestamp.slice(10, 12)), parseInt(timestamp.slice(12, 14))),
                    executed: false
                };
                migrations.push(migration);
            }
        }
        return migrations;
    }
    async getMigrationStatus() {
        await this.createMigrationsTable();
        const availableMigrations = this.getAvailableMigrations();
        const executedMigrations = await this.getExecutedMigrations();
        for (const migration of availableMigrations) {
            migration.executed = executedMigrations.includes(migration.id);
        }
        return availableMigrations;
    }
    async getExecutedMigrations() {
        try {
            const [results] = await this.sequelize.query('SELECT migration_id FROM sequelize_migrations ORDER BY executed_at ASC');
            return results.map(row => row.migration_id);
        }
        catch (error) {
            return [];
        }
    }
    async runMigrations(options = {}) {
        const result = {
            success: true,
            executed: [],
            failed: [],
            errors: []
        };
        try {
            console.log('🚀 Iniciando ejecución de migraciones...');
            await this.createMigrationsTable();
            const status = await this.getMigrationStatus();
            const pendingMigrations = status.filter(m => !m.executed);
            if (pendingMigrations.length === 0) {
                console.log('✅ No hay migraciones pendientes');
                return result;
            }
            console.log(`📋 Encontradas ${pendingMigrations.length} migraciones pendientes`);
            for (const migration of pendingMigrations) {
                try {
                    if (options.dryRun) {
                        console.log(`🔍 [DRY RUN] Ejecutaría migración: ${migration.name}`);
                        result.executed.push(migration.id);
                        continue;
                    }
                    console.log(`🔄 Ejecutando migración: ${migration.name}`);
                    const migrationFile = path_1.default.join(this.migrationsPath, `${migration.id}_${migration.name}.ts`);
                    const migrationModule = await Promise.resolve(`${migrationFile}`).then(s => __importStar(require(s)));
                    if (typeof migrationModule.up !== 'function') {
                        throw new Error(`Migración ${migration.name} no tiene función 'up'`);
                    }
                    await migrationModule.up(this.queryInterface);
                    await this.sequelize.query('INSERT INTO sequelize_migrations (migration_id, name, executed_at) VALUES (?, ?, ?)', {
                        replacements: [migration.id, migration.name, new Date()]
                    });
                    result.executed.push(migration.id);
                    console.log(`✅ Migración ${migration.name} ejecutada correctamente`);
                }
                catch (error) {
                    const errorMsg = `Error en migración ${migration.name}: ${error}`;
                    console.error(`❌ ${errorMsg}`);
                    result.failed.push(migration.id);
                    result.errors.push(errorMsg);
                    result.success = false;
                    if (!options.force) {
                        console.error('🛑 Deteniendo ejecución de migraciones debido a error');
                        break;
                    }
                }
            }
            console.log(`✅ Ejecución de migraciones completada`);
            console.log(`📊 Ejecutadas: ${result.executed.length}, Fallidas: ${result.failed.length}`);
        }
        catch (error) {
            console.error('❌ Error ejecutando migraciones:', error);
            result.success = false;
            result.errors.push(`Error general: ${error}`);
        }
        return result;
    }
    async rollbackMigrations(options = {}) {
        const result = {
            success: true,
            executed: [],
            failed: [],
            errors: []
        };
        try {
            console.log('🔄 Iniciando rollback de migraciones...');
            const status = await this.getMigrationStatus();
            const executedMigrations = status.filter(m => m.executed).reverse();
            if (executedMigrations.length === 0) {
                console.log('✅ No hay migraciones para revertir');
                return result;
            }
            const migrationsToRollback = options.to
                ? executedMigrations.slice(0, executedMigrations.findIndex(m => m.id === options.to) + 1)
                : executedMigrations.slice(0, 1);
            console.log(`📋 Revirtiendo ${migrationsToRollback.length} migraciones`);
            for (const migration of migrationsToRollback) {
                try {
                    if (options.dryRun) {
                        console.log(`🔍 [DRY RUN] Revertiría migración: ${migration.name}`);
                        result.executed.push(migration.id);
                        continue;
                    }
                    console.log(`🔄 Revirtiendo migración: ${migration.name}`);
                    const migrationFile = path_1.default.join(this.migrationsPath, `${migration.id}_${migration.name}.ts`);
                    const migrationModule = await Promise.resolve(`${migrationFile}`).then(s => __importStar(require(s)));
                    if (typeof migrationModule.down !== 'function') {
                        throw new Error(`Migración ${migration.name} no tiene función 'down'`);
                    }
                    await migrationModule.down(this.queryInterface);
                    await this.sequelize.query('DELETE FROM sequelize_migrations WHERE migration_id = ?', {
                        replacements: [migration.id]
                    });
                    result.executed.push(migration.id);
                    console.log(`✅ Migración ${migration.name} revertida correctamente`);
                }
                catch (error) {
                    const errorMsg = `Error revirtiendo migración ${migration.name}: ${error}`;
                    console.error(`❌ ${errorMsg}`);
                    result.failed.push(migration.id);
                    result.errors.push(errorMsg);
                    result.success = false;
                    if (!options.force) {
                        console.error('🛑 Deteniendo rollback debido a error');
                        break;
                    }
                }
            }
            console.log(`✅ Rollback de migraciones completado`);
            console.log(`📊 Revertidas: ${result.executed.length}, Fallidas: ${result.failed.length}`);
        }
        catch (error) {
            console.error('❌ Error en rollback de migraciones:', error);
            result.success = false;
            result.errors.push(`Error general: ${error}`);
        }
        return result;
    }
    async getStatus() {
        console.log('📊 Estado de las migraciones:');
        console.log('================================');
        const status = await this.getMigrationStatus();
        if (status.length === 0) {
            console.log('📭 No hay migraciones disponibles');
            return;
        }
        for (const migration of status) {
            const statusIcon = migration.executed ? '✅' : '⏳';
            const executedAt = migration.executed ? ' (ejecutada)' : ' (pendiente)';
            console.log(`${statusIcon} ${migration.id} - ${migration.name}${executedAt}`);
        }
        const executedCount = status.filter(m => m.executed).length;
        const pendingCount = status.length - executedCount;
        console.log('================================');
        console.log(`📊 Total: ${status.length} | Ejecutadas: ${executedCount} | Pendientes: ${pendingCount}`);
    }
}
exports.MigrationManager = MigrationManager;
function createMigrationManager(sequelize) {
    return new MigrationManager(sequelize);
}
exports.createMigrationManager = createMigrationManager;
async function runMigrationsCLI() {
    const { sequelize } = await Promise.resolve().then(() => __importStar(require('../models')));
    const migrationManager = createMigrationManager(sequelize);
    const args = process.argv.slice(2);
    const command = args[0];
    const options = {};
    if (args.includes('--force'))
        options.force = true;
    if (args.includes('--dry-run'))
        options.dryRun = true;
    if (args.includes('--to')) {
        const toIndex = args.indexOf('--to');
        options.to = args[toIndex + 1];
    }
    try {
        switch (command) {
            case 'create':
                const name = args[1];
                if (!name) {
                    console.error('❌ Debe especificar un nombre para la migración');
                    process.exit(1);
                }
                await migrationManager.createMigration(name);
                break;
            case 'up':
                const upResult = await migrationManager.runMigrations(options);
                if (!upResult.success) {
                    process.exit(1);
                }
                break;
            case 'down':
                const downResult = await migrationManager.rollbackMigrations(options);
                if (!downResult.success) {
                    process.exit(1);
                }
                break;
            case 'status':
                await migrationManager.getStatus();
                break;
            default:
                console.log('📋 Comandos disponibles:');
                console.log('  create <name>     - Crear nueva migración');
                console.log('  up                - Ejecutar migraciones pendientes');
                console.log('  down              - Revertir última migración');
                console.log('  status            - Mostrar estado de migraciones');
                console.log('');
                console.log('Opciones:');
                console.log('  --force           - Continuar aunque haya errores');
                console.log('  --dry-run         - Mostrar qué se ejecutaría sin hacerlo');
                console.log('  --to <migration>  - Ejecutar hasta migración específica');
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
exports.runMigrationsCLI = runMigrationsCLI;
exports.default = MigrationManager;
//# sourceMappingURL=MigrationManager.js.map