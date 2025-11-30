import { Router, Request, Response, NextFunction } from 'express';
import { Op, WhereOptions } from 'sequelize';

// Importaciones de middleware
import { 
  authenticateToken, 
  authorizeRoles, 
} from '../middleware/auth';
import { UserRole } from '../models/User';

// Importaciones de controladores
import RanchController from '../controllers/ranch';

// Interfaces para controladores que faltan
interface PropertyController {
  getPropertyInfo(params: any): Promise<any>;
  getFacilities(params: any): Promise<any>;
  createFacility(data: any): Promise<any>;
}

interface StaffController {
  getStaff(params: any): Promise<any>;
  createEmployee(data: any): Promise<any>;
  updateEmployee(id: string, data: any): Promise<any>;
  getEmployeePerformance(params: any): Promise<any>;
}

interface DocumentController {
  getRanchDocuments(params: any): Promise<any>;
  uploadDocuments(data: any): Promise<any>;
  deleteDocument(id: string, userId: string): Promise<boolean>;
}

// Controladores mock hasta que se implementen
const PropertyController: PropertyController = {
  async getPropertyInfo(params) { return { property: {}, documents: [], photos: [], facilities: [] }; },
  async getFacilities(params) { return { facilities: [] }; },
  async createFacility(data) { return { id: '1', ...data }; }
};

const StaffController: StaffController = {
  async getStaff(params) { return { staff: [], total: 0 }; },
  async createEmployee(data) { return { id: '1', ...data }; },
  async updateEmployee(id, data) { return { id, ...data }; },
  async getEmployeePerformance(params) { return { performance: {}, history: [] }; }
};

