// validators/index.ts
/**
 * ============================================================================
 * EXPORTACIONES UNIFICADAS DE VALIDADORES
 * ============================================================================
 */

// Bovino CRUD
export * from './bovine.validators';

// Mapas
export * from './bovine-geo.validators';

// Salud
export * from './bovine-health.validators';

// Tracking GPS
export * from './bovine-tracking.validators';

// Ubicaciones lógicas
export * from './bovine-location.validators';

// Finanzas
export * from './finance.validators';

// Reproducción
export * from './reproduction.validators';

// Producción (leche, carne, etc.)
export * from './production.validators';

// Inventario y movimientos de stock
export * from './inventory.validators';

// Ranchos
export * from './ranch.validators';

// Administración (creación de usuarios por admin)
export * from './admin.validators';
