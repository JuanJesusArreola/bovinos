import type { HealthStats } from './health.types';

export interface DashboardData {
  healthFull?: HealthDashboard;
  healthLight?: HealthLightDashboard;
  productionFull?: ProductionDashboard;
  productionLight?: ProductionLightDashboard;
  financialFull?: FinancialDashboard;
  financialLight?: FinancialLightDashboard;
  users?: UsersDashboard;
  systemMetrics?: SystemMetrics;
  reproductionMetrics?: ReproductionMetrics;
}

export interface HealthDashboard {
  stats: HealthStats;
  recentChecks: unknown[];
  alerts: unknown[];
  timeline: unknown[];
}

export interface HealthLightDashboard {
  total: number;
  healthy: number;
  sick: number;
  critical: number;
}

export interface ProductionDashboard {
  totalToday: number;
  averageDaily: number;
  trend: unknown[];
  topProducers: unknown[];
  byType: Record<string, number>;
}

export interface ProductionLightDashboard {
  totalToday: number;
  averageDaily: number;
}

export interface FinancialDashboard {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  monthlyTrend: unknown[];
  topExpenses: unknown[];
}

export interface FinancialLightDashboard {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
}

export interface UsersDashboard {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
  byRanch?: Record<string, unknown[]>;
}

export interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  blockedUsers: number;
  totalRanches: number;
  unresolvedEvents: number;
}

export interface ReproductionMetrics {
  conceptionRate: number;
  calvingInterval: number;
  recentBirths: number;
  upcomingDueDates: unknown[];
}
