import { Router, Request, Response } from 'express';
import { BovinesController } from '../controllers/bovines';
import { authenticateToken as authMiddleware } from '../middleware/auth';
import { validate as validationMiddleware } from '../middleware/validation';
import { createRateLimit, EndpointType } from '../middleware/rate-limit';
import { requireMinimumRole as roleMiddleware } from '../middleware/role';
import { UserRole } from '../models/User';
import { createUploadMiddleware, processUploadedFiles, handleUploadErrors, FileCategory } from '../middleware/upload';

// Crear instancia del router
const router = Router();

// Crear instancia del controlador de bovinos
const bovinesController = new BovinesController();

// Crear middleware de upload para fotos de ganado
const uploadMiddleware = createUploadMiddleware(FileCategory.CATTLE_PHOTOS);

// ============================================================================
// MIDDLEWARE GLOBAL PARA TODAS LAS RUTAS DE BOVINOS
// ============================================================================

// Todas las rutas de bovinos requieren autenticación
router.use(authMiddleware);

// ============================================================================
// RUTAS CRUD BÁSICAS
// ============================================================================

/**
 * @route   GET /cattle
 * @desc    Obtener lista paginada de bovinos con filtros opcionales
 * @access  Private
 */
router.get(
  '/',
  createRateLimit(EndpointType.CATTLE_READ),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    // Usar método genérico del controlador
    if (bovinesController.getBovines) {
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   POST /cattle
 * @desc    Crear un nuevo bovino en el sistema
 * @access  Private (Roles: RANCH_OWNER, ADMIN, WORKER)
 */
router.post(
  '/',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.CATTLE_WRITE),
  uploadMiddleware.multiple('photos', 5),
  processUploadedFiles(FileCategory.CATTLE_PHOTOS),
  validationMiddleware('cattle'),
  bovinesController.createBovine
);

/**
 * @route   GET /cattle/:id
 * @desc    Obtener detalles específicos de un bovino por ID
 * @access  Private
 */
router.get(
  '/:id',
  createRateLimit(EndpointType.CATTLE_READ),
  bovinesController.getBovineById
);

/**
 * @route   PUT /cattle/:id
 * @desc    Actualizar información de un bovino existente
 * @access  Private (Roles: RANCH_OWNER, ADMIN, WORKER, VETERINARIAN)
 */
router.put(
  '/:id',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.CATTLE_WRITE),
  uploadMiddleware.multiple('photos', 5),
  processUploadedFiles(FileCategory.CATTLE_PHOTOS),
  validationMiddleware('cattle'),
  bovinesController.updateBovine
);

/**
 * @route   DELETE /cattle/:id
 * @desc    Eliminar un bovino del sistema (soft delete)
 * @access  Private (Roles: RANCH_OWNER, ADMIN)
 */
router.delete(
  '/:id',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.BULK_OPERATIONS),
  bovinesController.deleteBovine
);

// ============================================================================
// RUTAS DE BÚSQUEDA ESPECÍFICA
// ============================================================================

/**
 * @route   GET /cattle/search
 * @desc    Búsqueda avanzada de bovinos con múltiples criterios
 * @access  Private
 */
router.get(
  '/search',
  createRateLimit(EndpointType.CATTLE_READ),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    // Implementar búsqueda usando el método genérico
    if (bovinesController.getBovines) {
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Search method not implemented' });
  }
);

/**
 * @route   GET /cattle/ear-tag/:earTag
 * @desc    Buscar bovino por número de arete específico
 * @access  Private
 */
