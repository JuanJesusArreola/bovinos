// services/ranch/RanchService.ts
import { Op, Transaction } from 'sequelize';
import sequelize from '../../config/database';
import logger from '../../utils/logger';
import { RanchNotFoundError, RanchValidationError, RanchCapacityError } from '../../utils/RanchErrors';
import { ensureError } from '../../utils/errorUtils';

import Ranch, { RanchAttributes, RanchCreationAttributes, RanchType, RanchStatus } from '../../models/Ranch';
import Bovine from '../../models/Bovine';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateRanchDTO {
  ranchCode: string;
  name: string;
  type: RanchType;
  address: string;
  city: string;
  state: string;
  country: string;
  timezone?: string;                 // opcional
  coordinates: any;                 // LocationData
  landTenure: any;
  climateZone: any;
  elevation?: number;               // opcional
  annualRainfall?: number;          // opcional
  averageTemperature?: number;      // opcional
  totalArea: number;
  grazingArea: number;
  maxCattleCapacity: number;
  currentCattleCount?: number;
  status?: RanchStatus;             // opcional (por si se envía)
  isActive?: boolean;
  isVerified?: boolean;             // ✅ Agregado
  createdBy: string;
}

export interface UpdateRanchDTO extends Partial<CreateRanchDTO> {
  id: string;
  updatedBy: string;
}

