-- SQL schema for the sync status tracking table (PostgreSQL dialect)

CREATE TABLE IF NOT EXISTS sync_status (
    id SERIAL PRIMARY KEY,
    temporal_workflow_id VARCHAR(255) NOT NULL,
    source_system VARCHAR(50) NOT NULL,
    target_system VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- Index for fast lookups by entity and system
    UNIQUE (entity_id, source_system, target_system)
);

-- Index for monitoring and auditing
CREATE INDEX idx_sync_status_timestamp ON sync_status (timestamp);
CREATE INDEX idx_sync_status_entity ON sync_status (entity_id);
