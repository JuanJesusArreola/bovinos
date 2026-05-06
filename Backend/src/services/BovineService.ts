// modules/bovine/services/BovineService.ts
import Sequelize, { Op, WhereOptions, Transaction } from 'sequelize';
import { randomBytes } from 'crypto';
import Bovine, {
    CattleType,
    HealthStatus,
    VaccinationStatus,
    GenderType,
    LocationData,
    BovineCreationAttributes
} from '../models/Bovine';
import Ranch from '../models/Ranch';
import User, { UserRole } from '../models/User';
import BovineLocationHistory from '../models/BovineLocationHistory';
import BovineVaccinationStatus from '../models/BovineVaccinationStatus';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { BovineGeoService } from './BovineGeoService';
import { EventService } from './EventService';
import { BovineHealthService } from './BovineHealthService';
import { bovineVaccinationStatusService } from './BovineVaccinationStatusService';
import { bovineFullService } from './BovineFullService';
import { BovineResponse } from '../dtos/bovine-response.dto';

import {
    BovineError,
    BovineNotFoundError,
    BovineValidationError,
    BovineStatisticsError
} from '../utils/BovineErrors';

// ============================================================================
// INTERFACES (CONSERVADAS DE TU CÓDIGO)
// ============================================================================

export interface CreateBovineData {
    earTag: string;
    name?: string;
    cattleType: CattleType;
    breed: string;
    gender: GenderType;
    birthDate: Date;
    weight?: number;
    location: LocationData;
    healthStatus?: HealthStatus;
    vaccinationStatus?: VaccinationStatus;
    notes?: string;
    ranchId?: string;
    ownerId?: string;
    physicalMetrics?: any;
    reproductiveInfo?: any;
    trackingConfig?: any;
    motherId?: string;
    fatherId?: string;
    acquisitionDate?: Date;
    acquisitionPrice?: number;
}

export interface UpdateBovineData extends Partial<CreateBovineData> {
    id: string;
}

export interface BovineFilters {
    searchTerm?: string;
    cattleType?: CattleType;
    breed?: string;
    gender?: GenderType;
    healthStatus?: HealthStatus;
    /**
     * Estado de vacunación. Se filtra contra `BovineVaccinationStatus` (cache
     * 1:1) — NO contra la columna deprecada `Bovine.vaccinationStatus`.
     */
    vaccinationStatus?: VaccinationStatus;
    ageRange?: { min: number; max: number };
    weightRange?: { min: number; max: number };
    /** Filtro por un rancho. Si se proporciona, ignora `ranchIds`. */
    ranchId?: string;
    /** Filtro por múltiples ranchos. Se intersecta con permisos del usuario. */
    ranchIds?: string[];
    /**
     * Filtro por ubicación ACTUAL del bovino. JOIN con BovineLocationHistory
     * con `exitedAt IS NULL` (stay activa).
     */
    locationId?: string;
    ownerId?: string;
    isActive?: boolean;
    isPregnant?: boolean;
}

