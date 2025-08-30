"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../middleware/auth");
const logging_1 = require("../middleware/logging");
const auth_2 = __importDefault(require("./auth"));
const bovines_1 = __importDefault(require("./bovines"));
const feeding_1 = __importDefault(require("./feeding"));
const health_1 = __importDefault(require("./health"));
const reproduction_1 = __importDefault(require("./reproduction"));
const production_1 = __importDefault(require("./production"));
const maps_1 = __importDefault(require("./maps"));
const events_1 = __importDefault(require("./events"));
const calendar_1 = __importDefault(require("./calendar"));
const inventory_1 = __importDefault(require("./inventory"));
const finances_1 = __importDefault(require("./finances"));
const reports_1 = __importDefault(require("./reports"));
const ranch_1 = __importDefault(require("./ranch"));
const dashboard_1 = __importDefault(require("./dashboard"));
const upload_1 = __importDefault(require("./upload"));
const router = (0, express_1.Router)();
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin)
            return callback(null, true);
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'https://ganado-app.com',
            'https://www.ganado-app.com',
            'https://app.ganado-ujat.edu.mx',
        ];
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.warn(`⚠️ CORS: Origen no permitido: ${origin}`);
            callback(new Error('No permitido por CORS'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-API-Key',
        'X-Client-Version',
        'X-Ranch-ID'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page',
        'X-Per-Page',
        'X-Rate-Limit-Remaining',
        'Content-Disposition'
    ],
    maxAge: 86400
};
router.use((0, cors_1.default)(corsOptions));
router.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));
router.use((0, compression_1.default)({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
    level: 6,
    threshold: 1024
}));
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        error: 'Demasiadas solicitudes desde esta IP',
        message: 'Por favor intente nuevamente en 15 minutos',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`🚫 Rate limit excedido para IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Demasiadas solicitudes. Intente nuevamente más tarde.',
            retryAfter: Math.ceil(15 * 60)
        });
    }
});
const strictLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: {
        error: 'Límite de operaciones críticas excedido',
        message: 'Por favor intente nuevamente en 1 hora',
        retryAfter: 60 * 60
    }
});
router.use(generalLimiter);
router.use(logging_1.requestLogger);
router.use((req, res, next) => {
    req.startTime = Date.now();
    req.requestId = require('crypto').randomUUID();
    req.clientInfo = {
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'Unknown',
        version: req.get('X-Client-Version') || '1.0.0',
        platform: req.get('X-Client-Platform') || 'Unknown'
    };
    next();
});
router.use((req, res, next) => {
    res.setHeader('X-API-Version', '1.0.0');
    res.setHeader('X-API-Server', 'Cattle Management System');
    next();
});
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    });
});
router.get('/status', async (req, res) => {
    const startTime = Date.now();
    try {
        const dbStatus = await checkDatabaseConnection();
        const diskStatus = await checkDiskSpace();
        const memoryStatus = checkMemoryUsage();
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            responseTime: Date.now() - startTime
        };
        const status = {
            status: 'healthy',
            version: '1.0.0',
            services: {
                database: dbStatus,
                storage: diskStatus,
                memory: memoryStatus
            },
            system: systemInfo
        };
        res.json({
            success: true,
            data: status,
            message: 'Sistema operando correctamente'
        });
    }
    catch (error) {
        console.error('❌ Error verificando estado del sistema:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: 'Error verificando estado del sistema',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/info', (req, res) => {
    res.json({
        success: true,
        data: {
            name: 'API de Gestión Ganadera con Geolocalización',
            version: '1.0.0',
            description: 'Sistema integral para gestión de ganado bovino con funcionalidades de geolocalización, salud veterinaria, reproducción y producción',
            institution: 'Universidad Juárez Autónoma de Tabasco (UJAT)',
            developer: 'División Académica de Ciencias Biológicas',
            documentation: '/api/docs',
            endpoints: {
                bovines: '/api/bovines/*',
                feeding: '/api/feeding/*',
                health: '/api/health/*',
                reproduction: '/api/reproduction/*',
                production: '/api/production/*',
                maps: '/api/maps/*',
                events: '/api/events/*',
                calendar: '/api/calendar/*',
                inventory: '/api/inventory/*',
                finances: '/api/finances/*',
                reports: '/api/reports/*',
                ranch: '/api/ranch/*',
                dashboard: '/api/dashboard/*',
                upload: '/api/upload/*'
            },
            features: [
                'Gestión integral de ganado bovino',
                'Control de alimentación y nutrición',
                'Geolocalización en tiempo real',
                'Control sanitario y veterinario',
                'Seguimiento reproductivo',
                'Análisis de producción',
                'Inventario de medicamentos',
                'Reportes especializados',
                'Sistema de alertas',
                'Gestión documental',
                'Análisis financiero'
            ],
            support: {
                email: 'soporte@ganado-ujat.edu.mx',
                documentation: 'https://docs.ganado-ujat.edu.mx',
                issues: 'https://github.com/ujat/ganado-api/issues'
            }
        }
    });
});
router.use('/auth', auth_2.default);
router.use('/bovines', bovines_1.default);
router.use('/feeding', feeding_1.default);
router.use('/health', health_1.default);
router.use('/reproduction', reproduction_1.default);
router.use('/production', production_1.default);
router.use('/maps', maps_1.default);
router.use('/events', events_1.default);
router.use('/calendar', calendar_1.default);
router.use('/inventory', inventory_1.default);
router.use('/finances', finances_1.default);
router.use('/reports', reports_1.default);
router.use('/ranch', ranch_1.default);
router.use('/dashboard', dashboard_1.default);
router.use('/upload', upload_1.default);
router.get('/ping', (req, res) => {
    res.json({
        success: true,
        message: 'pong',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    });
});
router.get('/time', (req, res) => {
    const now = new Date();
    res.json({
        success: true,
        data: {
            timestamp: now.toISOString(),
            unix: Math.floor(now.getTime() / 1000),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: 'es-MX'
        }
    });
});
router.post('/echo', (req, res) => {
    res.json({
        success: true,
        echo: {
            method: req.method,
            path: req.path,
            headers: req.headers,
            body: req.body,
            query: req.query,
            params: req.params,
            requestId: req.requestId,
            timestamp: new Date().toISOString()
        }
    });
});
router.get('/docs', (req, res) => {
    res.json({
        success: true,
        message: 'Documentación de API disponible',
        documentation: {
            swagger: '/api/docs/swagger',
            postman: '/api/docs/postman',
            openapi: '/api/docs/openapi.json'
        },
        sections: {
            bovines: 'Gestión de ganado bovino',
            feeding: 'Sistema de alimentación y nutrición',
            health: 'Salud veterinaria y tratamientos',
            reproduction: 'Manejo reproductivo',
            production: 'Control de producción',
            maps: 'Geolocalización y mapas',
            inventory: 'Inventario de medicamentos',
            reports: 'Reportes y análisis',
            ranch: 'Gestión del rancho',
            upload: 'Gestión de archivos'
        }
    });
});
router.get('/endpoints', auth_1.authenticateToken, (req, res) => {
    const endpoints = [
        { method: 'GET', path: '/api/bovines', description: 'Listar ganado' },
        { method: 'POST', path: '/api/bovines', description: 'Registrar nuevo bovino' },
        { method: 'GET', path: '/api/bovines/:id', description: 'Obtener bovino específico' },
        { method: 'PUT', path: '/api/bovines/:id', description: 'Actualizar bovino' },
        { method: 'DELETE', path: '/api/bovines/:id', description: 'Eliminar bovino' },
        { method: 'GET', path: '/api/feeding/records', description: 'Registros de alimentación' },
        { method: 'POST', path: '/api/feeding/records', description: 'Nuevo registro de alimentación' },
        { method: 'GET', path: '/api/feeding/plans', description: 'Planes nutricionales' },
        { method: 'POST', path: '/api/feeding/plans', description: 'Crear plan nutricional' },
        { method: 'GET', path: '/api/feeding/schedule', description: 'Horarios de alimentación' },
        { method: 'GET', path: '/api/feeding/inventory', description: 'Inventario de alimentos' },
        { method: 'GET', path: '/api/feeding/statistics', description: 'Estadísticas de alimentación' },
        { method: 'GET', path: '/api/health', description: 'Estado del sistema' },
        { method: 'GET', path: '/api/status', description: 'Estado detallado del sistema' },
        { method: 'GET', path: '/api/info', description: 'Información de la API' },
        { method: 'GET', path: '/api/ping', description: 'Test de conectividad' },
        { method: 'GET', path: '/api/time', description: 'Sincronización de tiempo' },
        { method: 'POST', path: '/api/echo', description: 'Hecho para pruebas' }
    ];
    res.json({
        success: true,
        data: {
            total: endpoints.length,
            endpoints
        },
        message: 'Lista de endpoints disponibles'
    });
});
router.use('*', (req, res) => {
    console.warn(`⚠️ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: 'ROUTE_NOT_FOUND',
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
        suggestion: 'Verifique la URL y el método HTTP. Consulte /api/docs para endpoints disponibles.',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    });
});
router.use((error, req, res, next) => {
    console.error('🚨 Error global:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
    });
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Error de validación',
            details: error.details || error.message,
            timestamp: new Date().toISOString()
        });
    }
    if (error.statusCode === 401) {
        return res.status(401).json({
            success: false,
            error: 'AUTHENTICATION_ERROR',
            message: error.message || 'Error de autenticación',
            timestamp: new Date().toISOString()
        });
    }
    if (error.statusCode === 403) {
        return res.status(403).json({
            success: false,
            error: 'AUTHORIZATION_ERROR',
            message: error.message || 'Sin permisos para realizar esta acción',
            timestamp: new Date().toISOString()
        });
    }
    res.status(error.statusCode || 500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    });
});
async function checkDatabaseConnection() {
    const startTime = Date.now();
    try {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
            status: 'connected',
            responseTime: Date.now() - startTime
        };
    }
    catch (error) {
        return {
            status: 'disconnected',
            responseTime: Date.now() - startTime
        };
    }
}
async function checkDiskSpace() {
    try {
        const fs = require('fs');
        return {
            status: 'ok',
            available: '10 GB',
            used: '2 GB'
        };
    }
    catch (error) {
        return {
            status: 'error',
            available: 'N/A',
            used: 'N/A'
        };
    }
}
function checkMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        status: usage.rss < 512 * 1024 * 1024 ? 'ok' : 'high',
        rss: formatBytes(usage.rss),
        heapUsed: formatBytes(usage.heapUsed),
        heapTotal: formatBytes(usage.heapTotal)
    };
}
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
exports.default = router;
//# sourceMappingURL=index.js.map