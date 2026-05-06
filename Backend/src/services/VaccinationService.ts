// services/VaccinationService.ts
// ============================================================================
// VACCINATION SERVICE
// ============================================================================
// CRUD de vacunas + sincronización con `BovineVaccinationStatus`.
//
// Decisión de diseño: la actualización del cache de status NO se hace por
// hook Sequelize (los hooks complican transacciones bulk), sino con llamada
// EXPLÍCITA desde este service después de cada mutación. Más predecible y
// fácil de testear.
// ============================================================================

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { ensureError } from '../utils/errorUtils';
import {
  BovineError,
  BovineNotFoundError,
  BovineValidationError,
} from '../utils/BovineErrors';

import Bovine from '../models/Bovine';
import User from '../models/User';
import Vaccination, {
  VaccineType,
  ApplicationRoute,
} from '../models/Vaccination';

import { bovineVaccinationStatusService } from './BovineVaccinationStatusService';
import { bovineFullService } from './BovineFullService';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

export interface CreateVaccinationInput {
  bovineId: string;
  vaccineType: VaccineType;
  vaccineName?: string;
  manufacturer?: string;
  batchNumber?: string;
  doseNumber?: number;
  doseAmountMl?: number;
  applicationRoute?: ApplicationRoute;
  applicationDate: Date | string;
  nextDueDate?: Date | string;
  applicatorId: string;
  withdrawalPeriodDays?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ListVaccinationsFilters {
  bovineId: string;
  vaccineType?: VaccineType;
  fromDate?: Date | string;
  toDate?: Date | string;
  applicatorId?: string;
  limit?: number;
  offset?: number;
}

export interface VaccinationListItem {
  id: string;
  bovineId: string;
  vaccineType: VaccineType;
  vaccineName: string | null;
  manufacturer: string | null;
  batchNumber: string | null;
  doseNumber: number;
  doseAmountMl: number | null;
  applicationRoute: ApplicationRoute | null;
  applicationDate: Date;
  nextDueDate: Date | null;
  applicatorId: string;
  applicatorName: string | null;
  withdrawalPeriodDays: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface VaccinationListResult {
  total: number;
  limit: number;
  offset: number;
  items: VaccinationListItem[];
}

// ============================================================================
// SERVICIO
// ============================================================================

export class VaccinationService {
  private readonly context = 'VaccinationService';

  // ==========================================================================
  // LECTURA
  // ==========================================================================

