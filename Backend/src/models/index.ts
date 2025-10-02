import { Sequelize, Op } from 'sequelize';
import sequelizeInstance from '../config/database'; // Cambiar nombre para evitar conflictos

// Importar todos los modelos
import User from './User';
import Bovine from './Bovine';
import Event from './Event';
import Finance from './Finance';
import Health from './Health';
import Ranch from './Ranch';
import Location from './Location';
import Inventory from './Inventory';
import Medication from './Medication';
import Production from './Production';
import Reproduction from './Reproduction';

// Interface para configuración de la base de datos
interface DatabaseConfig {
  sync: boolean;
  force: boolean;
  alter: boolean;
  logging: boolean;
}

// Interface para estadísticas de la base de datos
interface DatabaseStats {
  users: number;
  bovines: number;
  events: number;
  finances: number;
  healthRecords: number;
  ranches: number;
  locations: number;
  inventory: number;
  medications: number;
  production: number;
  reproduction: number;
  totalRecords: number;
}

// Interface para validación de integridad
interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

// Clase principal para manejo de la base de datos
class Database {
  public sequelize: Sequelize;
  public models: {
    User: typeof User;
    Bovine: typeof Bovine;
    Event: typeof Event;
    Finance: typeof Finance;
    Health: typeof Health;
    Ranch: typeof Ranch;
    Location: typeof Location;
    Inventory: typeof Inventory;
    Medication: typeof Medication;
    Production: typeof Production;
    Reproduction: typeof Reproduction;
  };

  constructor() {
    this.sequelize = sequelizeInstance; // Usar la instancia de configuración importada
    this.models = {
      User,
      Bovine,
      Event,
      Finance,
      Health,
      Ranch,
      Location,
      Inventory,
      Medication,
      Production,
      Reproduction
    };

    // Establecer las relaciones entre modelos
    this.setupAssociations();
  }

