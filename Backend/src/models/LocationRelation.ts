class LocationRelation extends Model {
  id: string;
  sourceLocationId: string;   // FK a Location
  targetLocationId: string;   // FK a Location
  
  relationType: 'CONTAINS' | 'ADJACENT' | 'CONNECTED' | 'NEARBY';
  distance?: number;          // Distancia en metros
  bidirectional: boolean;     // ¿Relación simétrica?
  
  metadata?: {
    pathType?: 'GATE' | 'ROAD' | 'TRAIL';
    restrictions?: string[];
    travelTime?: number;      // Tiempo estimado en minutos
  };
  
  // Para jerarquías (alternativa a parentLocationId)
  isPrimary: boolean;        // ¿Es la relación principal?
}