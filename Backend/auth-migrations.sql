-- ============================================================================
-- MIGRACIONES DE AUTENTICACIÓN - SISTEMA GANADERO UJAT
-- ============================================================================
-- Este archivo contiene las migraciones necesarias para que el AuthController
-- sea 100% funcional con todas las funcionalidades de seguridad.

-- ============================================================================
-- 1. TABLA EMAIL_VERIFICATION_TOKENS
-- ============================================================================
-- Para manejar tokens de verificación de email

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_email ON email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_used ON email_verification_tokens(used);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_created_at ON email_verification_tokens(created_at);

-- ============================================================================
-- 2. TABLA PASSWORD_RESET_TOKENS
-- ============================================================================
-- Para manejar tokens de reset de contraseña

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    new_password_hash VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_created_at ON password_reset_tokens(created_at);

-- ============================================================================
-- 3. TABLA TOKEN_BLACKLIST
-- ============================================================================
-- Para manejar tokens JWT revocados

CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    token_type VARCHAR(10) NOT NULL CHECK (token_type IN ('ACCESS', 'REFRESH')),
    token_jti VARCHAR(255) NOT NULL UNIQUE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    reason VARCHAR(20) NOT NULL CHECK (reason IN ('LOGOUT', 'PASSWORD_CHANGE', 'ACCOUNT_LOCKED', 'ADMIN_REVOKE', 'SECURITY_BREACH')),
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    revoked_by UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_type ON token_blacklist(token_type);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_jti ON token_blacklist(token_jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_hash ON token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_reason ON token_blacklist(reason);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_created_at ON token_blacklist(created_at);

-- Índice compuesto para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_token_blacklist_lookup ON token_blacklist(token_hash, expires_at);

-- ============================================================================
-- 4. TABLA SECURITY_EVENTS
-- ============================================================================
-- Para auditoría de eventos de seguridad

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE',
        'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'EMAIL_VERIFICATION_REQUEST',
        'EMAIL_VERIFICATION_SUCCESS', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
        'TOKEN_REVOKED', 'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED',
        'INVALID_TOKEN', 'UNAUTHORIZED_ACCESS', 'ADMIN_ACTION'
    )),
    severity VARCHAR(10) NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    location JSONB NULL,
    device_info JSONB NULL,
    session_id VARCHAR(255) NULL,
    token_id VARCHAR(255) NULL,
    additional_data JSONB NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    resolution_notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_session_id ON security_events(session_id);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_security_events_user_type_time ON security_events(user_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_type_time ON security_events(ip_address, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity_resolved_time ON security_events(severity, resolved, created_at);

-- ============================================================================
-- 5. FUNCIONES DE UTILIDAD
-- ============================================================================

-- Función para limpiar tokens expirados
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Limpiar tokens de verificación de email expirados
    DELETE FROM email_verification_tokens 
    WHERE expires_at < NOW() AND used = FALSE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Limpiar tokens de reset de contraseña expirados
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() AND used = FALSE;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Limpiar tokens de blacklist expirados (mantener por 30 días)
    DELETE FROM token_blacklist 
    WHERE expires_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de seguridad
CREATE OR REPLACE FUNCTION get_security_stats(days INTEGER DEFAULT 7)
RETURNS TABLE (
    total_events BIGINT,
    login_attempts BIGINT,
    failed_logins BIGINT,
    password_resets BIGINT,
    email_verifications BIGINT,
    critical_events BIGINT,
    unique_ips BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE event_type = 'LOGIN_SUCCESS' OR event_type = 'LOGIN_FAILED') as login_attempts,
        COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED') as failed_logins,
        COUNT(*) FILTER (WHERE event_type = 'PASSWORD_RESET_REQUEST') as password_resets,
        COUNT(*) FILTER (WHERE event_type = 'EMAIL_VERIFICATION_REQUEST') as email_verifications,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_events,
        COUNT(DISTINCT ip_address) as unique_ips
    FROM security_events 
    WHERE created_at >= NOW() - INTERVAL '1 day' * days;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE email_verification_tokens IS 'Tokens para verificación de email de usuarios';
COMMENT ON TABLE password_reset_tokens IS 'Tokens para reset de contraseña de usuarios';
COMMENT ON TABLE token_blacklist IS 'Lista negra de tokens JWT revocados';
COMMENT ON TABLE security_events IS 'Auditoría de eventos de seguridad del sistema';

-- ============================================================================
-- 7. VERIFICACIÓN DE MIGRACIONES
-- ============================================================================

-- Verificar que las tablas se crearon correctamente
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('email_verification_tokens', 'password_reset_tokens', 'token_blacklist', 'security_events');
    
    IF table_count = 4 THEN
        RAISE NOTICE '✅ Todas las tablas de autenticación se crearon correctamente';
    ELSE
        RAISE NOTICE '❌ Solo se crearon % de 4 tablas esperadas', table_count;
    END IF;
END $$;

-- ============================================================================
-- FIN DE MIGRACIONES
-- ============================================================================






