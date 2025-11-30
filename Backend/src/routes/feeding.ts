import { Router, Request, Response } from 'express';
import { FeedingController } from '../controllers/feeding';
import { authenticateToken as authMiddleware } from '../middleware/auth';
import { validate as validationMiddleware } from '../middleware/validation';
import { createRateLimit, EndpointType } from '../middleware/rate-limit';
import { requireMinimumRole as roleMiddleware } from '../middleware/role';
import { UserRole } from '../models/User';
import { createUploadMiddleware, processUploadedFiles, handleUploadErrors, FileCategory } from '../middleware/upload';

// Crear instancia del router
const router = Router();

// Crear instancia del controlador de alimentación
const feedingController = new FeedingController();

// Crear middleware de upload para archivos de alimentación
const uploadMiddleware = createUploadMiddleware(FileCategory.FEED_REPORTS);

// ============================================================================
// MIDDLEWARE GLOBAL PARA TODAS LAS RUTAS DE ALIMENTACIÓN
// ============================================================================

// Todas las rutas de alimentación requieren autenticación
router.use(authMiddleware);

// ============================================================================
// REGISTROS DE ALIMENTACIÓN - CRUD BÁSICO
// ============================================================================

/**
 * @route   GET /feeding/records
 * @desc    Obtener registros de alimentación con filtros avanzados
 * @access  Private
 */
router.get(
  '/records',
  createRateLimit(EndpointType.CATTLE_READ),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    // Método genérico para obtener registros
    return res.json({
      success: true,
      message: 'Registros de alimentación obtenidos',
      data: [],
      pagination: { page: 1, limit: 10, total: 0 }
    });
  }
);

/**
 * @route   POST /feeding/records
 * @desc    Crear nuevo registro de alimentación
 * @access  Private (Roles: RANCH_OWNER, ADMIN, WORKER, NUTRITIONIST)
 */
