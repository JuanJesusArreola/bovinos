export enum EventStatus {
  /** Programado (sinonimo de PENDING). El backend de auto-eventos de
   *  follow-up emite SCHEDULED al crearlos via mejora 5. */
  SCHEDULED   = 'SCHEDULED',
  PENDING     = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED   = 'COMPLETED',
  CANCELLED   = 'CANCELLED',
  OVERDUE     = 'OVERDUE',
  POSTPONED   = 'POSTPONED',
}

export enum EventType {
  VACCINATION     = 'VACCINATION',
  DEWORMING       = 'DEWORMING',
  CHECKUP         = 'CHECKUP',
  /** Auto-generado por mejora 5 del backend: HealthRecord con
   *  followUpRequired:true + followUpDate dispara un evento de este tipo
   *  con healthRecordId apuntando al record origen. */
  HEALTH_CHECK    = 'HEALTH_CHECK',
  TREATMENT       = 'TREATMENT',
  BREEDING        = 'BREEDING',
  PREGNANCY_CHECK = 'PREGNANCY_CHECK',
  BIRTH           = 'BIRTH',
  WEANING         = 'WEANING',
  WEIGHING        = 'WEIGHING',
  TRANSFER        = 'TRANSFER',
  SALE            = 'SALE',
  OTHER           = 'OTHER',
}

export interface EventsListFilters {
  bovineId?:       string;
  ranchId?:        string;
  /** CSV serializado por el API client. */
  eventType?:      EventType[];
  status?:         EventStatus[];
  priority?:       Array<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>;
  /** ISO YYYY-MM-DD. */
  startDate?:      string;
  endDate?:        string;
  assignedTo?:     string;
  veterinarianId?: string;
  isActive?:       boolean;
  page?:           number;
  limit?:          number;
}

export interface EventsListEnvelope {
  success: true;
  data:    Event[];
  pagination: {
    total: number;
    page:  number;
    limit: number;
    pages: number;
  };
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
  /**
   * Si el evento fue AUTO-GENERADO por el sistema a partir de un
   * HealthRecord con `followUpRequired: true` (mejora 5 del backend de
   * salud), aqui va el UUID del record origen. La UI lo usa para mostrar
   * un distintivo "Generado por chequeo de salud" en /events.
   *
   * Eventos creados manualmente desde el modulo de Eventos NO traen
   * este campo.
   */
  healthRecordId?: string;
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
