import { Router, Request, Response, NextFunction } from 'express';
import { 
  authenticateToken, 
  authorizeRoles, 
  checkPermission, 
  requireActiveSubscription,
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
import { createUploadMiddleware, processUploadedFiles, handleUploadErrors, FileCategory } from '../middleware/upload';

// Crear instancia del router
const router = Router();

// Upload middleware específico para documentos financieros
const financialUpload = createUploadMiddleware(FileCategory.FINANCIAL_DOCS);

// Simulación del controlador de finanzas (reemplazar con implementación real)
class FinancesController {
  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Transacciones financieras',
          page: req.query.page || '1',
          limit: req.query.limit || '50',
          type: req.query.type,
          category: req.query.category,
          status: req.query.status,
          dateFrom: req.query.dateFrom,
          dateTo: req.query.dateTo,
          bovineId: req.query.bovineId,
          vendorId: req.query.vendorId,
          sortBy: req.query.sortBy || 'date',
          sortOrder: req.query.sortOrder || 'desc',
          includeAttachments: req.query.includeAttachments === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener transacciones'
      });
    }
  }

  async createTransaction(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Transacción creada',
          type: req.body.type,
          category: req.body.category,
          amount: req.body.amount,
          description: req.body.description,
          date: req.body.date,
          bovineIds: req.body.bovineIds,
          vendorId: req.body.vendorId,
          paymentMethod: req.body.paymentMethod,
          reference: req.body.reference,
          files: (req as any).processedFiles?.length || 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear transacción'
      });
    }
  }

  async getTransactionById(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Detalles de transacción',
          id: req.params.id,
          includeAttachments: req.query.includeAttachments === 'true',
          includeAuditTrail: req.query.includeAuditTrail === 'true',
          includeRelatedTransactions: req.query.includeRelatedTransactions === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener detalles de transacción'
      });
    }
  }

  async updateTransaction(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Transacción actualizada',
          id: req.params.id,
          updates: req.body,
          files: (req as any).processedFiles?.length || 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar transacción'
      });
    }
  }

  async deleteTransaction(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Transacción eliminada',
          id: req.params.id,
          reason: req.body.reason,
          approvedBy: req.body.approvedBy,
          requiresAudit: req.body.requiresAudit
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al eliminar transacción'
      });
    }
  }

  async getIncomeOverview(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Resumen de ingresos',
          period: req.query.period || 'month',
          groupBy: req.query.groupBy,
          includeProjections: req.query.includeProjections === 'true',
          compareWithPrevious: req.query.compareWithPrevious === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener resumen de ingresos'
      });
    }
  }

  async recordSale(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Venta registrada',
          bovineIds: req.body.bovineIds,
          saleType: req.body.saleType,
          buyer: req.body.buyer,
          unitPrice: req.body.unitPrice,
          totalAmount: req.body.totalAmount,
          saleDate: req.body.saleDate,
          paymentTerms: req.body.paymentTerms,
          deliveryInfo: req.body.deliveryInfo,
          files: (req as any).processedFiles?.length || 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al registrar venta'
      });
    }
  }

  async getIncomeProjections(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Proyecciones de ingresos',
          horizon: req.query.horizon || '12m',
          includeSeasonality: req.query.includeSeasonality === 'true',
          confidenceLevel: req.query.confidenceLevel || '0.95',
          scenarios: req.query.scenarios
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener proyecciones de ingresos'
      });
    }
  }

  async getIncomeByAnimal(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Ingresos por animal',
          includeOperatingCosts: req.query.includeOperatingCosts === 'true',
          includeProfitability: req.query.includeProfitability === 'true',
          period: req.query.period || 'lifetime',
          sortBy: req.query.sortBy || 'roi'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener ingresos por animal'
      });
    }
  }

  async getExpenseOverview(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Resumen de gastos',
          period: req.query.period || 'month',
          category: req.query.category || 'all',
          includeRecurring: req.query.includeRecurring === 'true',
          includeBudgetComparison: req.query.includeBudgetComparison === 'true',
          sortBy: req.query.sortBy || 'amount'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener resumen de gastos'
      });
    }
  }

  async recordPurchase(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Compra registrada',
          category: req.body.category,
          items: req.body.items,
          vendor: req.body.vendor,
          totalAmount: req.body.totalAmount,
          purchaseDate: req.body.purchaseDate,
          paymentMethod: req.body.paymentMethod,
          deliveryDate: req.body.deliveryDate,
          warrantyInfo: req.body.warrantyInfo,
          files: (req as any).processedFiles?.length || 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al registrar compra'
      });
    }
  }

  async getRecurringExpenses(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Gastos recurrentes',
          status: req.query.status || 'active',
          category: req.query.category || 'all',
          includeUpcoming: req.query.includeUpcoming === 'true',
          daysAhead: req.query.daysAhead || '30'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener gastos recurrentes'
      });
    }
  }

  async createRecurringExpense(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Gasto recurrente creado',
          category: req.body.category,
          amount: req.body.amount,
          frequency: req.body.frequency,
          startDate: req.body.startDate,
          endDate: req.body.endDate,
          vendor: req.body.vendor,
          autoProcess: req.body.autoProcess,
          alertDays: req.body.alertDays
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear gasto recurrente'
      });
    }
  }

  async analyzeExpensePatterns(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Análisis de patrones de gastos',
          analysisType: req.query.analysisType || 'variance',
          period: req.query.period || 'quarter',
          includeRecommendations: req.query.includeRecommendations === 'true',
          compareWithBudget: req.query.compareWithBudget === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al analizar patrones de gastos'
      });
    }
  }

  async getCashFlow(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Flujo de caja',
          period: req.query.period || 'month',
          includeProjections: req.query.includeProjections === 'true',
          includeOperatingActivities: req.query.includeOperatingActivities === 'true',
          includeInvestingActivities: req.query.includeInvestingActivities === 'true',
          includeFinancingActivities: req.query.includeFinancingActivities === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener flujo de caja'
      });
    }
  }

  async generateCashFlowProjection(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Proyección de flujo de caja generada',
          projectionPeriod: req.body.projectionPeriod,
          scenarios: req.body.scenarios,
          includeSeasonality: req.body.includeSeasonality,
          assumptions: req.body.assumptions,
          sensitivityAnalysis: req.body.sensitivityAnalysis
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al generar proyección de flujo de caja'
      });
    }
  }

  async getCashFlowAlerts(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Alertas de flujo de caja',
          severity: req.query.severity || 'all',
          includeRecommendations: req.query.includeRecommendations === 'true',
          lookaheadDays: req.query.lookaheadDays || '30'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener alertas de flujo de caja'
      });
    }
  }

  async optimizeCashFlow(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Optimización de flujo de caja',
          optimizationGoals: req.body.optimizationGoals,
          constraints: req.body.constraints,
          timeHorizon: req.body.timeHorizon,
          riskTolerance: req.body.riskTolerance
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al optimizar flujo de caja'
      });
    }
  }

  async getProfitLoss(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Estado de resultados (P&L)',
          period: req.query.period || 'quarter',
          includeComparisons: req.query.includeComparisons === 'true',
          includeMargins: req.query.includeMargins === 'true',
          includeSegmentation: req.query.includeSegmentation === 'true',
          format: req.query.format || 'detailed'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al generar estado de resultados'
      });
    }
  }

  async getSegmentedProfitLoss(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'P&L segmentado',
          segmentBy: req.query.segmentBy || 'cattle_type',
          period: req.query.period || 'year',
          includeAllocations: req.query.includeAllocations === 'true',
          allocationMethod: req.query.allocationMethod || 'activity_based'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al generar P&L segmentado'
      });
    }
  }

  async analyzeProfitLossVariance(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Análisis de variaciones en P&L',
          comparisonType: req.body.comparisonType,
          baselinePeriod: req.body.baselinePeriod,
          analysisLevel: req.body.analysisLevel,
          includeExplanations: req.body.includeExplanations
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al analizar variaciones de P&L'
      });
    }
  }

  async getROIAnalysis(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Análisis de ROI',
          analysisType: req.query.analysisType || 'by_animal',
          period: req.query.period || 'lifetime',
          includeIRR: req.query.includeIRR === 'true',
          includeNPV: req.query.includeNPV === 'true',
          discountRate: req.query.discountRate || '0.08'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener análisis de ROI'
      });
    }
  }

  async evaluateInvestment(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Evaluación de inversión',
          investmentType: req.body.investmentType,
          initialCost: req.body.initialCost,
          projectedReturns: req.body.projectedReturns,
          riskAssessment: req.body.riskAssessment,
          paybackPeriod: req.body.paybackPeriod,
          scenarioAnalysis: req.body.scenarioAnalysis
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al evaluar inversión'
      });
    }
  }

  async getProfitabilityBenchmarks(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Benchmarks de rentabilidad',
          region: req.query.region || 'mexico',
          herdSize: req.query.herdSize || 'similar',
          productionType: req.query.productionType || 'mixed',
          includePercentiles: req.query.includePercentiles === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener benchmarks de rentabilidad'
      });
    }
  }

  async analyzeProfitabilityTrends(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Análisis de tendencias de rentabilidad',
          period: req.query.period || '5y',
          includeDrivers: req.query.includeDrivers === 'true',
          includePredictions: req.query.includePredictions === 'true',
          confidence: req.query.confidence || '0.95'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al analizar tendencias de rentabilidad'
      });
    }
  }

  async getBudgets(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Presupuestos',
          period: req.query.period || 'year',
          includeVariances: req.query.includeVariances === 'true',
          includeRevisedBudgets: req.query.includeRevisedBudgets === 'true',
          detailLevel: req.query.detailLevel || 'category'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener presupuestos'
      });
    }
  }

  async createBudget(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Presupuesto creado',
          name: req.body.name,
          period: req.body.period,
          categories: req.body.categories,
          assumptions: req.body.assumptions,
          approvalWorkflow: req.body.approvalWorkflow,
          basedOnHistorical: req.body.basedOnHistorical
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear presupuesto'
      });
    }
  }

  async updateBudget(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Presupuesto actualizado',
          id: req.params.id,
          updates: req.body
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar presupuesto'
      });
    }
  }

  async getBudgetVarianceAnalysis(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Análisis de variaciones presupuestarias',
          id: req.params.id,
          period: req.query.period || 'current',
          includeRecommendations: req.query.includeRecommendations === 'true',
          varianceThreshold: req.query.varianceThreshold || '5'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener análisis de variaciones presupuestarias'
      });
    }
  }

  async reviseBudget(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Revisión de presupuesto creada',
          id: req.params.id,
          revisionReason: req.body.revisionReason,
          adjustments: req.body.adjustments,
          effectiveDate: req.body.effectiveDate,
          approvalRequired: req.body.approvalRequired
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear revisión de presupuesto'
      });
    }
  }

  async getAssets(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Activos fijos',
          category: req.query.category || 'equipment',
          includeDepreciation: req.query.includeDepreciation === 'true',
          status: req.query.status || 'active',
          sortBy: req.query.sortBy || 'purchase_date'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener activos'
      });
    }
  }

  async registerAsset(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Activo registrado',
          name: req.body.name,
          category: req.body.category,
          purchasePrice: req.body.purchasePrice,
          purchaseDate: req.body.purchaseDate,
          usefulLife: req.body.usefulLife,
          depreciationMethod: req.body.depreciationMethod,
          location: req.body.location,
          serialNumber: req.body.serialNumber,
          files: (req as any).processedFiles?.length || 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al registrar activo'
      });
    }
  }

  async updateAsset(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Activo actualizado',
          id: req.params.id,
          updates: req.body
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar activo'
      });
    }
  }

  async calculateDepreciation(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Depreciación calculada',
          calculationDate: req.body.calculationDate,
          method: req.body.method,
          includeDisposals: req.body.includeDisposals,
          generateEntries: req.body.generateEntries
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al calcular depreciación'
      });
    }
  }

  async getAssetDepreciationSchedule(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Calendario de depreciación',
          id: req.params.id
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener calendario de depreciación'
      });
    }
  }

  async disposeAsset(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Activo dado de baja',
          id: req.params.id,
          disposalType: req.body.disposalType,
          disposalDate: req.body.disposalDate,
          disposalAmount: req.body.disposalAmount,
          reason: req.body.reason,
          buyer: req.body.buyer
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al dar de baja activo'
      });
    }
  }

  async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Facturas',
          type: req.query.type || 'issued',
          status: req.query.status || 'pending',
          dateFrom: req.query.dateFrom,
          includePayments: req.query.includePayments === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener facturas'
      });
    }
  }

  async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Factura creada',
          customer: req.body.customer,
          items: req.body.items,
          dueDate: req.body.dueDate,
          paymentTerms: req.body.paymentTerms,
          taxCalculation: req.body.taxCalculation,
          invoiceNumber: req.body.invoiceNumber
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear factura'
      });
    }
  }

  async updateInvoice(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Factura actualizada',
          id: req.params.id,
          updates: req.body
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar factura'
      });
    }
  }

  async recordInvoicePayment(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Pago de factura registrado',
          id: req.params.id,
          amount: req.body.amount,
          paymentDate: req.body.paymentDate,
          paymentMethod: req.body.paymentMethod,
          reference: req.body.reference,
          bankAccount: req.body.bankAccount,
          files: (req as any).processedFiles?.length || 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al registrar pago de factura'
      });
    }
  }

  async generateInvoicePDF(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'PDF de factura generado',
          id: req.params.id,
          template: req.query.template || 'standard',
          language: req.query.language || 'es',
          includeQR: req.query.includeQR === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al generar PDF de factura'
      });
    }
  }

  async sendInvoice(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Factura enviada',
          id: req.params.id,
          recipients: req.body.recipients,
          subject: req.body.subject,
          emailMessage: req.body.message,
          includeAttachments: req.body.includeAttachments
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al enviar factura'
      });
    }
  }

  async getCostCenters(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Centros de costos',
          includeAllocations: req.query.includeAllocations === 'true',
          period: req.query.period || 'month',
          activeOnly: req.query.activeOnly === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener centros de costos'
      });
    }
  }

  async createCostCenter(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Centro de costos creado',
          name: req.body.name,
          code: req.body.code,
          description: req.body.description,
          manager: req.body.manager,
          allocationMethod: req.body.allocationMethod,
          budgetAmount: req.body.budgetAmount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al crear centro de costos'
      });
    }
  }

  async allocateCosts(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Costos asignados',
          period: req.body.period,
          allocations: req.body.allocations,
          allocationMethod: req.body.allocationMethod,
          basis: req.body.basis
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al asignar costos'
      });
    }
  }

  async analyzeCostCenter(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Análisis de centro de costos',
          id: req.params.id,
          period: req.query.period || 'quarter',
          includeVariances: req.query.includeVariances === 'true',
          includeDrivers: req.query.includeDrivers === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al analizar centro de costos'
      });
    }
  }

  async getBankReconciliations(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Conciliaciones bancarias',
          account: req.query.account || 'all',
          status: req.query.status || 'pending',
          period: req.query.period || 'month',
          includeUnmatched: req.query.includeUnmatched === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener conciliaciones bancarias'
      });
    }
  }

  async startBankReconciliation(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Conciliación bancaria iniciada',
          bankAccount: req.body.bankAccount,
          statementDate: req.body.statementDate,
          endingBalance: req.body.endingBalance,
          autoMatch: req.body.autoMatch,
          files: req.file ? 1 : 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al iniciar conciliación bancaria'
      });
    }
  }

  async matchBankTransactions(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Transacciones bancarias emparejadas',
          id: req.params.id,
          matches: req.body.matches,
          unmatchedItems: req.body.unmatchedItems,
          adjustments: req.body.adjustments
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al emparejar transacciones bancarias'
      });
    }
  }

  async finalizeReconciliation(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Conciliación bancaria finalizada',
          id: req.params.id,
          finalBalance: req.body.finalBalance,
          adjustmentEntries: req.body.adjustmentEntries,
          approvedBy: req.body.approvedBy
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al finalizar conciliación'
      });
    }
  }

  async generateFinancialReport(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Reporte financiero generado',
          reportType: req.body.reportType,
          period: req.body.period,
          parameters: req.body.parameters,
          format: req.body.format,
          includeCharts: req.body.includeCharts,
          emailTo: req.body.emailTo
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al generar reporte financiero'
      });
    }
  }

  async downloadFinancialReport(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Descarga de reporte financiero',
          id: req.params.id
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al descargar reporte financiero'
      });
    }
  }

  async generateTaxReport(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Reporte fiscal generado',
          taxPeriod: req.body.taxPeriod,
          reportType: req.body.reportType,
          taxAuthority: req.body.taxAuthority,
          includeSupporting: req.body.includeSupporting
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al generar reporte fiscal'
      });
    }
  }

  async getScheduledReports(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Reportes programados',
          status: req.query.status || 'active',
          frequency: req.query.frequency || 'monthly',
          includeNext: req.query.includeNext === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener reportes programados'
      });
    }
  }

  async scheduleReport(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Reporte programado',
          reportConfig: req.body.reportConfig,
          frequency: req.body.frequency,
          recipients: req.body.recipients,
          startDate: req.body.startDate,
          endDate: req.body.endDate
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al programar reporte'
      });
    }
  }

  async getFinancialDashboard(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Dashboard financiero',
          period: req.query.period || 'month',
          includeComparisons: req.query.includeComparisons === 'true',
          includeProjections: req.query.includeProjections === 'true',
          kpis: req.query.kpis || 'revenue,profit,cashflow,roi'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al cargar dashboard financiero'
      });
    }
  }

  async getFinancialKPIs(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'KPIs financieros',
          period: req.query.period || 'quarter',
          includeTargets: req.query.includeTargets === 'true',
          includeBenchmarks: req.query.includeBenchmarks === 'true',
          format: req.query.format || 'detailed'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener KPIs financieros'
      });
    }
  }

  async getFinancialAlerts(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Alertas financieras',
          severity: req.query.severity || 'high',
          category: req.query.category || 'all',
          includeRecommendations: req.query.includeRecommendations === 'true',
          activeOnly: req.query.activeOnly === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener alertas financieras'
      });
    }
  }

  async getFinancialSettings(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Configuración del sistema financiero',
          userId: (req as any).userId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al obtener configuración financiera'
      });
    }
  }

  async updateFinancialSettings(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Configuración financiera actualizada',
          currency: req.body.currency,
          fiscalYearStart: req.body.fiscalYearStart,
          taxSettings: req.body.taxSettings,
          accountingMethod: req.body.accountingMethod,
          depreciationDefaults: req.body.depreciationDefaults
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al actualizar configuración financiera'
      });
    }
  }

  async exportFinancialData(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Datos financieros exportados',
          exportType: req.body.exportType,
          format: req.body.format,
          period: req.body.period,
          categories: req.body.categories,
          includeTransactions: req.body.includeTransactions
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al exportar datos financieros'
      });
    }
  }

  async downloadFinancialExport(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          message: 'Descarga de exportación financiera',
          exportId: req.params.exportId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al descargar exportación financiera'
      });
    }
  }
}

