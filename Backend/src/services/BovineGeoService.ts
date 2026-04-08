import { Op, Transaction, QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import { 
  BovineError,
  BovineValidationError,
  BovineNotFoundError 
} from '../utils/BovineErrors';
import { getErrorMessage, ensureError } from '../utils/errorUtils';
import { 
  GRID_SIZES,
  HEAT_INTENSITY,
  HEALTH_COLORS 
} from '../constants/bovine.constants';

// Modelos
import BovineHealthSnapshot from '../models/BovineHealthSnapshot';
import Bovine from '../models/Bovine';
import { HealthStatus, LocationData } from '../models/Bovine';


// ============================================================================
// INTERFACES PÚBLICAS
// ============================================================================

/**
 * Punto para mapa de calor (Leaflet)
 * 
 * Leaflet espera datos en este formato para heatmaps:
 * - lat: latitud
 * - lng: longitud
 * - value: intensidad (0-1) para el gradiente
 * - color: color del punto (para modo puntos)
 */
export interface HeatmapPoint {
  id: string;                    // ID del bovino (para popups)
  lat: number;                   // Latitud
  lng: number;                   // Longitud
  value: number;                 // Intensidad para heatmap (0-1)
  color: string;                 // Color hexadecimal
  metadata: {
    healthStatus: HealthStatus;  // Estado de salud (para filtros)
    breed?: string;              // Raza (para filtros)
    age?: number;                // Edad en meses (para filtros)
    diagnosis?: string;          // Diagnóstico actual (si existe)
  };
}

/**
 * Datos estructurados para que el FRONTEND construya el popup de Leaflet.
 *
 * El backend entrega datos; el frontend decide cómo renderizarlos.
 * Esto permite cambiar el idioma, el framework de UI o el proveedor
 * de mapas sin tocar ningún servicio backend.
 *
 * Uso típico en React/Leaflet:
 *   const popup = L.popup().setContent(renderBovinePopup(popupData));
 */
export interface PopupData {
  bovineId:      string;
  shortId:       string;        // últimos 6 chars del ID — para el título
  healthStatus:  HealthStatus;
  statusLabel:   string;        // etiqueta en español lista para mostrar
  statusColor:   string;        // color hex del estado
  breed?:        string;
  ageMonths?:    number;
  diagnosis?:    string;
  hasDiagnosis:  boolean;       // shortcut para condicionales en el template
}

/**
 * Cluster para agrupamiento en Leaflet
 * 
 * Cuando hay muchos puntos en un área, Leaflet los agrupa en clusters.
 * Este formato permite:
 * - Mostrar el centro del cluster
 * - Saber cuántos puntos contiene
 * - Conocer los límites para hacer zoom
 * - Mostrar colores según estados de salud predominantes
 */
export interface Cluster {
  id: string;                    // ID único del cluster
  center: {                      // Centro geográfico
    lat: number;
    lng: number;
  };
  pointCount: number;            // Cantidad de puntos en el cluster
  bounds: {                       // Límites del cluster (para hacer zoom)
    north: number;
    south: number;
    east: number;
    west: number;
  };
  healthStatuses: HealthStatus[]; // Estados de salud presentes (para color)
  avgSeverity: number;            // Severidad promedio (para gradiente)
}

/**
 * Límites geográficos (bounding box)
 * 
 * Usado para consultas espaciales y para centrar el mapa
 */
export interface Bounds {
  north: number;  // Latitud máxima
  south: number;  // Latitud mínima
  east: number;   // Longitud máxima
  west: number;   // Longitud mínima
}

/**
 * Filtros para mapas de calor
 * 
 * Estos filtros se aplican directamente en las consultas SQL
 * para evitar traer datos innecesarios del frontend
 */
export interface HeatmapFilters {
  healthStatus?: HealthStatus[];  // Filtrar por uno o más estados
  breeds?: string[];              // Filtrar por razas específicas
  ageRange?: {                    // Rango de edad en meses
    min: number;
    max: number;
  };
  // Lista de diagnósticos a incluir — comparación exacta contra el campo
  // `diagnosis` del snapshot (string normalizado, ej. "Mastitis", "Fiebre aftosa").
  // El frontend debe enviar los mismos valores que usa al guardar en Health.diagnosis.
  diseases?: string[];
}

/**
 * Datos para actualizar snapshot
 * 
 * Solo incluimos campos que pueden cambiar dinámicamente
 * Los campos fijos (raza, fecha nacimiento) se actualizan en otro lado
 */
export interface SnapshotUpdateData {
  healthStatus?: HealthStatus;
  location?: LocationData;
  lastUpdate?: Date;
  healthColor?: string;
  diagnosis?: string;
  lastHealthCheck?: Date;
}
// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

export class BovineGeoService {
  private readonly context = 'BovineGeoService';

  // ==========================================================================
  // MÉTODOS DE MANTENIMIENTO DE SNAPSHOTS
  // ==========================================================================

  /**
   * Crea un snapshot para un bovino recién registrado
   * 
   * ¿POR QUÉ ES NECESARIO?
   *   La tabla BovineHealthSnapshot es una vista desnormalizada optimizada
   *   para consultas geoespaciales. Cada bovino tiene UN SOLO snapshot.
   * 
   * ¿CUÁNDO SE USA?
   *   - Cuando se crea un nuevo bovino (desde BovineService)
   *   - Cuando se importan bovinos en lote
   * 
   * @param bovine - El bovino recién creado
   * @param transaction - Transacción activa (opcional)
   */
  async createSnapshot(bovine: Bovine, transaction?: Transaction): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Validar que el bovino tenga ranchId (necesario para filtros)
      if (!bovine.ranchId) {
        throw new BovineValidationError(
          'No se puede crear snapshot: bovino sin rancho asignado'
        );
      }

      // Calcular edad en meses (para filtros en el mapa)
      const ageInMonths = this.calculateAgeInMonths(bovine.birthDate);

      // Crear el snapshot
      // 📝 NOTA: Usamos upsert por si ya existía (caso borde)
      await BovineHealthSnapshot.upsert({
        bovineId: bovine.id,
        ranchId: bovine.ranchId,
        healthStatus: bovine.healthStatus,
        location: bovine.location,
        lastUpdate: new Date(),
        healthColor: this.getHealthColor(bovine.healthStatus),
        clusterSize: 1, // Inicialmente 1, se recalculará después
        breed: bovine.breed,
        ageMonths: ageInMonths,
        lastHealthCheck: bovine.lastHealthCheck,
        diagnosis: undefined // Se actualizará cuando haya diagnóstico
      }, { transaction });

      const duration = Date.now() - startTime;
      
      logger.info(`Snapshot creado para bovino ${bovine.id}`, this.context, {
        bovineId: bovine.id,
        ranchId: bovine.ranchId,
        healthStatus: bovine.healthStatus,
        durationMs: duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error creando snapshot para bovino ${bovine.id}`, this.context, {
        bovineId: bovine.id,
        durationMs: duration
      }, ensureError(error));
      
      if (error instanceof BovineError) throw error;
      throw new BovineError(
        `Error al crear snapshot para bovino ${bovine.id}`,
        'SNAPSHOT_CREATE_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  /**
   * Actualiza un snapshot existente
   * 
   * ¿POR QUÉ SEPARADO DE createSnapshot?
   *   - createSnapshot: se llama UNA VEZ al crear el bovino
   *   - updateSnapshot: se llama MÚLTIPLES VECES cuando cambia:
   *     * Estado de salud
   *     * Ubicación
   *     * Diagnóstico
   *     * Último chequeo
   * 
   * @param bovineId - ID del bovino
   * @param data - Datos a actualizar (parcial)
   * @param transaction - Transacción activa (opcional)
   */
  async updateSnapshot(
    bovineId: string,
    data: SnapshotUpdateData,
    transaction?: Transaction
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Verificar que el snapshot existe
      const snapshot = await BovineHealthSnapshot.findOne({
        where: { bovineId },
        transaction
      });

      if (!snapshot) {
        // Si no existe, probablemente es un error de consistencia
        // Mejor crearlo que fallar
        logger.warn(`Snapshot no encontrado para bovino ${bovineId}, creando...`, this.context);
        
        const bovine = await Bovine.findByPk(bovineId, { transaction });
        if (bovine) {
          await this.createSnapshot(bovine, transaction);
        }
        return;
      }

      // Construir payload de actualización de forma explícita para evitar
      // que un healthColor pasado en data pise el que calculamos aquí
      const updateData: Partial<BovineHealthSnapshot['_attributes']> & Record<string, unknown> = {
        lastUpdate:  new Date(),
        ...(data.location        !== undefined && { location:       data.location }),
        ...(data.diagnosis       !== undefined && { diagnosis:      data.diagnosis }),
        ...(data.lastHealthCheck !== undefined && { lastHealthCheck: data.lastHealthCheck }),
      };

      // healthStatus y healthColor siempre van juntos para mantener consistencia
      if (data.healthStatus) {
        updateData.healthStatus = data.healthStatus;
        updateData.healthColor  = this.getHealthColor(data.healthStatus);
      }

      // Actualizar snapshot
      await snapshot.update(updateData, { transaction });

      const duration = Date.now() - startTime;
      
      logger.debug(`Snapshot actualizado para bovino ${bovineId}`, this.context, {
        bovineId,
        updatedFields: Object.keys(data),
        durationMs: duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error actualizando snapshot para bovino ${bovineId}`, this.context, {
        bovineId,
        data: Object.keys(data),
        durationMs: duration
      }, ensureError(error));
      
      throw new BovineError(
        `Error al actualizar snapshot para bovino ${bovineId}`,
        'SNAPSHOT_UPDATE_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  /**
   * Elimina un snapshot (cuando se elimina el bovino)
   * 
   * @param bovineId - ID del bovino
   * @param transaction - Transacción activa (opcional)
   */
  async deleteSnapshot(bovineId: string, transaction?: Transaction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const deleted = await BovineHealthSnapshot.destroy({
        where: { bovineId },
        transaction
      });

      const duration = Date.now() - startTime;
      
      if (deleted > 0) {
        logger.info(`Snapshot eliminado para bovino ${bovineId}`, this.context, {
          bovineId,
          durationMs: duration
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error eliminando snapshot para bovino ${bovineId}`, this.context, {
        bovineId,
        durationMs: duration
      }, ensureError(error));
      
      throw new BovineError(
        `Error al eliminar snapshot para bovino ${bovineId}`,
        'SNAPSHOT_DELETE_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  /**
   * Refresca todos los snapshots del sistema
   * 
   * ¿PARA QUÉ SIRVE?
   *   Tarea programada (cron job) que se ejecuta diariamente para:
   *   - Recalcular edades (cambian cada día)
   *   - Corregir inconsistencias
   *   - Actualizar colores si cambió la paleta
   * 
   * @returns Número de snapshots procesados y fallidos
   */
  async refreshAllSnapshots(): Promise<{ processed: number; failed: number }> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      // Obtener todos los bovinos activos
      const bovines = await Bovine.findAll({ 
        where: { isActive: true },
        attributes: ['id', 'ranchId', 'healthStatus', 'location', 'birthDate', 'breed', 'lastHealthCheck']
      });

      logger.info(`Iniciando refresco de ${bovines.length} snapshots`, this.context);

      // Procesar en lotes para no sobrecargar la BD
      const BATCH_SIZE = 100;
      for (let i = 0; i < bovines.length; i += BATCH_SIZE) {
        const batch = bovines.slice(i, i + BATCH_SIZE);
        
        // Procesar lote en paralelo
        const results = await Promise.allSettled(
          batch.map(bovine => this.refreshSingleSnapshot(bovine))
        );

        // Contar resultados
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            processed++;
          } else {
            failed++;
            logger.error('Error en refresco de snapshot', this.context, {
              reason: result.reason
            });
          }
        });

        // Log de progreso cada lote
        logger.info(`Progreso: ${processed + failed}/${bovines.length} snapshots`, this.context);
      }

      const duration = Date.now() - startTime;
      
      logger.info('Refresco de snapshots completado', this.context, {
        processed,
        failed,
        total: bovines.length,
        durationMs: duration
      });

      return { processed, failed };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error en refreshAllSnapshots', this.context, {
        processed,
        failed,
        durationMs: duration
      }, ensureError(error));
      
      throw new BovineError(
        'Error al refrescar snapshots',
        'SNAPSHOT_REFRESH_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  /**
   * Refresca un snapshot individual (helper para refreshAllSnapshots)
   */
  private async refreshSingleSnapshot(bovine: Bovine): Promise<void> {
    const ageInMonths = this.calculateAgeInMonths(bovine.birthDate);
    
    await BovineHealthSnapshot.upsert({
      bovineId: bovine.id,
      ranchId: bovine.ranchId!,
      healthStatus: bovine.healthStatus,
      location: bovine.location,
      lastUpdate: new Date(),
      healthColor: this.getHealthColor(bovine.healthStatus),
      clusterSize: 1, // Se recalculará después
      breed: bovine.breed,
      ageMonths: ageInMonths,
      lastHealthCheck: bovine.lastHealthCheck
    });
  }

  /**
   * Refresca snapshots de un rancho específico (operación optimizada)
   *
   * Usa un INSERT … ON CONFLICT … DO UPDATE nativo para actualizar toda la
   * tabla en una sola roundtrip a la BD en lugar de un loop en JS.
   *
   * @param ranchId - ID del rancho
   * @returns Número de snapshots insertados o actualizados
   */
  async refreshRanchSnapshots(ranchId: string): Promise<number> {
    const startTime = Date.now();

    try {
      // ── Por qué QueryTypes.SELECT y no BULKUPDATE ────────────────────────
      //
      // BULKUPDATE devuelve un entero (filas afectadas) como primer elemento
      // del destructuring. Eso descarta la cláusula RETURNING, haciendo
      // imposible saber cuántas filas se tocaron realmente.
      //
      // QueryTypes.SELECT trata el resultado como filas devueltas, lo que
      // funciona correctamente con RETURNING — obtenemos el array de bovine_id
      // y su longitud es el conteo real.
      const rows = await sequelize.query<{ bovine_id: string }>(`
        INSERT INTO bovine_health_snapshots (
          bovine_id,
          ranch_id,
          health_status,
          location,
          geom,
          last_update,
          health_color,
          cluster_size,
          breed,
          age_months
        )
        SELECT
          b.id,
          b.ranch_id,
          b.health_status,
          b.location,
          -- ── columna geom sincronizada en cada refresh ──────────────────
          -- Sin esto el índice GIST queda desactualizado respecto al JSONB
          ST_SetSRID(
            ST_MakePoint(
              (b.location->>'longitude')::float,
              (b.location->>'latitude')::float
            ),
            4326
          ),
          NOW(),
          CASE b.health_status
            WHEN 'HEALTHY'    THEN '#10b981'
            WHEN 'SICK'       THEN '#ef4444'
            WHEN 'RECOVERING' THEN '#f59e0b'
            WHEN 'QUARANTINE' THEN '#8b5cf6'
            ELSE '#6b7280'
          END,
          1,
          b.breed,
          EXTRACT(YEAR  FROM age(NOW(), b.birth_date)) * 12 +
          EXTRACT(MONTH FROM age(NOW(), b.birth_date))
        FROM bovines b
        WHERE b.ranch_id  = :ranchId
          AND b.is_active = true
          AND b.deleted_at IS NULL
        ON CONFLICT (bovine_id)
        DO UPDATE SET
          health_status = EXCLUDED.health_status,
          location      = EXCLUDED.location,
          geom          = EXCLUDED.geom,         -- ← sincronizar geom también
          last_update   = EXCLUDED.last_update,
          health_color  = EXCLUDED.health_color,
          age_months    = EXCLUDED.age_months,
          breed         = EXCLUDED.breed
        RETURNING bovine_id
      `, {
        replacements: { ranchId },
        type: QueryTypes.SELECT          // ← devuelve las filas del RETURNING
      });

      // rows es el array de { bovine_id } devuelto por RETURNING
      const updatedCount = rows.length;
      const duration = Date.now() - startTime;

      logger.info(`Snapshots del rancho ${ranchId} actualizados`, this.context, {
        ranchId,
        updatedCount,
        durationMs: duration
      });

      return updatedCount;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error actualizando snapshots del rancho ${ranchId}`, this.context, {
        ranchId,
        durationMs: duration
      }, ensureError(error));

      throw new BovineError(
        `Error al actualizar snapshots del rancho ${ranchId}`,
        'RANCH_SNAPSHOT_REFRESH_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  // ==========================================================================
  // CONSULTAS PARA MAPAS (LO QUE USA LEAFLET)
  // ==========================================================================

  /**
   * Obtiene datos para mapa de calor
   * 
   * 📍 PARA LEAFLET:
   *   Este método alimenta directamente L.heatLayer
   *   Cada punto tiene lat, lng y value (intensidad)
   * 
   * @param ranchId - ID del rancho
   * @param filters - Filtros opcionales
   * @returns Array de puntos para heatmap
   */
  async getHeatmapData(
    ranchId: string,
    filters?: HeatmapFilters
  ): Promise<HeatmapPoint[]> {
    const startTime = Date.now();
    
    try {
      // Construir where clause dinámico
      const whereClause: any = { ranchId };
      
      if (filters?.healthStatus?.length) {
        whereClause.healthStatus = { [Op.in]: filters.healthStatus };
      }

      if (filters?.breeds?.length) {
        whereClause.breed = { [Op.in]: filters.breeds };
      }

      if (filters?.ageRange) {
        whereClause.ageMonths = {
          [Op.between]: [filters.ageRange.min, filters.ageRange.max]
        };
      }

      // ── Filtro por enfermedad ────────────────────────────────────────────
      // `diagnosis` en el snapshot es un string con el nombre normalizado
      // del diagnóstico principal (copiado de Health.diagnosis.primaryDiagnosis
      // cuando se actualiza el snapshot).
      // Usamos Op.in para permitir seleccionar múltiples enfermedades a la vez,
      // ej: ["Mastitis", "Fiebre aftosa"] → bovinos con cualquiera de las dos.
      if (filters?.diseases?.length) {
        whereClause.diagnosis = { [Op.in]: filters.diseases };
      }

      // Consultar snapshots — incluimos geom para no parsear el JSONB
      const snapshots = await BovineHealthSnapshot.findAll({
        where: whereClause,
        attributes: [
          'bovineId',
          'location',     // mantenemos location para el mapping lat/lng
          'healthStatus',
          'healthColor',
          'breed',
          'ageMonths',
          'diagnosis'
        ]
      });

      // Transformar al formato que espera Leaflet
      const points = snapshots.map(s => ({
        id: s.bovineId,
        lat: s.location.latitude,
        lng: s.location.longitude,
        value: this.getHeatIntensity(s.healthStatus),
        color: s.healthColor,
        metadata: {
          healthStatus: s.healthStatus,
          breed: s.breed,
          age: s.ageMonths,
          diagnosis: s.diagnosis
        }
      }));

      const duration = Date.now() - startTime;
      
      logger.info(`Datos de heatmap obtenidos para rancho ${ranchId}`, this.context, {
        ranchId,
        pointCount: points.length,
        appliedFilters: {
          healthStatus: filters?.healthStatus ?? [],
          breeds:       filters?.breeds       ?? [],
          diseases:     filters?.diseases     ?? [],
          hasAgeRange:  !!filters?.ageRange
        },
        durationMs: duration
      });

      return points;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error obteniendo heatmap para rancho ${ranchId}`, this.context, {
        ranchId,
        filters,
        durationMs: duration
      }, ensureError(error));
      
      throw new BovineError(
        `Error al obtener datos de heatmap para rancho ${ranchId}`,
        'HEATMAP_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  /**
   * Obtiene clusters para agrupamiento en Leaflet
   * 
   * 📍 PARA LEAFLET:
   *   Este método implementa clustering del lado del servidor.
   *   Es más eficiente que enviar 10,000 puntos al cliente.
   * 
   * ¿CÓMO FUNCIONA?
   *   1. Filtramos por bounding box (solo puntos visibles)
   *   2. Agrupamos por grid según nivel de zoom
   *   3. Calculamos centro y límites de cada cluster
   *   4. Enviamos al cliente para que Leaflet los dibuje
   * 
   * @param ranchId - ID del rancho
   * @param bounds - Límites geográficos visibles
   * @param zoom - Nivel de zoom actual
   * @param filters - Filtros adicionales
   * @returns Array de clusters
   */
  async getClusters(
    ranchId: string,
    bounds: Bounds,
    zoom: number,
    filters?: HeatmapFilters
  ): Promise<Cluster[]> {
    const startTime = Date.now();
    
    try {
      // Calcular tamaño de grid según zoom
      const gridSize = this.calculateGridSize(zoom);
      
      /**
       * CONSULTA SQL EXPLICADA:
       * 
       * 1. CTE filtered_snapshots: Filtra por rancho y bounding box
       *    - Usa índices GIST para ser rápido
       *    - Convierte location JSON a geometría PostGIS
       * 
       * 2. CTE clustered: Agrupa por celda de grid
       *    - ST_SnapToGrid: Asigna cada punto a una celda
       *    - Agrega: count, healthStatuses, avgSeverity
       * 
       * 3. SELECT final: Calcula centro y bounds de cada celda
       *    - ST_Centroid: Centro del cluster
       *    - ST_Envelope: Límites del cluster
       */
      const clusters = await sequelize.query(`
        WITH filtered_snapshots AS (
          SELECT
            bovine_id,
            geom,          -- columna PostGIS nativa: usa el índice GIST directamente
            health_status
          FROM bovine_health_snapshots
          WHERE ranch_id = :ranchId
            AND geom && ST_MakeEnvelope(:west, :south, :east, :north, 4326)
            ${filters?.healthStatus ? 'AND health_status = ANY(:healthStatus)' : ''}
            ${filters?.diseases    ? 'AND diagnosis    = ANY(:diseases)'      : ''}
        ),
        clustered AS (
          SELECT
            ST_SnapToGrid(geom, :gridSize) AS cell,
            COUNT(*)                        AS point_count,
            array_agg(DISTINCT health_status) AS health_statuses,
            AVG(CASE
              WHEN health_status = 'HEALTHY'    THEN 1
              WHEN health_status = 'RECOVERING' THEN 2
              WHEN health_status = 'SICK'       THEN 3
              WHEN health_status = 'QUARANTINE' THEN 4
              ELSE 0
            END) AS avg_severity
          FROM filtered_snapshots
          GROUP BY cell
        )
        SELECT
          ST_X(ST_Centroid(cell))      AS lng,
          ST_Y(ST_Centroid(cell))      AS lat,
          point_count,
          health_statuses,
          avg_severity,
          ST_XMin(ST_Envelope(cell))   AS west,
          ST_XMax(ST_Envelope(cell))   AS east,
          ST_YMin(ST_Envelope(cell))   AS south,
          ST_YMax(ST_Envelope(cell))   AS north
        FROM clustered
        WHERE point_count > 0
      `, {
        replacements: {
          ranchId,
          ...bounds,
          gridSize,
          healthStatus: filters?.healthStatus ?? null,
          diseases:     filters?.diseases     ?? null
        },
        type: 'SELECT'
      });

      // Transformar resultados al formato Cluster
      const result = (clusters as any[]).map(c => ({
        id: `cluster-${c.lat}-${c.lng}`,
        center: { lat: c.lat, lng: c.lng },
        pointCount: c.point_count,
        bounds: {
          north: c.north,
          south: c.south,
          east: c.east,
          west: c.west
        },
        healthStatuses: c.health_statuses,
        avgSeverity: c.avg_severity
      }));

      const duration = Date.now() - startTime;
      
      logger.debug(`Clusters obtenidos para rancho ${ranchId}`, this.context, {
        ranchId,
        clusterCount: result.length,
        zoom,
        gridSize,
        durationMs: duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error obteniendo clusters para rancho ${ranchId}`, this.context, {
        ranchId,
        bounds,
        zoom,
        durationMs: duration
      }, ensureError(error));
      
      throw new BovineError(
        `Error al obtener clusters para rancho ${ranchId}`,
        'CLUSTER_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  /**
   * Expande un cluster en puntos individuales
   * 
   * 📍 PARA LEAFLET:
   *   Cuando el usuario hace zoom en un cluster, necesitamos
   *   los puntos individuales dentro de ese cluster.
   * 
   * @param ranchId - ID del rancho
   * @param bounds - Límites del cluster a expandir
   * @param filters - Filtros adicionales
   * @returns Puntos individuales dentro del área
   */
  async expandCluster(
    ranchId: string,
    bounds: Bounds,
    filters?: HeatmapFilters
  ): Promise<HeatmapPoint[]> {
    const startTime = Date.now();
    
    try {
      const points = await sequelize.query(`
        SELECT
          bovine_id,
          ST_Y(geom) AS lat,
          ST_X(geom) AS lng,
          health_status,
          health_color,
          breed,
          age_months,
          diagnosis
        FROM bovine_health_snapshots
        WHERE ranch_id = :ranchId
          AND geom && ST_MakeEnvelope(:west, :south, :east, :north, 4326)
          ${filters?.healthStatus ? 'AND health_status = ANY(:healthStatus)' : ''}
          ${filters?.diseases     ? 'AND diagnosis    = ANY(:diseases)'      : ''}
      `, {
        replacements: {
          ranchId,
          ...bounds,
          healthStatus: filters?.healthStatus ?? null,
          diseases:     filters?.diseases     ?? null
        },
        type: 'SELECT'
      });

      const result = (points as any[]).map(p => ({
        id: p.bovine_id,
        lat: p.lat,
        lng: p.lng,
        value: this.getHeatIntensity(p.health_status),
        color: p.health_color,
        metadata: {
          healthStatus: p.health_status,
          breed: p.breed,
          age: p.age_months,
          diagnosis: p.diagnosis
        }
      }));

      const duration = Date.now() - startTime;
      
      logger.debug(`Cluster expandido en rancho ${ranchId}`, this.context, {
        ranchId,
        pointCount: result.length,
        bounds,
        durationMs: duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error expandiendo cluster en rancho ${ranchId}`, this.context, {
        ranchId,
        bounds,
        durationMs: duration
      }, ensureError(error));
      
      throw new BovineError(
        `Error al expandir cluster en rancho ${ranchId}`,
        'CLUSTER_EXPAND_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  /**
   * Obtiene un punto específico de un bovino
   * 
   * 📍 PARA LEAFLET:
   *   Cuando el usuario hace clic en un bovino individual,
   *   necesitamos sus datos para mostrar el popup.
   * 
   * @param bovineId - ID del bovino
   * @returns Punto del bovino o null si no existe
   */
  /**
   * Obtiene el punto geográfico de un bovino y los datos estructurados
   * para que el frontend construya el popup sin generar HTML en el servidor.
   *
   * @param bovineId - ID del bovino
   * @returns { point, popup } o null si el bovino no tiene snapshot
   */
  async getBovinePoint(
    bovineId: string
  ): Promise<{ point: HeatmapPoint; popup: PopupData } | null> {
    const startTime = Date.now();

    try {
      const snapshot = await BovineHealthSnapshot.findOne({
        where: { bovineId },
        attributes: [
          'bovineId', 'location', 'healthStatus',
          'healthColor', 'breed', 'ageMonths', 'diagnosis'
        ]
      });

      if (!snapshot) {
        logger.debug(`Snapshot no encontrado para bovino ${bovineId}`, this.context);
        return null;
      }

      const STATUS_LABELS: Record<HealthStatus, string> = {
        [HealthStatus.HEALTHY]:    'Saludable',
        [HealthStatus.SICK]:       'Enfermo',
        [HealthStatus.RECOVERING]: 'Recuperándose',
        [HealthStatus.QUARANTINE]: 'Cuarentena',
        [HealthStatus.DECEASED]:   'Fallecido',
        [HealthStatus.UNKNOWN]:    'Desconocido'
      };

      const point: HeatmapPoint = {
        id:    snapshot.bovineId,
        lat:   snapshot.location.latitude,
        lng:   snapshot.location.longitude,
        value: this.getHeatIntensity(snapshot.healthStatus),
        color: snapshot.healthColor,
        metadata: {
          healthStatus: snapshot.healthStatus,
          breed:        snapshot.breed,
          age:          snapshot.ageMonths,
          diagnosis:    snapshot.diagnosis
        }
      };

      // Datos estructurados para el popup — el frontend los usa
      // para construir el HTML/JSX que prefiera, en el idioma que prefiera
      const popup: PopupData = {
        bovineId:     snapshot.bovineId,
        shortId:      snapshot.bovineId.slice(-6),
        healthStatus: snapshot.healthStatus,
        statusLabel:  STATUS_LABELS[snapshot.healthStatus] ?? snapshot.healthStatus,
        statusColor:  snapshot.healthColor,
        breed:        snapshot.breed,
        ageMonths:    snapshot.ageMonths,
        diagnosis:    snapshot.diagnosis,
        hasDiagnosis: !!snapshot.diagnosis
      };

      const duration = Date.now() - startTime;

      logger.debug(`Punto obtenido para bovino ${bovineId}`, this.context, {
        bovineId,
        durationMs: duration
      });

      return { point, popup };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error obteniendo punto para bovino ${bovineId}`, this.context, {
        bovineId,
        durationMs: duration
      }, ensureError(error));

      throw new BovineError(
        `Error al obtener punto para bovino ${bovineId}`,
        'POINT_GET_ERROR',
        500,
        ensureError(error)
      );
    }
  }

  // ==========================================================================
  // MÉTODOS DE UTILIDAD
  // ==========================================================================

  /**
   * Obtiene color según estado de salud
   * 
   * 🎨 PARA LEAFLET:
   *   Los puntos individuales usan estos colores
   */
  private getHealthColor(status: HealthStatus): string {
    return HEALTH_COLORS[status] || HEALTH_COLORS[HealthStatus.DECEASED];
  }

  /**
   * Obtiene intensidad para heatmap
   * 
   * 🔥 PARA LEAFLET:
   *   El heatmap usa estos valores para el gradiente
   */
  private getHeatIntensity(status: HealthStatus): number {
    return HEAT_INTENSITY[status] || HEAT_INTENSITY[HealthStatus.HEALTHY];
  }

  /**
   * Calcula tamaño de grid según nivel de zoom
   * 
   * 📏 FÓRMULA:
   *   A menor zoom, mayor grid size (agrupamiento más agresivo)
   *   A mayor zoom, menor grid size (puntos más precisos)
   * 
   * @param zoom - Nivel de zoom de Leaflet (0-20)
   * @returns Tamaño de grid en grados
   */
  private calculateGridSize(zoom: number): number {
    if (zoom < 8) return GRID_SIZES.ZOOM_8;
    if (zoom < 10) return GRID_SIZES.ZOOM_10;
    if (zoom < 12) return GRID_SIZES.ZOOM_12;
    if (zoom < 14) return GRID_SIZES.ZOOM_14;
    if (zoom < 16) return GRID_SIZES.ZOOM_16;
    return GRID_SIZES.ZOOM_16; // Para zooms muy altos, grid mínimo
  }

  /**
   * Calcula edad en meses
   * 
   * @param birthDate - Fecha de nacimiento
   * @returns Edad en meses
   */
  private calculateAgeInMonths(birthDate: Date): number {
    const now = new Date();
    const birth = new Date(birthDate);
    const diffTime = Math.abs(now.getTime() - birth.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
  }

  /**
   * Genera HTML para popup de Leaflet
   *
   * @deprecated Usar `getBovinePoint()` y construir el popup en el frontend.
   *   El backend no debe generar HTML — si cambias el idioma, el framework
   *   de UI o el proveedor de mapas, este método rompe sin ninguna señal.
   *   Mantenido temporalmente para no romper clientes existentes.
   *   Se eliminará en la próxima versión mayor.
   */
  generatePopupHTML(point: HeatmapPoint): string {
    const statusLabels: Record<HealthStatus, string> = {
      [HealthStatus.HEALTHY]:    'Saludable',
      [HealthStatus.SICK]:       'Enfermo',
      [HealthStatus.RECOVERING]: 'Recuperándose',
      [HealthStatus.QUARANTINE]: 'Cuarentena',
      [HealthStatus.DECEASED]:   'Fallecido',
      [HealthStatus.UNKNOWN]:    'Desconocido'
    };

    const label = statusLabels[point.metadata.healthStatus] ?? point.metadata.healthStatus;

    return `
      <div class="bovine-popup" style="font-family: Arial, sans-serif; padding: 8px;">
        <h3 style="margin: 0 0 8px 0; color: #333;">Bovino ${point.id.slice(-6)}</h3>
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <div style="width:12px;height:12px;border-radius:50%;background:${point.color};margin-right:8px;"></div>
          <strong>Estado:</strong> ${label}
        </div>
        ${point.metadata.breed    ? `<p style="margin:5px 0;"><strong>Raza:</strong> ${point.metadata.breed}</p>` : ''}
        ${point.metadata.age      ? `<p style="margin:5px 0;"><strong>Edad:</strong> ${point.metadata.age} meses</p>` : ''}
        ${point.metadata.diagnosis ? `
          <div style="margin-top:8px;padding:5px;background:#fff3cd;border-radius:4px;">
            <strong style="color:#856404;">Diagnóstico:</strong>
            <p style="margin:5px 0 0 0;color:#856404;">${point.metadata.diagnosis}</p>
          </div>` : ''}
        <button
          onclick="window.dispatchEvent(new CustomEvent('bovine-selected',{detail:'${point.id}'}))"
          style="margin-top:10px;width:100%;padding:5px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;">
          Ver detalles
        </button>
      </div>
    `.trim();
  }
}

// Exportar instancia única
export const bovineGeoService = new BovineGeoService();