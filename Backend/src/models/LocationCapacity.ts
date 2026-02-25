class LocationCapacity extends Model {
    locationId: string;      // FK a Location
    maxAnimals: number;      // Capacidad máxima
    currentAnimals: number;  // Animales actuales (se actualiza frecuentemente)
    area: number;            // Área en m²
    areaUnit: 'M2' | 'HA' | 'ACRE';
    carryingCapacity: number; // Animales por hectárea
    waterSources: number;    // Número de fuentes de agua
    feedingStations: number;
    shelters: number;
    hasElectricity: boolean;
    hasWater: boolean;
    hasInternet: boolean;
    hasRoadAccess: boolean;
    securityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    lastUpdated: Date;
    updatedBy: string;
  }