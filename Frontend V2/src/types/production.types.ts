export interface ProductionRecord {
  id: string;
  bovineId: string;
  bovineEarTag?: string;
  type: string;
  quantity: number;
  unit: string;
  quality?: string;
  date: string;
  ranchId: string;
  recordedById: string;
  recordedByName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionMetrics {
  bovineId: string;
  totalProduction: number;
  averageDaily: number;
  peakProduction: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  lastRecord?: ProductionRecord;
}

export interface ProductionTrend {
  date: string;
  quantity: number;
  average: number;
}