const DocumentController: DocumentController = {
  async getRanchDocuments(params) { return { documents: [] }; },
  async uploadDocuments(data) { return { documents: [] }; },
  async deleteDocument(id, userId) { return true; }
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

// Función para validar email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Función para validar teléfono
const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

// Función para validar URL
const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
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
// RUTAS DE VISTA GENERAL DEL RANCHO
// ===================================================================

/**
 * GET /api/ranch/overview
 * Vista general del rancho con estadísticas principales
 */
router.get('/overview',
  authenticateToken,
  validateFields([
    {
      field: 'includeStats',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeStats debe ser verdadero o falso'
    },
    {
      field: 'includeAlerts',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeAlerts debe ser verdadero o falso'
    },
    {
      field: 'timeRange',
      validate: (value: any) => !value || ['7d', '30d', '90d', '1y'].includes(value),
      message: 'Rango de tiempo inválido'
    }
  ]),
  auditLog('ranch.overview.view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        includeStats = true, 
        includeAlerts = true, 
        timeRange = '30d' 
      } = req.query;
      const userId = req.user?.id;

      // Mock response hasta que se implemente el controlador real
      const overview = {
        ranch: {
          id: '1',
          name: 'Rancho Demo',
          totalArea: 100,
          operationType: 'mixed'
        },
        stats: includeStats === 'true' ? {
          totalCattle: 0,
          activeCattle: 0,
          totalProduction: 0
        } : null,
        alerts: includeAlerts === 'true' ? [] : null
      };

      res.json({
        success: true,
        data: overview,
        message: 'Vista general del rancho obtenida exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ranch/statistics
 * Estadísticas detalladas del rancho
 */
router.get('/statistics',
  authenticateToken,
  validateFields([
    {
      field: 'category',
      validate: (value: any) => !value || ['general', 'operational', 'financial', 'compliance', 'production'].includes(value),
      message: 'Categoría de estadísticas inválida'
    },
    {
      field: 'period',
      validate: (value: any) => !value || ['current', 'daily', 'weekly', 'monthly', 'yearly'].includes(value),
      message: 'Período inválido'
    },
    {
      field: 'includeComparisons',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeComparisons debe ser verdadero o falso'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        category = 'general', 
        period = 'current', 
        includeComparisons = false 
      } = req.query;
      const userId = req.user?.id;

      const statistics = {
        category,
        period,
        data: {},
        comparisons: includeComparisons === 'true' ? {} : null
      };

      res.json({
        success: true,
        data: statistics,
        message: 'Estadísticas del rancho obtenidas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE GESTIÓN DE RANCHOS
// ===================================================================

/**
 * GET /api/ranch
 * Obtiene información básica del rancho del usuario
 */
router.get('/',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      // Mock response hasta que se implemente
      const ranch = {
        id: '1',
        name: 'Rancho Demo',
        description: 'Rancho de demostración',
        totalArea: 100,
        owner: {
          id: userId,
          name: req.user?.personalInfo.firstName + ' ' + req.user?.personalInfo.lastName
        }
      };

      res.json({
        success: true,
        data: ranch,
        message: 'Información del rancho obtenida exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ranch
 * Crea un nuevo rancho (solo para administradores)
 */
router.post('/',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.OWNER),
  validateFields([
    {
      field: 'name',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'El nombre debe tener entre 2 y 100 caracteres',
      required: true
    },
    {
      field: 'description',
      validate: (value: any) => !value || isValidLength(value, 0, 1000),
      message: 'La descripción no puede exceder 1000 caracteres'
    },
    {
      field: 'establishedYear',
      validate: (value: any) => value && isValidInteger(value, 1800, new Date().getFullYear()),
      message: 'Año de establecimiento inválido',
      required: true
    },
    {
      field: 'propertyType',
      validate: (value: any) => value && ['ranch', 'farm', 'dairy', 'feedlot', 'mixed'].includes(value),
      message: 'Tipo de propiedad inválido',
      required: true
    },
    {
      field: 'address',
      validate: (value: any) => value && isValidLength(value, 10, 200),
      message: 'La dirección debe tener entre 10 y 200 caracteres',
      required: true
    },
    {
      field: 'city',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'La ciudad debe tener entre 2 y 100 caracteres',
      required: true
    },
    {
      field: 'state',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'El estado debe tener entre 2 y 100 caracteres',
      required: true
    },
    {
      field: 'country',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'El país debe tener entre 2 y 100 caracteres',
      required: true
    }
  ]),
  auditLog('ranch.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ranchData = req.body;
      const userId = req.user?.id;

      const newRanch = {
        id: Date.now().toString(),
        ...ranchData,
        createdBy: userId,
        createdAt: new Date()
      };

      res.status(201).json({
        success: true,
        data: newRanch,
        message: 'Rancho creado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/ranch/:id
 * Actualiza información del rancho
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER),
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID del rancho debe ser un UUID válido',
      required: true
    },
    {
      field: 'name',
      validate: (value: any) => !value || isValidLength(value, 2, 100),
      message: 'El nombre debe tener entre 2 y 100 caracteres'
    },
    {
      field: 'description',
      validate: (value: any) => !value || isValidLength(value, 0, 1000),
      message: 'La descripción no puede exceder 1000 caracteres'
    },
    {
      field: 'establishedYear',
      validate: (value: any) => !value || isValidInteger(value, 1800, new Date().getFullYear()),
      message: 'Año de establecimiento inválido'
    }
  ]),
  auditLog('ranch.update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user?.id;

      const updatedRanch = {
        id,
        ...updateData,
        updatedBy: userId,
        updatedAt: new Date()
      };

      res.json({
        success: true,
        data: updatedRanch,
        message: 'Rancho actualizado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE INFORMACIÓN DE LA PROPIEDAD
// ===================================================================

/**
 * GET /api/ranch/property-info
 * Obtiene información completa de la propiedad
 */
router.get('/property-info',
  authenticateToken,
  validateFields([
    {
      field: 'includeDocuments',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeDocuments debe ser verdadero o falso'
    },
    {
      field: 'includePhotos',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includePhotos debe ser verdadero o falso'
    },
    {
      field: 'includeFacilities',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeFacilities debe ser verdadero o falso'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        includeDocuments = true, 
        includePhotos = true, 
        includeFacilities = true 
      } = req.query;
      const userId = req.user?.id;

      const propertyInfo = await PropertyController.getPropertyInfo({
        includeDocuments: includeDocuments === 'true',
        includePhotos: includePhotos === 'true',
        includeFacilities: includeFacilities === 'true',
        userId
      });

      res.json({
        success: true,
        data: propertyInfo,
        message: 'Información de la propiedad obtenida exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ranch/facilities
 * Obtiene lista de instalaciones del rancho
 */
router.get('/facilities',
  authenticateToken,
  validateFields([
    {
      field: 'type',
      validate: (value: any) => !value || [
        'barn', 'milking_parlor', 'feed_storage', 'water_source', 'corral', 
        'office', 'housing', 'equipment_storage', 'processing', 'quarantine'
      ].includes(value),
      message: 'Tipo de instalación inválido'
    },
    {
      field: 'status',
      validate: (value: any) => !value || [
        'active', 'inactive', 'under_construction', 'needs_repair', 'planned'
      ].includes(value),
      message: 'Estado de instalación inválido'
    },
    {
      field: 'includeCoordinates',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeCoordinates debe ser verdadero o falso'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, status, includeCoordinates = true } = req.query;
      const userId = req.user?.id;

      const facilities = await PropertyController.getFacilities({
        type: type as string,
        status: status as string,
        includeCoordinates: includeCoordinates === 'true',
        userId
      });

      res.json({
        success: true,
        data: facilities,
        message: 'Instalaciones obtenidas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ranch/facilities
 * Registra nueva instalación en el rancho
 */
router.post('/facilities',
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
      field: 'type',
      validate: (value: any) => value && [
        'barn', 'milking_parlor', 'feed_storage', 'water_source', 'corral',
        'office', 'housing', 'equipment_storage', 'processing', 'quarantine'
      ].includes(value),
      message: 'Tipo de instalación inválido',
      required: true
    },
    {
      field: 'description',
      validate: (value: any) => !value || isValidLength(value, 0, 500),
      message: 'La descripción no puede exceder 500 caracteres'
    },
    {
      field: 'capacity',
      validate: (value: any) => !value || isValidInteger(value, 1),
      message: 'La capacidad debe ser un número entero positivo'
    },
    {
      field: 'area',
      validate: (value: any) => !value || isValidNumber(value, 0.1, 100000),
      message: 'El área debe estar entre 0.1 y 100,000 m²'
    }
  ]),
  auditLog('ranch.facility.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityData = req.body;
      const userId = req.user?.id;

      const newFacility = await PropertyController.createFacility({
        ...facilityData,
        createdBy: userId
      });

      res.status(201).json({
        success: true,
        data: newFacility,
        message: 'Instalación registrada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE GESTIÓN DE DOCUMENTOS
// ===================================================================

/**
 * GET /api/ranch/documents
 * Obtiene documentos del rancho
 */
router.get('/documents',
  authenticateToken,
  validateFields([
    {
      field: 'type',
      validate: (value: any) => !value || [
        'title_deed', 'survey', 'permit', 'certificate', 'insurance', 'tax',
        'environmental', 'inspection', 'contract', 'legal', 'financial'
      ].includes(value),
      message: 'Tipo de documento inválido'
    },
    {
      field: 'status',
      validate: (value: any) => !value || [
        'valid', 'expired', 'pending', 'requires_renewal', 'under_review'
      ].includes(value),
      message: 'Estado de documento inválido'
    },
    {
      field: 'expiringWithin',
      validate: (value: any) => !value || isValidInteger(value, 1, 365),
      message: 'Días de vencimiento debe estar entre 1 y 365'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, status, expiringWithin } = req.query;
      const userId = req.user?.id;

      const documents = await DocumentController.getRanchDocuments({
        type: type as string,
        status: status as string,
        expiringWithin: expiringWithin ? parseInt(expiringWithin as string) : undefined,
        userId
      });

      res.json({
        success: true,
        data: documents,
        message: 'Documentos obtenidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ranch/documents/upload
 * Sube documentos del rancho
 */
router.post('/documents/upload',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER),
  validateFields([
    {
      field: 'type',
      validate: (value: any) => value && [
        'title_deed', 'survey', 'permit', 'certificate', 'insurance', 'tax',
        'environmental', 'inspection', 'contract', 'legal', 'financial'
      ].includes(value),
      message: 'Tipo de documento inválido',
      required: true
    },
    {
      field: 'name',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'El nombre debe tener entre 2 y 100 caracteres',
      required: true
    },
    {
      field: 'description',
      validate: (value: any) => !value || isValidLength(value, 0, 500),
      message: 'La descripción no puede exceder 500 caracteres'
    },
    {
      field: 'expirationDate',
      validate: (value: any) => !value || isValidISODate(value),
      message: 'Fecha de vencimiento debe ser válida'
    },
    {
      field: 'issuer',
      validate: (value: any) => !value || isValidLength(value, 2, 100),
      message: 'El emisor debe tener entre 2 y 100 caracteres'
    },
    {
      field: 'documentNumber',
      validate: (value: any) => !value || isValidLength(value, 1, 50),
      message: 'Número de documento debe tener entre 1 y 50 caracteres'
    }
  ]),
  auditLog('ranch.document.upload'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentData = req.body;
      const userId = req.user?.id;

      // Mock file handling - en producción se manejarían archivos reales
      const uploadedDocuments = await DocumentController.uploadDocuments({
        ...documentData,
        files: [], // Se procesarían los archivos aquí
        uploadedBy: userId
      });

      res.status(201).json({
        success: true,
        data: uploadedDocuments,
        message: 'Documentos subidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/ranch/documents/:id
 * Elimina un documento
 */
router.delete('/documents/:id',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.OWNER),
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID del documento debe ser un UUID válido',
      required: true
    }
  ]),
  auditLog('ranch.document.delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const deleted = await DocumentController.deleteDocument(id, userId || '');

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Documento eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE GESTIÓN DE PERSONAL
// ===================================================================

/**
 * GET /api/ranch/staff
 * Obtiene lista del personal del rancho
 */
router.get('/staff',
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
      field: 'department',
      validate: (value: any) => !value || [
        'administration', 'livestock', 'veterinary', 'maintenance', 'security', 'production', 'nutrition'
      ].includes(value),
      message: 'Departamento inválido'
    },
    {
      field: 'position',
      validate: (value: any) => !value || isValidLength(value, 1, 100),
      message: 'Posición debe tener entre 1 y 100 caracteres'
    },
    {
      field: 'status',
      validate: (value: any) => !value || ['active', 'on_leave', 'suspended', 'terminated'].includes(value),
      message: 'Estado del empleado inválido'
    },
    {
      field: 'search',
      validate: (value: any) => !value || isValidLength(value, 1, 100),
      message: 'Búsqueda debe tener entre 1 y 100 caracteres'
    }
  ]),
  auditLog('ranch.staff.list'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 20,
        department,
        position,
        status,
        search
      } = req.query;

      const userId = req.user?.id;

      const filters = {
        department: department as string,
        position: position as string,
        status: status as string,
        search: search as string
      };

      const staff = await StaffController.getStaff({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        filters,
        userId
      });

      res.json({
        success: true,
        data: staff,
        message: 'Personal obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ranch/staff
 * Registra nuevo empleado
 */
router.post('/staff',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'firstName',
      validate: (value: any) => value && isValidLength(value, 2, 50),
      message: 'El nombre debe tener entre 2 y 50 caracteres',
      required: true
    },
    {
      field: 'lastName',
      validate: (value: any) => value && isValidLength(value, 2, 50),
      message: 'El apellido debe tener entre 2 y 50 caracteres',
      required: true
    },
    {
      field: 'idNumber',
      validate: (value: any) => value && isValidLength(value, 5, 20),
      message: 'Número de identificación debe tener entre 5 y 20 caracteres',
      required: true
    },
    {
      field: 'birthDate',
      validate: (value: any) => value && isValidISODate(value),
      message: 'Fecha de nacimiento debe ser válida',
      required: true
    },
    {
      field: 'gender',
      validate: (value: any) => value && ['male', 'female', 'other'].includes(value),
      message: 'Género inválido',
      required: true
    },
    {
      field: 'email',
      validate: (value: any) => !value || isValidEmail(value),
      message: 'Email debe ser válido'
    },
    {
      field: 'phone',
      validate: (value: any) => value && isValidPhone(value),
      message: 'Teléfono debe ser válido',
      required: true
    },
    {
      field: 'position',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'Posición debe tener entre 2 y 100 caracteres',
      required: true
    },
    {
      field: 'department',
      validate: (value: any) => value && [
        'administration', 'livestock', 'veterinary', 'maintenance', 'security', 'production', 'nutrition'
      ].includes(value),
      message: 'Departamento inválido',
      required: true
    },
    {
      field: 'hireDate',
      validate: (value: any) => value && isValidISODate(value),
      message: 'Fecha de contratación debe ser válida',
      required: true
    }
  ]),
  auditLog('ranch.staff.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staffData = req.body;
      const userId = req.user?.id;

      const newEmployee = await StaffController.createEmployee({
        ...staffData,
        createdBy: userId
      });

      res.status(201).json({
        success: true,
        data: newEmployee,
        message: 'Empleado registrado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/ranch/staff/:id
 * Actualiza información de empleado
 */
router.put('/staff/:id',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID del empleado debe ser un UUID válido',
      required: true
    },
    {
      field: 'firstName',
      validate: (value: any) => !value || isValidLength(value, 2, 50),
      message: 'El nombre debe tener entre 2 y 50 caracteres'
    },
    {
      field: 'lastName',
      validate: (value: any) => !value || isValidLength(value, 2, 50),
      message: 'El apellido debe tener entre 2 y 50 caracteres'
    },
    {
      field: 'email',
      validate: (value: any) => !value || isValidEmail(value),
      message: 'Email debe ser válido'
    },
    {
      field: 'phone',
      validate: (value: any) => !value || isValidPhone(value),
      message: 'Teléfono debe ser válido'
    },
    {
      field: 'position',
      validate: (value: any) => !value || isValidLength(value, 2, 100),
      message: 'Posición debe tener entre 2 y 100 caracteres'
    },
    {
      field: 'department',
      validate: (value: any) => !value || [
        'administration', 'livestock', 'veterinary', 'maintenance', 'security', 'production', 'nutrition'
      ].includes(value),
      message: 'Departamento inválido'
    },
    {
      field: 'status',
      validate: (value: any) => !value || ['active', 'on_leave', 'suspended', 'terminated'].includes(value),
      message: 'Estado del empleado inválido'
    },
    {
      field: 'salary',
      validate: (value: any) => !value || isValidNumber(value, 0),
      message: 'Salario debe ser un número positivo'
    }
  ]),
  auditLog('ranch.staff.update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user?.id;

      const updatedEmployee = await StaffController.updateEmployee(id, {
        ...updateData,
        updatedBy: userId
      });

      if (!updatedEmployee) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      res.json({
        success: true,
        data: updatedEmployee,
        message: 'Empleado actualizado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ranch/staff/:id/performance
 * Obtiene evaluación de rendimiento de empleado
 */
router.get('/staff/:id/performance',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'id',
      validate: isValidUUID,
      message: 'ID del empleado debe ser un UUID válido',
      required: true
    },
    {
      field: 'period',
      validate: (value: any) => !value || ['current_month', 'last_month', 'quarter', 'year', 'all_time'].includes(value),
      message: 'Período inválido'
    },
    {
      field: 'includeHistory',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeHistory debe ser verdadero o falso'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { period = 'current_month', includeHistory = false } = req.query;
      const userId = req.user?.id;

      const performance = await StaffController.getEmployeePerformance({
        employeeId: id,
        period: period as string,
        includeHistory: includeHistory === 'true',
        userId
      });

      res.json({
        success: true,
        data: performance,
        message: 'Evaluación de rendimiento obtenida exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE REPORTES DEL RANCHO
// ===================================================================

/**
 * GET /api/ranch/reports/compliance
 * Reporte de cumplimiento legal y certificaciones
 */
router.get('/reports/compliance',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'includeExpiring',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeExpiring debe ser verdadero o falso'
    },
    {
      field: 'expiryThreshold',
      validate: (value: any) => !value || isValidInteger(value, 1, 365),
      message: 'Umbral de vencimiento debe estar entre 1 y 365 días'
    },
    {
      field: 'format',
      validate: (value: any) => !value || ['json', 'pdf', 'excel'].includes(value),
      message: 'Formato inválido'
    }
  ]),
  auditLog('ranch.reports.compliance'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        includeExpiring = true, 
        expiryThreshold = 30, 
        format = 'json' 
      } = req.query;
      const userId = req.user?.id;

      const complianceReport = {
        compliance: {
          total: 0,
          compliant: 0,
          expiring: 0,
          expired: 0
        },
        details: []
      };

      if (format === 'json') {
        res.json({
          success: true,
          data: complianceReport,
          message: 'Reporte de cumplimiento generado exitosamente'
        });
      } else {
        // Para PDF y Excel, configurar headers apropiados
        const contentTypes = {
          pdf: 'application/pdf',
          excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };

        res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
        res.setHeader('Content-Disposition', `attachment; filename="compliance_report.${format}"`);
        res.send(Buffer.from('Mock report content'));
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ranch/reports/operational
 * Reporte operacional del rancho
 */
router.get('/reports/operational',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  validateFields([
    {
      field: 'startDate',
      validate: (value: any) => !value || isValidISODate(value),
      message: 'Fecha de inicio debe ser válida'
    },
    {
      field: 'endDate',
      validate: (value: any) => !value || isValidISODate(value),
      message: 'Fecha de fin debe ser válida'
    },
    {
      field: 'includeStaffMetrics',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeStaffMetrics debe ser verdadero o falso'
    },
    {
      field: 'includeFacilityStatus',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeFacilityStatus debe ser verdadero o falso'
    }
  ]),
  auditLog('ranch.reports.operational'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate,
        endDate,
        includeStaffMetrics = true,
        includeFacilityStatus = true
      } = req.query;
      const userId = req.user?.id;

      const operationalReport = {
        period: {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined
        },
        metrics: {
          staff: includeStaffMetrics === 'true' ? {} : null,
          facilities: includeFacilityStatus === 'true' ? {} : null
        }
      };

      res.json({
        success: true,
        data: operationalReport,
        message: 'Reporte operacional generado exitosamente'
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