const financesController = new FinancesController();

const simulateMiddleware = (middlewareName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log(`Middleware simulado: ${middlewareName}`);
    next();
  };
};

router.use(authenticateToken);
router.use(sanitizeInput);
router.use(simulateMiddleware('auditTrail'));

router.get('/transactions', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), validate('search'), financesController.getTransactions);
router.post('/transactions', requireModulePermission('finances', 'create'), createRateLimit(EndpointType.CATTLE_WRITE), financialUpload.multiple('receipts', 10), processUploadedFiles(FileCategory.FINANCIAL_DOCS), simulateMiddleware('accounting'), simulateMiddleware('taxCalculation'), simulateMiddleware('budgetControl'), simulateMiddleware('exchangeRate'), validate('search'), financesController.createTransaction);
router.get('/transactions/:id', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getTransactionById);
router.put('/transactions/:id', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financialUpload.multiple('receipts', 10), processUploadedFiles(FileCategory.FINANCIAL_DOCS), simulateMiddleware('accounting'), simulateMiddleware('taxCalculation'), validate('search'), financesController.updateTransaction);
router.delete('/transactions/:id', validateId('id'), requireExactRoles(UserRole.OWNER, UserRole.SUPER_ADMIN), createRateLimit(EndpointType.CATTLE_WRITE), financesController.deleteTransaction);

