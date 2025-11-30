import { Router, Request, Response, NextFunction } from 'express';
import { Op, WhereOptions } from 'sequelize';

// Importaciones de middleware
import { 
  authenticateToken, 
  authorizeRoles, 
} from '../middleware/auth';
import { UserRole } from '../models/User';

import { validate, validateId, sanitizeInput } from '../middleware/validation';

// Importaciones de controladores
import InventoryController from '../controllers/inventory';

// Interfaces para controladores que faltan
interface MedicineController {
  getMedicines(params: any): Promise<any>;
  getMedicineById(id: string, userId: string): Promise<any>;
  createMedicine(data: any): Promise<any>;
  updateMedicine(id: string, data: any): Promise<any>;
  deleteMedicine(id: string, userId: string): Promise<boolean>;
}

interface StockController {
  getStockLevels(params: any): Promise<any>;
  recordMovement(data: any): Promise<any>;
  getMovements(params: any): Promise<any>;
}

interface AlertController {
  getInventoryAlerts(params: any): Promise<any>;
  acknowledgeAlert(id: string, userId: string): Promise<any>;
  resolveAlert(id: string, userId: string, notes?: string): Promise<any>;
}

// Controladores mock hasta que se implementen
const MedicineController: MedicineController = {
  async getMedicines(params) { return { medicines: [], total: 0 }; },
  async getMedicineById(id, userId) { return null; },
  async createMedicine(data) { return { id: '1', ...data }; },
  async updateMedicine(id, data) { return { id, ...data }; },
  async deleteMedicine(id, userId) { return true; }
};

const StockController: StockController = {
  async getStockLevels(params) { return { levels: [] }; },
  async recordMovement(data) { return { id: '1', ...data }; },
  async getMovements(params) { return { movements: [], total: 0 }; }
};

const AlertController: AlertController = {
  async getInventoryAlerts(params) { return { alerts: [] }; },
  async acknowledgeAlert(id, userId) { return { id, acknowledged: true }; },
  async resolveAlert(id, userId, notes) { return { id, resolved: true, notes }; }
};

const router = Router();

// ===================================================================
// FUNCIONES DE VALIDACIÓN PERSONALIZADAS
// ===================================================================

// Función para validar UUID
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Función para validar fecha ISO
const isValidISODate = (date: string): boolean => {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return isoRegex.test(date) && !isNaN(Date.parse(date));
};

// Función para validar números
const isValidNumber = (value: any, min?: number, max?: number): boolean => {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
};

// Función para validar enteros
const isValidInteger = (value: any, min?: number, max?: number): boolean => {
  const num = parseInt(value);
  if (isNaN(num) || !Number.isInteger(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
};

// Función para validar longitud de cadena
const isValidLength = (value: any, min?: number, max?: number): boolean => {
  if (typeof value !== 'string') return false;
  if (min !== undefined && value.length < min) return false;
  if (max !== undefined && value.length > max) return false;
  return true;
};

// Función para validar valores en array
const isInArray = (value: any, validValues: string[]): boolean => {
  return validValues.includes(value);
};

// Middleware para validación personalizada
const validateFields = (validations: any[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: any[] = [];
    
    for (const validation of validations) {
      const { field, validate, message, required = false } = validation;
      let value;
      
      // Buscar el valor en params, query o body
      if (req.params[field] !== undefined) value = req.params[field];
      else if (req.query[field] !== undefined) value = req.query[field];
      else if (req.body && req.body[field] !== undefined) value = req.body[field];
      
      // Verificar si es requerido y está vacío
      if (required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          value,
          message: `${field} es requerido`
        });
        continue;
      }
      
      // Si no es requerido y está vacío, pasar al siguiente
      if (!required && (value === undefined || value === null || value === '')) {
        continue;
      }
      
      // Validar el valor
      if (!validate(value)) {
        errors.push({
          field,
          value,
          message
        });
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      });
    }
    
    next();
  };
};

// Middleware de auditoría simple
const auditLog = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log(`[AUDIT] ${action} - Usuario: ${req.user?.id} - ${new Date().toISOString()}`);
    next();
  };
};

