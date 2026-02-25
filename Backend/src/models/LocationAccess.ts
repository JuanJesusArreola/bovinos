class LocationAccess extends Model {
    id: string;
    locationId: string;      // FK a Location
    userId: string;          // FK a User (cuando exista)
    
    accessLevel: AccessLevel;
    grantedBy: string;
    grantedAt: Date;
    expiresAt?: Date;
    
    // Restricciones adicionales
    timeRestrictions?: JSON; // Horarios permitidos
    purposeRestrictions?: string[]; // Solo para ciertos propósitos
  }