export interface RanchFilters {
  type?: RanchType[];
  status?: RanchStatus[];
  isActive?: boolean;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface RanchSummary {
  id: string;
  ranchCode: string;
  name: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  totalArea: number;
  grazingArea: number;
  maxCattleCapacity: number;
  currentCattleCount: number;
  occupancyRate: number;        // current / max * 100
  cattleDensity: number;         // currentCattleCount / totalArea (animales/ha)
  isAtCapacity: boolean;
  availableCapacity: number;
  coordinates: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class RanchCoreService {
  private readonly context = 'RanchCoreService';

  // ==========================================================================
  // CRUD
  // ==========================================================================

  async createRanch(data: CreateRanchDTO, transaction?: Transaction): Promise<Ranch> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      // Verificar que el código no exista
      const existing = await Ranch.findOne({ where: { ranchCode: data.ranchCode }, transaction: t });
      if (existing) {
        throw new RanchValidationError(`Ya existe un rancho con código ${data.ranchCode}`);
      }

      // Validar área de pastoreo vs total
      if (data.grazingArea > data.totalArea) {
        throw new RanchValidationError('El área de pastoreo no puede exceder el área total');
      }

      // Si no se especifica currentCattleCount, se inicializa en 0
      const currentCattleCount = data.currentCattleCount ?? 0;
      if (currentCattleCount > data.maxCattleCapacity) {
        throw new RanchValidationError('El ganado actual no puede exceder la capacidad máxima');
      }

      const ranchData: RanchCreationAttributes = {
        ranchCode: data.ranchCode,
        name: data.name,
        type: data.type,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        timezone: data.timezone || 'America/Mexico_City',
        coordinates: data.coordinates,
        landTenure: data.landTenure,
        climateZone: data.climateZone,
        elevation: data.elevation,
        annualRainfall: data.annualRainfall,
        averageTemperature: data.averageTemperature,
        totalArea: data.totalArea,
        grazingArea: data.grazingArea,
        maxCattleCapacity: data.maxCattleCapacity,
        currentCattleCount,
        status: data.status || RanchStatus.ACTIVE,
        isActive: data.isActive ?? true,
        isVerified: data.isVerified ?? false,
        createdBy: data.createdBy,
      };

      const ranch = await Ranch.create(ranchData, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Rancho creado: ${ranch.id}`, this.context, {
        ranchId: ranch.id,
        name: ranch.name,
        createdBy: data.createdBy,
        durationMs: Date.now() - startTime,
      });

      return ranch;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error('Error creando rancho', this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async updateRanch(data: UpdateRanchDTO, transaction?: Transaction): Promise<Ranch> {
    const t = transaction || await sequelize.transaction();
    const isOwnTransaction = !transaction;
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(data.id, { transaction: t });
      if (!ranch) throw new RanchNotFoundError(data.id);

      // Validar área de pastoreo vs total si se actualizan
      if (data.grazingArea && data.totalArea && data.grazingArea > data.totalArea) {
        throw new RanchValidationError('El área de pastoreo no puede exceder el área total');
      }

      // Validar capacidad
      if (data.maxCattleCapacity && data.currentCattleCount && data.currentCattleCount > data.maxCattleCapacity) {
        throw new RanchValidationError('El ganado actual no puede exceder la capacidad máxima');
      }

      await ranch.update(data, { transaction: t });

      if (isOwnTransaction) await t.commit();

      logger.info(`Rancho actualizado: ${data.id}`, this.context, {
        ranchId: data.id,
        updatedBy: data.updatedBy,
        durationMs: Date.now() - startTime,
      });

      return ranch;
    } catch (error) {
      if (isOwnTransaction) await t.rollback();
      logger.error(`Error actualizando rancho ${data.id}`, this.context, { data }, ensureError(error));
      throw error;
    }
  }

  async deleteRanch(id: string, deletedBy: string): Promise<void> {
    const transaction = await sequelize.transaction();
    const startTime = Date.now();

    try {
      const ranch = await Ranch.findByPk(id, { transaction });
      if (!ranch) throw new RanchNotFoundError(id);

      await ranch.destroy({ transaction });
      await transaction.commit();

      logger.info(`Rancho eliminado (soft): ${id}`, this.context, {
        ranchId: id,
        deletedBy,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      await transaction.rollback();
      logger.error(`Error eliminando rancho ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async getRanchById(id: string): Promise<Ranch | null> {
    try {
      return await Ranch.findByPk(id);
    } catch (error) {
      logger.error(`Error obteniendo rancho por ID ${id}`, this.context, { id }, ensureError(error));
      throw error;
    }
  }

  async listRanches(filters: RanchFilters = {}): Promise<{ rows: Ranch[]; count: number }> {
    try {
      const where: any = {};
      if (filters.type?.length) where.type = { [Op.in]: filters.type };
      if (filters.status?.length) where.status = { [Op.in]: filters.status };
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.searchTerm) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${filters.searchTerm}%` } },
          { ranchCode: { [Op.iLike]: `%${filters.searchTerm}%` } },
        ];
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const { rows, count } = await Ranch.findAndCountAll({
        where,
        limit,
        offset,
        order: [['name', 'ASC']],
      });

      logger.debug(`Ranchos listados`, this.context, { count, filters });
      return { rows, count };
    } catch (error) {
      logger.error('Error listando ranchos', this.context, { filters }, ensureError(error));
      throw error;
    }
  }

  // ==========================================================================
  // MÉTRICAS DE CAPACIDAD Y OCUPACIÓN
  // ==========================================================================

  async getOccupancyRate(ranchId: string): Promise<number> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);
    if (ranch.maxCattleCapacity === 0) return 0;
    return (ranch.currentCattleCount / ranch.maxCattleCapacity) * 100;
  }

  async getAvailableCapacity(ranchId: string): Promise<number> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);
    return Math.max(0, ranch.maxCattleCapacity - ranch.currentCattleCount);
  }

  async isAtCapacity(ranchId: string): Promise<boolean> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);
    return ranch.currentCattleCount >= ranch.maxCattleCapacity;
  }

  async getCattleDensity(ranchId: string): Promise<number> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);
    if (ranch.totalArea === 0) return 0;
    return ranch.currentCattleCount / ranch.totalArea; // animales por hectárea
  }

  // ==========================================================================
  // UTILIDADES DE ETIQUETAS
  // ==========================================================================

  getRanchTypeLabel(type: RanchType): string {
    const labels: Record<RanchType, string> = {
      DAIRY: 'Lechero',
      BEEF: 'Carne',
      MIXED: 'Mixto',
      BREEDING: 'Reproducción/Cría',
      FEEDLOT: 'Engorda',
      ORGANIC: 'Orgánico',
      SUSTAINABLE: 'Sostenible',
      COMMERCIAL: 'Comercial',
      FAMILY_FARM: 'Familiar',
      COOPERATIVE: 'Cooperativa',
      CORPORATE: 'Corporativo',
      RESEARCH: 'Investigación',
      EDUCATIONAL: 'Educativo',
    };
    return labels[type] || type;
  }

  getStatusLabel(status: RanchStatus): string {
    const labels: Record<RanchStatus, string> = {
      ACTIVE: 'Activo',
      INACTIVE: 'Inactivo',
      UNDER_CONSTRUCTION: 'En construcción',
      RENOVATION: 'En renovación',
      TEMPORARY_CLOSURE: 'Cierre temporal',
      PERMANENT_CLOSURE: 'Cierre permanente',
      QUARANTINE: 'En cuarentena',
      SUSPENDED: 'Suspendido',
      PENDING_APPROVAL: 'Pendiente de aprobación',
    };
    return labels[status] || status;
  }

  // ==========================================================================
  // RESUMEN COMPLETO DEL RANCHO
  // ==========================================================================

  async getRanchSummary(ranchId: string): Promise<RanchSummary> {
    const ranch = await Ranch.findByPk(ranchId);
    if (!ranch) throw new RanchNotFoundError(ranchId);

    const occupancyRate = ranch.maxCattleCapacity === 0 ? 0 : (ranch.currentCattleCount / ranch.maxCattleCapacity) * 100;
    const cattleDensity = ranch.totalArea === 0 ? 0 : ranch.currentCattleCount / ranch.totalArea;
    const availableCapacity = Math.max(0, ranch.maxCattleCapacity - ranch.currentCattleCount);
    const isAtCapacity = ranch.currentCattleCount >= ranch.maxCattleCapacity;

    return {
      id: ranch.id,
      ranchCode: ranch.ranchCode,
      name: ranch.name,
      type: ranch.type,
      typeLabel: this.getRanchTypeLabel(ranch.type),
      status: ranch.status,
      statusLabel: this.getStatusLabel(ranch.status),
      totalArea: ranch.totalArea,
      grazingArea: ranch.grazingArea,
      maxCattleCapacity: ranch.maxCattleCapacity,
      currentCattleCount: ranch.currentCattleCount,
      occupancyRate,
      cattleDensity,
      isAtCapacity,
      availableCapacity,
      coordinates: ranch.coordinates,
      isActive: ranch.isActive,
      createdAt: ranch.createdAt,
      updatedAt: ranch.updatedAt,
    };
  }
}

export const ranchCoreService = new RanchCoreService();