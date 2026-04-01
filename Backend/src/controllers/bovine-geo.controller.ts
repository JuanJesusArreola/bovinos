// controllers/bovine-geo.controller.ts
import { Request, Response } from 'express';
import { bovineGeoService } from '../services/BovineGeoService';
import { HealthStatus } from '../models/Bovine';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class BovineGeoController {
    private readonly context = 'BovineGeoController';

    /**
     * GET /api/bovines/geo/heatmap
     * Obtiene datos para mapa de calor
     */
    async getHeatmap(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            
            // Obtener filtros del query string
            const healthStatusQuery = req.query.healthStatus as string;
            const breedsQuery = req.query.breeds as string;
            const ageMin = req.query.ageMin as string;
            const ageMax = req.query.ageMax as string;

            // ✅ CONVERTIR LOS STRINGS AL ENUM HEALTHSTATUS
            let healthStatus: HealthStatus[] | undefined;
            if (healthStatusQuery) {
                const statusStrings = healthStatusQuery.split(',');
                healthStatus = statusStrings
                    .map(s => s.trim().toUpperCase())
                    .filter(s => Object.values(HealthStatus).includes(s as HealthStatus))
                    .map(s => s as HealthStatus);
                
                // Opcional: Log si algunos valores no son válidos
                if (healthStatus.length !== statusStrings.length) {
                    logger.warn('Algunos valores de healthStatus no son válidos', this.context, {
                        received: statusStrings,
                        valid: healthStatus
                    });
                }
            }

            // Procesar breeds (siguen siendo strings, no hay problema)
            let breeds: string[] | undefined;
            if (breedsQuery) {
                breeds = breedsQuery.split(',').map(b => b.trim());
            }

            // Procesar rango de edad
            let ageRange: { min: number; max: number } | undefined;
            if (ageMin && ageMax) {
                const min = parseInt(ageMin);
                const max = parseInt(ageMax);
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    ageRange = { min, max };
                }
            }

            const filters = {
                healthStatus,
                breeds,
                ageRange
            };

            const data = await bovineGeoService.getHeatmapData(ranchId, filters);

            res.json({
                success: true,
                data
            });

        } catch (error) {
            logger.error('Error en getHeatmap', this.context, { params: req.params }, error as Error);
            
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/bovines/geo/clusters
     * Obtiene clusters para el mapa
     */
    async getClusters(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const { bounds, zoom, filters } = req.body;

            const clusters = await bovineGeoService.getClusters(
                ranchId,
                bounds,
                zoom,
                filters
            );

            res.json({
                success: true,
                data: clusters
            });

        } catch (error) {
            logger.error('Error en getClusters', this.context, { params: req.params, body: req.body }, error as Error);
            
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/bovines/geo/cluster/expand
     * Expande un cluster en puntos individuales
     */
    async expandCluster(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const { bounds, filters } = req.body;

            const points = await bovineGeoService.expandCluster(
                ranchId,
                bounds,
                filters
            );

            res.json({
                success: true,
                data: points
            });

        } catch (error) {
            logger.error('Error en expandCluster', this.context, { params: req.params, body: req.body }, error as Error);
            
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/geo/point/:bovineId
     * Obtiene punto de un bovino específico
     */
    async getBovinePoint(req: Request, res: Response): Promise<void> {
        try {
            const { bovineId } = req.params;

            const point = await bovineGeoService.getBovinePoint(bovineId);

            if (!point) {
                res.status(404).json({
                    success: false,
                    error: 'Punto no encontrado para el bovino'
                });
                return;
            }

            res.json({
                success: true,
                data: point
            });

        } catch (error) {
            logger.error('Error en getBovinePoint', this.context, { params: req.params }, error as Error);
            
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/bovines/geo/refresh/:ranchId
     * Refresca snapshots de un rancho (admin)
     */
    async refreshSnapshots(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const userId = req.user?.id;

            // Verificar permisos de admin
            if (req.user?.role !== 'SUPER_ADMIN') {
                res.status(403).json({
                    success: false,
                    error: 'No autorizado'
                });
                return;
            }

            const count = await bovineGeoService.refreshRanchSnapshots(ranchId);

            res.json({
                success: true,
                data: { refreshed: count },
                message: `Snapshots actualizados para ${count} bovinos`
            });

        } catch (error) {
            logger.error('Error en refreshSnapshots', this.context, { params: req.params }, error as Error);
            
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }
}

export const bovineGeoController = new BovineGeoController();