router.post(
  '/records',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.CATTLE_WRITE),
  uploadMiddleware.multiple('feedingPhotos', 5),
  processUploadedFiles(FileCategory.FEED_REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    // Crear registro básico
    return res.status(201).json({
      success: true,
      message: 'Registro de alimentación creado exitosamente',
      data: {
        id: `feeding_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString(),
        createdBy: req.userId
      }
    });
  }
);

/**
 * @route   GET /feeding/records/:id
 * @desc    Obtener detalles específicos de un registro de alimentación
 * @access  Private
 */
router.get(
  '/records/:id',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Registro de alimentación encontrado',
      data: {
        id: req.params.id,
        feedType: 'concentrate',
        quantity: 5.5,
        feedingTime: new Date().toISOString(),
        bovineIds: [],
        location: { name: 'Corral A' },
        createdAt: new Date().toISOString()
      }
    });
  }
);

/**
 * @route   PUT /feeding/records/:id
 * @desc    Actualizar registro de alimentación existente
 * @access  Private (Roles: RANCH_OWNER, ADMIN, WORKER, NUTRITIONIST)
 */
router.put(
  '/records/:id',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.CATTLE_WRITE),
  uploadMiddleware.multiple('feedingPhotos', 5),
  processUploadedFiles(FileCategory.FEED_REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Registro de alimentación actualizado exitosamente',
      data: {
        id: req.params.id,
        ...req.body,
        updatedAt: new Date().toISOString(),
        updatedBy: req.userId
      }
    });
  }
);

/**
 * @route   DELETE /feeding/records/:id
 * @desc    Eliminar registro de alimentación (soft delete)
 * @access  Private (Roles: RANCH_OWNER, ADMIN)
 */
router.delete(
  '/records/:id',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.BULK_OPERATIONS),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Registro de alimentación eliminado exitosamente',
      data: { id: req.params.id, deletedAt: new Date().toISOString() }
    });
  }
);

// ============================================================================
// PLANES NUTRICIONALES
// ============================================================================

/**
 * @route   GET /feeding/plans
 * @desc    Obtener planes nutricionales disponibles
 * @access  Private
 */
router.get(
  '/plans',
  createRateLimit(EndpointType.CATTLE_READ),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Planes nutricionales obtenidos',
      data: [
        {
          id: 'plan_1',
          name: 'Plan Básico Ganado Lechero',
          status: 'active',
          targetGroup: 'lactating',
          createdAt: new Date().toISOString()
        }
      ]
    });
  }
);

/**
 * @route   POST /feeding/plans
 * @desc    Crear nuevo plan nutricional
 * @access  Private (Roles: RANCH_OWNER, ADMIN, NUTRITIONIST, VETERINARIAN)
 */
router.post(
  '/plans',
  roleMiddleware(UserRole.VETERINARIAN),
  createRateLimit(EndpointType.CATTLE_WRITE),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.status(201).json({
      success: true,
      message: 'Plan nutricional creado exitosamente',
      data: {
        id: `plan_${Date.now()}`,
        ...req.body,
        status: 'draft',
        createdAt: new Date().toISOString(),
        createdBy: req.userId
      }
    });
  }
);

/**
 * @route   GET /feeding/plans/:id
 * @desc    Obtener detalles de un plan nutricional específico
 * @access  Private
 */
router.get(
  '/plans/:id',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Plan nutricional encontrado',
      data: {
        id: req.params.id,
        name: 'Plan Nutricional Ejemplo',
        description: 'Plan para ganado en etapa de lactancia',
        targetGroup: 'lactating',
        status: 'active',
        components: [],
        createdAt: new Date().toISOString()
      }
    });
  }
);

/**
 * @route   PUT /feeding/plans/:id
 * @desc    Actualizar plan nutricional
 * @access  Private (Roles: RANCH_OWNER, ADMIN, NUTRITIONIST, VETERINARIAN)
 */
router.put(
  '/plans/:id',
  roleMiddleware(UserRole.VETERINARIAN),
  createRateLimit(EndpointType.CATTLE_WRITE),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Plan nutricional actualizado exitosamente',
      data: {
        id: req.params.id,
        ...req.body,
        updatedAt: new Date().toISOString(),
        updatedBy: req.userId
      }
    });
  }
);

/**
 * @route   POST /feeding/plans/:id/assign
 * @desc    Asignar plan nutricional a bovinos específicos
 * @access  Private (Roles: RANCH_OWNER, ADMIN, NUTRITIONIST)
 */
router.post(
  '/plans/:id/assign',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.CATTLE_WRITE),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Plan nutricional asignado exitosamente',
      data: {
        planId: req.params.id,
        bovineIds: req.body.bovineIds || [],
        assignedAt: new Date().toISOString(),
        assignedBy: req.userId
      }
    });
  }
);

/**
 * @route   PUT /feeding/plans/:id/activate
 * @desc    Activar plan nutricional
 * @access  Private (Roles: RANCH_OWNER, ADMIN, NUTRITIONIST, VETERINARIAN)
 */
router.put(
  '/plans/:id/activate',
  roleMiddleware(UserRole.VETERINARIAN),
  createRateLimit(EndpointType.CATTLE_WRITE),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Plan nutricional activado exitosamente',
      data: {
        id: req.params.id,
        status: 'active',
        activatedAt: new Date().toISOString(),
        activatedBy: req.userId
      }
    });
  }
);

// ============================================================================
// PROGRAMACIÓN DE ALIMENTACIÓN (SCHEDULING)
// ============================================================================

/**
 * @route   GET /feeding/schedule
 * @desc    Obtener programa de alimentación actual
 * @access  Private
 */
router.get(
  '/schedule',
  createRateLimit(EndpointType.CATTLE_READ),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Programa de alimentación obtenido',
      data: {
        date: new Date().toISOString().split('T')[0],
        schedules: [
          {
            id: 'schedule_1',
            time: '06:00',
            feedType: 'hay',
            quantity: 10,
            location: 'Corral A'
          },
          {
            id: 'schedule_2',
            time: '18:00',
            feedType: 'concentrate',
            quantity: 5,
            location: 'Corral A'
          }
        ]
      }
    });
  }
);

/**
 * @route   POST /feeding/schedule
 * @desc    Crear programa de alimentación
 * @access  Private (Roles: RANCH_OWNER, ADMIN, NUTRITIONIST)
 */
router.post(
  '/schedule',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.CATTLE_WRITE),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.status(201).json({
      success: true,
      message: 'Programa de alimentación creado exitosamente',
      data: {
        id: `schedule_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString(),
        createdBy: req.userId
      }
    });
  }
);

/**
 * @route   GET /feeding/schedule/today
 * @desc    Obtener programa de alimentación para hoy
 * @access  Private
 */
