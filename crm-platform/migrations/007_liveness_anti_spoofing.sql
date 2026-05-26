-- Liveness & Anti-Spoofing Schema Migration
-- Adds tables for liveness detection events, anti-spoofing audit log,
-- face feature vectors, and facial landmarks.

-- Liveness check sessions
CREATE TABLE IF NOT EXISTS liveness_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    method VARCHAR(16) NOT NULL CHECK (method IN ('passive', 'active')),
    is_live BOOLEAN NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    spoof_type VARCHAR(32) DEFAULT 'none',
    challenge_id VARCHAR(64),
    processing_ms INTEGER NOT NULL DEFAULT 0,
    device_id VARCHAR(128),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_liveness_sessions_user ON liveness_sessions(user_id);
CREATE INDEX idx_liveness_sessions_tenant ON liveness_sessions(tenant_id);
CREATE INDEX idx_liveness_sessions_created ON liveness_sessions(created_at DESC);
CREATE INDEX idx_liveness_sessions_method ON liveness_sessions(method);
CREATE INDEX idx_liveness_sessions_is_live ON liveness_sessions(is_live);

-- Anti-spoofing scores per session
CREATE TABLE IF NOT EXISTS anti_spoof_scores (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES liveness_sessions(session_id) ON DELETE CASCADE,
    texture_analysis DECIMAL(5, 4) NOT NULL DEFAULT 0,
    moire_detection DECIMAL(5, 4) NOT NULL DEFAULT 0,
    depth_estimation DECIMAL(5, 4) NOT NULL DEFAULT 0,
    blink_detection DECIMAL(5, 4) NOT NULL DEFAULT 0,
    micro_expression DECIMAL(5, 4) NOT NULL DEFAULT 0,
    color_consistency DECIMAL(5, 4) NOT NULL DEFAULT 0,
    reflection_check DECIMAL(5, 4) NOT NULL DEFAULT 0,
    frequency_domain DECIMAL(5, 4) NOT NULL DEFAULT 0,
    temporal_coherence DECIMAL(5, 4) NOT NULL DEFAULT 0,
    deepfake_score DECIMAL(5, 4) NOT NULL DEFAULT 0,
    overall_score DECIMAL(5, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_anti_spoof_session ON anti_spoof_scores(session_id);

-- Spoofing attack classification log
CREATE TABLE IF NOT EXISTS spoof_detection_log (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES liveness_sessions(session_id),
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    is_spoof BOOLEAN NOT NULL,
    spoof_type VARCHAR(32) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    attack_probabilities JSONB NOT NULL DEFAULT '{}',
    features_used TEXT[] DEFAULT '{}',
    model_version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
    processing_ms INTEGER NOT NULL DEFAULT 0,
    image_hash VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_spoof_log_user ON spoof_detection_log(user_id);
CREATE INDEX idx_spoof_log_tenant ON spoof_detection_log(tenant_id);
CREATE INDEX idx_spoof_log_created ON spoof_detection_log(created_at DESC);
CREATE INDEX idx_spoof_log_type ON spoof_detection_log(spoof_type);
CREATE INDEX idx_spoof_log_is_spoof ON spoof_detection_log(is_spoof);

-- Face feature vectors for matching
CREATE TABLE IF NOT EXISTS face_features (
    feature_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    feature_vector FLOAT8[] NOT NULL,  -- 128-dimensional embedding
    feature_norm DECIMAL(10, 6) NOT NULL,
    source_session_id VARCHAR(64) REFERENCES liveness_sessions(session_id),
    quality_score DECIMAL(5, 4) NOT NULL CHECK (quality_score >= 0 AND quality_score <= 1),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_face_features_user ON face_features(user_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_face_features_tenant ON face_features(tenant_id);

-- Face match results
CREATE TABLE IF NOT EXISTS face_match_log (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    feature_id_1 VARCHAR(64) REFERENCES face_features(feature_id),
    feature_id_2 VARCHAR(64) REFERENCES face_features(feature_id),
    matched BOOLEAN NOT NULL,
    similarity DECIMAL(5, 4) NOT NULL,
    distance DECIMAL(10, 6) NOT NULL,
    threshold DECIMAL(5, 4) NOT NULL DEFAULT 0.75,
    confidence DECIMAL(5, 4) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_face_match_user ON face_match_log(user_id);
CREATE INDEX idx_face_match_created ON face_match_log(created_at DESC);

-- 68-point facial landmarks
CREATE TABLE IF NOT EXISTS facial_landmarks (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES liveness_sessions(session_id),
    user_id VARCHAR(64) NOT NULL,
    points JSONB NOT NULL,              -- 68 (x,y) points
    jaw JSONB NOT NULL DEFAULT '[]',
    right_eyebrow JSONB NOT NULL DEFAULT '[]',
    left_eyebrow JSONB NOT NULL DEFAULT '[]',
    nose_bridge JSONB NOT NULL DEFAULT '[]',
    nose_tip JSONB NOT NULL DEFAULT '[]',
    right_eye JSONB NOT NULL DEFAULT '[]',
    left_eye JSONB NOT NULL DEFAULT '[]',
    outer_lip JSONB NOT NULL DEFAULT '[]',
    inner_lip JSONB NOT NULL DEFAULT '[]',
    face_rect JSONB NOT NULL DEFAULT '{}',
    confidence DECIMAL(5, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_landmarks_session ON facial_landmarks(session_id);
CREATE INDEX idx_landmarks_user ON facial_landmarks(user_id);

-- Active liveness challenges
CREATE TABLE IF NOT EXISTS liveness_challenges (
    challenge_id VARCHAR(64) PRIMARY KEY,
    actions TEXT[] NOT NULL,
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    session_id VARCHAR(64) REFERENCES liveness_sessions(session_id)
);

CREATE INDEX idx_challenges_status ON liveness_challenges(status) WHERE status = 'PENDING';
