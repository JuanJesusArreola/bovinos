import { Router, Request, Response } from 'express';
import { 
  authenticateToken, 
  authorizeRoles, 
  checkPermission, 
  requireActiveSubscription
} from '../middleware/auth';
import { UserRole } from '../models/User';
import { validate, sanitizeInput, validateId } from '../middleware/validation';
import { createRateLimit, EndpointType } from '../middleware/rate-limit';
import { 
  requireMinimumRole, 
  requireExactRoles, 
  requireModulePermission,
  requireVeterinaryAccess,
  requireFinancialAccess,
  requireUserManagementAccess 
} from '../middleware/role';

// Crear instancia del router
const router = Router();

// Simulación del controlador de dashboard (reemplazar con implementación real)
class DashboardController {
  async getMainDashboard(req: Request, res: Response) {
    try {
      // TODO: Implementar lógica del dashboard principal
      res.json({
        success: true,
        data: {
          message: 'Dashboard principal cargado',
          period: req.query.period || '7d',
          timezone: req.query.timezone || 'America/Mexico_City',
          refresh: req.query.refresh === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar dashboard principal'
      });
    }
  }

  async getExecutiveSummary(req: Request, res: Response) {
    try {
      // TODO: Implementar resumen ejecutivo
      res.json({
        success: true,
        data: {
          message: 'Resumen ejecutivo',
          includeComparison: req.query.includeComparison === 'true',
          previousPeriod: req.query.previousPeriod === 'true',
          benchmarks: req.query.benchmarks
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar resumen ejecutivo'
      });
    }
  }

  async getKPIs(req: Request, res: Response) {
    try {
      // TODO: Implementar KPIs
      res.json({
        success: true,
        data: {
          message: 'KPIs principales',
          metrics: req.query.metrics || 'health,production,financial',
          format: req.query.format || 'detailed'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar KPIs'
      });
    }
  }

  async getHealthMetrics(req: Request, res: Response) {
    try {
      // TODO: Implementar métricas de salud
      res.json({
        success: true,
        data: {
          message: 'Métricas de salud del ganado',
          includeVaccinations: req.query.includeVaccinations === 'true',
          includeTreatments: req.query.includeTreatments === 'true',
          groupBy: req.query.groupBy
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar métricas de salud'
      });
    }
  }

  async getVaccinationStatus(req: Request, res: Response) {
    try {
      // TODO: Implementar estado de vacunación
      res.json({
        success: true,
        data: {
          message: 'Estado de vacunación',
          includeOverdue: req.query.includeOverdue === 'true',
          upcomingDays: req.query.upcomingDays || '30',
          groupBy: req.query.groupBy
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar estado de vacunación'
      });
    }
  }

  async getIllnessTrends(req: Request, res: Response) {
    try {
      // TODO: Implementar tendencias de enfermedades
      res.json({
        success: true,
        data: {
          message: 'Tendencias de enfermedades',
          period: req.query.period || '3m',
          includeSeasonality: req.query.includeSeasonality === 'true',
          riskAnalysis: req.query.riskAnalysis === 'true',
          groupBy: req.query.groupBy
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar tendencias de enfermedades'
      });
    }
  }

  async getMortalityRates(req: Request, res: Response) {
    try {
      // TODO: Implementar tasas de mortalidad
      res.json({
        success: true,
        data: {
          message: 'Tasas de mortalidad',
          period: req.query.period || '1y',
          includeReasons: req.query.includeReasons === 'true',
          ageGroups: req.query.ageGroups === 'true',
          seasonalAnalysis: req.query.seasonalAnalysis === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar tasas de mortalidad'
      });
    }
  }

  async getProductionMetrics(req: Request, res: Response) {
    try {
      // TODO: Implementar métricas de producción
      res.json({
        success: true,
        data: {
          message: 'Métricas de producción',
          productionType: req.query.productionType,
          includeQuality: req.query.includeQuality === 'true',
          efficiency: req.query.efficiency === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar métricas de producción'
      });
    }
  }

  async getFeedEfficiency(req: Request, res: Response) {
    try {
      // TODO: Implementar eficiencia alimentaria
      res.json({
        success: true,
        data: {
          message: 'Eficiencia alimentaria',
          includeNutrition: req.query.includeNutrition === 'true',
          costAnalysis: req.query.costAnalysis === 'true',
          groupBy: req.query.groupBy
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar eficiencia alimentaria'
      });
    }
  }

  async getGrowthRates(req: Request, res: Response) {
    try {
      // TODO: Implementar tasas de crecimiento
      res.json({
        success: true,
        data: {
          message: 'Tasas de crecimiento',
          ageGroups: req.query.ageGroups,
          includeWeight: req.query.includeWeight === 'true',
          includeHeight: req.query.includeHeight === 'true',
          benchmarks: req.query.benchmarks === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar tasas de crecimiento'
      });
    }
  }

  async getReproductivePerformance(req: Request, res: Response) {
    try {
      // TODO: Implementar rendimiento reproductivo
      res.json({
        success: true,
        data: {
          message: 'Rendimiento reproductivo',
          includeConceptionRates: req.query.includeConceptionRates === 'true',
          calvingInterval: req.query.calvingInterval === 'true',
          breedingEfficiency: req.query.breedingEfficiency === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar rendimiento reproductivo'
      });
    }
  }

  async getFinancialOverview(req: Request, res: Response) {
    try {
      // TODO: Implementar resumen financiero
      res.json({
        success: true,
        data: {
          message: 'Resumen financiero',
          includeCosts: req.query.includeCosts === 'true',
          includeRevenue: req.query.includeRevenue === 'true',
          profitability: req.query.profitability === 'true',
          period: req.query.period || '1y'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar resumen financiero'
      });
    }
  }

  async getCostAnalysis(req: Request, res: Response) {
    try {
      // TODO: Implementar análisis de costos
      res.json({
        success: true,
        data: {
          message: 'Análisis de costos',
          costCategories: req.query.costCategories,
          breakdown: req.query.breakdown,
          trends: req.query.trends === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar análisis de costos'
      });
    }
  }

  async getRevenueStreams(req: Request, res: Response) {
    try {
      // TODO: Implementar análisis de ingresos
      res.json({
        success: true,
        data: {
          message: 'Análisis de ingresos',
          sources: req.query.sources,
          seasonality: req.query.seasonality === 'true',
          projections: req.query.projections === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar análisis de ingresos'
      });
    }
  }

  async getROIAnalysis(req: Request, res: Response) {
    try {
      // TODO: Implementar análisis ROI
      res.json({
        success: true,
        data: {
          message: 'Análisis ROI',
          investments: req.query.investments,
          timeframe: req.query.timeframe,
          includeProjections: req.query.includeProjections === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar análisis ROI'
      });
    }
  }

  async getActiveAlerts(req: Request, res: Response) {
    try {
      // TODO: Implementar alertas activas
      res.json({
        success: true,
        data: {
          message: 'Alertas activas',
          severity: req.query.severity,
          category: req.query.category,
          limit: req.query.limit || '50'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar alertas activas'
      });
    }
  }

  async acknowledgeAlerts(req: Request, res: Response) {
    try {
      // TODO: Implementar reconocimiento de alertas
      res.json({
        success: true,
        data: {
          message: 'Alertas reconocidas',
          alertIds: req.body.alertIds,
          acknowledgement: req.body.acknowledgement,
          userId: req.body.userId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al reconocer alertas'
      });
    }
  }

  async getUrgentActions(req: Request, res: Response) {
    try {
      // TODO: Implementar acciones urgentes
      res.json({
        success: true,
        data: {
          message: 'Acciones urgentes',
          priority: req.query.priority,
          assignedTo: req.query.assignedTo,
          category: req.query.category
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar acciones urgentes'
      });
    }
  }

  async getGeographicDistribution(req: Request, res: Response) {
    try {
      // TODO: Implementar distribución geográfica
      res.json({
        success: true,
        data: {
          message: 'Distribución geográfica',
          includeHealthEvents: req.query.includeHealthEvents === 'true',
          includeVaccinations: req.query.includeVaccinations === 'true',
          clusterAnalysis: req.query.clusterAnalysis === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar distribución geográfica'
      });
    }
  }

  async getHeatmaps(req: Request, res: Response) {
    try {
      // TODO: Implementar mapas de calor
      res.json({
        success: true,
        data: {
          message: 'Mapas de calor',
          metric: req.query.metric,
          resolution: req.query.resolution
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar mapas de calor'
      });
    }
  }

  async getMovementPatterns(req: Request, res: Response) {
    try {
      // TODO: Implementar patrones de movimiento
      res.json({
        success: true,
        data: {
          message: 'Patrones de movimiento',
          timeframe: req.query.timeframe,
          includeAnomalies: req.query.includeAnomalies === 'true',
          predictiveAnalysis: req.query.predictiveAnalysis === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar patrones de movimiento'
      });
    }
  }

  async getUserWidgets(req: Request, res: Response) {
    try {
      // TODO: Implementar widgets del usuario
      res.json({
        success: true,
        data: {
          message: 'Widgets del usuario',
          layout: req.query.layout,
          includeData: req.query.includeData === 'true',
          activeOnly: req.query.activeOnly === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar widgets del usuario'
      });
    }
  }

  async createWidget(req: Request, res: Response) {
    try {
      // TODO: Implementar creación de widget
      res.json({
        success: true,
        data: {
          message: 'Widget creado',
          type: req.body.type,
          config: req.body.config,
          position: req.body.position,
          title: req.body.title,
          dataSource: req.body.dataSource
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear widget'
      });
    }
  }

  async updateWidget(req: Request, res: Response) {
    try {
      // TODO: Implementar actualización de widget
      res.json({
        success: true,
        data: {
          message: 'Widget actualizado',
          widgetId: req.params.widgetId,
          updates: req.body
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar widget'
      });
    }
  }

  async deleteWidget(req: Request, res: Response) {
    try {
      // TODO: Implementar eliminación de widget
      res.json({
        success: true,
        data: {
          message: 'Widget eliminado',
          widgetId: req.params.widgetId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al eliminar widget'
      });
    }
  }

  async updateDashboardLayout(req: Request, res: Response) {
    try {
      // TODO: Implementar actualización de layout
      res.json({
        success: true,
        data: {
          message: 'Layout del dashboard actualizado',
          widgets: req.body.widgets,
          layout: req.body.layout,
          settings: req.body.settings
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar layout del dashboard'
      });
    }
  }

  async getComparisons(req: Request, res: Response) {
    try {
      // TODO: Implementar comparaciones
      res.json({
        success: true,
        data: {
          message: 'Comparaciones',
          compareWith: req.query.compareWith,
          metrics: req.query.metrics,
          period: req.query.period
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar comparaciones'
      });
    }
  }

  async getBenchmarks(req: Request, res: Response) {
    try {
      // TODO: Implementar benchmarks
      res.json({
        success: true,
        data: {
          message: 'Benchmarks de la industria',
          category: req.query.category,
          region: req.query.region,
          ranchSize: req.query.ranchSize
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar benchmarks'
      });
    }
  }

  async getPerformanceScores(req: Request, res: Response) {
    try {
      // TODO: Implementar puntuaciones de rendimiento
      res.json({
        success: true,
        data: {
          message: 'Puntuaciones de rendimiento',
          categories: req.query.categories,
          includeRecommendations: req.query.includeRecommendations === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar puntuaciones de rendimiento'
      });
    }
  }

  async getRealtimeData(req: Request, res: Response) {
    try {
      // TODO: Implementar datos en tiempo real
      res.json({
        success: true,
        data: {
          message: 'Datos en tiempo real',
          metrics: req.query.metrics,
          format: req.query.format
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar datos en tiempo real'
      });
    }
  }

  async getLiveMetrics(req: Request, res: Response) {
    try {
      // TODO: Implementar métricas en vivo
      res.json({
        success: true,
        data: {
          message: 'Métricas en vivo',
          metrics: req.query.metrics,
          updateInterval: req.query.updateInterval
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar métricas en vivo'
      });
    }
  }

  async exportDashboard(req: Request, res: Response) {
    try {
      // TODO: Implementar exportación de dashboard
      res.json({
        success: true,
        data: {
          message: 'Dashboard exportado',
          format: req.body.format,
          sections: req.body.sections,
          includeCharts: req.body.includeCharts,
          timeRange: req.body.timeRange
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al exportar dashboard'
      });
    }
  }

  async downloadDashboardExport(req: Request, res: Response) {
    try {
      // TODO: Implementar descarga de exportación
      res.json({
        success: true,
        data: {
          message: 'Descarga de exportación',
          exportId: req.params.exportId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al descargar exportación'
      });
    }
  }

  async createScheduledReport(req: Request, res: Response) {
    try {
      // TODO: Implementar creación de reporte programado
      res.json({
        success: true,
        data: {
          message: 'Reporte programado creado',
          frequency: req.body.frequency,
          recipients: req.body.recipients,
          sections: req.body.sections,
          format: req.body.format,
          schedule: req.body.schedule
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear reporte programado'
      });
    }
  }

  async getDashboardSettings(req: Request, res: Response) {
    try {
      // TODO: Implementar obtención de configuración
      res.json({
        success: true,
        data: {
          message: 'Configuración del dashboard',
          userId: req.userId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar configuración del dashboard'
      });
    }
  }

  async updateDashboardSettings(req: Request, res: Response) {
    try {
      // TODO: Implementar actualización de configuración
      res.json({
        success: true,
        data: {
          message: 'Configuración actualizada',
          theme: req.body.theme,
          layout: req.body.layout,
          defaultPeriod: req.body.defaultPeriod,
          autoRefresh: req.body.autoRefresh,
          notifications: req.body.notifications
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar configuración'
      });
    }
  }

  async resetDashboard(req: Request, res: Response) {
    try {
      // TODO: Implementar reset del dashboard
      res.json({
        success: true,
        data: {
          message: 'Dashboard restablecido',
          confirmReset: req.body.confirmReset,
          preserveWidgets: req.body.preserveWidgets
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al restablecer dashboard'
      });
    }
  }

  async createCustomMetric(req: Request, res: Response) {
    try {
      // TODO: Implementar creación de métrica personalizada
      res.json({
        success: true,
        data: {
          message: 'Métrica personalizada creada',
          name: req.body.name,
          formula: req.body.formula,
          dataSource: req.body.dataSource,
          visualization: req.body.visualization,
          schedule: req.body.schedule
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear métrica personalizada'
      });
    }
  }

  async getPredictiveAnalytics(req: Request, res: Response) {
    try {
      // TODO: Implementar análisis predictivo
      res.json({
        success: true,
        data: {
          message: 'Análisis predictivo',
          models: req.query.models,
          horizon: req.query.horizon,
          confidence: req.query.confidence
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar análisis predictivo'
      });
    }
  }
}

// Crear instancia del controlador
const dashboardController = new DashboardController();

// ============================================================================
// MIDDLEWARE GLOBAL PARA TODAS LAS RUTAS DEL DASHBOARD
// ============================================================================

// Todas las rutas del dashboard requieren autenticación
router.use(authenticateToken);

// Sanitización de entrada para todas las rutas
router.use(sanitizeInput);

// ============================================================================
// DASHBOARD PRINCIPAL Y RESUMEN EJECUTIVO
// ============================================================================

/**
 * @route   GET /dashboard
 * @desc    Obtener vista principal del dashboard con KPIs generales
 * @access  Private
 * @query   ?period=7d|30d|90d|1y&timezone=America/Mexico_City&refresh=true
 */
router.get(
  '/',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getMainDashboard
);

/**
 * @route   GET /dashboard/summary
 * @desc    Resumen ejecutivo con métricas clave del rancho
 * @access  Private
 * @query   ?includeComparison=true&previousPeriod=true&benchmarks=industry
 */
router.get(
  '/summary',
  createRateLimit(EndpointType.REPORTS),
  dashboardController.getExecutiveSummary
);

/**
 * @route   GET /dashboard/kpis
 * @desc    Indicadores clave de rendimiento (KPIs) principales
 * @access  Private
 * @query   ?metrics=health,production,financial&format=detailed|compact
 */
router.get(
  '/kpis',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getKPIs
);

// ============================================================================
// MÉTRICAS DE SALUD Y BIENESTAR ANIMAL
// ============================================================================

/**
 * @route   GET /dashboard/health-metrics
 * @desc    Métricas específicas de salud del ganado
 * @access  Private
 * @query   ?includeVaccinations=true&includeTreatments=true&groupBy=type|breed|age
 */
router.get(
  '/health-metrics',
  createRateLimit(EndpointType.HEALTH),
  dashboardController.getHealthMetrics
);

/**
 * @route   GET /dashboard/vaccination-status
 * @desc    Estado de vacunación y programas de inmunización
 * @access  Private
 * @query   ?includeOverdue=true&upcomingDays=30&groupBy=vaccine_type
 */
router.get(
  '/vaccination-status',
  createRateLimit(EndpointType.VACCINATION),
  dashboardController.getVaccinationStatus
);

/**
 * @route   GET /dashboard/illness-trends
 * @desc    Tendencias de enfermedades y análisis epidemiológico
 * @access  Private
 * @query   ?period=3m&includeSeasonality=true&riskAnalysis=true&groupBy=disease_type
 */
router.get(
  '/illness-trends',
  createRateLimit(EndpointType.HEALTH),
  dashboardController.getIllnessTrends
);

/**
 * @route   GET /dashboard/mortality-rates
 * @desc    Tasas de mortalidad y análisis de causas
 * @access  Private (Roles: OWNER, ADMIN, VETERINARIAN)
 * @query   ?period=1y&includeReasons=true&ageGroups=true&seasonalAnalysis=true
 */
router.get(
  '/mortality-rates',
  requireVeterinaryAccess,
  createRateLimit(EndpointType.HEALTH),
  dashboardController.getMortalityRates
);

// ============================================================================
// MÉTRICAS DE PRODUCCIÓN Y RENDIMIENTO
// ============================================================================

/**
 * @route   GET /dashboard/production-metrics
 * @desc    Métricas de producción lechera, cárnica y reproductiva
 * @access  Private
 * @query   ?productionType=milk|meat|breeding&includeQuality=true&efficiency=true
 */
router.get(
  '/production-metrics',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getProductionMetrics
);

/**
 * @route   GET /dashboard/feed-efficiency
 * @desc    Eficiencia alimentaria y conversión de alimentos
 * @access  Private
 * @query   ?includeNutrition=true&costAnalysis=true&groupBy=feed_type|age_group
 */
router.get(
  '/feed-efficiency',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getFeedEfficiency
);

/**
 * @route   GET /dashboard/growth-rates
 * @desc    Tasas de crecimiento y desarrollo del ganado
 * @access  Private
 * @query   ?ageGroups=calf,growing,adult&includeWeight=true&includeHeight=true&benchmarks=true
 */
router.get(
  '/growth-rates',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getGrowthRates
);

/**
 * @route   GET /dashboard/reproductive-performance
 * @desc    Rendimiento reproductivo y indicadores de fertilidad
 * @access  Private (Roles: OWNER, ADMIN, VETERINARIAN)
 * @query   ?includeConceptionRates=true&calvingInterval=true&breedingEfficiency=true
 */
router.get(
  '/reproductive-performance',
  requireVeterinaryAccess,
  createRateLimit(EndpointType.HEALTH),
  dashboardController.getReproductivePerformance
);

// ============================================================================
// MÉTRICAS FINANCIERAS Y ECONÓMICAS
// ============================================================================

/**
 * @route   GET /dashboard/financial-overview
 * @desc    Resumen financiero y análisis económico
 * @access  Private (Roles: OWNER, ADMIN)
 * @query   ?includeCosts=true&includeRevenue=true&profitability=true&period=1y
 */
router.get(
  '/financial-overview',
  requireFinancialAccess,
  createRateLimit(EndpointType.REPORTS),
  dashboardController.getFinancialOverview
);

/**
 * @route   GET /dashboard/cost-analysis
 * @desc    Análisis detallado de costos operativos
 * @access  Private (Roles: OWNER, ADMIN)
 * @query   ?costCategories=feed,medical,labor,facilities&breakdown=detailed&trends=true
 */
router.get(
  '/cost-analysis',
  requireFinancialAccess,
  createRateLimit(EndpointType.REPORTS),
  dashboardController.getCostAnalysis
);

/**
 * @route   GET /dashboard/revenue-streams
 * @desc    Análisis de fuentes de ingresos y rentabilidad
 * @access  Private (Roles: OWNER, ADMIN)
 * @query   ?sources=milk,meat,breeding,other&seasonality=true&projections=true
 */
router.get(
  '/revenue-streams',
  requireFinancialAccess,
  createRateLimit(EndpointType.REPORTS),
  dashboardController.getRevenueStreams
);

/**
 * @route   GET /dashboard/roi-analysis
 * @desc    Análisis de retorno de inversión por categorías
 * @access  Private (Roles: OWNER, ADMIN)
 * @query   ?investments=genetics,facilities,technology&timeframe=3y&includeProjections=true
 */
router.get(
  '/roi-analysis',
  requireFinancialAccess,
  createRateLimit(EndpointType.REPORTS),
  dashboardController.getROIAnalysis
);

// ============================================================================
// ALERTAS Y NOTIFICACIONES CRÍTICAS
// ============================================================================

/**
 * @route   GET /dashboard/alerts
 * @desc    Alertas activas y notificaciones críticas
 * @access  Private
 * @query   ?severity=critical|high|medium|low&category=health|production|financial&limit=50
 */
router.get(
  '/alerts',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getActiveAlerts
);

/**
 * @route   POST /dashboard/alerts/acknowledge
 * @desc    Reconocer alertas específicas
 * @access  Private
 * @body    { alertIds: string[], acknowledgement: string, userId: string }
 */
router.post(
  '/alerts/acknowledge',
  createRateLimit(EndpointType.CATTLE_WRITE),
  validate('search'), // Usar esquema básico para validación
  dashboardController.acknowledgeAlerts
);

/**
 * @route   GET /dashboard/urgent-actions
 * @desc    Acciones urgentes requeridas
 * @access  Private
 * @query   ?priority=immediate|today|this_week&assignedTo=me&category=all
 */
router.get(
  '/urgent-actions',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getUrgentActions
);

// ============================================================================
// ANÁLISIS GEOESPACIAL Y MAPAS
// ============================================================================

/**
 * @route   GET /dashboard/geographic-distribution
 * @desc    Distribución geográfica del ganado y eventos
 * @access  Private
 * @query   ?includeHealthEvents=true&includeVaccinations=true&clusterAnalysis=true
 */
router.get(
  '/geographic-distribution',
  createRateLimit(EndpointType.MAPS),
  dashboardController.getGeographicDistribution
);

/**
 * @route   GET /dashboard/heatmaps
 * @desc    Mapas de calor para diferentes métricas
 * @access  Private
 * @query   ?metric=density|health|production|activity&resolution=high|medium|low
 */
router.get(
  '/heatmaps',
  createRateLimit(EndpointType.MAPS),
  dashboardController.getHeatmaps
);

/**
 * @route   GET /dashboard/movement-patterns
 * @desc    Patrones de movimiento del ganado
 * @access  Private
 * @query   ?timeframe=24h|7d|30d&includeAnomalies=true&predictiveAnalysis=true
 */
router.get(
  '/movement-patterns',
  createRateLimit(EndpointType.MAPS),
  dashboardController.getMovementPatterns
);

// ============================================================================
// WIDGETS PERSONALIZABLES
// ============================================================================

/**
 * @route   GET /dashboard/widgets
 * @desc    Obtener configuración de widgets del usuario
 * @access  Private
 * @query   ?layout=grid|list&includeData=true&activeOnly=true
 */
router.get(
  '/widgets',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getUserWidgets
);

/**
 * @route   POST /dashboard/widgets
 * @desc    Crear nuevo widget personalizado
 * @access  Private
 * @body    { type: string, config: object, position: object, title: string, dataSource: string }
 */
router.post(
  '/widgets',
  createRateLimit(EndpointType.CATTLE_WRITE),
  validate('search'), // Usar esquema básico para validación
  dashboardController.createWidget
);

/**
 * @route   PUT /dashboard/widgets/:widgetId
 * @desc    Actualizar configuración de widget
 * @access  Private
 * @params  widgetId: string (UUID del widget)
 * @body    Configuración actualizada del widget
 */
router.put(
  '/widgets/:widgetId',
  validateId('widgetId'),
  createRateLimit(EndpointType.CATTLE_WRITE),
  validate('search'), // Usar esquema básico para validación
  dashboardController.updateWidget
);

/**
 * @route   DELETE /dashboard/widgets/:widgetId
 * @desc    Eliminar widget del dashboard
 * @access  Private
 * @params  widgetId: string (UUID del widget)
 */
router.delete(
  '/widgets/:widgetId',
  validateId('widgetId'),
  createRateLimit(EndpointType.CATTLE_WRITE),
  dashboardController.deleteWidget
);

/**
 * @route   PUT /dashboard/widgets/layout
 * @desc    Actualizar layout completo del dashboard
 * @access  Private
 * @body    { widgets: array, layout: object, settings: object }
 */
router.put(
  '/widgets/layout',
  createRateLimit(EndpointType.CATTLE_WRITE),
  validate('search'), // Usar esquema básico para validación
  dashboardController.updateDashboardLayout
);

// ============================================================================
// COMPARACIONES Y BENCHMARKS
// ============================================================================

/**
 * @route   GET /dashboard/comparisons
 * @desc    Comparaciones con períodos anteriores y benchmarks
 * @access  Private
 * @query   ?compareWith=previous_year|industry_average|custom&metrics=all|specific&period=1y
 */
router.get(
  '/comparisons',
  createRateLimit(EndpointType.REPORTS),
  validate('search'), // Usar esquema básico para validación
  dashboardController.getComparisons
);

/**
 * @route   GET /dashboard/benchmarks
 * @desc    Benchmarks de la industria y mejores prácticas
 * @access  Private (Roles: OWNER, ADMIN)
 * @query   ?category=productivity|efficiency|profitability&region=mexico&ranchSize=similar
 */
router.get(
  '/benchmarks',
  requireFinancialAccess,
  createRateLimit(EndpointType.REPORTS),
  validate('search'), // Usar esquema básico para validación
  dashboardController.getBenchmarks
);

/**
 * @route   GET /dashboard/performance-scores
 * @desc    Puntuaciones de rendimiento del rancho
 * @access  Private
 * @query   ?categories=health,production,financial,operational&includeRecommendations=true
 */
router.get(
  '/performance-scores',
  createRateLimit(EndpointType.REPORTS),
  dashboardController.getPerformanceScores
);

// ============================================================================
// DATOS EN TIEMPO REAL Y STREAMING
// ============================================================================

/**
 * @route   GET /dashboard/realtime-data
 * @desc    Datos en tiempo real para widgets dinámicos
 * @access  Private
 * @query   ?metrics=live_health,current_alerts,active_events&format=sse
 */
router.get(
  '/realtime-data',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getRealtimeData
);

/**
 * @route   GET /dashboard/live-metrics
 * @desc    Métricas en vivo con actualizaciones automáticas
 * @access  Private
 * @query   ?metrics=temperature,activity,feeding&updateInterval=30s
 */
router.get(
  '/live-metrics',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getLiveMetrics
);

// ============================================================================
// REPORTES Y EXPORTACIÓN
// ============================================================================

/**
 * @route   POST /dashboard/export
 * @desc    Exportar dashboard completo en diferentes formatos
 * @access  Private
 * @body    { format: 'pdf' | 'excel' | 'powerpoint', sections: array, includeCharts: boolean, timeRange: object }
 */
router.post(
  '/export',
  createRateLimit(EndpointType.FILES),
  validate('search'), // Usar esquema básico para validación
  dashboardController.exportDashboard
);

/**
 * @route   GET /dashboard/export/:exportId/download
 * @desc    Descargar dashboard exportado
 * @access  Private
 * @params  exportId: string (ID del proceso de exportación)
 */
router.get(
  '/export/:exportId/download',
  validateId('exportId'),
  createRateLimit(EndpointType.FILES),
  dashboardController.downloadDashboardExport
);

/**
 * @route   POST /dashboard/scheduled-reports
 * @desc    Configurar reportes programados del dashboard
 * @access  Private (Roles: OWNER, ADMIN)
 * @body    { frequency: string, recipients: array, sections: array, format: string, schedule: object }
 */
router.post(
  '/scheduled-reports',
  requireFinancialAccess,
  createRateLimit(EndpointType.REPORTS),
  validate('search'), // Usar esquema básico para validación
  dashboardController.createScheduledReport
);

// ============================================================================
// CONFIGURACIÓN Y PERSONALIZACIÓN
// ============================================================================

/**
 * @route   GET /dashboard/settings
 * @desc    Obtener configuración personalizada del dashboard
 * @access  Private
 */
router.get(
  '/settings',
  createRateLimit(EndpointType.CATTLE_READ),
  dashboardController.getDashboardSettings
);

/**
 * @route   PUT /dashboard/settings
 * @desc    Actualizar configuración del dashboard
 * @access  Private
 * @body    { theme: string, layout: object, defaultPeriod: string, autoRefresh: boolean, notifications: object }
 */
router.put(
  '/settings',
  createRateLimit(EndpointType.CATTLE_WRITE),
  validate('search'), // Usar esquema básico para validación
  dashboardController.updateDashboardSettings
);

/**
 * @route   POST /dashboard/reset
 * @desc    Restablecer dashboard a configuración predeterminada
 * @access  Private
 * @body    { confirmReset: boolean, preserveWidgets?: boolean }
 */
router.post(
  '/reset',
  createRateLimit(EndpointType.CATTLE_WRITE),
  validate('search'), // Usar esquema básico para validación
  dashboardController.resetDashboard
);

// ============================================================================
// MÉTRICAS PERSONALIZADAS Y AVANZADAS
// ============================================================================

/**
 * @route   POST /dashboard/custom-metrics
 * @desc    Crear métrica personalizada
 * @access  Private (Roles: OWNER, ADMIN)
 * @body    { name: string, formula: string, dataSource: string, visualization: object, schedule: object }
 */
router.post(
  '/custom-metrics',
  requireFinancialAccess,
  createRateLimit(EndpointType.CATTLE_WRITE),
  validate('search'), // Usar esquema básico para validación
  dashboardController.createCustomMetric
);

/**
 * @route   GET /dashboard/predictive-analytics
 * @desc    Análisis predictivo y proyecciones
 * @access  Private (Roles: OWNER, ADMIN, VETERINARIAN)
 * @query   ?models=health,production,financial&horizon=30d|90d|1y&confidence=0.95
 */
router.get(
  '/predictive-analytics',
  requireVeterinaryAccess,
  createRateLimit(EndpointType.REPORTS),
  dashboardController.getPredictiveAnalytics
);

// ============================================================================
// MANEJO DE ERRORES ESPECÍFICOS PARA RUTAS DEL DASHBOARD
// ============================================================================

/**
 * Middleware de manejo de errores específico para dashboard
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  // Log del error para debugging
  console.error('Dashboard Route Error:', {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Errores específicos del dashboard
  if (error.name === 'DataAggregationError') {
    return res.status(500).json({
      success: false,
      message: 'Error al agregar datos del dashboard',
      error: 'DATA_AGGREGATION_ERROR',
      details: error.details
    });
  }

  if (error.name === 'WidgetConfigurationError') {
    return res.status(400).json({
      success: false,
      message: 'Configuración de widget inválida',
      error: 'WIDGET_CONFIGURATION_ERROR',
      details: error.details
    });
  }

  if (error.name === 'MetricCalculationError') {
    return res.status(500).json({
      success: false,
      message: 'Error al calcular métricas',
      error: 'METRIC_CALCULATION_ERROR',
      details: error.details
    });
  }

  if (error.name === 'CacheError') {
    return res.status(500).json({
      success: false,
      message: 'Error en sistema de caché',
      error: 'CACHE_ERROR'
    });
  }

  if (error.name === 'ExportGenerationError') {
    return res.status(500).json({
      success: false,
      message: 'Error al generar exportación',
      error: 'EXPORT_GENERATION_ERROR',
      details: error.details
    });
  }

  if (error.name === 'RealtimeConnectionError') {
    return res.status(503).json({
      success: false,
      message: 'Error en conexión de tiempo real',
      error: 'REALTIME_CONNECTION_ERROR'
    });
  }

  // Error genérico
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: 'INTERNAL_SERVER_ERROR'
  });
});

export default router;