router.get('/income', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.getIncomeOverview);
router.post('/income/sale', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financialUpload.multiple('saleDocuments', 15), processUploadedFiles(FileCategory.FINANCIAL_DOCS), simulateMiddleware('accounting'), simulateMiddleware('taxCalculation'), financesController.recordSale);
router.get('/income/projections', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.getIncomeProjections);
router.get('/income/by-animal', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.getIncomeByAnimal);

router.get('/expenses', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getExpenseOverview);
router.post('/expenses/purchase', requireModulePermission('finances', 'create'), createRateLimit(EndpointType.CATTLE_WRITE), financialUpload.multiple('purchaseDocuments', 15), processUploadedFiles(FileCategory.FINANCIAL_DOCS), simulateMiddleware('accounting'), simulateMiddleware('budgetControl'), financesController.recordPurchase);
router.get('/expenses/recurring', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getRecurringExpenses);
router.post('/expenses/recurring', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financesController.createRecurringExpense);
router.get('/expenses/analysis', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.analyzeExpensePatterns);

router.get('/cashflow', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), validate('search'), financesController.getCashFlow);
router.post('/cashflow/projection', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.generateCashFlowProjection);
router.get('/cashflow/alerts', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getCashFlowAlerts);
router.post('/cashflow/optimize', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.optimizeCashFlow);

