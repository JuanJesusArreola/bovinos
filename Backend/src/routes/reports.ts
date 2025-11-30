import { Router, Request, Response, NextFunction } from 'express';
import { Op, WhereOptions } from 'sequelize';

// Importaciones de middleware
import { 
  authenticateToken, 
  authorizeRoles,
} from '../middleware/auth';
import { UserRole } from '../models/User';

// Importaciones de controladores
import ReportsController from '../controllers/reports';

// Interfaces para controladores que faltan
interface HealthReportsController {
  getHealthOverview(params: any): Promise<any>;
  getDiseaseAnalysis(params: any): Promise<any>;
  getMortalityReport(params: any): Promise<any>;
  getTreatmentAnalysis(params: any): Promise<any>;
}

interface ProductionReportsController {
  getProductionOverview(params: any): Promise<any>;
  getEfficiencyReport(params: any): Promise<any>;
}

interface InventoryReportsController {
  getInventoryReport(params: any): Promise<any>;
}

interface VaccinationReportsController {
  getCoverageReport(params: any): Promise<any>;
  getScheduleReport(params: any): Promise<any>;
  getEfficacyReport(params: any): Promise<any>;
}

interface FinancialReportsController {
  getVeterinaryCosts(params: any): Promise<any>;
  getROIAnalysis(params: any): Promise<any>;
}

interface GeographicReportsController {
  getHealthPatterns(params: any): Promise<any>;
  getRiskZones(params: any): Promise<any>;
}

// Controladores mock hasta que se implementen
const HealthReportsController: HealthReportsController = {
  async getHealthOverview(params) { return { overview: {}, details: [] }; },
  async getDiseaseAnalysis(params) { return { analysis: {}, trends: [] }; },
  async getMortalityReport(params) { return { mortality: {}, causes: [] }; },
  async getTreatmentAnalysis(params) { return { treatments: {}, effectiveness: [] }; }
};

const ProductionReportsController: ProductionReportsController = {
  async getProductionOverview(params) { return { production: {}, trends: [] }; },
  async getEfficiencyReport(params) { return { efficiency: {}, metrics: [] }; }
};

const InventoryReportsController: InventoryReportsController = {
  async getInventoryReport(params) { return { inventory: {}, alerts: [] }; }
};

const VaccinationReportsController: VaccinationReportsController = {
  async getCoverageReport(params) { return { coverage: {}, gaps: [] }; },
  async getScheduleReport(params) { return { schedule: {}, upcoming: [] }; },
  async getEfficacyReport(params) { return { efficacy: {}, results: [] }; }
};

const FinancialReportsController: FinancialReportsController = {
  async getVeterinaryCosts(params) { return { costs: {}, breakdown: [] }; },
  async getROIAnalysis(params) { return { roi: {}, projections: [] }; }
};

