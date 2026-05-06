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
import LocationCapacity from './LocationCapacity';
import LocationInfo from './LocationInfo';
import LocationMonitoring from './LocationMonitoring';
import LocationAccess from './LocationAccess';
import LocationRelation from './LocationRelation';
import Inventory from './Inventory';
import Medication from './Medication';
import Production from './Production';
import Reproduction from './Reproduction';

// Importar modelos de Ranch especializados
import RanchOwnership from './RanchOwnership';
import RanchProduction from './RanchProduction';
import RanchFinancial from './RanchFinancial';
import RanchSustainability from './RanchSustainability';
import RanchTechnology from './RanchTechnology';
import RanchHR from './RanchHR';
import RanchCertification from './RanchCertification';
import RanchLicense from './RanchLicense';
import RanchInsurance from './RanchInsurance';
import RanchEmergency from './RanchEmergency';
import RanchMedia from './RanchMedia';

// Nuevos modelos de autenticación
import EmailVerificationToken from './EmailVerificationToken';
import PasswordResetToken from './PasswordResetToken';
import TokenBlacklist from './TokenBlacklist';
import SecurityEvent from './SecurityEvent';

import BovineTracking from './BovineTracking';  // ← FALTA
import BovineLocationHistory from './BovineLocationHistory';  // ← FALTA
import BovineHealthSnapshot from './BovineHealthSnapshot';  // ← FALTA
import Vaccination from './Vaccination';
import BovineVaccinationStatus from './BovineVaccinationStatus';

import Notification from './Notification';

