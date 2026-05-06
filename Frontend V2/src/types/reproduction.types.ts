export enum ReproductionEventType {
  HEAT = 'HEAT',
  INSEMINATION = 'INSEMINATION',
  PREGNANCY = 'PREGNANCY',
  BIRTH = 'BIRTH',
}

export interface ReproductionEvent {
  id: string;
  bovineId: string;
  bovineEarTag?: string;
  type: ReproductionEventType;
  date: string;
  notes?: string;
  bullId?: string;
  semenCode?: string;
  pregnancyConfirmed?: boolean;
  expectedDueDate?: string;
  calvesCount?: number;
  complications?: string;
  ranchId: string;
  recordedById: string;
  recordedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptionRate {
  totalInseminations: number;
  confirmedPregnancies: number;
  rate: number;
  byPeriod: { period: string; rate: number }[];
}

export interface CalvingInterval {
  average: number;
  min: number;
  max: number;
  byBovine: { bovineId: string; earTag: string; interval: number }[];
}
