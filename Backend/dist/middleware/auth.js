"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUserActivity = exports.verifyToken = exports.generateToken = exports.checkApiLimits = exports.optionalAuth = exports.requireActiveSubscription = exports.checkResourceOwnership = exports.checkPermission = exports.authorizeRoles = exports.authenticateToken = exports.mockUserDatabase = exports.ApiError = exports.UserRole = void 0;
const jwt = __importStar(require("jsonwebtoken"));
var UserRole;
(function (UserRole) {
    UserRole["OWNER"] = "owner";
    UserRole["ADMIN"] = "admin";
    UserRole["MANAGER"] = "manager";
    UserRole["VETERINARIAN"] = "veterinarian";
    UserRole["WORKER"] = "worker";
    UserRole["VIEWER"] = "viewer";
})(UserRole || (exports.UserRole = UserRole = {}));
class ApiError extends Error {
    constructor(statusCode, message, code = 'GENERAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-cattle-management';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
exports.mockUserDatabase = {};
const findUserById = async (userId) => {
    return exports.mockUserDatabase[userId] || null;
};
const updateUserActivity = async (userId) => {
    if (exports.mockUserDatabase[userId]) {
        exports.mockUserDatabase[userId].lastLoginAt = new Date();
    }
};
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            throw new ApiError(401, 'Token de acceso requerido', 'MISSING_TOKEN');
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await findUserById(decoded.userId);
        if (!user) {
            throw new ApiError(401, 'Usuario no encontrado', 'USER_NOT_FOUND');
        }
        if (!user.isActive) {
            throw new ApiError(401, 'Cuenta de usuario desactivada', 'USER_INACTIVE');
        }
        if (!user.isEmailVerified && req.path !== '/auth/verify-email') {
            throw new ApiError(401, 'Email no verificado', 'EMAIL_NOT_VERIFIED');
        }
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
        await updateUserActivity(user.id);
        next();
    }
    catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return next(new ApiError(401, 'Token inválido', 'INVALID_TOKEN'));
        }
        if (error instanceof jwt.TokenExpiredError) {
            return next(new ApiError(401, 'Token expirado', 'EXPIRED_TOKEN'));
        }
        next(error);
    }
};
exports.authenticateToken = authenticateToken;
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.userRole) {
            return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
        }
        if (!allowedRoles.includes(req.userRole)) {
            return next(new ApiError(403, 'Sin permisos para realizar esta acción', 'INSUFFICIENT_PERMISSIONS'));
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
const checkPermission = (resource, action) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
        }
        if (req.userRole === UserRole.OWNER || req.userRole === UserRole.ADMIN) {
            return next();
        }
        const hasPermission = req.user.permissions?.some((permission) => permission.resource === resource && permission.action === action);
        if (!hasPermission) {
            return next(new ApiError(403, `Sin permisos para ${action} en ${resource}`, 'INSUFFICIENT_PERMISSIONS'));
        }
        next();
    };
};
exports.checkPermission = checkPermission;
const checkResourceOwnership = (userIdField = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
        }
        if (req.userRole === UserRole.OWNER || req.userRole === UserRole.ADMIN) {
            return next();
        }
        const resourceUserId = req.params[userIdField] || req.body[userIdField];
        if (resourceUserId && resourceUserId !== req.userId) {
            return next(new ApiError(403, 'Sin acceso a este recurso', 'RESOURCE_ACCESS_DENIED'));
        }
        next();
    };
};
exports.checkResourceOwnership = checkResourceOwnership;
const requireActiveSubscription = (req, res, next) => {
    if (!req.user || !req.user.farm) {
        return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }
    const farm = req.user.farm;
    const subscriptionStatus = farm.subscriptionStatus;
    if (subscriptionStatus !== 'ACTIVE' && subscriptionStatus !== 'TRIAL') {
        return next(new ApiError(403, 'Suscripción requerida para esta función', 'SUBSCRIPTION_REQUIRED'));
    }
    next();
};
exports.requireActiveSubscription = requireActiveSubscription;
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await findUserById(decoded.userId);
            if (user && user.isActive) {
                req.user = user;
                req.userId = user.id;
                req.userRole = user.role;
            }
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
const checkApiLimits = (req, res, next) => {
    if (!req.user) {
        return next(new ApiError(401, 'Usuario no autenticado', 'NOT_AUTHENTICATED'));
    }
    const roleLimits = {
        [UserRole.VIEWER]: { requestsPerHour: 100 },
        [UserRole.WORKER]: { requestsPerHour: 500 },
        [UserRole.VETERINARIAN]: { requestsPerHour: 1000 },
        [UserRole.MANAGER]: { requestsPerHour: 2000 },
        [UserRole.ADMIN]: { requestsPerHour: 5000 },
        [UserRole.OWNER]: { requestsPerHour: 10000 }
    };
    const userLimit = roleLimits[req.userRole];
    req.apiLimits = userLimit;
    next();
};
exports.checkApiLimits = checkApiLimits;
const generateToken = (userId, email, role) => {
    const payload = {
        userId,
        email,
        role
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch (error) {
        throw new ApiError(401, 'Token inválido', 'INVALID_TOKEN');
    }
};
exports.verifyToken = verifyToken;
const logUserActivity = (action) => {
    return (req, res, next) => {
        if (req.user) {
            console.log(`Usuario ${req.user.email} realizó acción: ${action} en ${new Date().toISOString()}`);
        }
        next();
    };
};
exports.logUserActivity = logUserActivity;
//# sourceMappingURL=auth.js.map