router.get('/profit-loss', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), validate('search'), financesController.getProfitLoss);
router.get('/profit-loss/by-segment', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.getSegmentedProfitLoss);
router.post('/profit-loss/variance-analysis', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.analyzeProfitLossVariance);

router.get('/roi-analysis', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), validate('search'), financesController.getROIAnalysis);
router.post('/roi-analysis/investment-evaluation', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.evaluateInvestment);
router.get('/profitability/benchmarks', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.getProfitabilityBenchmarks);
router.get('/profitability/trends', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.analyzeProfitabilityTrends);

router.get('/budgets', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getBudgets);
router.post('/budgets', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), validate('search'), financesController.createBudget);
router.put('/budgets/:id', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), validate('search'), financesController.updateBudget);
router.get('/budgets/:id/variance', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.getBudgetVarianceAnalysis);
router.post('/budgets/:id/revise', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financesController.reviseBudget);

router.get('/assets', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getAssets);
router.post('/assets', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financialUpload.multiple('assetDocuments', 10), processUploadedFiles(FileCategory.FINANCIAL_DOCS), validate('search'), financesController.registerAsset);
router.put('/assets/:id', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), validate('search'), financesController.updateAsset);
router.post('/assets/depreciation/calculate', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), validate('search'), financesController.calculateDepreciation);
router.get('/assets/:id/depreciation-schedule', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getAssetDepreciationSchedule);
router.post('/assets/:id/dispose', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financesController.disposeAsset);

