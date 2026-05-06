export interface TrackingLocation {
  bovineId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  deviceId?: string;
  timestamp: string;
}

export interface TrackingPath {
  bovineId: string;
  points: { lat: number; lng: number; timestamp: string }[];
  totalDistance: number;
  duration: number;
}

export interface GeoCluster {
  id: string;
  center: { lat: number; lng: number };
  count: number;
  bovineIds: string[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export interface Geofence {
  id: string;
  locationId: string;
  type: 'CIRCLE' | 'RECTANGLE' | 'POLYGON' | 'CORRIDOR';
  geometry: unknown;
  center?: { lat: number; lng: number };
}

export interface DeviceStatus {
  deviceId: string;
  bovineId: string;
  isOnline: boolean;
  lastSeen: string;
  batteryLevel?: number;
  signalStrength?: number;
}
