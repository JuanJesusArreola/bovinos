// controllers/health.controller.ts
import { Request, Response } from 'express';
import { healthRecordService } from '../services/health/HealthRecordService';
import { HealthError } from '../utils/HealthErrors';
import logger from '../utils/logger';

export class HealthController {
    private readonly context = 'HealthController';

    constructor() {
        this.createHealthRecord = this.createHealthRecord.bind(this);
        this.getBovineHealthHistory = this.getBovineHealthHistory.bind(this);
        this.getHealthRecordById = this.getHealthRecordById.bind(this);
        this.getHealthSummary = this.getHealthSummary.bind(this);
    }

    /**
     * POST /api/health/records
     * Crea un nuevo registro de salud.
     * Requiere rol: VETERINARIAN, ADMIN o SUPER_ADMIN.
     */
    async createHealthRecord(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            // El usuario autenticado será el creador del registro
            const recordData = {
                ...req.body,
                createdBy: userId,
                // Si se envía veterinarianId, se respeta; si no, se asigna el userId
                veterinarianId: req.body.veterinarianId || userId,
            };

            const record = await healthRecordService.createHealthRecord(recordData);
            res.status(201).json({
                success: true,
                data: record,
                message: 'Registro de salud creado exitosamente',
            });
        } catch (error) {
            logger.error('Error en createHealthRecord', this.context, { body: req.body }, error as Error);
            if (error instanceof HealthError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/health/bovine/:bovineId/history
     * Obtiene el historial de salud de un bovino (con filtros opcionales).
     */
    async getBovineHealthHistory(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const {
                recordType,
                startDate,
                endDate,
                veterinarianId,
                overallHealthStatus,
                isEmergency,
                followUpRequired,
                limit,
                offset,
            } = req.query;

            const filters: any = {};
            if (recordType) filters.recordType = (recordType as string).split(',');
            if (startDate) filters.startDate = new Date(startDate as string);
            if (endDate) filters.endDate = new Date(endDate as string);
            if (veterinarianId) filters.veterinarianId = veterinarianId as string;
            if (overallHealthStatus) filters.overallHealthStatus = (overallHealthStatus as string).split(',');
            if (isEmergency !== undefined) filters.isEmergency = isEmergency === 'true';
            if (followUpRequired !== undefined) filters.followUpRequired = followUpRequired === 'true';
            if (limit) filters.limit = parseInt(limit as string);
            if (offset) filters.offset = parseInt(offset as string);

            const result = await healthRecordService.getBovineHealthHistory(bovineId, filters);
            res.json({
                success: true,
                data: result.rows,
                pagination: {
                    total: result.count,
                    limit: filters.limit || 50,
                    offset: filters.offset || 0,
                },
            });
        } catch (error) {
            logger.error('Error en getBovineHealthHistory', this.context, { params: req.params, query: req.query }, error as Error);
            if (error instanceof HealthError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/health/records/:id
     * Obtiene un registro de salud por ID.
     */
    async getHealthRecordById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const record = await healthRecordService.getHealthRecordById(id);
            if (!record) {
                res.status(404).json({ success: false, error: 'Registro de salud no encontrado' });
                return;
            }
            res.json({ success: true, data: record });
        } catch (error) {
            logger.error('Error en getHealthRecordById', this.context, { params: req.params }, error as Error);
            if (error instanceof HealthError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/health/bovine/:bovineId/summary
     * Obtiene un resumen de salud del bovino.
     */
    async getHealthSummary(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;
            const summary = await healthRecordService.getHealthSummary(bovineId);
            if (!summary) {
                res.status(404).json({ success: false, error: 'Bovino no encontrado' });
                return;
            }
            res.json({ success: true, data: summary });
        } catch (error) {
            logger.error('Error en getHealthSummary', this.context, { params: req.params }, error as Error);
            if (error instanceof HealthError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }
}

export const healthController = new HealthController();