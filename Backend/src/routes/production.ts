import { Router, Request, Response, NextFunction } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { 
  authenticateToken, 
  authorizeRoles,
} from '../middleware/auth';
import { UserRole } from '../models/User';
import { ProductionController } from '../controllers/production';
import { logMessage, LogLevel } from '../middleware/logging';

const router = Router();

// ===================================================================
// MIDDLEWARE DE VALIDACIÓN PERSONALIZADA
// ===================================================================

// Middleware para validar request básico
const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Implementación básica de validación
  next();
};

// Middleware de auditoría
const auditLog = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user) {
      logMessage(
        LogLevel.INFO,
        'user_action',
        `Usuario ${req.user.email} realizó acción: ${action}`,
        {
          userId: req.user.id,
          userRole: req.user.role,
          action,
          endpoint: req.originalUrl,
          method: req.method,
          timestamp: new Date().toISOString()
        }
      );
    }
    next();
  };
};

// ===================================================================
// RUTAS DE PRODUCCIÓN
// ===================================================================

/**
 * GET /api/production
 * Obtiene todos los registros de producción
 */
router.get('/',
  authenticateToken,
  auditLog('production.list'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.getAllProduction(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/production
 * Registra nueva producción
 */
router.post('/',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.WORKER),
  auditLog('production.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.recordProduction(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/production/:id
 * Obtiene un registro de producción por ID
 */
router.get('/:id',
  authenticateToken,
  auditLog('production.view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.getProductionById(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/production/:id
 * Actualiza un registro de producción
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.WORKER),
  auditLog('production.update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.updateProduction(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/production/:id
 * Elimina un registro de producción
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  auditLog('production.delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.deleteProduction(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE PRODUCCIÓN LÁCTEA
// ===================================================================

/**
 * POST /api/production/milk
 * Registra producción de leche
 */
router.post('/milk',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.WORKER),
  auditLog('production.milk.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.recordMilkProduction(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE PESO
// ===================================================================

/**
 * POST /api/production/weight
 * Registra peso del bovino
 */
router.post('/weight',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.WORKER, UserRole.VETERINARIAN),
  auditLog('production.weight.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.recordWeight(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE ESTADÍSTICAS
// ===================================================================

/**
 * GET /api/production/stats/:bovineId
 * Obtiene estadísticas de producción por bovino
 */
router.get('/stats/:bovineId',
  authenticateToken,
  auditLog('production.stats.bovine'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.getBovineProductionStats(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/production/reports/:ranchId
 * Obtiene reporte de producción del rancho
 */
router.get('/reports/:ranchId',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  auditLog('production.reports.ranch'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.getRanchProductionReport(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/production/comparison/:ranchId
 * Obtiene comparativa de productividad
 */
router.get('/comparison/:ranchId',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  auditLog('production.comparison'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ProductionController.getProductivityComparison(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ===================================================================

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  logMessage(
    LogLevel.ERROR,
    'production_route_error',
    `Error en ruta de producción: ${error.message}`,
    {
      path: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      error: error.stack
    }
  );

  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    }
  });
});

// ===================================================================
// EXPORTAR ROUTER
// ===================================================================

export default router;