router.get(
  '/schedule/today',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Programa de alimentación de hoy obtenido',
      data: {
        date: new Date().toISOString().split('T')[0],
        totalFeedings: 2,
        completed: 1,
        pending: 1,
        schedules: [
          {
            id: 'today_1',
            time: '06:00',
            status: 'completed',
            feedType: 'hay',
            quantity: 10
          },
          {
            id: 'today_2',
            time: '18:00',
            status: 'pending',
            feedType: 'concentrate',
            quantity: 5
          }
        ]
      }
    });
  }
);

// ============================================================================
// SEGUIMIENTO DE CONSUMO
// ============================================================================

/**
 * @route   POST /feeding/consumption
 * @desc    Registrar consumo real de alimento
 * @access  Private (Roles: RANCH_OWNER, ADMIN, WORKER, NUTRITIONIST)
 */
router.post(
  '/consumption',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.CATTLE_WRITE),
  uploadMiddleware.multiple('consumptionPhotos', 3),
  processUploadedFiles(FileCategory.FEED_REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.status(201).json({
      success: true,
      message: 'Consumo registrado exitosamente',
      data: {
        id: `consumption_${Date.now()}`,
        feedingRecordId: req.body.feedingRecordId,
        bovineId: req.body.bovineId,
        actualQuantity: req.body.actualQuantity || 0,
        refusalQuantity: req.body.refusalQuantity || 0,
        recordedAt: new Date().toISOString(),
        recordedBy: req.userId
      }
    });
  }
);

/**
 * @route   GET /feeding/consumption/:bovineId
 * @desc    Obtener historial de consumo de un bovino específico
 * @access  Private
 */
router.get(
  '/consumption/:bovineId',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Historial de consumo obtenido',
      data: {
        bovineId: req.params.bovineId,
        period: '30d',
        averageConsumption: 12.5,
        totalRecords: 30,
        records: [
          {
            date: new Date().toISOString().split('T')[0],
            quantity: 12.0,
            feedType: 'hay',
            efficiency: 'good'
          }
        ]
      }
    });
  }
);

// ============================================================================
// ANÁLISIS Y ESTADÍSTICAS
// ============================================================================

/**
 * @route   GET /feeding/statistics
 * @desc    Obtener estadísticas generales de alimentación
 * @access  Private
 */
router.get(
  '/statistics',
  createRateLimit(EndpointType.REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Estadísticas de alimentación obtenidas',
      data: {
        period: req.query.period || '30d',
        totalFeedings: 150,
        averageCost: 45.50,
        efficiency: 85.2,
        topFeedTypes: [
          { name: 'Hay', percentage: 60 },
          { name: 'Concentrate', percentage: 30 },
          { name: 'Silage', percentage: 10 }
        ],
        costBreakdown: {
          hay: 1200.00,
          concentrate: 800.00,
          supplements: 200.00
        }
      }
    });
  }
);

/**
 * @route   GET /feeding/inventory
 * @desc    Obtener inventario actual de alimentos
 * @access  Private
 */
router.get(
  '/inventory',
  createRateLimit(EndpointType.CATTLE_READ),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Inventario de alimentos obtenido',
      data: [
        {
          id: 'feed_1',
          name: 'Hay Premium',
          category: 'forage',
          quantity: 500,
          unit: 'kg',
          expirationDate: '2025-12-31',
          status: 'in_stock',
          location: 'Warehouse A'
        },
        {
          id: 'feed_2',
          name: 'Concentrate 18%',
          category: 'concentrate',
          quantity: 200,
          unit: 'kg',
          expirationDate: '2025-10-15',
          status: 'low_stock',
          location: 'Warehouse B'
        }
      ]
    });
  }
);

/**
 * @route   POST /feeding/inventory
 * @desc    Agregar nuevo lote de alimento al inventario
 * @access  Private (Roles: RANCH_OWNER, ADMIN, INVENTORY_MANAGER)
 */
router.post(
  '/inventory',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.CATTLE_WRITE),
  uploadMiddleware.multiple('feedPhotos', 5),
  processUploadedFiles(FileCategory.FEED_REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.status(201).json({
      success: true,
      message: 'Alimento agregado al inventario exitosamente',
      data: {
        id: `feed_${Date.now()}`,
        ...req.body,
        addedAt: new Date().toISOString(),
        addedBy: req.userId
      }
    });
  }
);

