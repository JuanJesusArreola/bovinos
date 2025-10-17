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
exports.bovineService = void 0;
const sequelize_1 = require("sequelize");
const Bovine_1 = __importStar(require("../models/Bovine"));
const logger_1 = __importDefault(require("../utils/logger"));
const bovineLogger = {
    info: (message, metadata) => logger_1.default.info(message, 'BovineService', metadata),
    error: (message, error) => logger_1.default.error(message, 'BovineService', { error }),
    warn: (message, metadata) => logger_1.default.warn(message, 'BovineService', metadata)
};
var EventType;
(function (EventType) {
    EventType["VACCINATION"] = "vaccination";
    EventType["ILLNESS"] = "illness";
    EventType["REPRODUCTIVE"] = "reproductive";
    EventType["TRANSFER"] = "transfer";
    EventType["MANAGEMENT"] = "management";
    EventType["HEALTH_CHECK"] = "health_check";
    EventType["FEEDING"] = "feeding";
    EventType["MILKING"] = "milking";
    EventType["PREGNANCY_CHECK"] = "pregnancy_check";
    EventType["BIRTH"] = "birth";
    EventType["DEATH"] = "death";
})(EventType || (EventType = {}));
var IllnessSeverity;
(function (IllnessSeverity) {
    IllnessSeverity["MILD"] = "mild";
    IllnessSeverity["MODERATE"] = "moderate";
    IllnessSeverity["SEVERE"] = "severe";
    IllnessSeverity["CRITICAL"] = "critical";
})(IllnessSeverity || (IllnessSeverity = {}));
const geolocationService = {
    calculateDistance: (point1, point2) => {
        const R = 6371;
        const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
        const dLng = (point2.longitude - point1.longitude) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(point1.latitude * Math.PI / 180) *
                Math.cos(point2.latitude * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },
    validateCoordinates: (location) => {
        return location.latitude >= -90 && location.latitude <= 90 &&
            location.longitude >= -180 && location.longitude <= 180;
    },
    getAddressFromCoordinates: async (location) => {
        return `Lat: ${location.latitude}, Lng: ${location.longitude}`;
    }
};
const notificationService = {
    sendVaccinationReminder: async (bovineId, vaccineType) => {
        logger_1.default.info(`Enviando recordatorio de vacunación para bovino ${bovineId}: ${vaccineType}`);
    },
    sendHealthAlert: async (bovineId, healthStatus) => {
        logger_1.default.info(`Alerta de salud para bovino ${bovineId}: ${healthStatus}`);
    }
};
class BovineService {
    async getBovines(filters = {}, pagination = { page: 1, limit: 20 }, userId) {
        try {
            const whereConditions = this.buildWhereConditions(filters);
            const offset = (pagination.page - 1) * pagination.limit;
            const orderClause = [[
                    pagination.sortBy || 'createdAt',
                    pagination.sortOrder || 'DESC'
                ]];
            const bovines = await Bovine_1.default.findAll({
                where: whereConditions,
                limit: pagination.limit,
                offset,
                order: orderClause
            });
            const total = await Bovine_1.default.count({
                where: whereConditions
            });
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
        }
        catch (error) {
            bovineLogger.error('Error obteniendo bovinos', error);
            throw error;
        }
    }
    async getBovineById(bovineId, userId) {
        try {
            const bovine = await Bovine_1.default.findByPk(bovineId);
            if (!bovine) {
                throw new Error('Bovino no encontrado');
            }
            bovineLogger.info(`Bovino ${bovineId} obtenido por usuario ${userId}`);
            return bovine;
        }
        catch (error) {
            bovineLogger.error(`Error obteniendo bovino ${bovineId}`, error);
            throw error;
        }
    }
    async getBovineByEarTag(earTag, farmId) {
        try {
            const whereConditions = { earTag };
            if (farmId) {
                whereConditions.farmId = farmId;
            }
            const bovine = await Bovine_1.default.findOne({
                where: whereConditions
            });
            return bovine;
        }
        catch (error) {
            bovineLogger.error(`Error obteniendo bovino por earTag ${earTag}`, error);
            throw error;
        }
    }
    async createBovine(bovineData, userId) {
        try {
            const existingBovine = await this.getBovineByEarTag(bovineData.earTag, bovineData.farmId);
            if (existingBovine) {
                throw new Error(`Ya existe un bovino con la etiqueta ${bovineData.earTag} en esta finca`);
            }
            if (!geolocationService.validateCoordinates(bovineData.location)) {
                throw new Error('Coordenadas de ubicación inválidas');
            }
            this.validateBovineData(bovineData);
            const healthStatus = bovineData.healthStatus || Bovine_1.HealthStatus.HEALTHY;
            const vaccinationStatus = bovineData.vaccinationStatus || Bovine_1.VaccinationStatus.NONE;
            const newBovine = await Bovine_1.default.create({
                ...bovineData,
                healthStatus,
                vaccinationStatus,
                isActive: true
            });
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
        }
        catch (error) {
            bovineLogger.error('Error creando bovino', error);
            throw error;
        }
    }
    async updateBovine(updateData, userId) {
        try {
            const existingBovine = await this.getBovineById(updateData.id, userId);
            if (updateData.earTag && updateData.earTag !== existingBovine.earTag) {
                const bovineWithSameTag = await this.getBovineByEarTag(updateData.earTag, existingBovine.farmId);
                if (bovineWithSameTag && bovineWithSameTag.id !== updateData.id) {
                    throw new Error(`Ya existe un bovino con la etiqueta ${updateData.earTag} en esta finca`);
                }
            }
            if (updateData.location && !geolocationService.validateCoordinates(updateData.location)) {
                throw new Error('Coordenadas de ubicación inválidas');
            }
            const { id, ...updatePayload } = updateData;
            await Bovine_1.default.update(updatePayload, {
                where: { id: updateData.id }
            });
            const updatedBovine = await this.getBovineById(updateData.id, userId);
            await this.createBovineEvent({
                bovineId: updateData.id,
                type: EventType.MANAGEMENT,
                description: `Información del bovino ${updatedBovine.earTag} actualizada`,
                location: updateData.location || existingBovine.location,
                userId,
                data: { action: 'update', changes: updateData }
            });
            if (updateData.healthStatus && updateData.healthStatus !== existingBovine.healthStatus) {
                await this.handleHealthStatusChange(updatedBovine, existingBovine.healthStatus, updateData.healthStatus);
            }
            bovineLogger.info(`Bovino actualizado: ${updatedBovine.earTag} por usuario ${userId}`, {
                bovineId: updateData.id,
                changes: Object.keys(updateData)
            });
            return updatedBovine;
        }
        catch (error) {
            bovineLogger.error(`Error actualizando bovino ${updateData.id}`, error);
            throw error;
        }
    }
    async deleteBovine(bovineId, userId) {
        try {
            const bovine = await this.getBovineById(bovineId, userId);
            await Bovine_1.default.destroy({
                where: { id: bovineId }
            });
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
        }
        catch (error) {
            bovineLogger.error(`Error eliminando bovino ${bovineId}`, error);
            throw error;
        }
    }
    async updateBovineLocation(locationData, userId) {
        try {
            const bovine = await this.getBovineById(locationData.bovineId, userId);
            if (!geolocationService.validateCoordinates(locationData.location)) {
                throw new Error('Coordenadas de ubicación inválidas');
            }
            await Bovine_1.default.update({
                location: {
                    ...locationData.location,
                    timestamp: locationData.timestamp || new Date(),
                    source: locationData.source || 'MANUAL'
                }
            }, { where: { id: locationData.bovineId } });
            await this.createLocationRecord({
                bovineId: locationData.bovineId,
                location: locationData.location,
                timestamp: locationData.timestamp || new Date(),
                source: locationData.source || 'MANUAL',
                notes: locationData.notes,
                userId
            });
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
        }
        catch (error) {
            bovineLogger.error(`Error actualizando ubicación del bovino ${locationData.bovineId}`, error);
            throw error;
        }
    }
    async getBovineStatistics(farmId, userId) {
        try {
            const whereConditions = { isActive: true };
            if (farmId) {
                whereConditions.farmId = farmId;
            }
            const totalBovines = await Bovine_1.default.count({ where: whereConditions });
            const totalByType = {};
            for (const type of Object.values(Bovine_1.CattleType)) {
                totalByType[type] = await Bovine_1.default.count({
                    where: { ...whereConditions, cattleType: type }
                });
            }
            const totalByGender = {};
            for (const gender of Object.values(Bovine_1.GenderType)) {
                totalByGender[gender] = await Bovine_1.default.count({
                    where: { ...whereConditions, gender }
                });
            }
            const totalByHealthStatus = {};
            for (const status of Object.values(Bovine_1.HealthStatus)) {
                totalByHealthStatus[status] = await Bovine_1.default.count({
                    where: { ...whereConditions, healthStatus: status }
                });
            }
            const totalByVaccinationStatus = {};
            for (const status of Object.values(Bovine_1.VaccinationStatus)) {
                totalByVaccinationStatus[status] = await Bovine_1.default.count({
                    where: { ...whereConditions, vaccinationStatus: status }
                });
            }
            const bovines = await Bovine_1.default.findAll({
                where: whereConditions,
                attributes: ['weight', 'birthDate']
            });
            const validWeights = bovines.filter(b => b.weight).map(b => b.weight);
            const averageWeight = validWeights.length > 0
                ? validWeights.reduce((sum, weight) => sum + weight, 0) / validWeights.length
                : 0;
            const now = new Date();
            const ages = bovines.map(bovine => {
                const birthDate = new Date(bovine.birthDate);
                const diffTime = Math.abs(now.getTime() - birthDate.getTime());
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
            });
            const averageAge = ages.length > 0
                ? ages.reduce((sum, age) => sum + age, 0) / ages.length
                : 0;
            const upcomingVaccinations = totalByVaccinationStatus[Bovine_1.VaccinationStatus.PENDING] || 0;
            const sickAnimals = (totalByHealthStatus[Bovine_1.HealthStatus.SICK] || 0) +
                (totalByHealthStatus[Bovine_1.HealthStatus.QUARANTINE] || 0);
            const pregnantCows = await Bovine_1.default.count({
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
        }
        catch (error) {
            bovineLogger.error('Error obteniendo estadísticas de bovinos', error);
            throw error;
        }
    }
    async getBovinesByLocation(centerLocation, radiusKm, userId) {
        try {
            if (!geolocationService.validateCoordinates(centerLocation)) {
                throw new Error('Coordenadas de ubicación inválidas');
            }
            const allBovines = await Bovine_1.default.findAll({
                where: { isActive: true }
            });
            const bovinesInRadius = allBovines.filter(bovine => {
                const distance = geolocationService.calculateDistance(centerLocation, bovine.location);
                return distance <= radiusKm;
            });
            bovineLogger.info(`Encontrados ${bovinesInRadius.length} bovinos en radio de ${radiusKm}km`, {
                centerLocation,
                radiusKm,
                totalChecked: allBovines.length,
                userId
            });
            return bovinesInRadius;
        }
        catch (error) {
            bovineLogger.error('Error buscando bovinos por ubicación', error);
            throw error;
        }
    }
    buildWhereConditions(filters) {
        const conditions = { isActive: true };
        if (filters.searchTerm) {
            conditions[sequelize_1.Op.or] = [
                { earTag: { [sequelize_1.Op.iLike]: `%${filters.searchTerm}%` } },
                { name: { [sequelize_1.Op.iLike]: `%${filters.searchTerm}%` } },
                { breed: { [sequelize_1.Op.iLike]: `%${filters.searchTerm}%` } }
            ];
        }
        if (filters.cattleType) {
            conditions.cattleType = filters.cattleType;
        }
        if (filters.breed) {
            conditions.breed = { [sequelize_1.Op.iLike]: `%${filters.breed}%` };
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
                [sequelize_1.Op.between]: [filters.weightRange.min, filters.weightRange.max]
            };
        }
        if (filters.dateRange) {
            conditions[filters.dateRange.field] = {
                [sequelize_1.Op.between]: [filters.dateRange.startDate, filters.dateRange.endDate]
            };
        }
        return conditions;
    }
    validateBovineData(bovineData) {
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
    async handleHealthStatusChange(bovine, previousStatus, newStatus) {
        try {
            if (newStatus === Bovine_1.HealthStatus.SICK || newStatus === Bovine_1.HealthStatus.QUARANTINE) {
                await notificationService.sendHealthAlert(bovine.id, newStatus);
            }
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
        }
        catch (error) {
            bovineLogger.error('Error manejando cambio de estado de salud', error);
        }
    }
    async createBovineEvent(eventData) {
        try {
            bovineLogger.info('Evento de bovino creado', {
                bovineId: eventData.bovineId,
                type: eventData.type,
                description: eventData.description
            });
        }
        catch (error) {
            bovineLogger.error('Error creando evento de bovino', error);
        }
    }
    async createLocationRecord(locationData) {
        try {
            bovineLogger.info('Registro de ubicación creado', {
                bovineId: locationData.bovineId,
                location: locationData.location,
                source: locationData.source
            });
        }
        catch (error) {
            bovineLogger.error('Error creando registro de ubicación', error);
        }
    }
}
exports.bovineService = new BovineService();
//# sourceMappingURL=bovine.js.map