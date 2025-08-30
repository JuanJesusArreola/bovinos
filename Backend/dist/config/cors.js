"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorsMiddleware = void 0;
let cors;
try {
    cors = require('cors');
}
catch (error) {
    console.warn('⚠️  Dependencia CORS no instalada. Ejecuta: npm install cors');
}
const corsOptions = {
    origin: function (origin, callback) {
        if (process.env.NODE_ENV === 'development') {
            callback(null, true);
            return;
        }
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://localhost:4173',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.log('🚫 Origen bloqueado:', origin);
            callback(null, true);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Access-Token',
        'X-Key',
        'X-Ranch-ID',
        'X-User-Role',
        'X-Device-ID',
        'X-App-Version',
        'X-Platform'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Current-Page',
        'X-Rate-Limit',
        'X-Rate-Remaining'
    ],
    credentials: true,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 200
};
const getCorsMiddleware = () => {
    if (!cors) {
        return (req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Credentials', 'true');
            if (req.method === 'OPTIONS') {
                res.status(200).end();
                return;
            }
            next();
        };
    }
    return cors(corsOptions);
};
exports.getCorsMiddleware = getCorsMiddleware;
exports.default = corsOptions;
//# sourceMappingURL=cors.js.map