// ============================================================================
// EXPORTACIÓN E IMPORTACIÓN
// ============================================================================

/**
 * @route   POST /feeding/export
 * @desc    Exportar datos de alimentación en diferentes formatos
 * @access  Private
 */
router.post(
  '/export',
  createRateLimit(EndpointType.REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Exportación iniciada exitosamente',
      data: {
        exportId: `export_${Date.now()}`,
        format: req.body.format || 'csv',
        status: 'processing',
        createdAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      }
    });
  }
);

/**
 * @route   GET /feeding/export/:exportId/download
 * @desc    Descargar archivo de datos de alimentación exportado
 * @access  Private
 */
router.get(
  '/export/:exportId/download',
  createRateLimit(EndpointType.FILES),
  (req: Request, res: Response) => {
    // Simular descarga de archivo
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=feeding_data_${req.params.exportId}.csv`);
    return res.send('Date,Feed Type,Quantity,Cost\n2025-07-23,Hay,10kg,25.00\n2025-07-23,Concentrate,5kg,15.00');
  }
);

/**
 * @route   GET /feeding/settings
 * @desc    Obtener configuración del sistema de alimentación
 * @access  Private
 */
router.get(
  '/settings',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Configuración obtenida',
      data: {
        defaultFeedingTimes: ['06:00', '12:00', '18:00'],
        alertThresholds: {
          lowStock: 50,
          expiringSoon: 7
        },
        automationSettings: {
          autoScheduling: true,
          inventoryTracking: true
        },
        nutritionalTargets: {
          minProtein: 18,
          maxMoisture: 14
        }
      }
    });
  }
);

/**
 * @route   PUT /feeding/settings
 * @desc    Actualizar configuración del sistema de alimentación
 * @access  Private (Roles: RANCH_OWNER, ADMIN, NUTRITIONIST)
 */
router.put(
  '/settings',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.CATTLE_WRITE),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: {
        ...req.body,
        updatedAt: new Date().toISOString(),
        updatedBy: req.userId
      }
    });
  }
);

// ============================================================================
// MANEJO DE ERRORES ESPECÍFICOS PARA RUTAS DE ALIMENTACIÓN
// ============================================================================

/**
 * Middleware de manejo de errores específico para alimentación
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  console.error('Feeding Route Error:', {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Errores específicos de alimentación
  if (error.name === 'NutritionalPlanNotFoundError') {
    return res.status(404).json({
      success: false,
      message: 'Plan nutricional no encontrado',
      error: 'NUTRITIONAL_PLAN_NOT_FOUND'
    });
  }

  if (error.name === 'InsufficientFeedInventoryError') {
    return res.status(400).json({
      success: false,
      message: 'Inventario de alimento insuficiente',
      error: 'INSUFFICIENT_FEED_INVENTORY',
      details: error.details
    });
  }

  if (error.name === 'NutritionalImbalanceError') {
    return res.status(400).json({
      success: false,
      message: 'Desbalance nutricional detectado',
      error: 'NUTRITIONAL_IMBALANCE',
      details: error.details
    });
  }

  if (error.name === 'FeedQualityError') {
    return res.status(400).json({
      success: false,
      message: 'Problema de calidad del alimento',
      error: 'FEED_QUALITY_ERROR',
      details: error.details
    });
  }

  if (error.name === 'ScheduleConflictError') {
    return res.status(409).json({
      success: false,
      message: 'Conflicto en programación de alimentación',
      error: 'SCHEDULE_CONFLICT',
      details: error.details
    });
  }

  if (error.name === 'DietFormulationError') {
    return res.status(400).json({
      success: false,
      message: 'Error en formulación de dieta',
      error: 'DIET_FORMULATION_ERROR',
      details: error.details
    });
  }

  if (error.name === 'InventoryUpdateError') {
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar inventario',
      error: 'INVENTORY_UPDATE_ERROR',
      details: error.details
    });
  }

  if (error.name === 'ConsumptionTrackingError') {
    return res.status(400).json({
      success: false,
      message: 'Error en seguimiento de consumo',
      error: 'CONSUMPTION_TRACKING_ERROR',
      details: error.details
    });
  }

  // Error genérico
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: 'INTERNAL_SERVER_ERROR'
  });
});

// Agregar middleware de manejo de errores de upload al final
router.use(handleUploadErrors);

export default router;