const GeographicReportsController: GeographicReportsController = {
  async getHealthPatterns(params) { return { patterns: {}, hotspots: [] }; },
  async getRiskZones(params) { return { zones: {}, recommendations: [] }; }
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

// Función para validar rango de fechas
const isValidDateRange = (startDate: string, endDate: string): boolean => {
  if (!isValidISODate(startDate) || !isValidISODate(endDate)) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start < end;
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

// Middleware de rate limiting simulado
const rateLimitByUserId = (limit: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Mock rate limiting - en producción usar Redis
    console.log(`[RATE_LIMIT] Usuario ${req.user?.id} - Límite: ${limit}/${windowMs}ms`);
    next();
  };
};

// ===================================================================
// RUTAS DEL DASHBOARD DE REPORTES
// ===================================================================

/**
 * GET /api/reports/dashboard
 * Dashboard principal con resumen de todos los reportes
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
      field: 'includeCharts',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeCharts debe ser verdadero o falso'
    },
    {
      field: 'includeAlerts',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeAlerts debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.dashboard.view'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        timeRange = '30d', 
        includeCharts = true, 
        includeAlerts = true 
      } = req.query;
      const userId = req.user?.id;

      const dashboard = {
        timeRange,
        charts: includeCharts === 'true' ? {} : null,
        alerts: includeAlerts === 'true' ? [] : null,
        summary: {
          totalReports: 0,
          pendingReports: 0,
          completedReports: 0
        }
      };

      res.json({
        success: true,
        data: dashboard,
        message: 'Dashboard de reportes obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/recent
 * Obtiene reportes recientes del usuario
 */
router.get('/recent',
  authenticateToken,
  validateFields([
    {
      field: 'limit',
      validate: (value: any) => !value || isValidInteger(value, 1, 50),
      message: 'Límite debe estar entre 1 y 50'
    },
    {
      field: 'type',
      validate: (value: any) => !value || ['health', 'production', 'inventory', 'vaccination', 'financial', 'geographic'].includes(value),
      message: 'Tipo de reporte inválido'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit = 10, type } = req.query;
      const userId = req.user?.id;

      const recentReports = [
        {
          id: '1',
          type: type || 'health',
          generatedAt: new Date(),
          status: 'completed'
        }
      ];

      res.json({
        success: true,
        data: recentReports,
        message: 'Reportes recientes obtenidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE REPORTES DE SALUD
// ===================================================================

/**
 * GET /api/reports/health/overview
 * Reporte general de salud del ganado
 */
router.get('/health/overview',
  authenticateToken,
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
      field: 'period',
      validate: (value: any) => !value || ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(value),
      message: 'Período de reporte inválido'
    },
    {
      field: 'includeDetails',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeDetails debe ser verdadero o falso'
    },
    {
      field: 'locationId',
      validate: (value: any) => !value || isValidUUID(value),
      message: 'ID de ubicación debe ser un UUID válido'
    },
    {
      field: 'veterinarianId',
      validate: (value: any) => !value || isValidUUID(value),
      message: 'ID de veterinario debe ser un UUID válido'
    }
  ]),
  auditLog('reports.health.overview'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, period = 'monthly',
        includeDetails = true, locationId, veterinarianId
      } = req.query;
      const userId = req.user?.id;

      const healthOverview = await HealthReportsController.getHealthOverview({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        period: period as string,
        includeDetails: includeDetails === 'true',
        locationId: locationId as string,
        veterinarianId: veterinarianId as string,
        userId
      });

      res.json({
        success: true,
        data: healthOverview,
        message: 'Reporte de salud general obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/health/disease-analysis
 * Análisis detallado de enfermedades
 */
router.get('/health/disease-analysis',
  authenticateToken,
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
      field: 'diseaseType',
      validate: (value: any) => !value || [
        'respiratory', 'digestive', 'reproductive', 'metabolic',
        'infectious', 'parasitic', 'nutritional', 'traumatic'
      ].includes(value),
      message: 'Tipo de enfermedad inválido'
    },
    {
      field: 'severity',
      validate: (value: any) => !value || ['mild', 'moderate', 'severe', 'critical'].includes(value),
      message: 'Severidad inválida'
    },
    {
      field: 'includeGeographic',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeGeographic debe ser verdadero o falso'
    },
    {
      field: 'includeTrends',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeTrends debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.health.disease_analysis'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, diseaseType, severity,
        includeGeographic = true, includeTrends = true
      } = req.query;
      const userId = req.user?.id;

      const diseaseAnalysis = await HealthReportsController.getDiseaseAnalysis({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        diseaseType: diseaseType as string,
        severity: severity as string,
        includeGeographic: includeGeographic === 'true',
        includeTrends: includeTrends === 'true',
        userId
      });

      res.json({
        success: true,
        data: diseaseAnalysis,
        message: 'Análisis de enfermedades obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/health/mortality
 * Reporte de mortalidad y análisis de causas
 */
router.get('/health/mortality',
  authenticateToken,
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
      field: 'groupBy',
      validate: (value: any) => !value || ['date', 'location', 'animal', 'disease', 'treatment', 'vaccine', 'veterinarian'].includes(value),
      message: 'Agrupación inválida'
    },
    {
      field: 'includeCauses',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeCauses debe ser verdadero o falso'
    },
    {
      field: 'includePreventable',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includePreventable debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.health.mortality'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, groupBy = 'date',
        includeCauses = true, includePreventable = true
      } = req.query;
      const userId = req.user?.id;

      const mortalityReport = await HealthReportsController.getMortalityReport({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        groupBy: groupBy as string,
        includeCauses: includeCauses === 'true',
        includePreventable: includePreventable === 'true',
        userId
      });

      res.json({
        success: true,
        data: mortalityReport,
        message: 'Reporte de mortalidad obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/health/treatment-analysis
 * Análisis de efectividad de tratamientos
 */
router.get('/health/treatment-analysis',
  authenticateToken,
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
      field: 'treatmentType',
      validate: (value: any) => !value || ['antibiotic', 'antiparasitic', 'antiinflammatory', 'vitamin', 'vaccine', 'hormone'].includes(value),
      message: 'Tipo de tratamiento inválido'
    },
    {
      field: 'medicationId',
      validate: (value: any) => !value || isValidUUID(value),
      message: 'ID de medicamento debe ser un UUID válido'
    },
    {
      field: 'includeSuccessRates',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeSuccessRates debe ser verdadero o falso'
    },
    {
      field: 'includeCosts',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeCosts debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.health.treatment_analysis'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, treatmentType, medicationId,
        includeSuccessRates = true, includeCosts = true
      } = req.query;
      const userId = req.user?.id;

      const treatmentAnalysis = await HealthReportsController.getTreatmentAnalysis({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        treatmentType: treatmentType as string,
        medicationId: medicationId as string,
        includeSuccessRates: includeSuccessRates === 'true',
        includeCosts: includeCosts === 'true',
        userId
      });

      res.json({
        success: true,
        data: treatmentAnalysis,
        message: 'Análisis de tratamientos obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE REPORTES DE VACUNACIÓN
// ===================================================================

/**
 * GET /api/reports/vaccinations/coverage
 * Reporte de cobertura de vacunación
 */
router.get('/vaccinations/coverage',
  authenticateToken,
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
      field: 'vaccineType',
      validate: (value: any) => !value || [
        'fiebre_aftosa', 'brucelosis', 'rabia', 'carbunco', 'clostridiosis',
        'ibl', 'dvb', 'pi3', 'brsv', 'leptospirosis', 'campylobacteriosis'
      ].includes(value),
      message: 'Tipo de vacuna inválido'
    },
    {
      field: 'ageGroup',
      validate: (value: any) => !value || ['calf', 'young', 'adult', 'senior'].includes(value),
      message: 'Grupo etario inválido'
    },
    {
      field: 'includeEffectiveness',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeEffectiveness debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.vaccination.coverage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, vaccineType, ageGroup,
        includeEffectiveness = true
      } = req.query;
      const userId = req.user?.id;

      const coverageReport = await VaccinationReportsController.getCoverageReport({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vaccineType: vaccineType as string,
        ageGroup: ageGroup as string,
        includeEffectiveness: includeEffectiveness === 'true',
        userId
      });

      res.json({
        success: true,
        data: coverageReport,
        message: 'Reporte de cobertura de vacunación obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/vaccinations/schedule
 * Calendario y programación de vacunaciones
 */
router.get('/vaccinations/schedule',
  authenticateToken,
  validateFields([
    {
      field: 'lookAhead',
      validate: (value: any) => !value || isValidInteger(value, 1, 365),
      message: 'Días de anticipación debe estar entre 1 y 365'
    },
    {
      field: 'includeOverdue',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeOverdue debe ser verdadero o falso'
    },
    {
      field: 'groupByVaccine',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'groupByVaccine debe ser verdadero o falso'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        lookAhead = 90,
        includeOverdue = true,
        groupByVaccine = false
      } = req.query;
      const userId = req.user?.id;

      const scheduleReport = await VaccinationReportsController.getScheduleReport({
        lookAhead: parseInt(lookAhead as string),
        includeOverdue: includeOverdue === 'true',
        groupByVaccine: groupByVaccine === 'true',
        userId
      });

      res.json({
        success: true,
        data: scheduleReport,
        message: 'Programación de vacunaciones obtenida exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/vaccinations/efficacy
 * Análisis de eficacia de vacunas
 */
router.get('/vaccinations/efficacy',
  authenticateToken,
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
      field: 'vaccineId',
      validate: (value: any) => !value || isValidUUID(value),
      message: 'ID de vacuna debe ser un UUID válido'
    },
    {
      field: 'batchNumber',
      validate: (value: any) => !value || isValidLength(value, 1, 50),
      message: 'Número de lote debe tener entre 1 y 50 caracteres'
    },
    {
      field: 'includeAdverseReactions',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeAdverseReactions debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.vaccination.efficacy'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, vaccineId, batchNumber,
        includeAdverseReactions = true
      } = req.query;
      const userId = req.user?.id;

      const efficacyReport = await VaccinationReportsController.getEfficacyReport({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        vaccineId: vaccineId as string,
        batchNumber: batchNumber as string,
        includeAdverseReactions: includeAdverseReactions === 'true',
        userId
      });

      res.json({
        success: true,
        data: efficacyReport,
        message: 'Análisis de eficacia de vacunas obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE REPORTES DE PRODUCCIÓN
// ===================================================================

/**
 * GET /api/reports/production/overview
 * Reporte general de producción
 */
router.get('/production/overview',
  authenticateToken,
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
      field: 'period',
      validate: (value: any) => !value || ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(value),
      message: 'Período inválido'
    },
    {
      field: 'productionType',
      validate: (value: any) => !value || ['milk', 'meat', 'breeding', 'all'].includes(value),
      message: 'Tipo de producción inválido'
    },
    {
      field: 'includeComparisons',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeComparisons debe ser verdadero o falso'
    },
    {
      field: 'includeProjections',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeProjections debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.production.overview'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, period = 'monthly',
        productionType = 'all',
        includeComparisons = true,
        includeProjections = true
      } = req.query;
      const userId = req.user?.id;

      const productionOverview = await ProductionReportsController.getProductionOverview({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        period: period as string,
        productionType: productionType as string,
        includeComparisons: includeComparisons === 'true',
        includeProjections: includeProjections === 'true',
        userId
      });

      res.json({
        success: true,
        data: productionOverview,
        message: 'Reporte de producción general obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/production/efficiency
 * Análisis de eficiencia productiva
 */
router.get('/production/efficiency',
  authenticateToken,
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
      field: 'metric',
      validate: (value: any) => !value || ['milk_yield', 'weight_gain', 'feed_conversion', 'reproduction_rate', 'cost_efficiency'].includes(value),
      message: 'Métrica de eficiencia inválida'
    },
    {
      field: 'benchmarkComparison',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'benchmarkComparison debe ser verdadero o falso'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, metric = 'milk_yield',
        benchmarkComparison = true
      } = req.query;
      const userId = req.user?.id;

      const efficiencyReport = await ProductionReportsController.getEfficiencyReport({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        metric: metric as string,
        benchmarkComparison: benchmarkComparison === 'true',
        userId
      });

      res.json({
        success: true,
        data: efficiencyReport,
        message: 'Análisis de eficiencia productiva obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE REPORTES FINANCIEROS
// ===================================================================

/**
 * GET /api/reports/financial/veterinary-costs
 * Análisis de costos veterinarios
 */
router.get('/financial/veterinary-costs',
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
      field: 'costCategory',
      validate: (value: any) => !value || ['treatments', 'vaccinations', 'consultations', 'surgeries', 'preventive', 'emergency'].includes(value),
      message: 'Categoría de costo inválida'
    },
    {
      field: 'includeROI',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeROI debe ser verdadero o falso'
    },
    {
      field: 'groupBy',
      validate: (value: any) => !value || ['month', 'quarter', 'veterinarian', 'treatment_type', 'animal'].includes(value),
      message: 'Agrupación inválida'
    }
  ]),
  auditLog('reports.financial.veterinary_costs'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, costCategory, includeROI = true, groupBy = 'month'
      } = req.query;
      const userId = req.user?.id;

      const veterinaryCosts = await FinancialReportsController.getVeterinaryCosts({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        costCategory: costCategory as string,
        includeROI: includeROI === 'true',
        groupBy: groupBy as string,
        userId
      });

      res.json({
        success: true,
        data: veterinaryCosts,
        message: 'Análisis de costos veterinarios obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/financial/roi-analysis
 * Análisis de retorno de inversión en salud animal
 */
router.get('/financial/roi-analysis',
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
      field: 'investmentType',
      validate: (value: any) => !value || ['prevention', 'treatment', 'vaccination', 'nutrition', 'equipment'].includes(value),
      message: 'Tipo de inversión inválido'
    },
    {
      field: 'includeProjections',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeProjections debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.financial.roi_analysis'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, investmentType, includeProjections = true
      } = req.query;
      const userId = req.user?.id;

      const roiAnalysis = await FinancialReportsController.getROIAnalysis({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        investmentType: investmentType as string,
        includeProjections: includeProjections === 'true',
        userId
      });

      res.json({
        success: true,
        data: roiAnalysis,
        message: 'Análisis ROI obtenido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE REPORTES GEOGRÁFICOS
// ===================================================================

/**
 * GET /api/reports/geographic/health-patterns
 * Patrones geográficos de salud
 */
router.get('/geographic/health-patterns',
  authenticateToken,
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
      field: 'analysisType',
      validate: (value: any) => !value || ['disease_distribution', 'treatment_locations', 'vaccination_coverage', 'outbreak_analysis'].includes(value),
      message: 'Tipo de análisis inválido'
    },
    {
      field: 'bounds',
      validate: (value: any) => {
        if (value) {
          const bounds = value.split(',').map(Number);
          return bounds.length === 4 && !bounds.some(isNaN);
        }
        return true;
      },
      message: 'Los límites deben ser cuatro números separados por comas'
    },
    {
      field: 'includeHeatmap',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeHeatmap debe ser verdadero o falso'
    }
  ]),
  auditLog('reports.geographic.health_patterns'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate, endDate, analysisType = 'disease_distribution',
        bounds, includeHeatmap = true
      } = req.query;
      const userId = req.user?.id;

      let geoBounds;
      if (bounds) {
        const [swLat, swLng, neLat, neLng] = (bounds as string).split(',').map(Number);
        geoBounds = { swLat, swLng, neLat, neLng };
      }

      const healthPatterns = await GeographicReportsController.getHealthPatterns({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        analysisType: analysisType as string,
        bounds: geoBounds,
        includeHeatmap: includeHeatmap === 'true',
        userId
      });

      res.json({
        success: true,
        data: healthPatterns,
        message: 'Patrones geográficos de salud obtenidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/geographic/risk-zones
 * Identificación de zonas de riesgo
 */
router.get('/geographic/risk-zones',
  authenticateToken,
  validateFields([
    {
      field: 'riskType',
      validate: (value: any) => !value || ['disease_outbreak', 'high_mortality', 'low_vaccination', 'treatment_resistance'].includes(value),
      message: 'Tipo de riesgo inválido'
    },
    {
      field: 'severity',
      validate: (value: any) => !value || ['low', 'medium', 'high', 'critical'].includes(value),
      message: 'Severidad inválida'
    },
    {
      field: 'includeRecommendations',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeRecommendations debe ser verdadero o falso'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        riskType = 'disease_outbreak', severity,
        includeRecommendations = true
      } = req.query;
      const userId = req.user?.id;

      const riskZones = await GeographicReportsController.getRiskZones({
        riskType: riskType as string,
        severity: severity as string,
        includeRecommendations: includeRecommendations === 'true',
        userId
      });

      res.json({
        success: true,
        data: riskZones,
        message: 'Zonas de riesgo identificadas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE EXPORTACIÓN DE REPORTES
// ===================================================================

/**
 * GET /api/reports/export/:reportType
 * Exporta reportes en diferentes formatos
 */
router.get('/export/:reportType',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.VETERINARIAN),
  validateFields([
    {
      field: 'reportType',
      validate: (value: any) => [
        'health_overview', 'disease_analysis', 'mortality', 'treatment_analysis',
        'vaccination_coverage', 'vaccination_schedule', 'vaccination_efficacy',
        'production_overview', 'production_efficiency',
        'financial_costs', 'financial_roi',
        'geographic_patterns', 'geographic_risks'
      ].includes(value),
      message: 'Tipo de reporte inválido',
      required: true
    },
    {
      field: 'format',
      validate: (value: any) => !value || ['json', 'pdf', 'excel', 'csv'].includes(value),
      message: 'Formato de exportación inválido'
    },
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
      field: 'includeCharts',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeCharts debe ser verdadero o falso'
    },
    {
      field: 'includeDetails',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeDetails debe ser verdadero o falso'
    },
    {
      field: 'reportTitle',
      validate: (value: any) => !value || isValidLength(value, 1, 200),
      message: 'Título del reporte debe tener entre 1 y 200 caracteres'
    }
  ]),
  auditLog('reports.export'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportType } = req.params;
      const {
        format = 'pdf',
        startDate, endDate,
        includeCharts = true,
        includeDetails = true,
        reportTitle
      } = req.query;
      const userId = req.user?.id;

      // Mock export data
      const exportedReport = {
        reportType,
        format,
        title: reportTitle || `Reporte ${reportType}`,
        generatedAt: new Date(),
        generatedBy: userId,
        data: 'Mock report content'
      };

      if (format === 'json') {
        res.json({
          success: true,
          data: exportedReport,
          message: 'Reporte exportado exitosamente'
        });
      } else {
        // Para otros formatos, configurar headers de descarga
        const contentTypes = {
          pdf: 'application/pdf',
          excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          csv: 'text/csv'
        };

        const fileExtensions = {
          pdf: 'pdf',
          excel: 'xlsx',
          csv: 'csv'
        };

        res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
        res.setHeader('Content-Disposition', 
          `attachment; filename="${reportType}_report.${fileExtensions[format as keyof typeof fileExtensions]}"`);
        res.send(Buffer.from('Mock report content'));
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/reports/generate-custom
 * Genera reporte personalizado con parámetros específicos
 */
router.post('/generate-custom',
  authenticateToken,
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.VETERINARIAN),
  rateLimitByUserId(10, 60), // 10 reportes personalizados por hora
  validateFields([
    {
      field: 'reportName',
      validate: (value: any) => value && isValidLength(value, 2, 100),
      message: 'Nombre del reporte debe tener entre 2 y 100 caracteres',
      required: true
    },
    {
      field: 'reportType',
      validate: (value: any) => value && ['health', 'production', 'financial', 'vaccination', 'geographic', 'comprehensive'].includes(value),
      message: 'Tipo de reporte inválido',
      required: true
    },
    {
      field: 'exportFormat',
      validate: (value: any) => !value || ['json', 'pdf', 'excel', 'csv'].includes(value),
      message: 'Formato de exportación inválido'
    },
    {
      field: 'includeCharts',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeCharts debe ser verdadero o falso'
    },
    {
      field: 'scheduleRecurrence',
      validate: (value: any) => !value || ['none', 'daily', 'weekly', 'monthly', 'quarterly'].includes(value),
      message: 'Recurrencia de programación inválida'
    }
  ]),
  auditLog('reports.generate_custom'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customReportData = req.body;
      const userId = req.user?.id;

      const customReport = {
        id: Date.now().toString(),
        ...customReportData,
        requestedBy: userId,
        status: 'generated',
        generatedAt: new Date()
      };

      res.status(201).json({
        success: true,
        data: customReport,
        message: 'Reporte personalizado generado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/reports/templates
 * Obtiene plantillas de reportes disponibles
 */
router.get('/templates',
  authenticateToken,
  validateFields([
    {
      field: 'category',
      validate: (value: any) => !value || ['health', 'production', 'financial', 'vaccination', 'geographic'].includes(value),
      message: 'Categoría inválida'
    },
    {
      field: 'includeCustom',
      validate: (value: any) => !value || value === 'true' || value === 'false',
      message: 'includeCustom debe ser verdadero o falso'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, includeCustom = false } = req.query;
      const userId = req.user?.id;

      const templates = [
        {
          id: '1',
          name: 'Reporte de Salud General',
          category: 'health',
          type: 'standard',
          description: 'Vista general del estado de salud del ganado'
        },
        {
          id: '2',
          name: 'Análisis de Producción',
          category: 'production',
          type: 'standard',
          description: 'Métricas de producción y tendencias'
        }
      ];

      const filteredTemplates = category 
        ? templates.filter(t => t.category === category)
        : templates;

      res.json({
        success: true,
        data: filteredTemplates,
        message: 'Plantillas de reportes obtenidas exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

// ===================================================================
// RUTAS DE GESTIÓN DE REPORTES PROGRAMADOS
// ===================================================================

/**
 * GET /api/reports/scheduled
 * Obtiene reportes programados del usuario
 */
router.get('/scheduled',
  authenticateToken,
  validateFields([
    {
      field: 'status',
      validate: (value: any) => !value || ['active', 'paused', 'completed', 'failed'].includes(value),
      message: 'Estado inválido'
    }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      const userId = req.user?.id;

      const scheduledReports = [
        {
          id: '1',
          reportType: 'health_overview',
          frequency: 'monthly',
          status: status || 'active',
          nextExecutionDate: new Date(),
          createdBy: userId
        }
      ];

      res.json({
        success: true,
        data: scheduledReports,
        message: 'Reportes programados obtenidos exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/reports/schedule
 * Programa un reporte para ejecución automática
 */
router.post('/schedule',
  authenticateToken,
  validateFields([
    {
      field: 'reportType',
      validate: (value: any) => value && ['health_overview', 'vaccination_coverage', 'production_overview', 'financial_costs'].includes(value),
      message: 'Tipo de reporte inválido',
      required: true
    },
    {
      field: 'frequency',
      validate: (value: any) => value && ['daily', 'weekly', 'monthly', 'quarterly'].includes(value),
      message: 'Frecuencia inválida',
      required: true
    },
    {
      field: 'nextExecutionDate',
      validate: (value: any) => value && isValidISODate(value),
      message: 'Fecha de próxima ejecución debe ser válida',
      required: true
    },
    {
      field: 'deliveryMethod',
      validate: (value: any) => value && ['email', 'internal', 'both'].includes(value),
      message: 'Método de entrega inválido',
      required: true
    },
    {
      field: 'format',
      validate: (value: any) => !value || ['pdf', 'excel', 'csv'].includes(value),
      message: 'Formato inválido'
    }
  ]),
  auditLog('reports.schedule'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scheduleData = req.body;
      const userId = req.user?.id;

      const scheduledReport = {
        id: Date.now().toString(),
        ...scheduleData,
        createdBy: userId,
        status: 'active',
        createdAt: new Date()
      };

      res.status(201).json({
        success: true,
        data: scheduledReport,
        message: 'Reporte programado exitosamente'
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