export interface PaginationOptions {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface BovineListResponse {
    bovines: Bovine[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface BovineStatistics {
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

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class BovineService {
    private readonly context = 'BovineService';

    // Inyectar servicios (se inicializan después para evitar dependencias circulares)
    private geoService!: BovineGeoService;
    private eventService!: EventService;
    private healthService!: BovineHealthService;

    constructor() {
        // Inicialización diferida para evitar dependencias circulares
        setTimeout(() => {
            this.geoService = new BovineGeoService();
            this.eventService = new EventService();
            this.healthService = new BovineHealthService();
        }, 0);
    }

    // ==========================================================================
    // CRUD PRINCIPAL (TU CÓDIGO MEJORADO)
    // ==========================================================================

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
            // ──────────────────────────────────────────────────────────────────
            // PASO 1: Aplicar permisos sobre ranchos (defensa en profundidad)
            // ──────────────────────────────────────────────────────────────────
            const allowedRanchIds = await this.getAccessibleRanchIds(userId);
            const effectiveFilters = await this.applyRanchPermissions(filters, allowedRanchIds);

            // Si la intersección dio vacío → no hay nada que devolver.
            if (effectiveFilters === null) {
                return {
                    bovines: [],
                    pagination: {
                        page: pagination.page,
                        limit: pagination.limit,
                        total: 0,
                        totalPages: 0,
                        hasNext: false,
                        hasPrev: pagination.page > 1,
                    },
                };
            }

            // ──────────────────────────────────────────────────────────────────
            // PASO 2: Construir where para la tabla Bovine
            // ──────────────────────────────────────────────────────────────────
            const whereConditions = this.buildWhereConditions(effectiveFilters);
            const offset = (pagination.page - 1) * pagination.limit;
            const orderClause = [[
                pagination.sortBy || 'created_at',
                pagination.sortOrder || 'DESC'
            ]];

            // ──────────────────────────────────────────────────────────────────
            // PASO 3: Includes (joins condicionales)
            // ──────────────────────────────────────────────────────────────────
            const includes: any[] = [
                {
                    model: Ranch,
                    as: 'ranch',
                    attributes: ['id', 'name'],
                },
            ];

            // Filtro vaccinationStatus → JOIN con BovineVaccinationStatus.
            // Caso especial NONE: incluir bovinos sin registro (LEFT JOIN + IS NULL).
            // Para los demás status, INNER JOIN con WHERE strict.
            if (effectiveFilters.vaccinationStatus !== undefined) {
                if (effectiveFilters.vaccinationStatus === VaccinationStatus.NONE) {
                    includes.push({
                        model: BovineVaccinationStatus,
                        as: 'vaccinationStatus',
                        required: false,
                        where: {
                            [Op.or]: [
                                { status: VaccinationStatus.NONE },
                                { bovineId: null },
                            ],
                        },
                    });
                } else {
                    includes.push({
                        model: BovineVaccinationStatus,
                        as: 'vaccinationStatus',
                        required: true,
                        where: { status: effectiveFilters.vaccinationStatus },
                    });
                }
            }

            // Filtro locationId → JOIN con BovineLocationHistory (stay activa)
            if (effectiveFilters.locationId) {
                includes.push({
                    model: BovineLocationHistory,
                    as: 'visits',
                    required: true,
                    attributes: [],
                    where: {
                        locationId: effectiveFilters.locationId,
                        exitedAt: { [Op.is]: null as any },
                    },
                });
            }

            // ──────────────────────────────────────────────────────────────────
            // PASO 4: Query con findAndCountAll + distinct para evitar count
            // inflado por LEFT JOINs.
            // ──────────────────────────────────────────────────────────────────
            const { rows: bovines, count: total } = await Bovine.findAndCountAll({
                where: whereConditions,
                limit: pagination.limit,
                offset,
                order: orderClause as any,
                include: includes,
                distinct: true,
            });

            const totalPages = Math.ceil(total / pagination.limit);

            logger.info(`Obtenidos ${bovines.length} bovinos`, this.context, {
                total,
                filters: effectiveFilters,
                pagination,
                userId,
            });

            return {
                bovines,
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total,
                    totalPages,
                    hasNext: pagination.page < totalPages,
                    hasPrev: pagination.page > 1
                }
            };

        } catch (error) {
            logger.error('Error obteniendo bovinos', this.context, { filters, pagination, userId }, error as Error);
            throw error;
        }
    }

    // ==========================================================================
    // PERMISOS DE RANCHO
    // ==========================================================================

