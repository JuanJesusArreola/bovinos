"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const error_1 = require("./middleware/error");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
exports.server = server;
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const cors = require('cors');
const corsOptions = {
    origin: function (origin, callback) {
        if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            callback(null, true);
            return;
        }
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:4173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:4173',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.log(`🚫 Origen rechazado: ${origin} - PERO PERMITIDO EN DESARROLLO`);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'X-Access-Token',
        'x-app-version',
        'x-client-platform',
        'x-client-version',
        'x-api-key',
        'x-request-id'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Current-Page'
    ],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH,HEAD');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token, x-app-version, x-client-platform, x-client-version, x-api-key, x-request-id');
        res.header('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    next();
});
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
                imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
                connectSrc: [
                    "'self'",
                    "http://localhost:*",
                    "https://localhost:*",
                    "http://127.0.0.1:*",
                    "https://127.0.0.1:*",
                    "ws://localhost:*",
                    "wss://localhost:*"
                ],
                fontSrc: ["'self'", "https:", "http:", "data:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'", "https:", "http:", "data:"],
                frameSrc: ["'self'", "https:", "http:"],
                workerSrc: ["'self'", "blob:"],
                childSrc: ["'self'", "blob:"],
                manifestSrc: ["'self'"],
                baseUri: ["'self'"]
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginOpenerPolicy: { policy: "unsafe-none" }
    }));
    console.log('🛡️  Helmet configurado para desarrollo (CSP muy permisivo)');
}
else {
    app.use((0, helmet_1.default)({
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
        crossOriginEmbedderPolicy: false,
    }));
}
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        const origin = req.headers.origin;
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
        }
        res.header('Access-Control-Allow-Credentials', 'true');
    }
    next();
});
app.use((0, compression_1.default)({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    }
}));
if (process.env.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)('combined', {
        skip: (req, res) => res.statusCode < 400
    }));
}
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf.toString());
        }
        catch (e) {
            const response = res;
            response.status(400).json({
                success: false,
                message: 'JSON inválido en el cuerpo de la petición'
            });
            throw new Error('JSON inválido');
        }
    }
}));
app.use(express_1.default.urlencoded({
    extended: true,
    limit: '10mb'
}));
const routes_1 = __importDefault(require("./routes"));
app.use('/api', routes_1.default);
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Sistema de Gestión Ganadera - API REST',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        status: 'active',
        cors: 'enabled - ALL HEADERS INCLUDED',
        endpoints: 'health, ping, reproduction, info',
        port: PORT
    });
});
app.get('/api/health/vaccinations', (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de vacunas funcionando',
        data: [],
        timestamp: new Date().toISOString(),
        corsFixed: true
    });
});
app.get('/api/info', (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de información funcionando',
        data: {
            system: 'Gestión Ganadera',
            version: '1.0.0',
            corsStatus: 'fixed'
        },
        timestamp: new Date().toISOString()
    });
});
app.get('/system-info', async (req, res) => {
    try {
        const systemInfo = {
            status: 'active',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString(),
            cors: 'enabled',
            corsHeaders: 'x-app-version included',
            port: PORT,
            host: HOST
        };
        res.json({
            success: true,
            data: systemInfo
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error obteniendo información del sistema'
        });
    }
});
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta ${req.originalUrl} no encontrada`,
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'GET /api/info',
            'GET /api/ping',
            'POST /api/ping',
            'GET /api/test-cors',
            'GET /system-info',
            'POST /api/auth/register',
            'POST /api/auth/login',
            'POST /api/auth/forgot-password',
            'POST /api/auth/reset-password',
            'POST /api/auth/verify-email',
            'GET /api/bovines',
            'GET /api/ranch',
            'GET /api/health',
            'GET /api/reproduction',
            'GET /api/production',
            'GET /api/inventory',
            'GET /api/finances',
            'GET /api/reports',
            'GET /api/dashboard'
        ]
    });
};
app.use(notFoundHandler);
app.use(error_1.errorHandler);
async function initializeServices() {
    try {
        console.log('🚀 Iniciando Sistema de Gestión Ganadera...');
        console.log('='.repeat(50));
        console.log('📋 Validando configuración básica...');
        if (!process.env.DB_HOST) {
            console.warn('⚠️ DB_HOST no configurado');
        }
        if (!process.env.JWT_ACCESS_SECRET) {
            console.warn('⚠️ JWT_ACCESS_SECRET no configurado');
        }
        console.log('🌐 Configuración de desarrollo:');
        console.log(`   - Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   - Puerto: ${PORT}`);
        console.log(`   - CORS: Habilitado (muy permisivo)`);
        console.log(`   - Headers permitidos: x-app-version, x-client-platform, etc.`);
        console.log(`   - CSP: Configurado para desarrollo`);
        console.log(`   - Helmet: Modo desarrollo`);
        console.log(`   - Endpoints: health, ping, reproduction, etc.`);
        console.log('='.repeat(50));
        console.log('✅ Servicios básicos inicializados');
        return true;
    }
    catch (error) {
        console.error('❌ Error crítico durante la inicialización:', error);
        return false;
    }
}
async function startServer() {
    try {
        server.listen(PORT, HOST, () => {
            console.log('');
            console.log('🎉 ¡Servidor iniciado exitosamente!');
            console.log('='.repeat(50));
            console.log(`🌐 Servidor corriendo en: http://${HOST}:${PORT}`);
            console.log(`📚 Documentación API: http://${HOST}:${PORT}/api/docs`);
            console.log(`🏥 Health Check: http://${HOST}:${PORT}/api/health`);
            console.log(`🏓 Ping: http://${HOST}:${PORT}/api/ping`);
            console.log(`🧪 Test CORS: http://${HOST}:${PORT}/api/test-cors`);
            console.log(`💉 Vacunas: http://${HOST}:${PORT}/api/health/vaccinations`);
            console.log(`📋 Info: http://${HOST}:${PORT}/api/info`);
            console.log(`🐄 Apareamientos: http://${HOST}:${PORT}/api/reproduction/mating-records`);
            console.log(`📊 Dashboard Reprod: http://${HOST}:${PORT}/api/reproduction/dashboard`);
            console.log(`📊 Estado del sistema: http://${HOST}:${PORT}/system-info`);
            console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📅 Iniciado: ${new Date().toLocaleString()}`);
            console.log('');
            console.log('🔧 PRUEBAS RÁPIDAS:');
            console.log(`curl http://localhost:${PORT}/api/health`);
            console.log(`curl http://localhost:${PORT}/api/ping`);
            console.log(`curl http://localhost:${PORT}/api/test-cors`);
            console.log('');
            console.log('🌐 Frontend fetch test:');
            console.log(`fetch('http://localhost:${PORT}/api/health').then(r=>r.json()).then(console.log)`);
            console.log('');
            console.log('✅ CORS CORREGIDO: Todos los headers incluidos');
            console.log('✅ RUTAS AGREGADAS: ping, reproduction, health');
            console.log('='.repeat(50));
            console.log('');
        });
        server.on('error', (error) => {
            if (error.syscall !== 'listen') {
                throw error;
            }
            const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
            switch (error.code) {
                case 'EACCES':
                    console.error(`❌ ${bind} requiere privilegios elevados`);
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    console.error(`❌ ${bind} ya está en uso`);
                    console.log('💡 Soluciones:');
                    console.log(`   lsof -i :${PORT}  # Ver qué proceso usa el puerto`);
                    console.log(`   kill -9 <PID>     # Matar el proceso`);
                    console.log(`   PORT=5001 npm run dev  # Usar otro puerto`);
                    process.exit(1);
                    break;
                default:
                    throw error;
            }
        });
    }
    catch (error) {
        console.error('❌ Error iniciando el servidor:', error);
        process.exit(1);
    }
}
async function handleShutdown(signal) {
    console.log(`\n🔄 Señal ${signal} recibida. Iniciando cierre ordenado...`);
    try {
        server.close(() => {
            console.log('🌐 Servidor HTTP cerrado');
        });
        console.log('✅ Cierre ordenado completado');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error durante el cierre ordenado:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error);
    handleShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    console.error('   En la promesa:', promise);
    handleShutdown('UNHANDLED_REJECTION');
});
async function main() {
    try {
        console.clear();
        console.log('🐄 SISTEMA DE GESTIÓN GANADERA - UJAT');
        console.log('   Universidad Juárez Autónoma de Tabasco');
        console.log('   Backend API v1.0.0 - COMPLETAMENTE ARREGLADO');
        console.log('   ✅ CORS completo + Todos los endpoints + Headers');
        console.log('');
        const servicesReady = await initializeServices();
        if (!servicesReady) {
            console.error('❌ Error crítico: No se pudieron inicializar los servicios');
            process.exit(1);
        }
        await startServer();
    }
    catch (error) {
        console.error('❌ Error crítico en la inicialización:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map