router.get('/invoices', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getInvoices);
router.post('/invoices', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), simulateMiddleware('taxCalculation'), validate('search'), financesController.createInvoice);
router.put('/invoices/:id', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), simulateMiddleware('taxCalculation'), validate('search'), financesController.updateInvoice);
router.post('/invoices/:id/payment', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financialUpload.multiple('paymentProofs', 5), processUploadedFiles(FileCategory.FINANCIAL_DOCS), validate('search'), financesController.recordInvoicePayment);
router.get('/invoices/:id/pdf', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.FILES), financesController.generateInvoicePDF);
router.post('/invoices/:id/send', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.EXTERNAL_API), financesController.sendInvoice);

router.get('/cost-centers', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getCostCenters);
router.post('/cost-centers', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), validate('search'), financesController.createCostCenter);
router.post('/cost-centers/allocate', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financesController.allocateCosts);
router.get('/cost-centers/:id/analysis', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.analyzeCostCenter);

router.get('/bank-reconciliation', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getBankReconciliations);
router.post('/bank-reconciliation', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financialUpload.single('bankStatement'), processUploadedFiles(FileCategory.FINANCIAL_DOCS), validate('search'), financesController.startBankReconciliation);
router.put('/bank-reconciliation/:id/match', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financesController.matchBankTransactions);
router.post('/bank-reconciliation/:id/finalize', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.CATTLE_WRITE), financesController.finalizeReconciliation);