    /**
     * Devuelve los IDs de ranchos a los que el usuario puede acceder.
     *
     *   - SUPER_ADMIN / OWNER → `null` (significa "todos los ranchos").
     *   - Cualquier otro rol → array con los ranchIds activos en `user.ranchAccess`.
     *
     * Si el usuario no tiene `ranchAccess` o todos están inactivos → array vacío.
     */
    async getAccessibleRanchIds(userId: string): Promise<string[] | null> {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'role', 'ranchAccess'] as any,
        });
        if (!user) return [];

        const role = (user as any).role as UserRole;
        if (role === UserRole.SUPER_ADMIN || role === UserRole.OWNER) {
            return null; // sin restricción
        }

        const access = ((user as any).ranchAccess || []) as Array<{ ranchId: string; isActive: boolean }>;
        return access.filter((a) => a.isActive).map((a) => a.ranchId);
    }

    /**
     * Intersecta los filtros recibidos con los ranchos permitidos. Devuelve
     * `null` si la intersección queda vacía (=> el caller debe responder lista
     * vacía sin ejecutar queries).
     *
     * Reglas:
     *   - allowedRanchIds = null   → todos permitidos (no se modifica el filtro).
     *   - allowedRanchIds = []     → ninguno permitido → null.
     *   - filters.ranchId pedido   → debe estar en allowed; si no, null.
     *   - filters.ranchIds pedido  → intersección; si vacía, null.
     *   - sin filtro de rancho     → se aplica `ranchIds = allowedRanchIds`.
     */
    private async applyRanchPermissions(
        filters: BovineFilters,
        allowedRanchIds: string[] | null
    ): Promise<BovineFilters | null> {
        // Permisos completos
        if (allowedRanchIds === null) {
            return { ...filters };
        }

        // Sin acceso a ningún rancho
        if (allowedRanchIds.length === 0) {
            return null;
        }

        // Pidió un rancho específico
        if (filters.ranchId) {
            if (!allowedRanchIds.includes(filters.ranchId)) {
                return null;
            }
            return { ...filters };
        }

        // Pidió múltiples ranchos
        if (filters.ranchIds && filters.ranchIds.length > 0) {
            const intersected = filters.ranchIds.filter((id) => allowedRanchIds.includes(id));
            if (intersected.length === 0) return null;
            return { ...filters, ranchIds: intersected };
        }

        // Sin filtro explícito → restringir a los ranchos accesibles
        return { ...filters, ranchIds: allowedRanchIds };
    }

    /**
     * Obtiene un bovino específico por ID
     */
    async getBovineById(bovineId: string, userId: string): Promise<Bovine | null> {
        try {
            // ✅ TU CÓDIGO - Mejorado con include opcional
            const bovine = await Bovine.findByPk(bovineId, {
                include: [{
                    model: Ranch,
                    as: 'ranch',
                    attributes: ['id', 'name', 'location']
                }]
            });

            if (!bovine) {
                throw new BovineNotFoundError(bovineId);
            }

            logger.info(`Bovino ${bovineId} obtenido`, this.context, { userId });
            return bovine;

        } catch (error) {
            // Si ya es un error nuestro, lo relanzamos
            if (error instanceof BovineError) {
                throw error;
            }

            // Si es otro error, lo envolvemos
            logger.error(`Error obteniendo bovino ${bovineId}`, this.context, { userId }, error as Error);
            throw new BovineError(
                `Error al obtener el bovino ${bovineId}`,
                'GET_ERROR',
                500,
                error as Error
            );
        }
    }

    /**
     * Obtiene un bovino por su etiqueta de oreja
     */
    async getBovineByEarTag(earTag: string, ranchId?: string): Promise<Bovine | null> {
        try {
            // ✅ TU CÓDIGO - Conservado
            const whereConditions: any = { earTag };
            if (ranchId) {
                whereConditions.ranchId = ranchId;
            }

            const bovine = await Bovine.findOne({ where: whereConditions });

            if (bovine) {
                logger.debug(`Bovino encontrado por earTag ${earTag}`, this.context, { ranchId });
            }

            return bovine;

        } catch (error) {
            logger.error(`Error obteniendo bovino por earTag ${earTag}`, this.context, { ranchId }, error as Error);
            throw error;
        }
    }

    /**
     * Crea un nuevo bovino
     * - Genera QR automáticamente
     * - Crea snapshot para mapas
     */
    async createBovine(data: CreateBovineData, userId: string): Promise<Bovine> {
        const transaction = await sequelize.transaction();

        try {
            // ✅ TU CÓDIGO - Validaciones conservadas
            const existingBovine = await this.getBovineByEarTag(data.earTag, data.ranchId);
            if (existingBovine) {

                throw new BovineValidationError(
                    `Ya existe un bovino con la etiqueta ${data.earTag} en este rancho`
                );
            }

            // Validación de coordenadas (mejorada)
            this.validateCoordinates(data.location);

            // ✅ TU CÓDIGO - Validación de datos
            this.validateBovineData(data);

            // ✅ NUEVO - Validación de edad mínima
            this.validateMinimumAge(data.birthDate, data.cattleType);

            // ✅ NUEVO - Validar que el rancho existe
            await this.validateRanchExists(data.ranchId!, transaction);

            // ✅ NUEVO - Generar QR
            const qrCode = this.generateQRCode(data.earTag);

            // Asignar valores por defecto
            const healthStatus = data.healthStatus || HealthStatus.HEALTHY;
            const vaccinationStatus = data.vaccinationStatus || VaccinationStatus.NONE;

            // Crear el bovino
            const newBovine = await Bovine.create({
                ...data,
                qrCode,
                healthStatus,
                vaccinationStatus,
                isActive: true
            } as BovineCreationAttributes, { transaction });

            // ✅ NUEVO - Crear snapshot para mapas
            if (this.geoService) {
                await this.geoService.createSnapshot(newBovine, transaction);
            }

            // ✅ Inicializar registro de BovineVaccinationStatus con NONE.
            // Garantiza que el filtro `vaccinationStatus = NONE` con JOIN sea
            // trivial y consistente desde el día 1.
            await bovineVaccinationStatusService.initializeForNewBovine(
                newBovine.id,
                transaction
            );

            // ✅ NUEVO - Crear evento de registro
            if (this.eventService) {
                await this.eventService.createEventFromAction('BOVINE_CREATED', {
                    bovineId: newBovine.id,
                    userId,
                    metadata: { earTag: newBovine.earTag }
                }, transaction);
            }

            await transaction.commit();

            logger.info(`Bovino creado: ${newBovine.earTag}`, this.context, {
                bovineId: newBovine.id,
                ranchId: data.ranchId,
                userId
            });

            return newBovine;

        } catch (error) {
            await transaction.rollback();
            logger.error('Error creando bovino', this.context, { data, userId }, error as Error);
            throw error;
        }
    }

    /**
     * Actualiza un bovino existente
     */
    async updateBovine(updateData: UpdateBovineData, userId: string): Promise<Bovine> {
        const transaction = await sequelize.transaction();

        try {
            // ✅ TU CÓDIGO - Verificar existencia
            const existingBovine = await Bovine.findByPk(updateData.id, { transaction });
            if (!existingBovine) {
                throw new Error('Bovino no encontrado');
            }

            // ✅ TU CÓDIGO - Validar unicidad de earTag
            if (updateData.earTag && updateData.earTag !== existingBovine.earTag) {
                const bovineWithSameTag = await this.getBovineByEarTag(
                    updateData.earTag,
                    existingBovine.ranchId || undefined
                );
                if (bovineWithSameTag && bovineWithSameTag.id !== updateData.id) {
                    throw new Error(`Ya existe un bovino con la etiqueta ${updateData.earTag} en esta finca`);
                }
            }

            // ✅ TU CÓDIGO - Validar coordenadas
            if (updateData.location) {
                this.validateCoordinates(updateData.location);
            }

            // Guardar estado anterior para comparar
            const previousState = {
                healthStatus: existingBovine.healthStatus,
                location: existingBovine.location
            };

            // Preparar datos de actualización
            const { id, ...updatePayload } = updateData;

            // Actualizar el bovino
            await existingBovine.update(updatePayload, { transaction });

            // ✅ NUEVO - Actualizar snapshot si es necesario
            const needsSnapshotUpdate =
                (updateData.healthStatus && updateData.healthStatus !== previousState.healthStatus) ||
                (updateData.location && JSON.stringify(updateData.location) !== JSON.stringify(previousState.location));

            if (needsSnapshotUpdate && this.geoService) {
                await this.geoService.updateSnapshot(updateData.id, {
                    healthStatus: existingBovine.healthStatus,
                    location: existingBovine.location,
                    lastUpdate: new Date()
                }, transaction);
            }

            // ✅ NUEVO - Manejar cambio de salud (delegado a HealthService)
            if (updateData.healthStatus && updateData.healthStatus !== previousState.healthStatus) {
                if (this.healthService) {
                    await this.healthService.handleHealthStatusChange(
                        existingBovine,
                        previousState.healthStatus,
                        updateData.healthStatus,
                        userId,
                        transaction
                    );
                }
            }

            await transaction.commit();

            // Invalidar cache compuesto
            bovineFullService.invalidate(updateData.id);

            logger.info(`Bovino actualizado: ${existingBovine.earTag}`, this.context, {
                bovineId: updateData.id,
                changes: Object.keys(updateData),
                userId
            });

            return existingBovine;

        } catch (error) {
            await transaction.rollback();
            logger.error(`Error actualizando bovino ${updateData.id}`, this.context, { updateData, userId }, error as Error);
            throw error;
        }
    }

    /**
     * Elimina un bovino (soft delete)
     */
    async deleteBovine(bovineId: string, userId: string): Promise<void> {
        const transaction = await sequelize.transaction();

        try {
            // ✅ TU CÓDIGO - Verificar existencia
            const bovine = await Bovine.findByPk(bovineId, { transaction });
            if (!bovine) {
                throw new Error('Bovino no encontrado');
            }

            // ✅ NUEVO - Validar que pueda eliminarse
            await this.validateCanDelete(bovineId, transaction);

            // Soft delete
            await bovine.destroy({ transaction });

            // ✅ NUEVO - Eliminar snapshot
            if (this.geoService) {
                await this.geoService.deleteSnapshot(bovineId, transaction);
            }

            // ✅ NUEVO - Crear evento de eliminación
            if (this.eventService) {
                await this.eventService.createEventFromAction('BOVINE_DELETED', {
                    bovineId,
                    userId,
                    metadata: { earTag: bovine.earTag }
                }, transaction);
            }

            await transaction.commit();

            // Invalidar cache compuesto
            bovineFullService.invalidate(bovineId);

            logger.info(`Bovino eliminado: ${bovine.earTag}`, this.context, { bovineId, userId });


        } catch (error) {
            await transaction.rollback();
            logger.error(`Error eliminando bovino ${bovineId}`, this.context, { userId }, error as Error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas generales de bovinos
     */
    async getBovineStatistics(ranchId?: string, userId?: string): Promise<BovineStatistics> {
        const startTime = Date.now();
        try {
            // ✅ TU CÓDIGO - 90% conservado, solo mejoras menores
            const whereConditions: any = { isActive: true };
            if (ranchId) {
                whereConditions.ranchId = ranchId;
            }

            const [
                totalBovines,
                countsByType,
                countsByGender,
                countsByHealth,
                countsByVaccination,
                bovines,
                pregnantCows
            ] = await Promise.all([
                // Consulta 1: Total de bovinos
                Bovine.count({ where: whereConditions }),

                // Consulta 2: Conteos por tipo (ejecuta 4 consultas en paralelo internamente)
                this.getCountsByField(whereConditions, 'cattleType', Object.values(CattleType)),

                // Consulta 3: Conteos por género (ejecuta 3 consultas en paralelo)
                this.getCountsByField(whereConditions, 'gender', Object.values(GenderType)),

                // Consulta 4: Conteos por salud (ejecuta 5 consultas en paralelo)
                this.getCountsByField(whereConditions, 'healthStatus', Object.values(HealthStatus)),

                // Consulta 5: Conteos por vacunación (ejecuta 4 consultas en paralelo)
                this.getCountsByField(whereConditions, 'vaccinationStatus', Object.values(VaccinationStatus)),

                // Consulta 6: Datos para promedios
                Bovine.findAll({
                    where: whereConditions,
                    attributes: ['weight', 'birthDate']
                }),

                // Consulta 7: Vacas preñadas
                Bovine.count({
                    where: { ...whereConditions, 'reproductiveInfo.isPregnant': true }
                })
            ]);

            // Calcular promedios usando los datos obtenidos
            const { averageWeight, averageAge } = this.calculateAverages(bovines);

            const duration = Date.now() - startTime;

            logger.info('Estadísticas calculadas', this.context, {
                ranchId,
                totalBovines,
                durationMs: duration,
                userId
            });

            return {
                totalBovines,
                totalByType: countsByType,
                totalByGender: countsByGender,
                totalByHealthStatus: countsByHealth,
                totalByVaccinationStatus: countsByVaccination,
                averageWeight: Math.round(averageWeight * 100) / 100,
                averageAge: Math.round(averageAge * 100) / 100,
                upcomingVaccinations: countsByVaccination[VaccinationStatus.PENDING] || 0,
                sickAnimals: (countsByHealth[HealthStatus.SICK] || 0) + (countsByHealth[HealthStatus.QUARANTINE] || 0),
                pregnantCows
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Error obteniendo estadísticas', this.context, {
                ranchId,
                userId,
                durationMs: duration
            }, error as Error);

            //Lanzamos error personalizado con el error original como causa
            throw new BovineStatisticsError(ranchId, error as Error);
        }
    }

    // ==========================================================================
    // MÉTODOS DE VALIDACIÓN (TU CÓDIGO CONSERVADO)
    // ==========================================================================

    /**
     * Construye las condiciones WHERE para los filtros
     */
    private buildWhereConditions(filters: BovineFilters): WhereOptions {
        // ✅ TU CÓDIGO - 100% conservado
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

        // NOTA: `vaccinationStatus` NO se aplica aquí. Se filtra por JOIN con
        // BovineVaccinationStatus en `getBovines()`. La columna cacheada
        // `Bovine.vaccinationStatus` está deprecada.

        if (filters.ranchId) {
            // Filtro por un rancho específico
            conditions.ranchId = filters.ranchId;
        } else if (filters.ranchIds && filters.ranchIds.length > 0) {
            // Filtro por múltiples ranchos (multi-rancho)
            conditions.ranchId = { [Op.in]: filters.ranchIds };
        }

        if (filters.ownerId) {
            conditions.ownerId = filters.ownerId;
        }

        if (filters.weightRange) {
            conditions.weight = {
                [Op.between]: [filters.weightRange.min, filters.weightRange.max]
            };
        }

        if (filters.ageRange) {
            const now = new Date();
            const maxBirthDate = new Date(now.getFullYear() - filters.ageRange.min, now.getMonth(), now.getDate());
            const minBirthDate = new Date(now.getFullYear() - filters.ageRange.max - 1, now.getMonth(), now.getDate());
            conditions.birthDate = {
                [Op.between]: [minBirthDate, maxBirthDate]
            };
        }

        if (filters.isPregnant !== undefined) {
            conditions[Op.and] = [
                Sequelize.where(
                    Sequelize.literal(
                        `COALESCE(
                    CAST(("Bovine"."reproductive_info"->>'isPregnant') AS BOOLEAN),
                    false
                )`
                    ),
                    filters.isPregnant
                )
            ];
        }

        return conditions;
    }

    /**
     * Valida los datos del bovino antes de crear o actualizar
     */
    private validateBovineData(bovineData: Partial<CreateBovineData>): void {
        // ✅ TU CÓDIGO - 100% conservado
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

    // ==========================================================================
    // NUEVOS MÉTODOS DE VALIDACIÓN (DE MI PROPUESTA)
    // ==========================================================================

    private validateCoordinates(location?: LocationData): void {
        // Si no se envía ubicación, se permite (es opcional en la creación)
        if (!location) {
            return;
        }

        if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
            throw new Error('La ubicación debe incluir latitud y longitud numéricas');
        }

        if (location.latitude < -90 || location.latitude > 90 ||
            location.longitude < -180 || location.longitude > 180) {
            throw new Error('Coordenadas de ubicación inválidas');
        }
    }

    private validateMinimumAge(birthDate: Date, cattleType: CattleType): void {
        const ageInMonths = this.getAgeInMonths({ birthDate } as Bovine);

        const minAgeByType = {
            [CattleType.BULL]: 18,
            [CattleType.COW]: 15,
            [CattleType.CALF]: 0,
            [CattleType.CATTLE]: 0
        };

        if (ageInMonths < minAgeByType[cattleType]) {
            throw new Error(`Edad mínima para ${cattleType} es ${minAgeByType[cattleType]} meses`);
        }
    }

    private async validateRanchExists(ranchId: string, transaction?: Transaction): Promise<void> {
        const ranch = await Ranch.findByPk(ranchId, { transaction });
        if (!ranch) {
            throw new Error(`Rancho con ID ${ranchId} no encontrado`);
        }
    }

    private async validateCanDelete(bovineId: string, transaction?: Transaction): Promise<void> {
        const Health = (await import('../models/Health')).default;
        const hasActiveHealth = await Health.count({
            where: { bovineId, isActive: true },
            transaction
        }) > 0;

        if (hasActiveHealth) {
            throw new Error('No se puede eliminar un bovino con registros de salud activos');
        }
    }

    // ==========================================================================
    // NUEVO MÉTODO: getHealthColor (para formateo de respuestas)
    // ==========================================================================

    /**
     * Obtiene el color hexadecimal según el estado de salud
     * @param status - Estado de salud del bovino
     * @returns Color hexadecimal
     */
    getHealthColor(status: HealthStatus): string {
        const colors = {
            [HealthStatus.HEALTHY]: '#10b981',      // Verde
            [HealthStatus.SICK]: '#ef4444',         // Rojo
            [HealthStatus.RECOVERING]: '#f59e0b',   // Naranja
            [HealthStatus.QUARANTINE]: '#8b5cf6',   // Púrpura
            [HealthStatus.DECEASED]: '#6b7280',     // Gris
            [HealthStatus.UNKNOWN]: '#9ca3af'       // Gris claro
        };
        return colors[status] || colors[HealthStatus.UNKNOWN];
    }

    // ==========================================================================
    // NUEVO MÉTODO: formatBovineResponse (el que necesitas en el controlador)
    // ==========================================================================

    /**
     * Formatea un bovino para respuesta al frontend
     * @param bovine - El bovino de la base de datos
     * @returns Objeto formateado para la respuesta API
     */
    formatBovineResponse(bovine: Bovine): BovineResponse {
        const ageInMonths = this.getAgeInMonths(bovine);
        const { years, months } = this.getAgeInYearsAndMonths(bovine);
        const bovineWithRanch = bovine as Bovine & { ranch?: { id: string; name: string; } };

        return {
            id: bovine.id,
            earTag: bovine.earTag,
            name: bovine.name,
            cattleType: bovine.cattleType,
            cattleTypeLabel: this.getCattleTypeLabel(bovine.cattleType),
            breed: bovine.breed,
            gender: bovine.gender,
            genderLabel: this.getGenderLabel(bovine.gender),
            birthDate: bovine.birthDate,
            ageInMonths,
            ageInYears: years,
            ageDisplay: this.getAgeDisplay(bovine),
            weight: bovine.weight,
            healthStatus: bovine.healthStatus,
            healthStatusLabel: this.getHealthStatusLabel(bovine.healthStatus),
            healthColor: this.getHealthColor(bovine.healthStatus),
            vaccinationStatus: bovine.vaccinationStatus,
            vaccinationStatusLabel: this.getVaccinationStatusLabel(bovine.vaccinationStatus),
            location: bovine.location,
            qrCode: bovine.qrCode || '',
            isAdult: this.isAdult(bovine),
            ranch: bovineWithRanch.ranch ? {   // ← Ahora TypeScript no se queja
                id: bovineWithRanch.ranch.id,
                name: bovineWithRanch.ranch.name
            } : undefined,
            lastHealthCheck: bovine.lastHealthCheck,
            isPregnant: bovine.reproductiveInfo?.isPregnant,
            expectedCalvingDate: bovine.reproductiveInfo?.expectedCalvingDate,
            daysInOperation: this.getDaysInOperation(bovine)
        };
    }

    // ==========================================================================
    // MÉTODOS DE UTILIDAD (DE MI PROPUESTA)
    // ==========================================================================

    getAgeInMonths(bovine: Bovine): number {
        const now = new Date();
        const birthDate = new Date(bovine.birthDate);
        const diffTime = Math.abs(now.getTime() - birthDate.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    }

    getAgeInYearsAndMonths(bovine: Bovine): { years: number; months: number } {
        const totalMonths = this.getAgeInMonths(bovine);
        return {
            years: Math.floor(totalMonths / 12),
            months: totalMonths % 12
        };
    }

    getAgeDisplay(bovine: Bovine): string {
        const { years, months } = this.getAgeInYearsAndMonths(bovine);
        if (years === 0) return `${months} meses`;
        return `${years} año${years !== 1 ? 's' : ''} ${months > 0 ? `${months} mes${months !== 1 ? 'es' : ''}` : ''}`.trim();
    }

    isAdult(bovine: Bovine): boolean {
        return this.getAgeInMonths(bovine) >= 24;
    }

    getDaysInOperation(bovine: Bovine): number {
        if (!bovine.acquisitionDate) return 0;
        const diffTime = Math.abs(new Date().getTime() - new Date(bovine.acquisitionDate).getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    generateQRCode(earTag: string): string {
        const random = randomBytes(4).toString('hex').toUpperCase();
        const cleanEarTag = earTag.replace(/[^a-zA-Z0-9]/g, '');
        return `BOVINE-${cleanEarTag}-${random}`;
    }

    async regenerateQRCode(bovineId: string, userId: string): Promise<string> {
        const bovine = await Bovine.findByPk(bovineId);
        if (!bovine) throw new Error('Bovino no encontrado');

        const newQR = this.generateQRCode(bovine.earTag);
        await bovine.update({ qrCode: newQR });

        logger.info(`QR regenerado para bovino ${bovine.earTag}`, this.context, { bovineId, userId });
        return newQR;
    }

    // ==========================================================================
    // MÉTODOS HELPER PARA CONTEOS OPTIMIZADOS
    // ==========================================================================

    /**
     * Obtiene conteos agrupados por un campo específico
     * Ejecuta todas las consultas en paralelo automáticamente
     */
    private async getCountsByField<T extends string>(
        baseWhere: any,
        field: string,
        enumValues: T[]
    ): Promise<Record<T, number>> {
        // Creamos un array de promesas, una por cada valor del enum
        const promises = enumValues.map(async (value) => {
            const count = await Bovine.count({
                where: { ...baseWhere, [field]: value }
            });
            return { value, count };
        });

        // Ejecutamos TODAS las promesas en PARALELO
        const results = await Promise.all(promises);

        // Convertimos el array de resultados a un objeto Record
        return results.reduce((acc, { value, count }) => {
            acc[value] = count;
            return acc;
        }, {} as Record<T, number>);
    }

    /**
     * Calcula promedios de peso y edad
     */
    private calculateAverages(bovines: Bovine[]): { averageWeight: number; averageAge: number } {
        // Calcular peso promedio
        const validWeights = bovines.filter(b => b.weight).map(b => b.weight!);
        const averageWeight = validWeights.length > 0
            ? validWeights.reduce((sum, w) => sum + w, 0) / validWeights.length
            : 0;

        // Calcular edad promedio
        const now = new Date();
        const ages = bovines.map(b => {
            const diff = Math.abs(now.getTime() - new Date(b.birthDate).getTime());
            return Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
        });

        const averageAge = ages.length > 0
            ? ages.reduce((sum, a) => sum + a, 0) / ages.length
            : 0;

        return { averageWeight, averageAge };
    }




    // ==========================================================================
    // TRADUCCIONES (NUEVAS)
    // ==========================================================================

    getHealthStatusLabel(status: HealthStatus): string {
        const labels = {
            [HealthStatus.HEALTHY]: 'Saludable',
            [HealthStatus.SICK]: 'Enfermo',
            [HealthStatus.RECOVERING]: 'Recuperándose',
            [HealthStatus.QUARANTINE]: 'Cuarentena',
            [HealthStatus.DECEASED]: 'Fallecido',
            [HealthStatus.UNKNOWN]: 'Desconocido'
        };
        return labels[status];
    }

    getCattleTypeLabel(type: CattleType): string {
        const labels = {
            [CattleType.CATTLE]: 'Ganado General',
            [CattleType.BULL]: 'Toro',
            [CattleType.COW]: 'Vaca',
            [CattleType.CALF]: 'Ternero'
        };
        return labels[type];
    }

    getGenderLabel(gender: GenderType): string {
        const labels = {
            [GenderType.MALE]: 'Macho',
            [GenderType.FEMALE]: 'Hembra',
            [GenderType.UNKNOWN]: 'Desconocido'
        };
        return labels[gender];
    }

    getVaccinationStatusLabel(status: VaccinationStatus): string {
        const labels = {
            [VaccinationStatus.UP_TO_DATE]: 'Al día',
            [VaccinationStatus.PENDING]: 'Pendiente',
            [VaccinationStatus.OVERDUE]: 'Atrasada',
            [VaccinationStatus.NONE]: 'Sin vacunar'
        };
        return labels[status];
    }
}

// Exportar instancia única
export const bovineService = new BovineService();