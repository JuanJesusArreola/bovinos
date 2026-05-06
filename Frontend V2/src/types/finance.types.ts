export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum TransactionCategory {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  VETERINARY = 'VETERINARY',
  FEED = 'FEED',
  EQUIPMENT = 'EQUIPMENT',
  LABOR = 'LABOR',
  MAINTENANCE = 'MAINTENANCE',
  INSURANCE = 'INSURANCE',
  TAXES = 'TAXES',
  OTHER = 'OTHER',
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  date: string;
  bovineId?: string;
  bovineEarTag?: string;
  ranchId: string;
  createdById: string;
  createdByName?: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  incomeByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
  monthlyTrend: { month: string; income: number; expenses: number }[];
}

export interface ROIAnalysis {
  totalInvestment: number;
  totalReturns: number;
  roi: number;
  paybackPeriod?: number;
  byCategory: Record<string, { investment: number; returns: number; roi: number }>;
}
