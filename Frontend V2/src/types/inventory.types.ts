export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStock?: number;
  maxStock?: number;
  unitCost?: number;
  supplier?: string;
  location?: string;
  ranchId: string;
  expirationDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryValuation {
  totalItems: number;
  totalValue: number;
  byCategory: { category: string; count: number; value: number }[];
}

export interface InventoryAlert {
  itemId: string;
  itemName: string;
  type: 'LOW_STOCK' | 'EXPIRING' | 'OUT_OF_STOCK';
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}