router.post('/reports/generate', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), validate('search'), financesController.generateFinancialReport);
router.get('/reports/:id/download', validateId('id'), requireFinancialAccess, createRateLimit(EndpointType.FILES), financesController.downloadFinancialReport);
router.post('/reports/tax-report', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), validate('search'), financesController.generateTaxReport);
router.get('/reports/scheduled', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getScheduledReports);
router.post('/reports/schedule', requireFinancialAccess, createRateLimit(EndpointType.REPORTS), financesController.scheduleReport);

router.get('/dashboard', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getFinancialDashboard);
router.get('/kpis', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getFinancialKPIs);
router.get('/alerts', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getFinancialAlerts);

router.get('/settings', requireFinancialAccess, createRateLimit(EndpointType.CATTLE_READ), financesController.getFinancialSettings);
router.put('/settings', requireExactRoles(UserRole.OWNER, UserRole.SUPER_ADMIN), createRateLimit(EndpointType.CATTLE_WRITE), financesController.updateFinancialSettings);
router.post('/export', requireFinancialAccess, createRateLimit(EndpointType.FILES), financesController.exportFinancialData);
router.get('/export/:exportId/download', validateId('exportId'), requireFinancialAccess, createRateLimit(EndpointType.FILES), financesController.downloadFinancialExport);

