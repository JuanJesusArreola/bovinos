// services/analytics/DashboardService.ts
import { Op, literal, QueryTypes,  } from 'sequelize';
import sequelize from '../../config/database'
import logger from '../../utils/logger';
import { ensureError } from '../../utils/errorUtils';
import {
    HerdHealthStats,
    bovineHealthService
} from '../BovineHealthService';
import { ranchOperationsService } from '../ranch/RanchOperationsService';
import { financeService } from '../../container';
import { eventService } from '../EventService';
import { notificationService } from '../NotificationService';
import {
    NotificationStatus,
    NotificationPriority,
    NotificationType
} from '../../models/Notification';
import Bovine from '../../models/Bovine';
import Production from '../../models/Production';
import { ProductionType } from '../../models/Production';
import User, { UserStatus } from '../../models/User';

// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Dashboard completo para la vista principal
 */
export interface FullDashboard {
    health: HealthDashboard;
    production: ProductionDashboard;
    financial: FinancialDashboard;
    summary: DashboardSummary;
    generatedAt: Date;
}

/**
 * Dashboard de salud
 */
export interface HealthDashboard extends HerdHealthStats {
    recentHealthEvents: Array<{
        id: string;
        date: Date;
        type: string;
        bovineId: string;
        bovineEarTag?: string;
        description: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>;
    upcomingHealthChecks: number;
    overdueHealthChecks: number;
}

/**
 * Dashboard de producción
 */
export interface ProductionDashboard {
    currentPeriod: {
        startDate: Date;
        endDate: Date;
    };
    milkProduction: {
        total: number;
        averagePerCow: number;
        vsLastPeriod: number;
    };
    meatProduction: {
        total: number;
        averagePerAnimal: number;
        vsLastPeriod: number;
    };
    reproduction: {
        calvingRate: number;
        conceptionRate: number;
        birthsLastMonth: number;
        expectedBirths: number;
    };
    trends: {
        milk: number[];
        meat: number[];
        years: number[];
    };
}

/**
 * Dashboard financiero
 */
export interface FinancialDashboard {
    currentPeriod: {
        startDate: Date;
        endDate: Date;
    };
    totals: {
        income: number;
        expenses: number;
        net: number;
        profitMargin: number;
    };
    byCategory: {
        income: Array<{ category: string; amount: number; percentage: number }>;
        expenses: Array<{ category: string; amount: number; percentage: number }>;
    };
    veterinaryCosts: {
        total: number;
        trend: 'INCREASING' | 'DECREASING' | 'STABLE';
        percentageOfExpenses: number;
    };
    roi: number;
}

/**
 * Resumen rápido del dashboard
 */
export interface DashboardSummary {
    totalBovines: number;
    activeAlerts: number;
    pendingTasks: number;
    unreadNotifications: number;
    criticalHealthIssues: number;
    lowStockItems: number;
}

/**
 * Filtros para dashboards
 */
export interface DashboardFilters {
    ranchId: string;
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
    startDate?: Date;
    endDate?: Date;
    compareWithPrevious?: boolean;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class DashboardService {
    private readonly context = 'DashboardService';

    /**
     * Obtiene el dashboard completo para un rancho
     */
    async getFullDashboard(filters: DashboardFilters): Promise<FullDashboard> {
        const startTime = Date.now();

        try {
            logger.info('Obteniendo dashboard completo', this.context, {
                ranchId: filters.ranchId,
                period: filters.period
            });

            // Ejecutar todas las consultas en paralelo para máxima eficiencia
            const [health, production, financial] = await Promise.all([
                this.getHealthDashboard(filters),
                this.getProductionDashboard(filters),
                this.getFinancialDashboard(filters)
            ]);

            // Calcular resumen
            const summary = this.calculateSummary(health, production, financial);

            const duration = Date.now() - startTime;

            logger.info('Dashboard completo obtenido', this.context, {
                ranchId: filters.ranchId,
                durationMs: duration
            });

            return {
                health,
                production,
                financial,
                summary,
                generatedAt: new Date()
            };

        } catch (error) {
            logger.error('Error obteniendo dashboard completo', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene dashboard de salud
     */
    async getHealthDashboard(filters: DashboardFilters): Promise<HealthDashboard> {
        const startTime = Date.now();

        try {
            const { ranchId } = filters;

            // 1. Obtener estadísticas base de salud
            const healthStats = await bovineHealthService.getHerdHealthStats(ranchId);

            // 2. Obtener eventos de salud recientes (últimos 7 días)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentHealthEvents = await this.getRecentHealthEvents(ranchId, sevenDaysAgo);

            // 3. Obtener chequeos programados
            const upcomingChecks = await this.getUpcomingHealthChecks(ranchId);
            const overdueChecks = await this.getOverdueHealthChecks(ranchId);

            const duration = Date.now() - startTime;

            logger.debug('Dashboard de salud obtenido', this.context, {
                ranchId,
                totalBovines: healthStats.totalBovines,
                sickCount: healthStats.byStatus.SICK,
                durationMs: duration
            });

            return {
                ...healthStats,
                recentHealthEvents,
                upcomingHealthChecks: upcomingChecks,
                overdueHealthChecks: overdueChecks
            };

        } catch (error) {
            logger.error('Error obteniendo dashboard de salud', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene dashboard de producción
     */
    async getProductionDashboard(filters: DashboardFilters): Promise<ProductionDashboard> {
        const startTime = Date.now();

        try {
            const { ranchId, period = 'month' } = filters;

            // Determinar fechas del período
            const { startDate, endDate, previousStartDate, previousEndDate } =
                this.getPeriodDates(period, filters.startDate, filters.endDate);

            // 1. Obtener bovinos del rancho para contar vacas
            const bovines = await Bovine.findAll({
                where: { ranchId, isActive: true },
                attributes: ['id', 'cattleType']
            });
            const cowCount = bovines.filter(b => b.cattleType === 'COW').length;
            const totalBovines = bovines.length;

            // 2. Obtener producción del período actual (usando modelo Production directamente)
            const currentProduction = await Production.findAll({
                where: {
                    [Op.and]: [
                        literal(`bovine_id IN (SELECT id FROM bovines WHERE ranch_id = '${ranchId}')`),
                        {
                            productionDate: { [Op.between]: [startDate, endDate] }
                        }
                    ]
                }
            });

            // 3. Obtener producción del período anterior para comparación
            let previousProduction: Production[] = [];
            if (filters.compareWithPrevious && previousStartDate && previousEndDate) {
                previousProduction = await Production.findAll({
                    where: {
                        [Op.and]: [
                            literal(`bovine_id IN (SELECT id FROM bovines WHERE ranch_id = '${ranchId}')`),
                            {
                                productionDate: { [Op.between]: [previousStartDate, previousEndDate] }
                            }
                        ]
                    }
                });
            }

            // 4. Calcular métricas de leche
            const milkRecords = currentProduction.filter(p => p.productionType === ProductionType.MILK);
            const totalMilk = milkRecords.reduce((sum, p) => sum + p.quantity, 0);

            const previousMilkRecords = previousProduction.filter(p => p.productionType === ProductionType.MILK);
            const previousTotalMilk = previousMilkRecords.reduce((sum, p) => sum + p.quantity, 0);
            const milkVsLastPeriod = previousTotalMilk > 0
                ? ((totalMilk - previousTotalMilk) / previousTotalMilk) * 100
                : 0;

            // 5. Calcular métricas de carne
            const meatRecords = currentProduction.filter(p => p.productionType === ProductionType.MEAT);
            const totalMeat = meatRecords.reduce((sum, p) => sum + p.quantity, 0);

            const previousMeatRecords = previousProduction.filter(p => p.productionType === ProductionType.MEAT);
            const previousTotalMeat = previousMeatRecords.reduce((sum, p) => sum + p.quantity, 0);
            const meatVsLastPeriod = previousTotalMeat > 0
                ? ((totalMeat - previousTotalMeat) / previousTotalMeat) * 100
                : 0;

            // 6. Obtener tendencias (últimos 5 años)
            const trends = await ranchOperationsService.getProductionTrends(ranchId, 5);

            // 7. Obtener métricas de reproducción
            const reproductionMetrics = await this.getReproductionMetrics(ranchId, startDate, endDate);

            const duration = Date.now() - startTime;

            logger.debug('Dashboard de producción obtenido', this.context, {
                ranchId,
                totalMilk,
                totalMeat,
                cowCount,
                durationMs: duration
            });

            return {
                currentPeriod: { startDate, endDate },
                milkProduction: {
                    total: totalMilk,
                    averagePerCow: cowCount > 0 ? totalMilk / cowCount : 0,
                    vsLastPeriod: milkVsLastPeriod
                },
                meatProduction: {
                    total: totalMeat,
                    averagePerAnimal: totalBovines > 0 ? totalMeat / totalBovines : 0,
                    vsLastPeriod: meatVsLastPeriod
                },
                reproduction: {
                    calvingRate: reproductionMetrics.calvingRate,
                    conceptionRate: reproductionMetrics.conceptionRate,
                    birthsLastMonth: reproductionMetrics.birthsLastMonth,
                    expectedBirths: reproductionMetrics.expectedBirths
                },
                trends: {
                    milk: trends.milk,
                    meat: trends.meat,
                    years: trends.years
                }
            };

        } catch (error) {
            logger.error('Error obteniendo dashboard de producción', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    /**
     * Obtiene dashboard financiero
     */
    async getFinancialDashboard(filters: DashboardFilters): Promise<FinancialDashboard> {
        const startTime = Date.now();

        try {
            const { ranchId, period = 'month' } = filters;

            // Determinar fechas del período
            const { startDate, endDate, previousStartDate, previousEndDate } =
                this.getPeriodDates(period, filters.startDate, filters.endDate);

            // 1. Obtener resumen financiero del período actual
            const summary = await financeService.getFinancialSummary(ranchId, startDate, endDate);

            // 2. Obtener costos veterinarios
            const veterinaryCosts = await financeService.getVeterinaryCosts(ranchId, startDate, endDate);

            // 3. Obtener ROI
            const roiAnalysis = await financeService.getROIAnalysis(ranchId, startDate, endDate);

            // 4. Calcular tendencia de costos veterinarios
            let veterinaryTrend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
            if (previousStartDate && previousEndDate) {
                const previousVetCosts = await financeService.getVeterinaryCosts(ranchId, previousStartDate, previousEndDate);
                if (veterinaryCosts.total > previousVetCosts.total * 1.1) {
                    veterinaryTrend = 'INCREASING';
                } else if (veterinaryCosts.total < previousVetCosts.total * 0.9) {
                    veterinaryTrend = 'DECREASING';
                }
            }

            // 5. Calcular porcentajes por categoría
            const totalIncome = summary.totals.income;
            const totalExpenses = summary.totals.expense;

            const incomeByCategory = Object.entries(summary.byCategory)
                .filter(([cat]) => this.isIncomeCategory(cat))
                .map(([category, amount]) => ({
                    category: this.getCategoryLabel(category),
                    amount,
                    percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0
                }))
                .sort((a, b) => b.amount - a.amount);

            const expensesByCategory = Object.entries(summary.byCategory)
                .filter(([cat]) => this.isExpenseCategory(cat))
                .map(([category, amount]) => ({
                    category: this.getCategoryLabel(category),
                    amount,
                    percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                }))
                .sort((a, b) => b.amount - a.amount);

            const duration = Date.now() - startTime;

            logger.debug('Dashboard financiero obtenido', this.context, {
                ranchId,
                income: totalIncome,
                expenses: totalExpenses,
                net: summary.totals.net,
                durationMs: duration
            });

            return {
                currentPeriod: { startDate, endDate },
                totals: {
                    income: totalIncome,
                    expenses: totalExpenses,
                    net: summary.totals.net,
                    profitMargin: totalIncome > 0 ? (summary.totals.net / totalIncome) * 100 : 0
                },
                byCategory: {
                    income: incomeByCategory,
                    expenses: expensesByCategory
                },
                veterinaryCosts: {
                    total: veterinaryCosts.total,
                    trend: veterinaryTrend,
                    percentageOfExpenses: totalExpenses > 0 ? (veterinaryCosts.total / totalExpenses) * 100 : 0
                },
                roi: roiAnalysis.roi
            };

        } catch (error) {
            logger.error('Error obteniendo dashboard financiero', this.context, {
                filters
            }, ensureError(error));
            throw error;
        }
    }

    // ==========================================================================
    // MÉTODOS AUXILIARES
    // ==========================================================================

    /**
     * Obtiene eventos de salud recientes
     */
    private async getRecentHealthEvents(
        ranchId: string,
        since: Date
    ): Promise<HealthDashboard['recentHealthEvents']> {
        try {
            const [users] = await sequelize.query(`
            SELECT id FROM users 
            WHERE is_active = true 
            AND status = 'ACTIVE'
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(ranch_access) AS access
                WHERE access->>'ranchId' = :ranchId 
                AND (access->>'isActive')::boolean = true
            )
        `, {
                replacements: { ranchId },
                type: QueryTypes.SELECT
            });

            const userIds = (users as any[]).map(u => u.id);

            if (userIds.length === 0) return [];

            const notifications = await notificationService?.listNotifications({
                userId: { [Op.in]: userIds } as any,
                type: [NotificationType.HEALTH_ALERT, NotificationType.PRODUCTION_ALERT],
                startDate: since,
                limit: 10
            });

            if (!notifications) return [];

            return notifications.rows.map(n => ({
                id: n.id,
                date: n.createdAt,
                type: n.type,
                bovineId: n.metadata?.bovineId || 'unknown',
                bovineEarTag: n.metadata?.bovineEarTag,
                description: n.content,
                severity: this.mapPriorityToSeverity(n.priority)
            }));

        } catch (error) {
            logger.error('Error obteniendo dashboard completo', this.context, {
                ranchId,
                since
            }, ensureError(error));
            return [];
        }
    }

    /**
     * Obtiene cantidad de chequeos de salud próximos
     */
    private async getUpcomingHealthChecks(ranchId: string): Promise<number> {
        try {
            const events = await eventService.getUpcomingEvents(ranchId, 7);
            return events.filter(e => e.eventType === 'HEALTH_CHECK').length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Obtiene cantidad de chequeos de salud atrasados
     */
    private async getOverdueHealthChecks(ranchId: string): Promise<number> {
        try {
            const events = await eventService.getOverdueEvents(ranchId);
            return events.filter(e => e.eventType === 'HEALTH_CHECK').length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Obtiene métricas de reproducción
     */
    private async getReproductionMetrics(
        ranchId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        calvingRate: number;
        conceptionRate: number;
        birthsLastMonth: number;
        expectedBirths: number;
    }> {
        // Valores por defecto
        const defaults = {
            calvingRate: 0,
            conceptionRate: 0,
            birthsLastMonth: 0,
            expectedBirths: 0
        };

        try {
            // TODO: Implementar cuando tengamos el servicio de reproducción
            // Por ahora retornamos valores por defecto
            return defaults;

        } catch (error) {
            return defaults;
        }
    }

    /**
     * Calcula resumen del dashboard
     */
    private calculateSummary(
        health: HealthDashboard,
        production: ProductionDashboard,
        financial: FinancialDashboard
    ): DashboardSummary {
        return {
            totalBovines: health.totalBovines,
            activeAlerts: health.byStatus.SICK + health.byStatus.QUARANTINE,
            pendingTasks: health.upcomingHealthChecks + health.overdueHealthChecks,
            unreadNotifications: 0,
            criticalHealthIssues: health.byStatus.QUARANTINE,
            lowStockItems: 0
        };
    }

    /**
     * Determina fechas del período
     */
    private getPeriodDates(
        period: string,
        customStartDate?: Date,
        customEndDate?: Date
    ): {
        startDate: Date;
        endDate: Date;
        previousStartDate?: Date;
        previousEndDate?: Date;
    } {
        const endDate = customEndDate || new Date();
        let startDate: Date;

        if (customStartDate) {
            startDate = customStartDate;
        } else {
            startDate = new Date(endDate);
            switch (period) {
                case 'day':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case 'week':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'quarter':
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default:
                    startDate.setDate(startDate.getDate() - 30);
            }
        }

        // Calcular período anterior para comparación
        const duration = endDate.getTime() - startDate.getTime();
        const previousStartDate = new Date(startDate.getTime() - duration);
        const previousEndDate = new Date(startDate.getTime());

        return {
            startDate,
            endDate,
            previousStartDate,
            previousEndDate
        };
    }

    /**
     * Mapea prioridad a severidad
     */
    private mapPriorityToSeverity(priority: NotificationPriority): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        const map: Record<NotificationPriority, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
            [NotificationPriority.LOW]: 'LOW',
            [NotificationPriority.MEDIUM]: 'MEDIUM',
            [NotificationPriority.HIGH]: 'HIGH',
            [NotificationPriority.URGENT]: 'CRITICAL'
        };
        return map[priority] || 'MEDIUM';
    }

    /**
     * Verifica si una categoría es de ingresos
     */
    private isIncomeCategory(category: string): boolean {
        const incomeCategories = [
            'CATTLE_SALE', 'MILK_PRODUCTION', 'MEAT_PRODUCTION',
            'BREEDING_SERVICES', 'RENTAL_INCOME', 'GOVERNMENT_SUBSIDIES',
            'INSURANCE_CLAIMS', 'CONSULTATION_SERVICES', 'EQUIPMENT_SALE',
            'OTHER_INCOME'
        ];
        return incomeCategories.includes(category);
    }

    /**
     * Verifica si una categoría es de gastos
     */
    private isExpenseCategory(category: string): boolean {
        const expenseCategories = [
            'FEED_PURCHASE', 'VETERINARY_SERVICES', 'MEDICATION',
            'VACCINATION', 'CATTLE_PURCHASE', 'EQUIPMENT_PURCHASE',
            'FACILITY_MAINTENANCE', 'LABOR_COSTS', 'UTILITIES',
            'FUEL_COSTS', 'INSURANCE_PREMIUMS', 'TRANSPORTATION',
            'PROPERTY_TAXES', 'LICENSING_FEES', 'PROFESSIONAL_SERVICES',
            'MARKETING_ADVERTISING', 'OFFICE_SUPPLIES', 'TECHNOLOGY_SOFTWARE',
            'RESEARCH_DEVELOPMENT', 'OTHER_EXPENSES'
        ];
        return expenseCategories.includes(category);
    }

    /**
     * Obtiene etiqueta legible de categoría
     */
    private getCategoryLabel(category: string): string {
        const labels: Record<string, string> = {
            // Ingresos
            'CATTLE_SALE': 'Venta de Ganado',
            'MILK_PRODUCTION': 'Producción de Leche',
            'MEAT_PRODUCTION': 'Producción de Carne',
            'BREEDING_SERVICES': 'Servicios de Reproducción',
            'RENTAL_INCOME': 'Ingresos por Alquiler',
            'GOVERNMENT_SUBSIDIES': 'Subsidios Gubernamentales',
            'INSURANCE_CLAIMS': 'Reclamaciones de Seguro',
            'CONSULTATION_SERVICES': 'Servicios de Consultoría',
            'EQUIPMENT_SALE': 'Venta de Equipo',
            'OTHER_INCOME': 'Otros Ingresos',

            // Gastos
            'FEED_PURCHASE': 'Compra de Alimento',
            'VETERINARY_SERVICES': 'Servicios Veterinarios',
            'MEDICATION': 'Medicamentos',
            'VACCINATION': 'Vacunaciones',
            'CATTLE_PURCHASE': 'Compra de Ganado',
            'EQUIPMENT_PURCHASE': 'Compra de Equipo',
            'FACILITY_MAINTENANCE': 'Mantenimiento',
            'LABOR_COSTS': 'Mano de Obra',
            'UTILITIES': 'Servicios Públicos',
            'FUEL_COSTS': 'Combustible',
            'INSURANCE_PREMIUMS': 'Seguros',
            'TRANSPORTATION': 'Transporte',
            'PROPERTY_TAXES': 'Impuestos',
            'LICENSING_FEES': 'Licencias',
            'PROFESSIONAL_SERVICES': 'Servicios Profesionales',
            'MARKETING_ADVERTISING': 'Marketing',
            'OFFICE_SUPPLIES': 'Suministros',
            'TECHNOLOGY_SOFTWARE': 'Tecnología',
            'RESEARCH_DEVELOPMENT': 'I+D',
            'OTHER_EXPENSES': 'Otros Gastos'
        };
        return labels[category] || category;
    }
}

// ============================================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================================

export const dashboardService = new DashboardService();