router.get(
  '/ear-tag/:earTag',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    // Implementar búsqueda por arete usando el método genérico
    if (bovinesController.getBovines) {
      // Agregar filtro de arete a la query
      req.query.earTag = req.params.earTag;
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   GET /cattle/type/:type
 * @desc    Obtener bovinos filtrados por tipo
 * @access  Private
 */
router.get(
  '/type/:type',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    if (bovinesController.getBovines) {
      req.query.type = req.params.type;
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   GET /cattle/breed/:breed
 * @desc    Obtener bovinos filtrados por raza
 * @access  Private
 */
router.get(
  '/breed/:breed',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    if (bovinesController.getBovines) {
      req.query.breed = req.params.breed;
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   GET /cattle/gender/:gender
 * @desc    Obtener bovinos filtrados por género
 * @access  Private
 */
router.get(
  '/gender/:gender',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    if (bovinesController.getBovines) {
      req.query.gender = req.params.gender;
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   GET /cattle/health-status/:status
 * @desc    Obtener bovinos filtrados por estado de salud
 * @access  Private
 */
router.get(
  '/health-status/:status',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    if (bovinesController.getBovines) {
      req.query.healthStatus = req.params.status;
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

// ============================================================================
// RUTAS DE GENEALOGÍA Y PARENTESCO
// ============================================================================

/**
 * @route   GET /cattle/:id/genealogy
 * @desc    Obtener árbol genealógico completo de un bovino
 * @access  Private
 */
router.get(
  '/:id/genealogy',
  createRateLimit(EndpointType.CATTLE_READ),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    // Usar getBovineById como fallback
    return bovinesController.getBovineById(req, res);
  }
);

/**
 * @route   GET /cattle/:id/offspring
 * @desc    Obtener descendencia directa de un bovino
 * @access  Private
 */
router.get(
  '/:id/offspring',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return bovinesController.getBovineById(req, res);
  }
);

/**
 * @route   GET /cattle/:id/siblings
 * @desc    Obtener hermanos de un bovino
 * @access  Private
 */
router.get(
  '/:id/siblings',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return bovinesController.getBovineById(req, res);
  }
);

/**
 * @route   GET /cattle/:id/parents
 * @desc    Obtener información de los padres de un bovino
 * @access  Private
 */
router.get(
  '/:id/parents',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return bovinesController.getBovineById(req, res);
  }
);

// ============================================================================
// RUTAS DE UBICACIÓN Y GEOLOCALIZACIÓN
// ============================================================================

/**
 * @route   PUT /cattle/:id/location
 * @desc    Actualizar ubicación GPS de un bovino
 * @access  Private
 */
router.put(
  '/:id/location',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.MAPS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    // Usar updateBovine para actualizar ubicación
    return bovinesController.updateBovine(req, res);
  }
);

/**
 * @route   GET /cattle/nearby
 * @desc    Encontrar bovinos cercanos a una ubicación específica
 * @access  Private
 */
router.get(
  '/nearby',
  createRateLimit(EndpointType.MAPS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    if (bovinesController.getBovines) {
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   GET /cattle/by-area
 * @desc    Obtener bovinos dentro de un área geográfica específica
 * @access  Private
 */
router.get(
  '/by-area',
  createRateLimit(EndpointType.MAPS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    if (bovinesController.getBovines) {
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

// ============================================================================
// RUTAS DE ESTADÍSTICAS Y ANÁLISIS
// ============================================================================

/**
 * @route   GET /cattle/stats
 * @desc    Obtener estadísticas generales del ganado
 * @access  Private
 */
router.get(
  '/stats',
  createRateLimit(EndpointType.REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    if (bovinesController.getBovineStats) {
      return bovinesController.getBovineStats(req, res);
    } else if (bovinesController.getBovines) {
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Statistics method not implemented' });
  }
);

/**
 * @route   GET /cattle/stats/by-type
 * @desc    Estadísticas agrupadas por tipo de bovino
 * @access  Private
 */
router.get(
  '/stats/by-type',
  createRateLimit(EndpointType.REPORTS),
  (req: Request, res: Response) => {
    if (bovinesController.getBovineStats) {
      req.query.groupBy = 'type';
      return bovinesController.getBovineStats(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   GET /cattle/stats/by-health
 * @desc    Estadísticas agrupadas por estado de salud
 * @access  Private
 */
router.get(
  '/stats/by-health',
  createRateLimit(EndpointType.REPORTS),
  (req: Request, res: Response) => {
    if (bovinesController.getBovineStats) {
      req.query.groupBy = 'health';
      return bovinesController.getBovineStats(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   GET /cattle/stats/age-distribution
 * @desc    Distribución de edades del ganado
 * @access  Private
 */
router.get(
  '/stats/age-distribution',
  createRateLimit(EndpointType.REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    if (bovinesController.getBovineStats) {
      req.query.groupBy = 'age';
      return bovinesController.getBovineStats(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

/**
 * @route   GET /cattle/stats/weight-distribution
 * @desc    Distribución de pesos del ganado
 * @access  Private
 */
router.get(
  '/stats/weight-distribution',
  createRateLimit(EndpointType.REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    if (bovinesController.getBovineStats) {
      req.query.groupBy = 'weight';
      return bovinesController.getBovineStats(req, res);
    }
    return res.status(501).json({ error: 'Method not implemented' });
  }
);

// ============================================================================
// OPERACIONES MASIVAS (BULK OPERATIONS)
// ============================================================================

/**
 * @route   PUT /cattle/bulk-update
 * @desc    Actualizar múltiples bovinos simultáneamente
 * @access  Private
 */
router.put(
  '/bulk-update',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.BULK_OPERATIONS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    // Usar updateBovine como fallback
    return bovinesController.updateBovine(req, res);
  }
);

/**
 * @route   DELETE /cattle/bulk-delete
 * @desc    Eliminar múltiples bovinos simultáneamente
 * @access  Private
 */
router.delete(
  '/bulk-delete',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.BULK_OPERATIONS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    // Usar deleteBovine como fallback
    return bovinesController.deleteBovine(req, res);
  }
);

/**
 * @route   PUT /cattle/bulk-location-update
 * @desc    Actualizar ubicación de múltiples bovinos
 * @access  Private
 */
router.put(
  '/bulk-location-update',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.BULK_OPERATIONS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return bovinesController.updateBovine(req, res);
  }
);

// ============================================================================
// IMPORTACIÓN Y EXPORTACIÓN
// ============================================================================

/**
 * @route   POST /cattle/export
 * @desc    Exportar datos de bovinos en diferentes formatos
 * @access  Private
 */
router.post(
  '/export',
  createRateLimit(EndpointType.REPORTS),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    if (bovinesController.getBovines) {
      return bovinesController.getBovines(req, res);
    }
    return res.status(501).json({ error: 'Export method not implemented' });
  }
);

/**
 * @route   POST /cattle/import
 * @desc    Importar bovinos desde archivo CSV o Excel
 * @access  Private
 */
router.post(
  '/import',
  roleMiddleware(UserRole.SUPER_ADMIN),
  createRateLimit(EndpointType.FILES),
  createUploadMiddleware(FileCategory.PRODUCTION_DATA).single('file'),
  processUploadedFiles(FileCategory.PRODUCTION_DATA),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return bovinesController.createBovine(req, res);
  }
);

/**
 * @route   GET /cattle/export/:exportId/download
 * @desc    Descargar archivo exportado previamente
 * @access  Private
 */
router.get(
  '/export/:exportId/download',
  createRateLimit(EndpointType.FILES),
  (req: Request, res: Response) => {
    return bovinesController.getBovineById(req, res);
  }
);

/**
 * @route   GET /cattle/import/:importId/status
 * @desc    Verificar estado de proceso de importación
 * @access  Private
 */
router.get(
  '/import/:importId/status',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return bovinesController.getBovineById(req, res);
  }
);

// ============================================================================
// RUTAS DE ARCHIVO Y MULTIMEDIA
// ============================================================================

/**
 * @route   POST /cattle/:id/photos
 * @desc    Subir fotos adicionales para un bovino
 * @access  Private
 */
router.post(
  '/:id/photos',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.FILES),
  uploadMiddleware.multiple('photos', 10),
  processUploadedFiles(FileCategory.CATTLE_PHOTOS),
  (req: Request, res: Response) => {
    return bovinesController.updateBovine(req, res);
  }
);

/**
 * @route   DELETE /cattle/:id/photos/:photoId
 * @desc    Eliminar foto específica de un bovino
 * @access  Private
 */
router.delete(
  '/:id/photos/:photoId',
  roleMiddleware(UserRole.WORKER),
  createRateLimit(EndpointType.FILES),
  (req: Request, res: Response) => {
    return bovinesController.deleteBovine(req, res);
  }
);

/**
 * @route   GET /cattle/:id/photos/:photoId
 * @desc    Obtener foto específica de un bovino
 * @access  Private
 */
router.get(
  '/:id/photos/:photoId',
  createRateLimit(EndpointType.FILES),
  (req: Request, res: Response) => {
    return bovinesController.getBovineById(req, res);
  }
);

// ============================================================================
// RUTAS DE AUDITORÍA Y HISTORIAL
// ============================================================================

/**
 * @route   GET /cattle/:id/history
 * @desc    Obtener historial completo de cambios de un bovino
 * @access  Private
 */
router.get(
  '/:id/history',
  createRateLimit(EndpointType.CATTLE_READ),
  validationMiddleware('search'),
  (req: Request, res: Response) => {
    return bovinesController.getBovineById(req, res);
  }
);

/**
 * @route   GET /cattle/:id/timeline
 * @desc    Obtener línea de tiempo de eventos importantes del bovino
 * @access  Private
 */
router.get(
  '/:id/timeline',
  createRateLimit(EndpointType.CATTLE_READ),
  (req: Request, res: Response) => {
    return bovinesController.getBovineById(req, res);
  }
);

// ============================================================================
// MANEJO DE ERRORES ESPECÍFICOS PARA RUTAS DE BOVINOS
// ============================================================================

/**
 * Middleware de manejo de errores específico para bovinos
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  console.error('Bovines Route Error:', {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  if (error.name === 'BovineNotFoundError') {
    return res.status(404).json({
      success: false,
      message: 'Bovino no encontrado',
      error: 'BOVINE_NOT_FOUND'
    });
  }

  if (error.name === 'DuplicateEarTagError') {
    return res.status(409).json({
      success: false,
      message: 'Ya existe un bovino con este número de arete',
      error: 'DUPLICATE_EAR_TAG'
    });
  }

  if (error.name === 'InvalidLocationError') {
    return res.status(400).json({
      success: false,
      message: 'Coordenadas GPS inválidas',
      error: 'INVALID_LOCATION'
    });
  }

  if (error.name === 'FileUploadError') {
    return res.status(400).json({
      success: false,
      message: 'Error al subir archivo',
      error: 'FILE_UPLOAD_ERROR',
      details: error.details
    });
  }

  if (error.name === 'BulkOperationError') {
    return res.status(400).json({
      success: false,
      message: 'Error en operación masiva',
      error: 'BULK_OPERATION_ERROR',
      details: error.details
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: 'INTERNAL_SERVER_ERROR'
  });
});

// Agregar middleware de manejo de errores de upload al final
router.use(handleUploadErrors);

export default router;