export interface Medication {
  id: string;
  name: string;
  code: string;
  type: string;
  description?: string;
  manufacturer?: string;
  activeIngredient?: string;
  dosageForm?: string;
  concentration?: string;
  storageConditions?: string;
  withdrawalPeriodMeat?: number;
  withdrawalPeriodMilk?: number;
  requiresPrescription: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationInventory {
  medicationCode: string;
  medicationName: string;
  currentStock: number;
  unit: string;
  minStock?: number;
  expirationDate?: string;
  batchNumber?: string;
}

export interface DoseCalculation {
  medicationId: string;
  weight: number;
  recommendedDose: number;
  unit: string;
  frequency: string;
  notes?: string;
}