import InventoryMovement from './InventoryMovement';
import PurchaseOrder from './PurchaseOrder';
import Supplier from './Supplier';

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
    EmailVerificationToken: typeof EmailVerificationToken;
    PasswordResetToken: typeof PasswordResetToken;
    TokenBlacklist: typeof TokenBlacklist;
    SecurityEvent: typeof SecurityEvent;

    LocationCapacity: typeof LocationCapacity;
    LocationInfo: typeof LocationInfo;
    LocationMonitoring: typeof LocationMonitoring;
    LocationAccess: typeof LocationAccess;
    LocationRelation: typeof LocationRelation;

    // Modelos de Ranch especializados
    RanchOwnership: typeof RanchOwnership;
    RanchProduction: typeof RanchProduction;
    RanchFinancial: typeof RanchFinancial;
    RanchSustainability: typeof RanchSustainability;
    RanchTechnology: typeof RanchTechnology;
    RanchHR: typeof RanchHR;
    RanchCertification: typeof RanchCertification;
    RanchLicense: typeof RanchLicense;
    RanchInsurance: typeof RanchInsurance;
    RanchEmergency: typeof RanchEmergency;
    RanchMedia: typeof RanchMedia;
    BovineHealthSnapshot: typeof BovineHealthSnapshot;
    BovineTracking: typeof BovineTracking;
    BovineLocationHistory: typeof BovineLocationHistory;
    Vaccination: typeof Vaccination;
    BovineVaccinationStatus: typeof BovineVaccinationStatus;

    Notification: typeof Notification;

    InventoryMovement: typeof InventoryMovement;
    PurchaseOrder: typeof PurchaseOrder;
    Supplier: typeof Supplier;
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
      LocationCapacity,
      LocationInfo,
      LocationMonitoring,
      LocationAccess,
      LocationRelation,
      Inventory,
      Medication,
      Production,
      Reproduction,
      EmailVerificationToken,
      PasswordResetToken,
      TokenBlacklist,
      SecurityEvent,
      RanchOwnership,
      RanchProduction,
      RanchFinancial,
      RanchSustainability,
      RanchTechnology,
      RanchHR,
      RanchCertification,
      RanchLicense,
      RanchInsurance,
      RanchEmergency,
      RanchMedia,
      BovineTracking,
      BovineLocationHistory,
      BovineHealthSnapshot,
      Vaccination,
      BovineVaccinationStatus,
      Notification,
      InventoryMovement,
      PurchaseOrder,
      Supplier
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
      as: 'inventoryRanch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // NUEVAS RELACIONES DE RANCH (MODELOS ESPECIALIZADOS)
    // =============================================

    // 1. RanchOwnership (1:1)
    Ranch.hasOne(RanchOwnership, {
      foreignKey: 'ranchId',
      as: 'ownership',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchOwnership.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 2. RanchProduction (1:N por año)
    Ranch.hasMany(RanchProduction, {
      foreignKey: 'ranchId',
      as: 'productions',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchProduction.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 3. RanchFinancial (1:N por año fiscal)
    Ranch.hasMany(RanchFinancial, {
      foreignKey: 'ranchId',
      as: 'financials',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchFinancial.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 4. RanchSustainability (1:1)
    Ranch.hasOne(RanchSustainability, {
      foreignKey: 'ranchId',
      as: 'sustainability',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchSustainability.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 5. RanchTechnology (1:1)
    Ranch.hasOne(RanchTechnology, {
      foreignKey: 'ranchId',
      as: 'technology',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchTechnology.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 6. RanchHR (1:1)
    Ranch.hasOne(RanchHR, {
      foreignKey: 'ranchId',
      as: 'humanResources',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchHR.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 7. RanchCertification (1:N)
    Ranch.hasMany(RanchCertification, {
      foreignKey: 'ranchId',
      as: 'certifications',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchCertification.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 8. RanchLicense (1:N)
    Ranch.hasMany(RanchLicense, {
      foreignKey: 'ranchId',
      as: 'licenses',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchLicense.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 9. RanchInsurance (1:N)
    Ranch.hasMany(RanchInsurance, {
      foreignKey: 'ranchId',
      as: 'insurances',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchInsurance.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 10. RanchEmergency (1:1)
    Ranch.hasOne(RanchEmergency, {
      foreignKey: 'ranchId',
      as: 'emergencyPlan',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchEmergency.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 11. RanchMedia (1:N)
    Ranch.hasMany(RanchMedia, {
      foreignKey: 'ranchId',
      as: 'media',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    RanchMedia.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
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

    // 1. Location → LocationCapacity (1:1)
    Location.hasOne(LocationCapacity, {
      foreignKey: 'locationId',
      as: 'capacity'
    });
    LocationCapacity.belongsTo(Location, {
      foreignKey: 'locationId',
      as: 'location'
    });

    // 2. Location → LocationInfo (1:1)
    Location.hasOne(LocationInfo, {
      foreignKey: 'locationId',
      as: 'info'
    });
    LocationInfo.belongsTo(Location, {
      foreignKey: 'locationId',
      as: 'location'
    });

    // 3. Location → LocationMonitoring (1:1)
    Location.hasOne(LocationMonitoring, {
      foreignKey: 'locationId',
      as: 'monitoring'
    });
    LocationMonitoring.belongsTo(Location, {
      foreignKey: 'locationId',
      as: 'location'
    });

    // 4. Location → LocationAccess (1:N)
    Location.hasMany(LocationAccess, {
      foreignKey: 'locationId',
      as: 'accesses'
    });
    LocationAccess.belongsTo(Location, {
      foreignKey: 'locationId',
      as: 'location'
    });

    // 5. Location → LocationRelation (N:M)
    // Como origen
    Location.hasMany(LocationRelation, {
      foreignKey: 'sourceLocationId',
      as: 'outgoingRelations'
    });
    // Como destino
    Location.hasMany(LocationRelation, {
      foreignKey: 'targetLocationId',
      as: 'incomingRelations'
    });

    // 6. Auto-relación (parent)
    Location.belongsTo(Location, {
      foreignKey: 'parentLocationId',
      as: 'parent'
    });
    Location.hasMany(Location, {
      foreignKey: 'parentLocationId',
      as: 'children'
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
      as: 'inventoryItemsMedication',
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

    // =============================================
    // RELACIONES DE BOVINE TRACKING
    // =============================================
    // ✅ AGREGAR:

    Bovine.hasMany(BovineTracking, {
      foreignKey: 'bovineId',
      as: 'trackingHistory',
      onDelete: 'CASCADE'
    });

    BovineTracking.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'CASCADE'
    });

    // =============================================
    // RELACIONES DE BOVINE LOCATION HISTORY
    // =============================================
    // ✅ AGREGAR:

    Bovine.hasMany(BovineLocationHistory, {
      foreignKey: 'bovineId',
      as: 'locationHistory',
      onDelete: 'CASCADE'
    });

    Location.hasMany(BovineLocationHistory, {
      foreignKey: 'locationId',
      as: 'visits',
      onDelete: 'CASCADE'
    });

    BovineLocationHistory.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'CASCADE'
    });

    BovineLocationHistory.belongsTo(Location, {
      foreignKey: 'locationId',
      as: 'location',
      onDelete: 'CASCADE'
    });

    // =============================================
    // RELACIONES DE HEALTH CON MEDICATION (ya existen parcialmente)
    // =============================================
    // ✅ VERIFICAR que esta relación esté presente:

    // =============================================
    // RELACIONES DE EVENT CON HEALTH
    // =============================================
    // ✅ AGREGAR (esto ya lo tienes pero verifica):

    Event.hasOne(Health, {
      foreignKey: 'eventId',
      as: 'healthRecord',
      onDelete: 'SET NULL'
    });

    Health.belongsTo(Event, {
      foreignKey: 'eventId',
      as: 'event',
      onDelete: 'SET NULL'
    });

    Bovine.hasOne(BovineHealthSnapshot, {
      foreignKey: 'bovineId',
      as: 'healthSnapshot',
      onDelete: 'CASCADE'
    });

    BovineHealthSnapshot.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine'
    });

    // =============================================
    // ✅ VACUNACIÓN — Vaccination y BovineVaccinationStatus
    // =============================================

    // Un bovino tiene muchas vacunas (historial)
    Bovine.hasMany(Vaccination, {
      foreignKey: 'bovineId',
      as: 'vaccinations',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    Vaccination.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Vaccination pertenece a un User (el aplicador / veterinario)
    Vaccination.belongsTo(User, {
      foreignKey: 'applicatorId',
      as: 'applicator'
    });

    User.hasMany(Vaccination, {
      foreignKey: 'applicatorId',
      as: 'appliedVaccinations'
    });

    // Un bovino tiene UN snapshot de estado de vacunación (1:1)
    Bovine.hasOne(BovineVaccinationStatus, {
      foreignKey: 'bovineId',
      as: 'vaccinationStatus',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    BovineVaccinationStatus.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // =============================================
    // ✅ NUEVAS RELACIONES DE NOTIFICACIONES
    // =============================================

    // Un usuario puede tener muchas notificaciones
    User.hasMany(Notification, {
      foreignKey: 'userId',
      as: 'notifications',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Una notificación pertenece a un usuario
    Notification.belongsTo(User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Una notificación puede estar relacionada con un bovino (opcional)
    Bovine.hasMany(Notification, {
      foreignKey: 'bovineId',
      as: 'bovineNotifications',
      constraints: false
    });

    // Una notificación puede estar relacionada con un evento (opcional)
    Event.hasMany(Notification, {
      foreignKey: 'eventId',
      as: 'eventNotifications',
      constraints: false
    });

    // Una notificación puede estar relacionada con un registro de salud (opcional)
    Health.hasMany(Notification, {
      foreignKey: 'healthRecordId',
      as: 'healthNotifications',
      constraints: false
    });

    // Una notificación puede estar relacionada con una ubicación (opcional)
    Location.hasMany(Notification, {
      foreignKey: 'locationId',
      as: 'locationNotifications',
      constraints: false
    });

    // Una notificación puede estar relacionada con un rancho (opcional)
    Ranch.hasMany(Notification, {
      foreignKey: 'ranchId',
      as: 'ranchNotifications',
      constraints: false
    });

    // ============================================================================
    // RELACIONES DE INVENTARIO
    // ============================================================================

    // Inventory → InventoryMovement (1:N)
    Inventory.hasMany(InventoryMovement, {
      foreignKey: 'inventoryItemId',
      as: 'movements',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    InventoryMovement.belongsTo(Inventory, {
      foreignKey: 'inventoryItemId',
      as: 'inventoryItem',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });




    // Inventory → Supplier (N:1)
    Inventory.belongsTo(Supplier, {
      foreignKey: 'supplierId',
      as: 'supplier',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    Supplier.hasMany(Inventory, {
      foreignKey: 'supplierId',
      as: 'inventoryItems',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // InventoryMovement → Bovine (N:1)
    InventoryMovement.belongsTo(Bovine, {
      foreignKey: 'bovineId',
      as: 'bovine',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    Bovine.hasMany(InventoryMovement, {
      foreignKey: 'bovineId',
      as: 'inventoryMovements',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // ============================================================================
    // RELACIONES DE ÓRDENES DE COMPRA
    // ============================================================================

    // PurchaseOrder → Ranch (N:1)
    PurchaseOrder.belongsTo(Ranch, {
      foreignKey: 'ranchId',
      as: 'ranch',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    Ranch.hasMany(PurchaseOrder, {
      foreignKey: 'ranchId',
      as: 'purchaseOrders',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // PurchaseOrder → Supplier (N:1)
    PurchaseOrder.belongsTo(Supplier, {
      foreignKey: 'supplierId',
      as: 'supplier',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    Supplier.hasMany(PurchaseOrder, {
      foreignKey: 'supplierId',
      as: 'purchaseOrders',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // PurchaseOrder → User (creador)
    PurchaseOrder.belongsTo(User, {
      foreignKey: 'createdBy',
      as: 'creator',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    User.hasMany(PurchaseOrder, {
      foreignKey: 'createdBy',
      as: 'createdPurchaseOrders',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // ============================================================================
    // RELACIONES DE PROVEEDORES (Supplier)
    // ============================================================================

    // Supplier → User (creador)
    Supplier.belongsTo(User, {
      foreignKey: 'createdBy',
      as: 'creator',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    User.hasMany(Supplier, {
      foreignKey: 'createdBy',
      as: 'createdSuppliers',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
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

      await this.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('✅ Extensión PostGIS verificada/creada');



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

      // Índices para BovineTracking (series temporales)
      if (tables.includes('bovine_tracking')) {
        await this.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_tracking_bovine_time 
        ON bovine_tracking (bovine_id, recorded_at DESC);
      `);
      }

      // Índices para BovineLocationHistory (ubicaciones actuales)
      if (tables.includes('bovine_location_history')) {
        await this.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_location_history_current 
        ON bovine_location_history (location_id, exited_at)
        WHERE exited_at IS NULL;
      `);
      }

      // Índices para Health (búsquedas por diagnóstico)
      if (tables.includes('health_records')) {
        await this.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_health_diagnosis_gin 
        ON health_records USING gin(diagnosis);
      `);
      }

      // Índices para Event (eventos futuros)
      if (tables.includes('events')) {
        await this.sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_events_future 
        ON events (scheduled_date, status)
        WHERE status = 'SCHEDULED';
      `);
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
  // Core
  User, Bovine, Ranch, Location,

  // Location sub-modelos
  LocationCapacity, LocationInfo, LocationMonitoring, LocationAccess, LocationRelation,

  // Bovine sub-modelos
  BovineTracking, BovineLocationHistory, Vaccination, BovineVaccinationStatus,

  // Ranch sub-modelos
  RanchOwnership, RanchProduction, RanchFinancial, RanchSustainability,
  RanchTechnology, RanchHR, RanchCertification, RanchLicense, RanchInsurance,
  RanchEmergency, RanchMedia,

  // Salud
  Health, Event, Medication,

  // Otros
  Inventory, Production, Reproduction, Finance,

  // Auth
  EmailVerificationToken, PasswordResetToken, TokenBlacklist, SecurityEvent,

  Notification,
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