router.use(handleUploadErrors);

router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Finance Route Error:', {
    path: req.path,
    method: req.method,
    userId: (req as any).userId,
    errorMessage: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id']
  });

  if (err.name === 'InsufficientFundsError') {
    return res.status(400).json({
      success: false,
      message: 'Fondos insuficientes para la operación',
      errorCode: 'INSUFFICIENT_FUNDS',
      details: err.details
    });
  }

  if (err.name === 'BudgetExceededError') {
    return res.status(400).json({
      success: false,
      message: 'Límite presupuestario excedido',
      errorCode: 'BUDGET_EXCEEDED',
      details: err.details
    });
  }

  if (err.name === 'TaxCalculationError') {
    return res.status(500).json({
      success: false,
      message: 'Error en cálculo de impuestos',
      errorCode: 'TAX_CALCULATION_ERROR',
      details: err.details
    });
  }

  if (err.name === 'AccountingEntryError') {
    return res.status(400).json({
      success: false,
      message: 'Error en entrada contable',
      errorCode: 'ACCOUNTING_ENTRY_ERROR',
      details: err.details
    });
  }

  if (err.name === 'ReconciliationError') {
    return res.status(400).json({
      success: false,
      message: 'Error en conciliación bancaria',
      errorCode: 'RECONCILIATION_ERROR',
      details: err.details
    });
  }

  if (err.name === 'DepreciationCalculationError') {
    return res.status(500).json({
      success: false,
      message: 'Error en cálculo de depreciación',
      errorCode: 'DEPRECIATION_CALCULATION_ERROR',
      details: err.details
    });
  }

  if (err.name === 'InvoiceGenerationError') {
    return res.status(500).json({
      success: false,
      message: 'Error al generar factura',
      errorCode: 'INVOICE_GENERATION_ERROR',
      details: err.details
    });
  }

  if (err.name === 'PaymentProcessingError') {
    return res.status(400).json({
      success: false,
      message: 'Error al procesar pago',
      errorCode: 'PAYMENT_PROCESSING_ERROR',
      details: err.details
    });
  }

  if (err.name === 'ROICalculationError') {
    return res.status(500).json({
      success: false,
      message: 'Error en cálculo de ROI',
      errorCode: 'ROI_CALCULATION_ERROR',
      details: err.details
    });
  }

  if (err.name === 'ReportGenerationError') {
    return res.status(500).json({
      success: false,
      message: 'Error al generar reporte financiero',
      errorCode: 'REPORT_GENERATION_ERROR',
      details: err.details
    });
  }

  if (err.name === 'CurrencyConversionError') {
    return res.status(500).json({
      success: false,
      message: 'Error en conversión de moneda',
      errorCode: 'CURRENCY_CONVERSION_ERROR',
      details: err.details
    });
  }

  if (err.name === 'AuditTrailError') {
    return res.status(500).json({
      success: false,
      message: 'Error en registro de auditoría',
      errorCode: 'AUDIT_TRAIL_ERROR',
      details: err.details
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor financiero',
    errorCode: 'INTERNAL_SERVER_ERROR'
  });
});

export default router;