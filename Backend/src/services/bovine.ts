import { Op, WhereOptions } from 'sequelize';
import Bovine, { 
  CattleType, 
  HealthStatus, 
  VaccinationStatus, 
  GenderType, 
  LocationData,
  PhysicalMetrics,
  ReproductiveInfo,
  TrackingConfig,
  BovineAttributes,
  BovineCreationAttributes,
  DiseaseEventData
} from '../models/Bovine';

// Importaciones correctas usando export default
import Health from '../models/Health';
import LocationModel from '../models/Location';
import Event from '../models/Event';
import Ranch from '../models/Ranch';

// Usar el logger correcto
import logger from '../utils/logger';

// Logger adaptador para mantener compatibilidad
const bovineLogger = {
  info: (message: string, metadata?: any) => logger.info(message, 'BovineService', metadata),
  error: (message: string, error?: any) => logger.error(message, 'BovineService', { error }),
  warn: (message: string, metadata?: any) => logger.warn(message, 'BovineService', metadata)
};
// Enums para eventos (mantenemos esto por ahora hasta usar el modelo Event real)
/*enum EventType {
  VACCINATION = "vaccination",
  ILLNESS = "illness",
  REPRODUCTIVE = "reproductive",
  TRANSFER = "transfer",
  MANAGEMENT = "management",
  HEALTH_CHECK = "health_check",
  FEEDING = "feeding",
  MILKING = "milking",
  PREGNANCY_CHECK = "pregnancy_check",
  BIRTH = "birth",
  DEATH = "death"
}*/

enum IllnessSeverity {
  MILD = "MILD",
  MODERATE = "MODERATE",
  SEVERE = "SEVERE",
  CRITICAL = "CRITICAL"
}

// Interfaces que usan los tipos del modelo real
interface Vaccination {
  id: string;
  bovineId: string;
  vaccineType: string;
  vaccineName: string;
  dose: string;
  applicationDate: Date;
  nextDueDate?: Date;
  veterinarianName: string;
  batchNumber: string;
  manufacturer: string;
  location: LocationData;
  notes?: string;
  sideEffects?: string[];
  createdAt: Date;
}

interface Illness {
  id: string;
  bovineId: string;
  diseaseName: string;
  diagnosisDate: Date;
  symptoms: string[];
  severity: IllnessSeverity;
  treatment?: string;
  veterinarianName: string;
  recoveryDate?: Date;
  location: LocationData;
  notes?: string;
  isContagious: boolean;
  createdAt: Date;
}

// Extendemos la interface del modelo para incluir relaciones
interface BovineModelWithRelations extends BovineAttributes {
  vaccinations?: Vaccination[];
  illnesses?: Illness[];
  photos?: string[];
  ranch?: {
    id: string;
    name: string;
    location: string;
  };
}

interface CreateBovineData {
  earTag: string;
  name?: string;
  cattleType: CattleType; // Usamos CattleType del modelo
  breed: string;
  gender: GenderType; // Usamos GenderType del modelo
  birthDate: Date;
  weight?: number;
  location: LocationData; // Usamos LocationData del modelo
  healthStatus?: HealthStatus;
  vaccinationStatus?: VaccinationStatus;
  notes?: string;
  farmId?: string; // Usamos farmId como en el modelo
  ownerId?: string;
  physicalMetrics?: PhysicalMetrics;
  reproductiveInfo?: ReproductiveInfo;
  trackingConfig?: TrackingConfig;
}

interface UpdateBovineData extends Partial<CreateBovineData> {
  id: string;
}

interface BovineFilters {
  searchTerm?: string;
  cattleType?: CattleType; // Cambiado de 'type' a 'cattleType'
  breed?: string;
  gender?: GenderType;
  healthStatus?: HealthStatus;
  vaccinationStatus?: VaccinationStatus;
  ageRange?: {
    min: number;
    max: number;
  };
  weightRange?: {
    min: number;
    max: number;
  };
  locationRadius?: {
    center: LocationData;
    radiusKm: number;
  };
  dateRange?: {
    field: "birthDate" | "createdAt" | "updatedAt";
    startDate: Date;
    endDate: Date;
  };
  farmId?: string; // Cambiado de ranchId a farmId
  ownerId?: string;
}

interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface BovineListResponse {
  bovines: BovineModelWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface LocationUpdateData {
  bovineId: string;
  location: LocationData;
  timestamp?: Date;
  source?: 'GPS' | 'MANUAL' | 'ESTIMATED';
  notes?: string;
}

interface BovineStatistics {
  totalBovines: number;
  totalByType: Record<CattleType, number>;
  totalByGender: Record<GenderType, number>;
  totalByHealthStatus: Record<HealthStatus, number>;
  totalByVaccinationStatus: Record<VaccinationStatus, number>;
  averageWeight: number;
  averageAge: number;
  upcomingVaccinations: number;
  sickAnimals: number;
  pregnantCows: number;
}

interface BovineEventData {
  bovineId: string;
  type: EventType;
  description: string;
  location: LocationData;
  userId: string;
  data?: any;
}

interface LocationRecordData {
  bovineId: string;
  location: LocationData;
  timestamp: Date;
  source: string;
  notes?: string;
  userId: string;
}

// Servicios temporales - reemplazar cuando estén disponibles
const geolocationService = {
  calculateDistance: (point1: LocationData, point2: LocationData): number => {
    // Fórmula de Haversine
    const R = 6371; // Radio de la Tierra en km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLng = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1.latitude * Math.PI / 180) * 
              Math.cos(point2.latitude * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },
  validateCoordinates: (location: LocationData): boolean => {
    return location.latitude >= -90 && location.latitude <= 90 &&
           location.longitude >= -180 && location.longitude <= 180;
  },
  getAddressFromCoordinates: async (location: LocationData): Promise<string> => {
    return `Lat: ${location.latitude}, Lng: ${location.longitude}`;
  }
};

const notificationService = {
  sendVaccinationReminder: async (bovineId: string, vaccineType: string): Promise<void> => {
    logger.info(`Enviando recordatorio de vacunación para bovino ${bovineId}: ${vaccineType}`);
  },
  sendHealthAlert: async (bovineId: string, healthStatus: HealthStatus): Promise<void> => {
    logger.info(`Alerta de salud para bovino ${bovineId}: ${healthStatus}`);
  }
};

class BovineService {
  /**
   * Obtiene la lista de bovinos con filtros y paginación
   * @param filters - Filtros de búsqueda
   * @param pagination - Opciones de paginación
   * @param userId - ID del usuario para verificar permisos
   * @returns Promise con la lista paginada de bovinos
   */
  async getBovines(
    filters: BovineFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 },
    userId: string
  ): Promise<BovineListResponse> {
    try {
      // Construir condiciones de filtrado
      const whereConditions = this.buildWhereConditions(filters);
      
      // Calcular offset para paginación
      const offset = (pagination.page - 1) * pagination.limit;
      
      // Configurar ordenamiento
      const orderClause = [[
        pagination.sortBy || 'createdAt',
        pagination.sortOrder || 'DESC'
      ]];

      // Obtener bovinos con filtros aplicados
      const bovines = await Bovine.findAll({
        where: whereConditions,
        limit: pagination.limit,
        offset,
        order: orderClause as any
      }) as BovineModelWithRelations[];

      // Contar total de registros
      const total = await Bovine.count({
        where: whereConditions
      });

      // Calcular información de paginación
      const totalPages = Math.ceil(total / pagination.limit);
      const hasNext = pagination.page < totalPages;
      const hasPrev = pagination.page > 1;

      bovineLogger.info(`Obtenidos ${bovines.length} bovinos para usuario ${userId}`, {
        total,
        filters,
        pagination
      });

      return {
        bovines,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      };

    } catch (error) {
      bovineLogger.error('Error obteniendo bovinos', error);
      throw error;
    }
  }

  /**
   * Obtiene un bovino específico por ID
   * @param bovineId - ID del bovino
   * @param userId - ID del usuario para verificar permisos
   * @returns Promise con los datos del bovino
   */
  async getBovineById(bovineId: string, userId: string): Promise<BovineModelWithRelations> {
    try {
      const bovine = await Bovine.findByPk(bovineId) as BovineModelWithRelations | null;

      if (!bovine) {
        throw new Error('Bovino no encontrado');
      }

      bovineLogger.info(`Bovino ${bovineId} obtenido por usuario ${userId}`);
      return bovine;

    } catch (error) {
      bovineLogger.error(`Error obteniendo bovino ${bovineId}`, error);
      throw error;
    }
  }

  /**
   * Obtiene un bovino por su etiqueta de oreja
   * @param earTag - Etiqueta de oreja del bovino
   * @param farmId - ID de la finca (opcional)
   * @returns Promise con los datos del bovino
   */
  async getBovineByEarTag(earTag: string, farmId?: string): Promise<BovineModelWithRelations | null> {
    try {
      const whereConditions: any = { earTag };
      if (farmId) {
        whereConditions.farmId = farmId;
      }

      const bovine = await Bovine.findOne({
        where: whereConditions
      }) as BovineModelWithRelations | null;

      return bovine;

    } catch (error) {
      bovineLogger.error(`Error obteniendo bovino por earTag ${earTag}`, error);
      throw error;
    }
  }

  /**
   * Crea un nuevo bovino
   * @param bovineData - Datos del bovino a crear
   * @param userId - ID del usuario que crea el bovino
   * @returns Promise con el bovino creado
   */
  async createBovine(bovineData: CreateBovineData, userId: string): Promise<BovineModelWithRelations> {
    try {
      // Validar que no exista otro bovino con la misma etiqueta en la finca
      const existingBovine = await this.getBovineByEarTag(bovineData.earTag, bovineData.farmId);
      if (existingBovine) {
        throw new Error(`Ya existe un bovino con la etiqueta ${bovineData.earTag} en esta finca`);
      }

      // Validar coordenadas
      if (!geolocationService.validateCoordinates(bovineData.location)) {
        throw new Error('Coordenadas de ubicación inválidas');
      }

      // Validar datos del bovino
      this.validateBovineData(bovineData);

      // Asignar valores por defecto
      const healthStatus = bovineData.healthStatus || HealthStatus.HEALTHY;
      const vaccinationStatus = bovineData.vaccinationStatus || VaccinationStatus.NONE;

      // Crear el bovino usando el modelo real
      const newBovine = await Bovine.create({
        ...bovineData,
        healthStatus,
        vaccinationStatus,
        isActive: true
      } as BovineCreationAttributes) as BovineModelWithRelations;

      // Crear evento de registro del bovino
      await this.createBovineEvent({
        bovineId: newBovine.id,
        type: EventType.MANAGEMENT,
        description: `Bovino ${newBovine.earTag} registrado en el sistema`,
        location: bovineData.location,
        userId,
        data: { action: 'register' }
      });

      bovineLogger.info(`Bovino creado: ${newBovine.earTag} por usuario ${userId}`, {
        bovineId: newBovine.id,
        earTag: newBovine.earTag
      });
      
      return newBovine;

    } catch (error) {
      bovineLogger.error('Error creando bovino', error);
      throw error;
    }
  }

  /**
   * Actualiza un bovino existente
   * @param updateData - Datos a actualizar
   * @param userId - ID del usuario que actualiza
   * @returns Promise con el bovino actualizado
   */
  async updateBovine(updateData: UpdateBovineData, userId: string): Promise<BovineModelWithRelations> {
    try {
      // Verificar que el bovino existe
      const existingBovine = await this.getBovineById(updateData.id, userId);

      // Si se está actualizando la etiqueta, verificar que no existe otra igual
      if (updateData.earTag && updateData.earTag !== existingBovine.earTag) {
        const bovineWithSameTag = await this.getBovineByEarTag(updateData.earTag, existingBovine.farmId);
        if (bovineWithSameTag && bovineWithSameTag.id !== updateData.id) {
          throw new Error(`Ya existe un bovino con la etiqueta ${updateData.earTag} en esta finca`);
        }
      }

      // Validar nuevas coordenadas si se proporcionan
      if (updateData.location && !geolocationService.validateCoordinates(updateData.location)) {
        throw new Error('Coordenadas de ubicación inválidas');
      }

      // Preparar datos de actualización
      const { id, ...updatePayload } = updateData;

      // Actualizar el bovino usando el modelo real
      await Bovine.update(updatePayload, {
        where: { id: updateData.id }
      });

      // Obtener el bovino actualizado
      const updatedBovine = await this.getBovineById(updateData.id, userId);

      // Crear evento de actualización
      await this.createBovineEvent({
        bovineId: updateData.id,
        type: EventType.MANAGEMENT,
        description: `Información del bovino ${updatedBovine.earTag} actualizada`,
        location: updateData.location || existingBovine.location,
        userId,
        data: { action: 'update', changes: updateData }
      });

      // Verificar si hay cambios críticos de salud
      if (updateData.healthStatus && updateData.healthStatus !== existingBovine.healthStatus) {
        await this.handleHealthStatusChange(updatedBovine, existingBovine.healthStatus, updateData.healthStatus);
      }

      bovineLogger.info(`Bovino actualizado: ${updatedBovine.earTag} por usuario ${userId}`, {
        bovineId: updateData.id,
        changes: Object.keys(updateData)
      });
      
      return updatedBovine;

    } catch (error) {
      bovineLogger.error(`Error actualizando bovino ${updateData.id}`, error);
      throw error;
    }
  }

  /**
   * Elimina un bovino (soft delete)
   * @param bovineId - ID del bovino a eliminar
   * @param userId - ID del usuario que elimina
   * @returns Promise<void>
   */
  async deleteBovine(bovineId: string, userId: string): Promise<void> {
    try {
      // Verificar que el bovino existe
      const bovine = await this.getBovineById(bovineId, userId);

      // Usar soft delete del modelo (paranoid: true)
      await Bovine.destroy({
        where: { id: bovineId }
      });

      // Crear evento de eliminación
      await this.createBovineEvent({
        bovineId,
        type: EventType.MANAGEMENT,
        description: `Bovino ${bovine.earTag} eliminado del sistema`,
        location: bovine.location,
        userId,
        data: { action: 'delete' }
      });

      bovineLogger.info(`Bovino eliminado: ${bovine.earTag} por usuario ${userId}`, {
        bovineId,
        earTag: bovine.earTag
      });

    } catch (error) {
      bovineLogger.error(`Error eliminando bovino ${bovineId}`, error);
      throw error;
    }
  }

  /**
   * Actualiza la ubicación de un bovino
   * @param locationData - Datos de ubicación
   * @param userId - ID del usuario
   * @returns Promise<void>
   */
  async updateBovineLocation(locationData: LocationUpdateData, userId: string): Promise<void> {
    try {
      // Verificar que el bovino existe
      const bovine = await this.getBovineById(locationData.bovineId, userId);

      // Validar coordenadas
      if (!geolocationService.validateCoordinates(locationData.location)) {
        throw new Error('Coordenadas de ubicación inválidas');
      }

      // Actualizar ubicación en el bovino
      await Bovine.update(
        {
          location: {
            ...locationData.location,
            timestamp: locationData.timestamp || new Date(),
            source: locationData.source || 'MANUAL'
          }
        },
        { where: { id: locationData.bovineId } }
      );

      // Crear registro de ubicación histórica
      await this.createLocationRecord({
        bovineId: locationData.bovineId,
        location: locationData.location,
        timestamp: locationData.timestamp || new Date(),
        source: locationData.source || 'MANUAL',
        notes: locationData.notes,
        userId
      });

      // Crear evento de transferencia
      await this.createBovineEvent({
        bovineId: locationData.bovineId,
        type: EventType.TRANSFER,
        description: `Ubicación actualizada para bovino ${bovine.earTag}`,
        location: locationData.location,
        userId,
        data: {
          previousLocation: bovine.location,
          newLocation: locationData.location,
          source: locationData.source
        }
      });

      bovineLogger.info(`Ubicación actualizada para bovino ${locationData.bovineId} por usuario ${userId}`, {
        bovineId: locationData.bovineId,
        newLocation: locationData.location
      });

    } catch (error) {
      bovineLogger.error(`Error actualizando ubicación del bovino ${locationData.bovineId}`, error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas generales de bovinos
   * @param farmId - ID de la finca (opcional)
   * @param userId - ID del usuario
   * @returns Promise con estadísticas
   */
  async getBovineStatistics(farmId?: string, userId?: string): Promise<BovineStatistics> {
    try {
      const whereConditions: any = { isActive: true };
      if (farmId) {
        whereConditions.farmId = farmId;
      }

      // Obtener conteos básicos
      const totalBovines = await Bovine.count({ where: whereConditions });

      // Conteos por tipo
      const totalByType = {} as Record<CattleType, number>;
      for (const type of Object.values(CattleType)) {
        totalByType[type] = await Bovine.count({
          where: { ...whereConditions, cattleType: type }
        });
      }

      // Conteos por género
      const totalByGender = {} as Record<GenderType, number>;
      for (const gender of Object.values(GenderType)) {
        totalByGender[gender] = await Bovine.count({
          where: { ...whereConditions, gender }
        });
      }

      // Conteos por estado de salud
      const totalByHealthStatus = {} as Record<HealthStatus, number>;
      for (const status of Object.values(HealthStatus)) {
        totalByHealthStatus[status] = await Bovine.count({
          where: { ...whereConditions, healthStatus: status }
        });
      }

      // Conteos por estado de vacunación
      const totalByVaccinationStatus = {} as Record<VaccinationStatus, number>;
      for (const status of Object.values(VaccinationStatus)) {
        totalByVaccinationStatus[status] = await Bovine.count({
          where: { ...whereConditions, vaccinationStatus: status }
        });
      }

      // Calcular promedios usando datos reales
      const bovines = await Bovine.findAll({ 
        where: whereConditions,
        attributes: ['weight', 'birthDate']
      });

      const validWeights = bovines.filter(b => b.weight).map(b => b.weight!);
      const averageWeight = validWeights.length > 0 
        ? validWeights.reduce((sum, weight) => sum + weight, 0) / validWeights.length 
        : 0;

      // Calcular edad promedio en meses
      const now = new Date();
      const ages = bovines.map(bovine => {
        const birthDate = new Date(bovine.birthDate);
        const diffTime = Math.abs(now.getTime() - birthDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // meses
      });
      
      const averageAge = ages.length > 0 
        ? ages.reduce((sum, age) => sum + age, 0) / ages.length 
        : 0;

      const upcomingVaccinations = totalByVaccinationStatus[VaccinationStatus.PENDING] || 0;
      const sickAnimals = (totalByHealthStatus[HealthStatus.SICK] || 0) + 
                         (totalByHealthStatus[HealthStatus.QUARANTINE] || 0);

      // Contar vacas preñadas usando información reproductiva
      const pregnantCows = await Bovine.count({
        where: {
          ...whereConditions,
          'reproductiveInfo.isPregnant': true
        }
      });

      const stats = {
        totalBovines,
        totalByType,
        totalByGender,
        totalByHealthStatus,
        totalByVaccinationStatus,
        averageWeight: Math.round(averageWeight * 100) / 100,
        averageAge: Math.round(averageAge * 100) / 100,
        upcomingVaccinations,
        sickAnimals,
        pregnantCows
      };

      bovineLogger.info('Estadísticas de bovinos calculadas', { farmId, totalBovines, userId });
      return stats;

    } catch (error) {
      bovineLogger.error('Error obteniendo estadísticas de bovinos', error);
      throw error;
    }
  }

  /**
   * Busca bovinos por ubicación (radio de búsqueda)
   * @param centerLocation - Ubicación central
   * @param radiusKm - Radio de búsqueda en kilómetros
   * @param userId - ID del usuario
   * @returns Promise con bovinos en el área
   */
  async getBovinesByLocation(
    centerLocation: LocationData,
    radiusKm: number,
    userId: string
  ): Promise<BovineModelWithRelations[]> {
    try {
      // Validar coordenadas
      if (!geolocationService.validateCoordinates(centerLocation)) {
        throw new Error('Coordenadas de ubicación inválidas');
      }

      // Obtener todos los bovinos activos
      const allBovines = await Bovine.findAll({
        where: { isActive: true }
      }) as BovineModelWithRelations[];

      // Filtrar por distancia
      const bovinesInRadius = allBovines.filter(bovine => {
        const distance = geolocationService.calculateDistance(
          centerLocation,
          bovine.location
        );
        return distance <= radiusKm;
      });

      bovineLogger.info(`Encontrados ${bovinesInRadius.length} bovinos en radio de ${radiusKm}km`, {
        centerLocation,
        radiusKm,
        totalChecked: allBovines.length,
        userId
      });
      
      return bovinesInRadius;

    } catch (error) {
      bovineLogger.error('Error buscando bovinos por ubicación', error);
      throw error;
    }
  }

  /**
   * Construye las condiciones WHERE para los filtros
   * @param filters - Filtros aplicados
   * @returns Objeto con condiciones de Sequelize
   */
  private buildWhereConditions(filters: BovineFilters): WhereOptions {
    const conditions: any = { isActive: true };

    if (filters.searchTerm) {
      conditions[Op.or] = [
        { earTag: { [Op.iLike]: `%${filters.searchTerm}%` } },
        { name: { [Op.iLike]: `%${filters.searchTerm}%` } },
        { breed: { [Op.iLike]: `%${filters.searchTerm}%` } }
      ];
    }

    if (filters.cattleType) {
      conditions.cattleType = filters.cattleType;
    }

    if (filters.breed) {
      conditions.breed = { [Op.iLike]: `%${filters.breed}%` };
    }

    if (filters.gender) {
      conditions.gender = filters.gender;
    }

    if (filters.healthStatus) {
      conditions.healthStatus = filters.healthStatus;
    }

    if (filters.vaccinationStatus) {
      conditions.vaccinationStatus = filters.vaccinationStatus;
    }

    if (filters.farmId) {
      conditions.farmId = filters.farmId;
    }

    if (filters.ownerId) {
      conditions.ownerId = filters.ownerId;
    }

    if (filters.weightRange) {
      conditions.weight = {
        [Op.between]: [filters.weightRange.min, filters.weightRange.max]
      };
    }

    if (filters.dateRange) {
      conditions[filters.dateRange.field] = {
        [Op.between]: [filters.dateRange.startDate, filters.dateRange.endDate]
      };
    }

    return conditions;
  }

  /**
   * Valida los datos del bovino antes de crear o actualizar
   * @param bovineData - Datos a validar
   * @throws Error si los datos no son válidos
   */
  private validateBovineData(bovineData: Partial<CreateBovineData>): void {
    if (bovineData.earTag && bovineData.earTag.length < 3) {
      throw new Error('La etiqueta de oreja debe tener al menos 3 caracteres');
    }

    if (bovineData.weight && (bovineData.weight < 1 || bovineData.weight > 2000)) {
      throw new Error('El peso debe estar entre 1 y 2000 kg');
    }

    if (bovineData.birthDate && bovineData.birthDate > new Date()) {
      throw new Error('La fecha de nacimiento no puede ser futura');
    }

    if (bovineData.breed && bovineData.breed.length < 2) {
      throw new Error('La raza debe tener al menos 2 caracteres');
    }
  }

  /**
   * Maneja cambios en el estado de salud del bovino
   * @param bovine - Bovino actualizado
   * @param previousStatus - Estado anterior
   * @param newStatus - Nuevo estado
   */
  private async handleHealthStatusChange(
    bovine: BovineModelWithRelations,
    previousStatus: HealthStatus,
    newStatus: HealthStatus
  ): Promise<void> {
    try {
      // Enviar notificaciones según el cambio de estado
      if (newStatus === HealthStatus.SICK || newStatus === HealthStatus.QUARANTINE) {
        await notificationService.sendHealthAlert(bovine.id, newStatus);
      }

      // Crear evento de cambio de estado de salud
      await this.createBovineEvent({
        bovineId: bovine.id,
        type: EventType.HEALTH_CHECK,
        description: `Estado de salud cambiado de ${previousStatus} a ${newStatus}`,
        location: bovine.location,
        userId: 'system',
        data: {
          previousStatus,
          newStatus
        }
      });

      bovineLogger.info(`Estado de salud cambiado para bovino ${bovine.earTag}: ${previousStatus} -> ${newStatus}`, {
        bovineId: bovine.id,
        previousStatus,
        newStatus
      });

    } catch (error) {
      bovineLogger.error('Error manejando cambio de estado de salud', error);
    }
  }

  /**
   * Crea un evento relacionado con el bovino
   * @param eventData - Datos del evento
   */
  private async createBovineEvent(eventData: BovineEventData): Promise<void> {
    try {
      // TODO: Implementar con el modelo Event real cuando esté disponible
      // Por ahora solo loggeamos el evento
      bovineLogger.info('Evento de bovino creado', {
        bovineId: eventData.bovineId,
        type: eventData.type,
        description: eventData.description
      });
      
    } catch (error) {
      bovineLogger.error('Error creando evento de bovino', error);
    }
  }

  /**
   * Crea un registro de ubicación histórica
   * @param locationData - Datos de ubicación
   */
  private async createLocationRecord(locationData: LocationRecordData): Promise<void> {
    try {
      // TODO: Implementar con el modelo LocationModel real cuando esté disponible
      // Por ahora solo loggeamos el registro de ubicación
      bovineLogger.info('Registro de ubicación creado', {
        bovineId: locationData.bovineId,
        location: locationData.location,
        source: locationData.source
      });
      
    } catch (error) {
      bovineLogger.error('Error creando registro de ubicación', error);
    }
  }
}

// Exportar instancia única del servicio
export const bovineService = new BovineService();