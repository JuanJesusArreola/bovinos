"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = require("./config/cors");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.getCorsMiddleware)());
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (process.env.NODE_ENV === 'development') {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH,HEAD');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
        res.header('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    next();
});
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV === 'development') {
    console.log('⚠️  Helmet desactivado en desarrollo');
}
else {
    const helmet = require('helmet');
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));
}
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Backend funcionando correctamente',
        timestamp: new Date().toISOString(),
        cors: 'enabled',
        environment: process.env.NODE_ENV || 'development'
    });
});
app.get('/api/test-db', async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Endpoint de prueba disponible',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error en prueba de BD',
            error: error.message
        });
    }
});
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta ${req.originalUrl} no encontrada`,
        availableRoutes: ['/api/health', '/api/test-db']
    });
});
app.listen(PORT, () => {
    console.log('');
    console.log('🎉 ¡Servidor iniciado con CORS arreglado!');
    console.log('=====================================');
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`💓 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔧 Test DB: http://localhost:${PORT}/api/test-db`);
    console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log('✅ CORS: Completamente permisivo');
    console.log('✅ CSP: Desactivado');
    console.log('');
});
exports.default = app;
//# sourceMappingURL=temp-express-fixed.js.map