export * from './api.types';
export * from './auth.types';
export * from './bovine.types';
export * from './health.types';
export * from './event.types';
export * from './finance.types';
export * from './production.types';
export * from './reproduction.types';
export * from './location.types';
export * from './medication.types';
export * from './notification.types';
// tracking.types also exports DeviceStatus — location.types's string-literal
// DeviceStatus wins (it's the one used by monitoring UI). Re-export the rest
// under an unambiguous alias.
export type {
  TrackingLocation,
  TrackingPath,
  GeoCluster,
  HeatmapPoint,
  Geofence,
  DeviceStatus as BovineDeviceStatus,
} from './tracking.types';
export * from './inventory.types';
export * from './ranch.types';
export * from './dashboard.types';