// ===================================================================
// RUTAS DEL DASHBOARD DE INVENTARIO
// ===================================================================

/**
 * GET /api/inventory/dashboard
 * Obtiene estadísticas generales del inventario para el dashboard
 */
router.get('/dashboard', 
  authenticateToken,
  validateFields([
    {
      field: 'timeRange',
      validate: (value: any) => !value || ['7d', '30d', '90d', '1y'].includes(value),
      message: 'Rango de tiempo inválido'
    },
    {
      field: 'ranchId',
      validate: (value: any) => !value || isValidUUID(value),
      message: 'ID de rancho debe ser un UUID válido'
    }
  ]),
  auditLog('inventory.dashboard.view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { timeRange = '30d', ranchId } = req.query;
      const userId = req.user?.id;

      await InventoryController.getInventoryStats(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/inventory/summary
 * Resumen ejecutivo del estado del inventario
 */
router.get('/summary',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      await InventoryController.getInventoryStats(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE GESTIÓN DE MEDICAMENTOS
// ===================================================================

/**
 * GET /api/inventory/medicines
 * Obtiene lista paginada de medicamentos con filtros
 */
router.get('/medicines',
  authenticateToken,
  validateFields([
    {
      field: 'page',
      validate: (value: any) => !value || isValidInteger(value, 1),
      message: 'La página debe ser un número entero mayor a 0'
    },
    {
      field: 'limit',
      validate: (value: any) => !value || isValidInteger(value, 1, 100),
      message: 'El límite debe estar entre 1 y 100'
    },
    {
      field: 'search',
      validate: (value: any) => !value || isValidLength(value, 1, 100),
      message: 'La búsqueda debe tener entre 1 y 100 caracteres'
    },
    {
      field: 'category',
      validate: (value: any) => !value || isInArray(value, [
        'antibiotic', 'vaccine', 'antiparasitic', 'antiinflammatory',
        'analgesic', 'vitamin', 'mineral', 'hormone', 'anesthetic',
        'antidiarrheal', 'respiratory', 'dermatological', 'reproductive',
        'immunomodulator', 'antiseptic'
      ]),
      message: 'Categoría de medicamento inválida'
    },
    {
      field: 'status',
      validate: (value: any) => !value || isInArray(value, [
        'in_stock', 'low_stock', 'out_of_stock', 'overstocked',
        'reserved', 'expired', 'damaged', 'quarantined', 'discontinued'
      ]),
      message: 'Estado de inventario inválido'
    }
  ]),
  auditLog('inventory.medicines.list'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category,
        status,
        expiringWithin,
        requiresRefrigeration,
        location
      } = req.query;

      const userId = req.user?.id;

      const filters = {
        search: search as string,
        category: category as string,
        status: status as string,
        expiringWithin: expiringWithin ? parseInt(expiringWithin as string) : undefined,
        requiresRefrigeration: requiresRefrigeration === 'true',
        location: location as string
      };

      const medicines = await MedicineController.getMedicines({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        filters,
        userId
      });

      res.json({
        success: true,
        data: medicines,
        message: 'Medicamentos obtenidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/inventory/medicines/:id
 * Obtiene detalles completos de un medicamento específico
 */
router.get('/medicines/:id',
  authenticateToken,
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID debe ser un UUID válido',
      required: true
    }
  ]),
  auditLog('inventory.medicine.view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const medicine = await MedicineController.getMedicineById(id, userId || '');

      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: 'Medicamento no encontrado'
        });
      }

      res.json({
        success: true,
        data: medicine
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/inventory/medicines
 * Crea un nuevo medicamento en el inventario
 */
router.post('/medicines',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'name',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'El nombre debe tener entre 2 y 100 caracteres',
      required: true
    },
    {
      field: 'category',
      validate: (value: any) => value && isInArray(value, [
        'antibiotic', 'vaccine', 'antiparasitic', 'antiinflammatory',
        'analgesic', 'vitamin', 'mineral', 'hormone', 'anesthetic',
        'antidiarrheal', 'respiratory', 'dermatological', 'reproductive',
        'immunomodulator', 'antiseptic'
      ]),
      message: 'Categoría de medicamento inválida',
      required: true
    },
    {
      field: 'manufacturer',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'El fabricante debe tener entre 2 y 100 caracteres',
      required: true
    },
    {
      field: 'activeIngredient',
      validate: (value: any) => value && isValidLength(value, 2, 200),
      message: 'El principio activo debe tener entre 2 y 200 caracteres',
      required: true
    },
    {
      field: 'concentration',
      validate: (value: any) => value !== undefined && value !== null && value !== '',
      message: 'La concentración es requerida',
      required: true
    }
  ]),
  auditLog('inventory.medicine.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const medicineData = req.body;
      const userId = req.user?.id;

      const newMedicine = await MedicineController.createMedicine({
        ...medicineData,
        createdBy: userId
      });

      res.status(201).json({
        success: true,
        data: newMedicine,
        message: 'Medicamento creado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/inventory/medicines/:id
 * Actualiza un medicamento existente
 */
router.put('/medicines/:id',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID debe ser un UUID válido',
      required: true
    },
    {
      field: 'name',
      validate: (value: any) => !value || isValidLength(value, 2, 100),
      message: 'El nombre debe tener entre 2 y 100 caracteres'
    },
    {
      field: 'currentStock',
      validate: (value: any) => !value || isValidNumber(value, 0),
      message: 'El stock actual debe ser un número no negativo'
    }
  ]),
  auditLog('inventory.medicine.update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user?.id;

      const updatedMedicine = await MedicineController.updateMedicine(id, {
        ...updateData,
        lastUpdatedBy: userId
      });

      if (!updatedMedicine) {
        return res.status(404).json({
          success: false,
          message: 'Medicamento no encontrado'
        });
      }

      res.json({
        success: true,
        data: updatedMedicine,
        message: 'Medicamento actualizado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/inventory/medicines/:id
 * Elimina un medicamento (soft delete)
 */
router.delete('/medicines/:id',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID debe ser un UUID válido',
      required: true
    }
  ]),
  auditLog('inventory.medicine.delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const deleted = await MedicineController.deleteMedicine(id, userId || '');

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Medicamento no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Medicamento eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE GESTIÓN DE STOCK
// ===================================================================

/**
 * GET /api/inventory/stock/levels
 * Obtiene los niveles de stock con análisis de optimización
 */
router.get('/stock/levels',
  authenticateToken,
  validateFields([
    {
      field: 'category',
      validate: (value: any) => !value || isInArray(value, [
        'antibiotic', 'vaccine', 'antiparasitic', 'antiinflammatory',
        'analgesic', 'vitamin', 'mineral', 'hormone', 'anesthetic'
      ]),
      message: 'Categoría inválida'
    },
    {
      field: 'status',
      validate: (value: any) => !value || isInArray(value, [
        'optimal', 'adequate', 'low', 'critical', 'overstock', 'out_of_stock'
      ]),
      message: 'Estado de stock inválido'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, status } = req.query;
      const userId = req.user?.id;

      const stockLevels = await StockController.getStockLevels({
        category: category as string,
        status: status as string,
        userId
      });

      res.json({
        success: true,
        data: stockLevels
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/inventory/stock/movement
 * Registra un movimiento de stock (entrada, salida, ajuste)
 */
router.post('/stock/movement',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'medicineId',
      validate: isValidUUID,
      message: 'ID de medicamento debe ser un UUID válido',
      required: true
    },
    {
      field: 'movementType',
      validate: (value: any) => value && isInArray(value, [
        'entry', 'exit', 'adjustment', 'transfer', 'usage', 'expired', 'damaged'
      ]),
      message: 'Tipo de movimiento inválido',
      required: true
    },
    {
      field: 'quantity',
      validate: (value: any) => value !== undefined && isValidNumber(value, -999999, 999999),
      message: 'La cantidad debe ser un número válido',
      required: true
    },
    {
      field: 'reason',
      validate: (value: any) => value && isValidLength(value, 5, 200),
      message: 'La razón debe tener entre 5 y 200 caracteres',
      required: true
    }
  ]),
  auditLog('inventory.stock.movement'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const movementData = req.body;
      const userId = req.user?.id;

      const movement = await StockController.recordMovement({
        ...movementData,
        performedBy: userId,
        timestamp: new Date()
      });

      res.status(201).json({
        success: true,
        data: movement,
        message: 'Movimiento de stock registrado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/inventory/stock/movements
 * Obtiene historial de movimientos de stock
 */
router.get('/stock/movements',
  authenticateToken,
  validateFields([
    {
      field: 'page',
      validate: (value: any) => !value || isValidInteger(value, 1),
      message: 'La página debe ser un número entero mayor a 0'
    },
    {
      field: 'limit',
      validate: (value: any) => !value || isValidInteger(value, 1, 100),
      message: 'El límite debe estar entre 1 y 100'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 20,
        medicineId,
        movementType,
        dateFrom,
        dateTo
      } = req.query;

      const userId = req.user?.id;

      const movements = await StockController.getMovements({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        filters: {
          medicineId: medicineId as string,
          movementType: movementType as string,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined
        },
        userId
      });

      res.json({
        success: true,
        data: movements
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE ALERTAS DE INVENTARIO
// ===================================================================

/**
 * GET /api/inventory/alerts
 * Obtiene alertas activas del inventario
 */
router.get('/alerts',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, priority, status } = req.query;
      const userId = req.user?.id;

      const alerts = await AlertController.getInventoryAlerts({
        type: type as string,
        priority: priority as string,
        status: status as string,
        userId
      });

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/inventory/alerts/:id/acknowledge
 * Marca una alerta como reconocida
 */
router.put('/alerts/:id/acknowledge',
  authenticateToken,
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID debe ser un UUID válido',
      required: true
    }
  ]),
  auditLog('inventory.alert.acknowledge'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const alert = await AlertController.acknowledgeAlert(id, userId || '');

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alerta no encontrada'
        });
      }

      res.json({
        success: true,
        data: alert,
        message: 'Alerta reconocida exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/inventory/alerts/:id/resolve
 * Marca una alerta como resuelta
 */
router.put('/alerts/:id/resolve',
  authenticateToken,
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID debe ser un UUID válido',
      required: true
    },
    {
      field: 'resolutionNotes',
      validate: (value: any) => !value || isValidLength(value, 0, 500),
      message: 'Las notas de resolución no pueden exceder 500 caracteres'
    }
  ]),
  auditLog('inventory.alert.resolve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { resolutionNotes } = req.body;
      const userId = req.user?.id;

      const alert = await AlertController.resolveAlert(id, userId || '', resolutionNotes);

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alerta no encontrada'
        });
      }

      res.json({
        success: true,
        data: alert,
        message: 'Alerta resuelta exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE REPORTES DE INVENTARIO
// ===================================================================

/**
 * GET /api/inventory/reports/stock-valuation
 * Genera reporte de valorización del inventario
 */
router.get('/reports/stock-valuation',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  auditLog('inventory.reports.stock_valuation'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await InventoryController.getInventoryStats(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/inventory/reports/usage-analysis
 * Genera análisis de consumo de medicamentos
 */
router.get('/reports/usage-analysis',
  authenticateToken,
  auditLog('inventory.reports.usage_analysis'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await InventoryController.getInventoryStats(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/inventory/reports/expiry
 * Reporte de medicamentos próximos a vencer
 */
router.get('/reports/expiry',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await InventoryController.getAlerts(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE GEOLOCALIZACIÓN DE INVENTARIO
// ===================================================================

/**
 * GET /api/inventory/locations
 * Obtiene ubicaciones donde se han aplicado medicamentos
 */
router.get('/locations',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: { locations: [] },
        message: 'Ubicaciones de medicamentos obtenidas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/inventory/usage-map
 * Mapa de calor del uso de medicamentos por ubicación
 */
router.get('/usage-map',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: { usageMap: [] },
        message: 'Mapa de uso generado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// EXPORTAR ROUTER
// ===================================================================

export default router;