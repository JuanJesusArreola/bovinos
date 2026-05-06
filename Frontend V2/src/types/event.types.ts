export enum EventStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE',
  POSTPONED = 'POSTPONED',
}

export enum EventType {
  VACCINATION = 'VACCINATION',
  DEWORMING = 'DEWORMING',
  CHECKUP = 'CHECKUP',
  TREATMENT = 'TREATMENT',
  BREEDING = 'BREEDING',
  PREGNANCY_CHECK = 'PREGNANCY_CHECK',
  BIRTH = 'BIRTH',
  WEANING = 'WEANING',
  WEIGHING = 'WEIGHING',
  TRANSFER = 'TRANSFER',
  SALE = 'SALE',
  OTHER = 'OTHER',
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  status: EventStatus;
  scheduledDate: string;
  completedDate?: string;
  bovineId?: string;
  bovineEarTag?: string;
  ranchId: string;
  assignedToId?: string;
  assignedToName?: string;
  createdById: string;
  createdByName?: string;
  notes?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
}

export interface EventFormData {
  title: string;
  description?: string;
  type: EventType;
  scheduledDate: string;
  bovineId?: string;
  assignedToId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
}