  /**
   * Lista vacunas de un bovino con filtros y paginación.
   * Hace lookup batch del nombre del aplicador (User) en una sola query.
   */
  async listByBovine(filters: ListVaccinationsFilters): Promise<VaccinationListResult> {
    try {
      const limit = Math.min(Math.max(filters.limit ?? 20, 1), 200);
      const offset = Math.max(filters.offset ?? 0, 0);

      const where: any = { bovineId: filters.bovineId };
      if (filters.vaccineType) where.vaccineType = filters.vaccineType;
      if (filters.applicatorId) where.applicatorId = filters.applicatorId;
      if (filters.fromDate || filters.toDate) {
        where.applicationDate = {};
        if (filters.fromDate) where.applicationDate[Op.gte] = new Date(filters.fromDate);
        if (filters.toDate) where.applicationDate[Op.lte] = new Date(filters.toDate);
      }

      const { rows, count } = await Vaccination.findAndCountAll({
        where,
        order: [['applicationDate', 'DESC']],
        limit,
        offset,
      });

      // Lookup batch de nombres de aplicadores
      const applicatorIds = Array.from(new Set(rows.map((r) => r.applicatorId)));
      const applicatorNameMap = new Map<string, string>();
      if (applicatorIds.length > 0) {
        const users = await User.findAll({
          where: { id: applicatorIds },
          attributes: ['id', 'firstName', 'lastName', 'username'] as any,
        });
        for (const u of users) {
          const u_any: any = u;
          const fullName = [u_any.firstName, u_any.lastName].filter(Boolean).join(' ').trim();
          applicatorNameMap.set(u_any.id, fullName || u_any.username || '');
        }
      }

      const items: VaccinationListItem[] = rows.map((v) => ({
        id: v.id,
        bovineId: v.bovineId,
        vaccineType: v.vaccineType,
        vaccineName: v.vaccineName ?? null,
        manufacturer: v.manufacturer ?? null,
        batchNumber: v.batchNumber ?? null,
        doseNumber: v.doseNumber,
        doseAmountMl: v.doseAmountMl ?? null,
        applicationRoute: v.applicationRoute ?? null,
        applicationDate: v.applicationDate,
        nextDueDate: v.nextDueDate ?? null,
        applicatorId: v.applicatorId,
        applicatorName: applicatorNameMap.get(v.applicatorId) ?? null,
        withdrawalPeriodDays: v.withdrawalPeriodDays ?? null,
        notes: v.notes ?? null,
        createdAt: v.createdAt,
      }));

      return { total: count, limit, offset, items };
    } catch (error) {
      logger.error(
        `Error listando vacunas del bovino ${filters.bovineId}`,
        this.context,
        { filters },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Obtiene una vacuna por ID. 404 si no existe.
   */
  async getById(id: string): Promise<Vaccination> {
    const v = await Vaccination.findByPk(id);
    if (!v) {
      throw new BovineError('Vacuna no encontrada', 'VACCINATION_NOT_FOUND', 404);
    }
    return v;
  }

  // ==========================================================================
  // ESCRITURA
  // ==========================================================================

  /**
   * Registra una nueva vacuna y recalcula el cache de status del bovino.
   * Todo en una transacción. Detecta duplicados (mismo tipo + misma fecha).
   */
  async create(input: CreateVaccinationInput): Promise<Vaccination> {
    const t = await sequelize.transaction();
    try {
      // Verificar bovino existe
      const bovine = await Bovine.findByPk(input.bovineId, { transaction: t });
      if (!bovine) {
        throw new BovineNotFoundError(input.bovineId);
      }

      // Verificar applicator (User) existe
      const applicator = await User.findByPk(input.applicatorId, { transaction: t });
      if (!applicator) {
        throw new BovineValidationError(
          `Aplicador con ID ${input.applicatorId} no encontrado`
        );
      }

      const applicationDate = new Date(input.applicationDate);
      const nextDueDate = input.nextDueDate ? new Date(input.nextDueDate) : undefined;

      // Detectar duplicado: mismo bovino + mismo tipo + misma fecha
      const existing = await Vaccination.findOne({
        where: {
          bovineId: input.bovineId,
          vaccineType: input.vaccineType,
          applicationDate,
        },
        transaction: t,
      });
      if (existing) {
        throw new BovineError(
          'Ya existe una vacuna de este tipo registrada en la misma fecha para este bovino.',
          'VACCINATION_DUPLICATE',
          409
        );
      }

      const created = await Vaccination.create(
        {
          bovineId: input.bovineId,
          vaccineType: input.vaccineType,
          vaccineName: input.vaccineName,
          manufacturer: input.manufacturer,
          batchNumber: input.batchNumber,
          doseNumber: input.doseNumber ?? 1,
          doseAmountMl: input.doseAmountMl,
          applicationRoute: input.applicationRoute,
          applicationDate,
          nextDueDate,
          applicatorId: input.applicatorId,
          withdrawalPeriodDays: input.withdrawalPeriodDays,
          notes: input.notes,
          metadata: input.metadata,
        } as any,
        { transaction: t }
      );

      // Recalcular cache de estado de vacunación (dentro de la misma tx)
      await bovineVaccinationStatusService.recompute(input.bovineId, t);

      await t.commit();

      // Invalidar cache compuesto del bovino
      bovineFullService.invalidate(input.bovineId);

      logger.info(
        `Vacuna registrada: ${created.id} (${input.vaccineType}) para bovino ${input.bovineId}`,
        this.context,
        { vaccinationId: created.id, bovineId: input.bovineId }
      );

      return created;
    } catch (error) {
      await t.rollback();
      logger.error(
        `Error registrando vacuna para bovino ${input.bovineId}`,
        this.context,
        { input },
        ensureError(error)
      );
      throw error;
    }
  }

  /**
   * Elimina (soft) una vacuna y recalcula el cache de status.
   */
  async delete(id: string): Promise<void> {
    const t = await sequelize.transaction();
    try {
      const v = await Vaccination.findByPk(id, { transaction: t });
      if (!v) {
        throw new BovineError('Vacuna no encontrada', 'VACCINATION_NOT_FOUND', 404);
      }
      const bovineId = v.bovineId;
      await v.destroy({ transaction: t });
      await bovineVaccinationStatusService.recompute(bovineId, t);
      await t.commit();
      // Invalidar cache compuesto del bovino
      bovineFullService.invalidate(bovineId);
      logger.info(`Vacuna eliminada: ${id}`, this.context, { vaccinationId: id });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

// ============================================================================
// INSTANCIA ÚNICA
// ============================================================================

export const vaccinationService = new VaccinationService();