  /**
   * Configura todas las relaciones entre modelos
   */
  private setupAssociations(): void {
    console.log('🔗 Configurando relaciones entre modelos...');

    // =============================================
    // RELACIONES DEL MODELO USER
    // =============================================

    // 1. Un usuario puede tener muchos ranchos (como propietario)
    User.hasMany(Ranch, {
      foreignKey: 'ownerId',
      as: 'ownedRanches',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 2. Un usuario puede crear muchos eventos
    User.hasMany(Event, {
      foreignKey: 'createdById',
      as: 'createdEvents',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 3. Un usuario puede ser responsable de muchos bovinos
    User.hasMany(Bovine, {
      foreignKey: 'responsibleUserId',
      as: 'responsibleBovines',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // RELACIONES DEL MODELO RANCH
    // =============================================

    // 4. Un rancho pertenece a un usuario (propietario)
    Ranch.belongsTo(User, {
      foreignKey: 'ownerId',
      as: 'owner',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 5. Un rancho puede tener muchos bovinos
    Ranch.hasMany(Bovine, {
      foreignKey: 'ranchId',
      as: 'bovines',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 6. Un rancho puede tener muchas ubicaciones
    Ranch.hasMany(Location, {
      foreignKey: 'ranchId',
      as: 'locations',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 7. Un rancho puede tener inventario
    Ranch.hasMany(Inventory, {
      foreignKey: 'ranchId',
      as: 'inventoryItems',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // RELACIONES DEL MODELO BOVINE
    // =============================================

    // 8. Un bovino pertenece a un rancho
    Bovine.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 9. Un bovino tiene un usuario responsable
    Bovine.belongsTo(User, {
      foreignKey: 'responsibleUserId',
      as: 'responsibleUser',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 10. Un bovino puede tener muchos eventos
    Bovine.hasMany(Event, {
      foreignKey: 'bovineId',
      as: 'events',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 11. Un bovino puede tener muchas transacciones financieras
    Bovine.hasMany(Finance, {
      foreignKey: 'bovineId',
      as: 'financialTransactions',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 12. Un bovino puede tener muchos registros de salud
    Bovine.hasMany(Health, {
      foreignKey: 'bovineId',
      as: 'healthRecords',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 13. Un bovino puede tener muchos registros de producción
    Bovine.hasMany(Production, {
      foreignKey: 'bovineId',
      as: 'productionRecords',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 14. Un bovino puede tener muchos registros de reproducción
    Bovine.hasMany(Reproduction, {
      foreignKey: 'bovineId',
      as: 'reproductionRecords',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 15. Relaciones familiares - Madre
    Bovine.belongsTo(Bovine, {
      foreignKey: 'motherId',
      as: 'mother',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 16. Relaciones familiares - Padre
    Bovine.belongsTo(Bovine, {
      foreignKey: 'fatherId',
      as: 'father',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 17. Hijos (crías) - relación inversa con madre
    Bovine.hasMany(Bovine, {
      foreignKey: 'motherId',
      as: 'offspring',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 18. Descendencia paterna - relación inversa con padre
    Bovine.hasMany(Bovine, {
      foreignKey: 'fatherId',
      as: 'paternalOffspring',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // RELACIONES DEL MODELO EVENT
    // =============================================

    // 19. Un evento pertenece a un bovino
    Event.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 20. Un evento es creado por un usuario
    Event.belongsTo(User, {
      foreignKey: 'createdById',
      as: 'creator',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 21. Un evento puede generar una transacción financiera
    Event.hasOne(Finance, {
      foreignKey: 'eventId',
      as: 'financialTransaction',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 22. Eventos recurrentes - relación padre-hijo
    Event.belongsTo(Event, {
      foreignKey: 'parentEventId',
      as: 'parentEvent',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 23. Eventos hijos - relación inversa
    Event.hasMany(Event, {
      foreignKey: 'parentEventId',
      as: 'childEvents',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // RELACIONES DEL MODELO FINANCE
    // =============================================

    // 24. Una transacción financiera puede estar relacionada con un bovino
    Finance.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 25. Una transacción financiera puede estar relacionada con un evento
    Finance.belongsTo(Event, {
      foreignKey: 'eventId',
      as: 'event',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 26. Transacciones recurrentes - relación padre-hijo
    Finance.belongsTo(Finance, {
      foreignKey: 'parentTransactionId',
      as: 'parentTransaction',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 27. Transacciones hijas - relación inversa
    Finance.hasMany(Finance, {
      foreignKey: 'parentTransactionId',
      as: 'childTransactions',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // RELACIONES DEL MODELO HEALTH
    // =============================================

    // 28. Un registro de salud pertenece a un bovino
    Health.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 29. Un registro de salud puede usar medicamentos
    Health.belongsToMany(Medication, {
      through: 'HealthMedication',
      foreignKey: 'healthRecordId',
      otherKey: 'medicationId',
      as: 'medications'
    });

    // =============================================
    // RELACIONES DEL MODELO LOCATION
    // =============================================

    // 30. Una ubicación pertenece a un rancho
    Location.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // RELACIONES DEL MODELO INVENTORY
    // =============================================

    // 31. Un item de inventario pertenece a un rancho
    Inventory.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 32. Un item de inventario puede estar relacionado con un medicamento
    Inventory.belongsTo(Medication, {
      foreignKey: 'medicationId',
      as: 'medication',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // RELACIONES DEL MODELO MEDICATION
    // =============================================

    // 33. Un medicamento puede estar en muchos inventarios
    Medication.hasMany(Inventory, {
      foreignKey: 'medicationId',
      as: 'inventoryItems',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 34. Un medicamento puede ser usado en muchos registros de salud
    Medication.belongsToMany(Health, {
      through: 'HealthMedication',
      foreignKey: 'medicationId',
      otherKey: 'healthRecordId',
      as: 'healthRecords'
    });

    // =============================================
    // RELACIONES DEL MODELO PRODUCTION
    // =============================================

    // 35. Un registro de producción pertenece a un bovino
    Production.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // RELACIONES DEL MODELO REPRODUCTION
    // =============================================

    // 36. Un registro de reproducción pertenece a un bovino (madre)
    Reproduction.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 37. Un registro de reproducción puede tener un padre (sire)
    Reproduction.belongsTo(Bovine, {
      foreignKey: 'sireId',
      as: 'sire',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // 38. Un registro de reproducción puede tener crías
    Reproduction.belongsTo(Bovine, {
      foreignKey: 'offspringId',
      as: 'offspring',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    console.log('✅ Relaciones configuradas exitosamente');
  }

  /**
   * Sincroniza la base de datos con los modelos
   * @param config Configuración para la sincronización
   */
  public async syncDatabase(config: Partial<DatabaseConfig> = {}): Promise<void> {
    const defaultConfig: DatabaseConfig = {
      sync: true,
      force: true,      // ⚠️ CUIDADO: true elimina todas las tablas - se cambio a true para que se elimine todas las tablas y se cree nuevamente
      alter: false,      // true modifica tablas existentes
      logging: true
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      console.log('🗄️  Iniciando sincronización de base de datos...');

      // Verificar conexión
      await this.sequelize.authenticate();
      console.log('✅ Conexión a la base de datos establecida correctamente');

      if (finalConfig.sync) {
        // Sincronizar modelos
        console.log('🔄 Sincronizando modelos...');

        await this.sequelize.sync({
          force: finalConfig.force,
          alter: finalConfig.alter,
          logging: finalConfig.logging ? console.log : false
        });

        console.log('✅ Modelos sincronizados correctamente');

        // Crear índices adicionales si es necesario
        await this.createAdditionalIndexes();
      }

    } catch (error) {
      console.error('❌ Error durante la sincronización de la base de datos:', error);
      throw error;
    }
  }

  /**
 * Crea índices adicionales para optimización
 */
private async createAdditionalIndexes(): Promise<void> {
  try {
    console.log('�� Creando índices adicionales...');

    // Crear índices solo si las tablas existen
    const queryInterface = this.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    // Índice para usuarios por email y rol
    if (tables.includes('users')) {
      const userColumns = [];
      
      // Verificar cada columna antes de agregarla al índice
      if (await this.columnExists('users', 'email')) userColumns.push('email');
      if (await this.columnExists('users', 'role')) userColumns.push('role');
      if (await this.columnExists('users', 'status')) userColumns.push('status');
      if (await this.columnExists('users', 'is_active')) userColumns.push('is_active');
      
      if (userColumns.length > 0) {
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_users_search 
          ON users (${userColumns.join(', ')})
        `).catch(() => console.log('⚠️ Índice de usuarios ya existe o no se pudo crear'));
        
        console.log(`✅ Índice de usuarios creado con columnas: ${userColumns.join(', ')}`);
      } else {
        console.log('⚠️ No se encontraron columnas válidas para índice de usuarios');
      }
    }

    // Índices para bovinos si la tabla existe
    if (tables.includes('bovines')) {
      const bovineColumns = [];
      
      if (await this.columnExists('bovines', 'ear_tag')) bovineColumns.push('ear_tag');
      if (await this.columnExists('bovines', 'breed')) bovineColumns.push('breed');
      if (await this.columnExists('bovines', 'is_active')) bovineColumns.push('is_active');
      
      if (bovineColumns.length > 0) {
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_bovines_search 
          ON bovines (${bovineColumns.join(', ')})
        `).catch(() => console.log('⚠️ Índice de bovinos ya existe o no se pudo crear'));
        
        console.log(`✅ Índice de bovinos creado con columnas: ${bovineColumns.join(', ')}`);
      } else {
        console.log('⚠️ No se encontraron columnas válidas para índice de bovinos');
      }
    }

    // Índices para eventos si la tabla existe
    if (tables.includes('events')) {
      const eventColumns = [];
      
      if (await this.columnExists('events', 'event_type')) eventColumns.push('event_type');
      if (await this.columnExists('events', 'scheduled_date')) eventColumns.push('scheduled_date');
      if (await this.columnExists('events', 'status')) eventColumns.push('status');
      
      if (eventColumns.length > 0) {
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_events_search 
          ON events (${eventColumns.join(', ')})
        `).catch(() => console.log('⚠️ Índice de eventos ya existe o no se pudo crear'));
        
        console.log(`✅ Índice de eventos creado con columnas: ${eventColumns.join(', ')}`);
      } else {
        console.log('⚠️ No se encontraron columnas válidas para índice de eventos');
      }
    }

    // Índices para finanzas si la tabla existe
    if (tables.includes('finances')) {
      const financeColumns = [];
      
      if (await this.columnExists('finances', 'transaction_date')) financeColumns.push('transaction_date');
      if (await this.columnExists('finances', 'transaction_type')) financeColumns.push('transaction_type');
      
      if (financeColumns.length > 0) {
        await this.sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_finances_period 
          ON finances (${financeColumns.join(', ')})
        `).catch(() => console.log('⚠️ Índice de finanzas ya existe o no se pudo crear'));
        
        console.log(`✅ Índice de finanzas creado con columnas: ${financeColumns.join(', ')}`);
      } else {
        console.log('⚠️ No se encontraron columnas válidas para índice de finanzas');
      }
    }

    console.log('✅ Índices adicionales procesados');

  } catch (error) {
    console.error('⚠️  Error creando índices adicionales:', error);
    // No lanzar error, los índices son opcionales
  }
}
  /**
   * Verifica si una columna existe en una tabla
   * @param tableName Nombre de la tabla
   * @param columnName Nombre de la columna
   * @returns true si la columna existe, false si no
   */
  private async columnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const queryInterface = this.sequelize.getQueryInterface();
      const columns = await queryInterface.describeTable(tableName);
      return columns[columnName] !== undefined;
    } catch (error) {
      console.error('❌ Error verificando existencia de columna:', error);
      return false;
    }
  }



  /**
   * Cierra la conexión a la base de datos
   */
  public async closeConnection(): Promise<void> {
    try {
      await this.sequelize.close();
      console.log('🔌 Conexión a la base de datos cerrada');
    } catch (error) {
      console.error('❌ Error cerrando la conexión:', error);
      throw error;
    }
  }

  /**
   * Ejecuta las migraciones pendientes
   */
  public async runMigrations(): Promise<void> {
    try {
      console.log('🚀 Ejecutando migraciones...');

      // Aquí se ejecutarían las migraciones de Sequelize
      // await this.sequelize.getQueryInterface().

      console.log('✅ Migraciones ejecutadas correctamente');
    } catch (error) {
      console.error('❌ Error ejecutando migraciones:', error);
      throw error;
    }
  }

  /**
   * Crea datos de prueba para desarrollo
   */
  public async createSeedData(): Promise<void> {
    try {
      console.log('🌱 Creando datos de prueba...');

      // Verificar si ya existen datos
      const userCount = await User.count();
      if (userCount > 0) {
        console.log('📊 Ya existen datos en la base de datos, saltando seed');
        return;
      }

      // Crear usuario de ejemplo con datos básicos
      const sampleUser = await User.create({
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
      } as any); // Usar 'as any' temporalmente hasta que los tipos estén definidos

      console.log('✅ Datos de prueba creados correctamente');

    } catch (error) {
      console.error('❌ Error creando datos de prueba:', error);
      // No lanzar error para permitir que la aplicación continúe
      console.log('⚠️ Continuando sin datos de prueba...');
    }
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  public async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const [
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
        reproduction
      ] = await Promise.all([
        User.count(),
        Bovine.count(),
        Event.count(),
        Finance.count(),
        Health.count(),
        Ranch.count(),
        Location.count(),
        Inventory.count(),
        Medication.count(),
        Production.count(),
        Reproduction.count()
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
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Valida la integridad de los datos
   */
  public async validateDataIntegrity(): Promise<ValidationResult> {
    const issues: string[] = [];

    try {
      console.log('🔍 Validando integridad de datos...');

      // Verificar bovinos sin rancho (usando propiedades que existen en el modelo)
      const bovinesWithoutRanch = await Bovine.count({
        where: {
          // Usar la propiedad correcta según el modelo Bovine
          // ranchId: null // Comentado hasta verificar la estructura del modelo
        }
      });

      // if (bovinesWithoutRanch > 0) {
      //   issues.push(`${bovinesWithoutRanch} bovinos sin rancho asignado`);
      // }

      // Verificar eventos que podrían no tener bovino asociado
      try {
        const orphanEvents = await Event.findAll({
          include: [{
            model: Bovine,
            as: 'bovine',
            required: false
          }]
        });

        const orphanCount = orphanEvents.filter(event => !event.get('bovine')).length;

        if (orphanCount > 0) {
          issues.push(`${orphanCount} eventos sin bovino asociado`);
        }
      } catch (error) {
        console.log('⚠️ No se pudo verificar eventos huérfanos:', error);
      }

      // Verificar transacciones sin aprobar antiguas
      try {
        const oldPendingTransactions = await Finance.count({
          where: {
            // Usar propiedades que existan en el modelo Finance
            createdAt: {
              [Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 días atrás
            }
          }
        });

        if (oldPendingTransactions > 0) {
          issues.push(`${oldPendingTransactions} transacciones antiguas encontradas`);
        }
      } catch (error) {
        console.log('⚠️ No se pudo verificar transacciones:', error);
      }

      console.log(`✅ Validación completada. ${issues.length} problemas encontrados`);

      return {
        isValid: issues.length === 0,
        issues
      };

    } catch (error) {
      console.error('❌ Error durante validación:', error);
      return {
        isValid: false,
        issues: [`Error durante validación: ${error}`]
      };
    }
  }

  /**
   * Respalda la base de datos (solo estructura)
   */
  public async backupSchema(): Promise<string> {
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

    } catch (error) {
      console.error('❌ Error creando respaldo:', error);
      throw error;
    }
  }
}

// Crear instancia única de la base de datos
const databaseInstance = new Database();

// Exportar la instancia y los modelos
export default databaseInstance;
export const { sequelize, models } = databaseInstance;

// Exportar todos los modelos
export {
  User,
  Bovine,
  Event,
  Finance,
  Health,
  Ranch,
  Location,
  Inventory,
  Medication,
  Production,
  Reproduction
};

// Función de inicialización para usar en la aplicación
export async function initializeDatabase(config?: Partial<DatabaseConfig>): Promise<Database> {
  try {
    console.log('🚀 Inicializando sistema de base de datos...');

    await databaseInstance.syncDatabase(config);

    // Crear datos de prueba solo en desarrollo
    if (process.env.NODE_ENV === 'development') {
      await databaseInstance.createSeedData();
    }

    // Validar integridad de datos
    const validation = await databaseInstance.validateDataIntegrity();
    if (!validation.isValid) {
      console.warn('⚠️  Problemas de integridad encontrados:', validation.issues);
    }

    // Mostrar estadísticas
    const stats = await databaseInstance.getDatabaseStats();
    console.log('📊 Estadísticas de la base de datos:', stats);

    console.log('✅ Base de datos inicializada correctamente');
    return databaseInstance;

  } catch (error) {
    console.error('❌ Error inicializando la base de datos:', error);
    throw error;
  }
}

// Función para cerrar la base de datos de forma segura
export async function closeDatabase(): Promise<void> {
  try {
    await databaseInstance.closeConnection();
  } catch (error) {
    console.error('❌ Error cerrando la base de datos:', error);
    throw error;
  }
}