"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withLogging = exports.createLoggingMiddleware = exports.createLogger = exports.Logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const environments_1 = require("../config/environments");
class Logger {
    constructor(config) {
        this.currentFileSize = 0;
        const envConfig = (0, environments_1.getEnvironmentConfig)();
        this.config = {
            level: config?.level || envConfig.logging.level,
            enableConsole: config?.enableConsole ?? envConfig.logging.enableConsole,
            enableFile: config?.enableFile ?? envConfig.logging.enableFile,
            filePath: config?.filePath || envConfig.logging.filePath,
            maxFileSize: config?.maxFileSize || 10 * 1024 * 1024,
            maxFiles: config?.maxFiles || 5
        };
        if (this.config.enableFile && this.config.filePath) {
            this.setupLogFile();
        }
    }
    setupLogFile() {
        if (!this.config.filePath)
            return;
        const logDir = path_1.default.dirname(this.config.filePath);
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
        }
        this.logFilePath = this.config.filePath;
        this.currentFileSize = fs_1.default.existsSync(this.logFilePath) ? fs_1.default.statSync(this.logFilePath).size : 0;
    }
    shouldLog(level) {
        const levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        return levels[level] <= levels[this.config.level];
    }
    formatMessage(entry) {
        const timestamp = entry.timestamp;
        const level = entry.level.toUpperCase().padEnd(5);
        const context = entry.context ? `[${entry.context}]` : '';
        const message = entry.message;
        const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
        const stack = entry.stack ? `\n${entry.stack}` : '';
        return `${timestamp} ${level} ${context} ${message}${metadata}${stack}`;
    }
    writeToFile(formattedMessage) {
        if (!this.logFilePath || !this.config.enableFile)
            return;
        try {
            if (this.currentFileSize > this.config.maxFileSize) {
                this.rotateLogFile();
            }
            fs_1.default.appendFileSync(this.logFilePath, formattedMessage + '\n');
            this.currentFileSize += Buffer.byteLength(formattedMessage + '\n');
        }
        catch (error) {
            console.error('Error escribiendo al archivo de log:', error);
        }
    }
    rotateLogFile() {
        if (!this.logFilePath)
            return;
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backupPath = `${this.logFilePath}.${timestamp}`;
            fs_1.default.renameSync(this.logFilePath, backupPath);
            fs_1.default.writeFileSync(this.logFilePath, '');
            this.currentFileSize = 0;
            this.cleanOldLogFiles();
            console.log(`Log rotado: ${path_1.default.basename(backupPath)}`);
        }
        catch (error) {
            console.error('Error rotando archivo de log:', error);
        }
    }
    cleanOldLogFiles() {
        if (!this.logFilePath)
            return;
        try {
            const logDir = path_1.default.dirname(this.logFilePath);
            const logBaseName = path_1.default.basename(this.logFilePath);
            const files = fs_1.default.readdirSync(logDir)
                .filter(file => file.startsWith(logBaseName) && file !== logBaseName)
                .map(file => ({
                name: file,
                path: path_1.default.join(logDir, file),
                stats: fs_1.default.statSync(path_1.default.join(logDir, file))
            }))
                .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
            const filesToDelete = files.slice(this.config.maxFiles - 1);
            for (const file of filesToDelete) {
                fs_1.default.unlinkSync(file.path);
                console.log(`Archivo de log eliminado: ${file.name}`);
            }
        }
        catch (error) {
            console.error('Error limpiando archivos de log antiguos:', error);
        }
    }
    log(level, message, context, metadata, error) {
        if (!this.shouldLog(level))
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            metadata,
            stack: error?.stack
        };
        const formattedMessage = this.formatMessage(entry);
        if (this.config.enableConsole) {
            const consoleMethod = level === 'error' ? console.error :
                level === 'warn' ? console.warn :
                    level === 'info' ? console.info :
                        console.log;
            consoleMethod(formattedMessage);
        }
        this.writeToFile(formattedMessage);
    }
    error(message, context, metadata, error) {
        this.log('error', message, context, metadata, error);
    }
    warn(message, context, metadata) {
        this.log('warn', message, context, metadata);
    }
    info(message, context, metadata) {
        this.log('info', message, context, metadata);
    }
    debug(message, context, metadata) {
        this.log('debug', message, context, metadata);
    }
    start(operation, context, metadata) {
        this.info(`Iniciando: ${operation}`, context, metadata);
    }
    end(operation, context, metadata) {
        this.info(`Completado: ${operation}`, context, metadata);
    }
    fail(operation, error, context, metadata) {
        this.error(`Falló: ${operation}`, context, metadata, error);
    }
    progress(operation, current, total, context) {
        const percentage = Math.round((current / total) * 100);
        this.info(`Progreso: ${operation} (${current}/${total} - ${percentage}%)`, context);
    }
    metrics(operation, metrics, context) {
        this.info(`Métricas: ${operation}`, context, metrics);
    }
    security(event, context, metadata) {
        this.warn(`Seguridad: ${event}`, context, metadata);
    }
    database(operation, context, metadata) {
        this.debug(`Base de datos: ${operation}`, context, metadata);
    }
    api(method, endpoint, statusCode, duration, context) {
        const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
        this.log(level, `API: ${method} ${endpoint} - ${statusCode} (${duration}ms)`, context);
    }
    auth(event, context, metadata) {
        this.info(`Autenticación: ${event}`, context, metadata);
    }
    validation(operation, errors, context) {
        this.warn(`Validación: ${operation}`, context, { errors });
    }
    getStats() {
        const stats = {
            logFileExists: false,
            logFileSize: 0,
            logFileAge: undefined
        };
        if (this.logFilePath && fs_1.default.existsSync(this.logFilePath)) {
            const fileStats = fs_1.default.statSync(this.logFilePath);
            stats.logFileExists = true;
            stats.logFileSize = fileStats.size;
            stats.logFileAge = Date.now() - fileStats.mtime.getTime();
        }
        return stats;
    }
    clearLogFile() {
        if (this.logFilePath && fs_1.default.existsSync(this.logFilePath)) {
            fs_1.default.writeFileSync(this.logFilePath, '');
            this.currentFileSize = 0;
            console.log('🧹 Archivo de log limpiado');
        }
    }
}
exports.Logger = Logger;
const logger = new Logger();
exports.default = logger;
function createLogger(config) {
    return new Logger(config);
}
exports.createLogger = createLogger;
function createLoggingMiddleware() {
    return (req, res, next) => {
        const startTime = Date.now();
        logger.info(`Request: ${req.method} ${req.path}`, 'HTTP', {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            query: req.query,
            body: req.method !== 'GET' ? req.body : undefined
        });
        const originalSend = res.send;
        res.send = function (data) {
            const duration = Date.now() - startTime;
            logger.api(req.method, req.path, res.statusCode, duration, 'HTTP');
            return originalSend.call(this, data);
        };
        next();
    };
}
exports.createLoggingMiddleware = createLoggingMiddleware;
function withLogging(fn, operationName, context) {
    return async (...args) => {
        logger.start(operationName, context);
        try {
            const result = await fn(...args);
            logger.end(operationName, context);
            return result;
        }
        catch (error) {
            logger.fail(operationName, error, context);
            throw error;
        }
    };
}
exports.withLogging = withLogging;
//# sourceMappingURL=logger.js.map