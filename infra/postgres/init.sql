-- ─── OG RMM Platform — PostgreSQL Schema Initialization ─────────────────────
-- Database: PostgreSQL 16
-- Encoding: UTF-8
-- Schemas: wells, telemetry, alarms, financials, ml, audit

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- ─── Schemas ─────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS wells;
CREATE SCHEMA IF NOT EXISTS telemetry;
CREATE SCHEMA IF NOT EXISTS alarms;
CREATE SCHEMA IF NOT EXISTS financials;
CREATE SCHEMA IF NOT EXISTS ml;
CREATE SCHEMA IF NOT EXISTS audit;

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE wells.well_status AS ENUM (
    'ACTIVE', 'SHUT_IN', 'DRILLING', 'WORKOVER', 'ABANDONED', 'PLUGGED'
);
CREATE TYPE wells.well_type AS ENUM (
    'OIL', 'GAS', 'WATER_INJECTION', 'DISPOSAL', 'OBSERVATION', 'CONDENSATE'
);
CREATE TYPE wells.lift_type AS ENUM (
    'NATURAL_FLOW', 'ESP', 'GAS_LIFT', 'SUCKER_ROD', 'PLUNGER_LIFT', 'PCP'
);
CREATE TYPE alarms.alarm_severity AS ENUM ('1_CRITICAL', '2_HIGH', '3_MEDIUM', '4_LOW');
CREATE TYPE alarms.alarm_state AS ENUM (
    'UNACKNOWLEDGED', 'ACKNOWLEDGED', 'CLEARED', 'SUPPRESSED', 'SHELVED'
);
CREATE TYPE financials.transaction_type AS ENUM (
    'REVENUE', 'ROYALTY', 'OPEX', 'CAPEX', 'TAX', 'TRANSPORT', 'SETTLEMENT'
);
CREATE TYPE financials.settlement_status AS ENUM (
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'REVERSED'
);

-- ─── Wells Schema ─────────────────────────────────────────────────────────────

CREATE TABLE wells.fields (
    field_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_name      VARCHAR(200) NOT NULL,
    basin           VARCHAR(100) NOT NULL,
    state           CHAR(2) NOT NULL,
    country         CHAR(2) NOT NULL DEFAULT 'US',
    operator        VARCHAR(200) NOT NULL,
    geometry        GEOMETRY(POLYGON, 4326),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wells.wells (
    well_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id            UUID REFERENCES wells.fields(field_id),
    well_name           VARCHAR(200) NOT NULL,
    api_number          VARCHAR(20) UNIQUE NOT NULL,
    well_type           wells.well_type NOT NULL,
    status              wells.well_status NOT NULL DEFAULT 'DRILLING',
    lift_type           wells.lift_type NOT NULL DEFAULT 'NATURAL_FLOW',
    latitude            DECIMAL(10, 7) NOT NULL,
    longitude           DECIMAL(10, 7) NOT NULL,
    location            GEOMETRY(POINT, 4326) GENERATED ALWAYS AS (
                            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                        ) STORED,
    surface_elevation_ft DECIMAL(8, 2),
    total_depth_ft      DECIMAL(8, 2),
    true_vertical_depth_ft DECIMAL(8, 2),
    spud_date           DATE,
    completion_date     DATE,
    first_production_date DATE,
    operator            VARCHAR(200) NOT NULL,
    lease_name          VARCHAR(200),
    section_township    VARCHAR(50),
    county              VARCHAR(100),
    state               CHAR(2) NOT NULL,
    country             CHAR(2) NOT NULL DEFAULT 'US',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wells.esp_configurations (
    esp_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id         UUID NOT NULL REFERENCES wells.wells(well_id) ON DELETE CASCADE,
    manufacturer    VARCHAR(100),
    model           VARCHAR(100),
    stages          INTEGER,
    horsepower      DECIMAL(8, 2),
    min_frequency_hz DECIMAL(5, 2) DEFAULT 30.0,
    max_frequency_hz DECIMAL(5, 2) DEFAULT 70.0,
    set_frequency_hz DECIMAL(5, 2) DEFAULT 60.0,
    installation_date DATE,
    run_life_days   INTEGER,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wells.production_daily (
    id              BIGSERIAL,
    well_id         UUID NOT NULL REFERENCES wells.wells(well_id),
    production_date DATE NOT NULL,
    oil_bbls        DECIMAL(10, 2) DEFAULT 0,
    gas_mcf         DECIMAL(10, 2) DEFAULT 0,
    water_bbls      DECIMAL(10, 2) DEFAULT 0,
    ngl_bbls        DECIMAL(10, 2) DEFAULT 0,
    injection_bbls  DECIMAL(10, 2) DEFAULT 0,
    uptime_hours    DECIMAL(5, 2) DEFAULT 0,
    downtime_reason VARCHAR(200),
    choke_size_64ths INTEGER,
    tubing_pressure_psi DECIMAL(8, 2),
    casing_pressure_psi DECIMAL(8, 2),
    wellhead_temp_f DECIMAL(6, 2),
    gor_scf_bbl     DECIMAL(8, 2),
    water_cut_pct   DECIMAL(5, 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, production_date)
);

-- TimescaleDB hypertable for production data
SELECT create_hypertable('wells.production_daily', 'production_date',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- ─── Telemetry Schema ─────────────────────────────────────────────────────────

CREATE TABLE telemetry.sensors (
    sensor_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id         UUID NOT NULL REFERENCES wells.wells(well_id),
    sensor_tag      VARCHAR(100) NOT NULL,
    sensor_type     VARCHAR(100) NOT NULL,
    description     VARCHAR(300),
    unit            VARCHAR(20) NOT NULL,
    min_range       DECIMAL(12, 4),
    max_range       DECIMAL(12, 4),
    low_low_limit   DECIMAL(12, 4),
    low_limit       DECIMAL(12, 4),
    high_limit      DECIMAL(12, 4),
    high_high_limit DECIMAL(12, 4),
    scan_rate_sec   INTEGER DEFAULT 60,
    protocol        VARCHAR(50) DEFAULT 'MODBUS',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(well_id, sensor_tag)
);

CREATE TABLE telemetry.readings (
    reading_id      BIGSERIAL,
    sensor_id       UUID NOT NULL REFERENCES telemetry.sensors(sensor_id),
    well_id         UUID NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL,
    value           DECIMAL(16, 6) NOT NULL,
    quality         SMALLINT NOT NULL DEFAULT 100 CHECK (quality BETWEEN 0 AND 100),
    source          VARCHAR(50) DEFAULT 'SCADA',
    PRIMARY KEY (reading_id, timestamp)
);

-- TimescaleDB hypertable for sensor readings
SELECT create_hypertable('telemetry.readings', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Continuous aggregate for hourly averages
CREATE MATERIALIZED VIEW telemetry.readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    sensor_id,
    well_id,
    time_bucket('1 hour', timestamp) AS bucket,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    COUNT(*) AS sample_count,
    AVG(quality) AS avg_quality
FROM telemetry.readings
GROUP BY sensor_id, well_id, bucket
WITH NO DATA;

-- ─── Alarms Schema ────────────────────────────────────────────────────────────

CREATE TABLE alarms.alarm_definitions (
    alarm_def_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alarm_type      VARCHAR(100) NOT NULL UNIQUE,
    description     VARCHAR(500),
    default_severity alarms.alarm_severity NOT NULL DEFAULT '3_MEDIUM',
    suppression_duration_min INTEGER DEFAULT 60,
    auto_clear      BOOLEAN DEFAULT FALSE,
    notification_channels JSONB DEFAULT '["email", "sms"]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alarms.alarms (
    alarm_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id         UUID NOT NULL REFERENCES wells.wells(well_id),
    sensor_id       UUID REFERENCES telemetry.sensors(sensor_id),
    alarm_def_id    UUID REFERENCES alarms.alarm_definitions(alarm_def_id),
    alarm_type      VARCHAR(100) NOT NULL,
    severity        alarms.alarm_severity NOT NULL,
    state           alarms.alarm_state NOT NULL DEFAULT 'UNACKNOWLEDGED',
    message         TEXT NOT NULL,
    value           DECIMAL(16, 6),
    unit            VARCHAR(20),
    threshold       DECIMAL(16, 6),
    temporal_workflow_id VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(200),
    cleared_at      TIMESTAMPTZ,
    suppressed_until TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_alarms_well_id ON alarms.alarms(well_id);
CREATE INDEX idx_alarms_state ON alarms.alarms(state);
CREATE INDEX idx_alarms_severity ON alarms.alarms(severity);
CREATE INDEX idx_alarms_created_at ON alarms.alarms(created_at DESC);

-- ─── Financials Schema ────────────────────────────────────────────────────────

CREATE TABLE financials.accounts (
    account_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code    VARCHAR(20) UNIQUE NOT NULL,
    account_name    VARCHAR(200) NOT NULL,
    account_type    VARCHAR(50) NOT NULL,  -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    tigerbeetle_id  BIGINT UNIQUE,         -- TigerBeetle account ID (128-bit stored as BIGINT pair)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financials.transactions (
    transaction_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id         UUID REFERENCES wells.wells(well_id),
    transaction_type financials.transaction_type NOT NULL,
    description     TEXT NOT NULL,
    amount_usd      DECIMAL(18, 4) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate   DECIMAL(10, 6) DEFAULT 1.0,
    debit_account   VARCHAR(20) NOT NULL REFERENCES financials.accounts(account_code),
    credit_account  VARCHAR(20) NOT NULL REFERENCES financials.accounts(account_code),
    tigerbeetle_transfer_id BIGINT,
    reference_number VARCHAR(100),
    production_date DATE,
    oil_bbls        DECIMAL(10, 2),
    gas_mcf         DECIMAL(10, 2),
    oil_price_per_bbl DECIMAL(8, 4),
    gas_price_per_mcf DECIMAL(8, 4),
    status          VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at      TIMESTAMPTZ
);

CREATE TABLE financials.royalty_obligations (
    royalty_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id         UUID NOT NULL REFERENCES wells.wells(well_id),
    payee_name      VARCHAR(200) NOT NULL,
    payee_type      VARCHAR(50) NOT NULL,  -- STATE, FEDERAL, PRIVATE, OVERRIDING
    royalty_rate_pct DECIMAL(6, 4) NOT NULL,
    effective_date  DATE NOT NULL,
    expiry_date     DATE,
    mojaloop_party_id VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financials.settlements (
    settlement_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    royalty_id      UUID REFERENCES financials.royalty_obligations(royalty_id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    gross_revenue   DECIMAL(18, 4) NOT NULL,
    royalty_amount  DECIMAL(18, 4) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    mojaloop_transfer_id VARCHAR(200),
    status          financials.settlement_status NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ─── ML Schema ───────────────────────────────────────────────────────────────

CREATE TABLE ml.models (
    model_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name      VARCHAR(200) NOT NULL,
    model_type      VARCHAR(100) NOT NULL,  -- ESP_FAILURE, ANOMALY_DETECTION, PRODUCTION_FORECAST
    version         VARCHAR(50) NOT NULL,
    algorithm       VARCHAR(100),           -- XGBOOST, LSTM, ISOLATION_FOREST, etc.
    training_samples INTEGER,
    precision_score DECIMAL(6, 4),
    recall_score    DECIMAL(6, 4),
    f1_score        DECIMAL(6, 4),
    auc_roc         DECIMAL(6, 4),
    model_path      VARCHAR(500),
    feature_names   JSONB,
    hyperparameters JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    trained_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ml.predictions (
    prediction_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id        UUID NOT NULL REFERENCES ml.models(model_id),
    well_id         UUID NOT NULL REFERENCES wells.wells(well_id),
    prediction_type VARCHAR(100) NOT NULL,
    predicted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    horizon_days    INTEGER,
    probability     DECIMAL(6, 4),
    predicted_value DECIMAL(16, 6),
    confidence_lower DECIMAL(16, 6),
    confidence_upper DECIMAL(16, 6),
    features_used   JSONB,
    is_confirmed    BOOLEAN,
    actual_outcome  VARCHAR(200),
    confirmed_at    TIMESTAMPTZ
);

CREATE TABLE ml.anomaly_events (
    anomaly_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id         UUID NOT NULL REFERENCES wells.wells(well_id),
    sensor_id       UUID REFERENCES telemetry.sensors(sensor_id),
    model_id        UUID REFERENCES ml.models(model_id),
    anomaly_type    VARCHAR(100) NOT NULL,
    anomaly_score   DECIMAL(8, 4) NOT NULL,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    value           DECIMAL(16, 6),
    baseline_value  DECIMAL(16, 6),
    deviation_pct   DECIMAL(8, 4),
    alarm_id        UUID REFERENCES alarms.alarms(alarm_id),
    is_false_positive BOOLEAN,
    reviewed_by     VARCHAR(200),
    reviewed_at     TIMESTAMPTZ
);

-- ─── Audit Schema ─────────────────────────────────────────────────────────────

CREATE TABLE audit.events (
    event_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type      VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(100) NOT NULL,
    entity_id       UUID,
    user_id         VARCHAR(200),
    user_name       VARCHAR(200),
    ip_address      INET,
    changes         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit.events(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit.events(created_at DESC);

-- ─── Seed Data ────────────────────────────────────────────────────────────────

-- Chart of Accounts
INSERT INTO financials.accounts (account_code, account_name, account_type) VALUES
    ('1001', 'Accounts Receivable — Oil & Gas', 'ASSET'),
    ('1002', 'Cash and Cash Equivalents', 'ASSET'),
    ('2001', 'Royalties Payable — State', 'LIABILITY'),
    ('2002', 'Royalties Payable — Federal', 'LIABILITY'),
    ('4001', 'Oil Revenue', 'REVENUE'),
    ('4002', 'Gas Revenue', 'REVENUE'),
    ('4003', 'NGL Revenue', 'REVENUE'),
    ('5001', 'Royalty Expense', 'EXPENSE'),
    ('6001', 'Lease Operating Expense', 'EXPENSE'),
    ('6002', 'Workover Expense', 'EXPENSE'),
    ('7001', 'Capital Expenditures', 'ASSET'),
    ('7002', 'Well Drilling & Completion', 'ASSET')
ON CONFLICT (account_code) DO NOTHING;

-- Alarm Definitions
INSERT INTO alarms.alarm_definitions (alarm_type, description, default_severity) VALUES
    ('ESP_FAILURE_PREDICTED', 'ML model predicts ESP failure within prediction horizon', '1_CRITICAL'),
    ('HIGH_VIBRATION', 'ESP vibration exceeds high-high limit', '2_HIGH'),
    ('LOW_TUBING_PRESSURE', 'Tubing pressure below low limit', '2_HIGH'),
    ('HIGH_WATER_CUT', 'Water cut exceeds threshold', '3_MEDIUM'),
    ('SENSOR_QUALITY', 'Sensor quality degraded below acceptable threshold', '3_MEDIUM'),
    ('COMMUNICATION_LOSS', 'SCADA communication lost with well RTU', '2_HIGH'),
    ('RAPID_PRESSURE_DROP', 'Rapid pressure decline detected', '1_CRITICAL'),
    ('ESP_OVERCURRENT', 'ESP motor current exceeds rated limit', '1_CRITICAL'),
    ('HIGH_GOR', 'Gas-oil ratio exceeds threshold', '3_MEDIUM'),
    ('PRODUCTION_DECLINE', 'Significant production rate decline detected', '2_HIGH')
ON CONFLICT (alarm_type) DO NOTHING;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_wells_status ON wells.wells(status);
CREATE INDEX idx_wells_field_id ON wells.wells(field_id);
CREATE INDEX idx_wells_location ON wells.wells USING GIST(location);
CREATE INDEX idx_production_well_date ON wells.production_daily(well_id, production_date DESC);
CREATE INDEX idx_sensors_well_id ON telemetry.sensors(well_id);
CREATE INDEX idx_readings_sensor_ts ON telemetry.readings(sensor_id, timestamp DESC);
CREATE INDEX idx_predictions_well_id ON ml.predictions(well_id, predicted_at DESC);
CREATE INDEX idx_transactions_well_id ON financials.transactions(well_id, created_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE wells.wells ENABLE ROW LEVEL SECURITY;
ALTER TABLE alarms.alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE financials.transactions ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for microservices)
CREATE POLICY service_all ON wells.wells TO ogrmm USING (TRUE);
CREATE POLICY service_all ON alarms.alarms TO ogrmm USING (TRUE);
CREATE POLICY service_all ON financials.transactions TO ogrmm USING (TRUE);

-- ═══════════════════════════════════════════════════════════════════════════════
-- WT PETROTECH GAP CLOSURE — SCHEMA ADDITIONS
-- Added: FPSO/HPU assets, subsea trees, calibration scheduling,
--        site connectivity, electro-hydraulic actuator commands
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── New Enums ────────────────────────────────────────────────────────────────

CREATE TYPE wells.asset_type AS ENUM (
    'WELLHEAD', 'FPSO', 'HPU', 'SUBSEA_TREE', 'SUBSEA_MANIFOLD',
    'UMBILICAL', 'RISER', 'SEPARATOR', 'COMPRESSOR', 'SOLAR_UNIT',
    'PNEUMATIC_CONTROLLER', 'ESD_PANEL', 'FUSIBLE_LOOP', 'COIL_TUBING_UNIT'
);

CREATE TYPE wells.valve_type AS ENUM (
    'MASTER_VALVE', 'WING_VALVE', 'SWAB_VALVE', 'CHOKE_VALVE',
    'SURFACE_SAFETY_VALVE', 'SUBSURFACE_SAFETY_VALVE', 'ANNULUS_MASTER_VALVE',
    'PRODUCTION_WING_VALVE', 'GAS_LIFT_VALVE', 'INJECTION_VALVE'
);

CREATE TYPE wells.actuator_type AS ENUM (
    'HYDRAULIC', 'ELECTRO_HYDRAULIC', 'PNEUMATIC', 'ELECTRIC', 'MANUAL'
);

CREATE TYPE wells.protocol_type AS ENUM (
    'MQTT', 'MODBUS_TCP', 'MODBUS_RTU', 'OPC_UA', 'DNP3', 'HART', 'PROFIBUS', 'INTERNAL'
);

CREATE TYPE wells.connectivity_status AS ENUM (
    'ONLINE', 'DEGRADED', 'OFFLINE', 'BUFFERING', 'MAINTENANCE'
);

CREATE TYPE wells.calibration_status AS ENUM (
    'CURRENT', 'DUE_SOON', 'OVERDUE', 'IN_PROGRESS', 'FAILED', 'WAIVED'
);

CREATE TYPE wells.command_status AS ENUM (
    'PENDING', 'SENT', 'ACKNOWLEDGED', 'EXECUTED', 'FAILED', 'CANCELLED', 'TIMED_OUT'
);

-- ─── FPSO / Offshore Asset Registry ──────────────────────────────────────────

CREATE TABLE wells.fpso_vessels (
    vessel_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id            UUID REFERENCES wells.fields(field_id),
    vessel_name         VARCHAR(200) NOT NULL,
    imo_number          VARCHAR(20) UNIQUE,
    flag_state          CHAR(2) NOT NULL DEFAULT 'US',
    vessel_type         VARCHAR(50) NOT NULL DEFAULT 'FPSO',   -- FPSO, FSO, FLNG, SEMI
    location            GEOMETRY(POINT, 4326),
    latitude            DECIMAL(10, 7),
    longitude           DECIMAL(10, 7),
    water_depth_m       DECIMAL(8, 2),
    oil_storage_bbl     INTEGER,
    processing_capacity_bpd INTEGER,
    gas_processing_mmscfd   DECIMAL(8, 3),
    water_injection_bpd     INTEGER,
    mooring_type        VARCHAR(50),   -- TURRET, SPREAD, SINGLE_POINT
    commissioning_date  DATE,
    operator            VARCHAR(200) NOT NULL,
    status              wells.well_status NOT NULL DEFAULT 'ACTIVE',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wells.hpu_units (
    hpu_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id           UUID REFERENCES wells.fpso_vessels(vessel_id),
    well_id             UUID REFERENCES wells.wells(well_id),
    hpu_tag             VARCHAR(100) NOT NULL UNIQUE,
    hpu_name            VARCHAR(200) NOT NULL,
    asset_type          wells.asset_type NOT NULL DEFAULT 'HPU',
    manufacturer        VARCHAR(200),
    model               VARCHAR(200),
    serial_number       VARCHAR(100),
    rated_pressure_psi  DECIMAL(8, 2),
    rated_flow_lpm      DECIMAL(8, 2),
    accumulator_volume_l DECIMAL(8, 2),
    reservoir_volume_l  DECIMAL(8, 2),
    fluid_type          VARCHAR(50) DEFAULT 'MINERAL_OIL',
    pump_count          INTEGER DEFAULT 2,
    location_description VARCHAR(500),
    installation_date   DATE,
    last_maintenance_date DATE,
    status              wells.well_status NOT NULL DEFAULT 'ACTIVE',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Subsea Tree and Manifold Registry ───────────────────────────────────────

CREATE TABLE wells.subsea_trees (
    tree_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id             UUID REFERENCES wells.wells(well_id),
    vessel_id           UUID REFERENCES wells.fpso_vessels(vessel_id),
    tree_tag            VARCHAR(100) NOT NULL UNIQUE,
    tree_name           VARCHAR(200) NOT NULL,
    tree_type           VARCHAR(50) NOT NULL DEFAULT 'HORIZONTAL', -- HORIZONTAL, VERTICAL, DUAL
    water_depth_m       DECIMAL(8, 2) NOT NULL,
    location            GEOMETRY(POINT, 4326),
    latitude            DECIMAL(10, 7),
    longitude           DECIMAL(10, 7),
    manufacturer        VARCHAR(200),
    model               VARCHAR(200),
    serial_number       VARCHAR(100),
    rated_pressure_psi  DECIMAL(8, 2),
    rated_temp_f        DECIMAL(6, 2),
    installation_date   DATE,
    umbilical_id        UUID,  -- FK to umbilicals table
    manifold_id         UUID,  -- FK to manifolds table
    status              wells.well_status NOT NULL DEFAULT 'ACTIVE',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wells.subsea_manifolds (
    manifold_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id           UUID REFERENCES wells.fpso_vessels(vessel_id),
    manifold_tag        VARCHAR(100) NOT NULL UNIQUE,
    manifold_name       VARCHAR(200) NOT NULL,
    water_depth_m       DECIMAL(8, 2) NOT NULL,
    location            GEOMETRY(POINT, 4326),
    slot_count          INTEGER NOT NULL DEFAULT 4,
    slots_occupied      INTEGER NOT NULL DEFAULT 0,
    rated_pressure_psi  DECIMAL(8, 2),
    manufacturer        VARCHAR(200),
    installation_date   DATE,
    status              wells.well_status NOT NULL DEFAULT 'ACTIVE',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link subsea trees to manifolds
ALTER TABLE wells.subsea_trees
    ADD CONSTRAINT fk_tree_manifold
    FOREIGN KEY (manifold_id) REFERENCES wells.subsea_manifolds(manifold_id);

CREATE TABLE wells.umbilicals (
    umbilical_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id           UUID REFERENCES wells.fpso_vessels(vessel_id),
    umbilical_tag       VARCHAR(100) NOT NULL UNIQUE,
    umbilical_name      VARCHAR(200) NOT NULL,
    umbilical_type      VARCHAR(50) DEFAULT 'INTEGRATED', -- INTEGRATED, ELECTRICAL, HYDRAULIC, CHEMICAL
    length_m            DECIMAL(10, 2),
    outer_diameter_mm   DECIMAL(6, 2),
    hydraulic_lines     INTEGER DEFAULT 2,
    electrical_cores    INTEGER DEFAULT 4,
    fiber_optic_cores   INTEGER DEFAULT 0,
    chemical_injection_lines INTEGER DEFAULT 1,
    installation_date   DATE,
    status              wells.well_status NOT NULL DEFAULT 'ACTIVE',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wells.subsea_trees
    ADD CONSTRAINT fk_tree_umbilical
    FOREIGN KEY (umbilical_id) REFERENCES wells.umbilicals(umbilical_id);

-- ─── Valve / Actuator Registry ────────────────────────────────────────────────

CREATE TABLE wells.valves (
    valve_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id             UUID REFERENCES wells.wells(well_id),
    tree_id             UUID REFERENCES wells.subsea_trees(tree_id),
    hpu_id              UUID REFERENCES wells.hpu_units(hpu_id),
    valve_tag           VARCHAR(100) NOT NULL,
    valve_name          VARCHAR(200) NOT NULL,
    valve_type          wells.valve_type NOT NULL,
    actuator_type       wells.actuator_type NOT NULL,
    fail_safe_position  VARCHAR(10) NOT NULL DEFAULT 'CLOSED', -- OPEN, CLOSED
    rated_pressure_psi  DECIMAL(8, 2),
    bore_size_in        DECIMAL(6, 3),
    manufacturer        VARCHAR(200),
    model               VARCHAR(200),
    serial_number       VARCHAR(100),
    installation_date   DATE,
    last_test_date      DATE,
    next_test_date      DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN, CLOSED, PARTIAL, FAULT
    position_pct        DECIMAL(5, 2) DEFAULT 100.0,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Actuator Command Log ─────────────────────────────────────────────────────

CREATE TABLE wells.actuator_commands (
    command_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id             UUID REFERENCES wells.wells(well_id),
    valve_id            UUID REFERENCES wells.valves(valve_id),
    tree_id             UUID REFERENCES wells.subsea_trees(tree_id),
    hpu_id              UUID REFERENCES wells.hpu_units(hpu_id),
    command_type        VARCHAR(50) NOT NULL,  -- OPEN, CLOSE, SETPOINT, ESD_RESET, CHOKE_POSITION
    actuator_type       wells.actuator_type NOT NULL,
    protocol            wells.protocol_type NOT NULL,
    target_value        DECIMAL(12, 4),
    unit                VARCHAR(20),
    register_address    INTEGER,               -- Modbus register
    node_id             VARCHAR(200),          -- OPC-UA NodeId
    dnp3_point          INTEGER,               -- DNP3 point index
    issued_by           VARCHAR(200) NOT NULL,
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at             TIMESTAMPTZ,
    ack_at              TIMESTAMPTZ,
    executed_at         TIMESTAMPTZ,
    status              wells.command_status NOT NULL DEFAULT 'PENDING',
    error_message       TEXT,
    temporal_workflow_id VARCHAR(200),
    metadata            JSONB DEFAULT '{}'
);

CREATE INDEX idx_actuator_commands_well ON wells.actuator_commands(well_id, issued_at DESC);
CREATE INDEX idx_actuator_commands_status ON wells.actuator_commands(status) WHERE status IN ('PENDING', 'SENT');

-- ─── Site Connectivity ────────────────────────────────────────────────────────

CREATE TABLE wells.site_connectivity (
    connectivity_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id             UUID REFERENCES wells.wells(well_id) UNIQUE,
    status              wells.connectivity_status NOT NULL DEFAULT 'ONLINE',
    link_quality_pct    SMALLINT NOT NULL DEFAULT 100 CHECK (link_quality_pct BETWEEN 0 AND 100),
    buffer_depth        INTEGER NOT NULL DEFAULT 0,
    last_upload_ok      BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_upload_at      TIMESTAMPTZ,
    protocols_active    TEXT[] DEFAULT '{}',
    -- Solar / power status
    solar_voltage_v     DECIMAL(6, 3),
    battery_soc_pct     DECIMAL(5, 2),
    compressor_running  BOOLEAN,
    site_power_mode     VARCHAR(20) DEFAULT 'GRID',  -- GRID, SOLAR, BATTERY, GENERATOR
    -- Edge agent metadata
    agent_version       VARCHAR(50),
    agent_hostname      VARCHAR(200),
    uptime_seconds      BIGINT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-series for connectivity history (TimescaleDB hypertable)
CREATE TABLE wells.site_connectivity_history (
    time                TIMESTAMPTZ NOT NULL,
    well_id             UUID NOT NULL,
    link_quality_pct    SMALLINT,
    buffer_depth        INTEGER,
    solar_voltage_v     DECIMAL(6, 3),
    battery_soc_pct     DECIMAL(5, 2),
    compressor_running  BOOLEAN
);
SELECT create_hypertable('wells.site_connectivity_history', 'time', if_not_exists => TRUE);
CREATE INDEX idx_connectivity_history_well ON wells.site_connectivity_history(well_id, time DESC);

-- ─── Calibration Scheduling ───────────────────────────────────────────────────

CREATE TABLE wells.sensor_registry (
    sensor_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id             UUID REFERENCES wells.wells(well_id),
    tree_id             UUID REFERENCES wells.subsea_trees(tree_id),
    hpu_id              UUID REFERENCES wells.hpu_units(hpu_id),
    sensor_tag          VARCHAR(100) NOT NULL,
    sensor_name         VARCHAR(200) NOT NULL,
    sensor_type         VARCHAR(100) NOT NULL,  -- PRESSURE, TEMPERATURE, FLOW, VIBRATION, etc.
    manufacturer        VARCHAR(200),
    model               VARCHAR(200),
    serial_number       VARCHAR(100),
    range_min           DECIMAL(12, 4),
    range_max           DECIMAL(12, 4),
    unit                VARCHAR(20) NOT NULL,
    accuracy_pct        DECIMAL(5, 3),
    protocol            wells.protocol_type NOT NULL DEFAULT 'MODBUS_TCP',
    register_address    INTEGER,
    node_id             VARCHAR(200),
    dnp3_point          INTEGER,
    installation_date   DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(well_id, sensor_tag)
);

CREATE TABLE wells.calibration_schedule (
    calibration_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sensor_id           UUID REFERENCES wells.sensor_registry(sensor_id) NOT NULL,
    well_id             UUID REFERENCES wells.wells(well_id) NOT NULL,
    calibration_type    VARCHAR(50) NOT NULL DEFAULT 'ROUTINE', -- ROUTINE, DRIFT_CORRECTION, POST_REPAIR, INITIAL
    interval_days       INTEGER NOT NULL DEFAULT 365,
    last_calibration_date DATE,
    last_calibration_result VARCHAR(20),  -- PASS, FAIL, ADJUSTED
    last_calibration_by VARCHAR(200),
    next_due_date       DATE NOT NULL,
    status              wells.calibration_status NOT NULL DEFAULT 'CURRENT',
    tolerance_pct       DECIMAL(5, 3) DEFAULT 0.5,
    -- Drift tracking
    current_drift_pct   DECIMAL(7, 4) DEFAULT 0.0,
    drift_threshold_pct DECIMAL(5, 3) DEFAULT 1.0,
    drift_alert_enabled BOOLEAN DEFAULT TRUE,
    -- Certificate
    certificate_number  VARCHAR(100),
    certificate_expiry  DATE,
    traceable_to        VARCHAR(200) DEFAULT 'NIST',
    -- Scheduling
    assigned_technician VARCHAR(200),
    workorder_id        UUID,  -- FK to workovers
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calibration_due ON wells.calibration_schedule(next_due_date, status);
CREATE INDEX idx_calibration_well ON wells.calibration_schedule(well_id, status);
CREATE INDEX idx_calibration_sensor ON wells.calibration_schedule(sensor_id);

-- Calibration history log
CREATE TABLE wells.calibration_history (
    history_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calibration_id      UUID REFERENCES wells.calibration_schedule(calibration_id),
    sensor_id           UUID REFERENCES wells.sensor_registry(sensor_id),
    well_id             UUID NOT NULL,
    calibration_date    DATE NOT NULL,
    calibration_type    VARCHAR(50) NOT NULL,
    result              VARCHAR(20) NOT NULL,  -- PASS, FAIL, ADJUSTED
    as_found_error_pct  DECIMAL(7, 4),
    as_left_error_pct   DECIMAL(7, 4),
    adjustment_made     BOOLEAN DEFAULT FALSE,
    adjustment_value    DECIMAL(12, 6),
    performed_by        VARCHAR(200) NOT NULL,
    certificate_number  VARCHAR(100),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sensor quality time-series (for drift trend analysis)
CREATE TABLE telemetry.sensor_quality_history (
    time                TIMESTAMPTZ NOT NULL,
    sensor_id           UUID NOT NULL,
    well_id             UUID NOT NULL,
    quality_score       SMALLINT NOT NULL,
    drift_estimate_pct  DECIMAL(7, 4),
    reading_count       INTEGER,
    out_of_range_count  INTEGER
);
SELECT create_hypertable('telemetry.sensor_quality_history', 'time', if_not_exists => TRUE);
CREATE INDEX idx_sensor_quality_sensor ON telemetry.sensor_quality_history(sensor_id, time DESC);

-- ─── Protocol Configuration ───────────────────────────────────────────────────

CREATE TABLE wells.protocol_configs (
    config_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    well_id             UUID REFERENCES wells.wells(well_id),
    protocol            wells.protocol_type NOT NULL,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    -- Connection parameters (stored as JSONB for flexibility)
    connection_params   JSONB NOT NULL DEFAULT '{}',
    -- Examples:
    -- MODBUS_TCP: {"host": "192.168.1.100", "port": 502, "unit_id": 1}
    -- OPC_UA:     {"endpoint": "opc.tcp://192.168.1.100:4840/", "security_mode": "SignAndEncrypt"}
    -- DNP3:       {"host": "192.168.1.101", "port": 20000, "master_addr": 1, "outstation_addr": 10}
    -- MQTT:       {"host": "mosquitto", "port": 1883, "use_tls": true}
    poll_interval_ms    INTEGER DEFAULT 1000,
    timeout_ms          INTEGER DEFAULT 5000,
    retry_count         INTEGER DEFAULT 3,
    last_connected_at   TIMESTAMPTZ,
    last_error          TEXT,
    status              VARCHAR(20) DEFAULT 'ACTIVE',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(well_id, protocol)
);

-- ─── Seed data: Protocol support matrix ──────────────────────────────────────

-- WT Petrotech system type → recommended protocol mapping
CREATE TABLE wells.system_protocol_matrix (
    system_type         VARCHAR(100) NOT NULL,
    recommended_protocol wells.protocol_type NOT NULL,
    fallback_protocol   wells.protocol_type,
    notes               TEXT,
    PRIMARY KEY (system_type, recommended_protocol)
);

INSERT INTO wells.system_protocol_matrix VALUES
    ('PLC_BASED_WELLHEAD',          'OPC_UA',       'MODBUS_TCP',  'Allen-Bradley, Siemens, Schneider PLCs'),
    ('CONVENTIONAL_PNEUMATIC',      'MODBUS_RTU',   'MQTT',        'Smart transmitters via RS-485'),
    ('ELECTRO_HYDRAULIC_WELLHEAD',  'OPC_UA',       'MODBUS_TCP',  'High-pressure EH systems'),
    ('SOLAR_MODULAR_WELLHEAD',      'MQTT',         'MODBUS_RTU',  'Low-power IoT protocol preferred'),
    ('SCADA_OUTSTATION',            'DNP3',         'MODBUS_TCP',  'Legacy RTU outstations'),
    ('FPSO_HPU',                    'MODBUS_TCP',   'OPC_UA',      'Hydraulic power unit controllers'),
    ('SUBSEA_TREE',                 'MODBUS_TCP',   NULL,          'Via umbilical to topside MCS'),
    ('EMERGENCY_SHUTDOWN',          'MODBUS_TCP',   'DNP3',        'ESD panel I/O modules'),
    ('FUSIBLE_LOOP',                'MODBUS_RTU',   NULL,          'Temperature loop monitoring'),
    ('COIL_TUBE_PRESSURE_PILOT',    'MODBUS_RTU',   'MQTT',        'Pressure safety pilots'),
    ('TESTING_CALIBRATION',         'MODBUS_TCP',   'OPC_UA',      'Test and calibration equipment'),
    ('SOLAR_AIR_COMPRESSOR',        'MQTT',         'MODBUS_RTU',  'Solar-powered compressor control');

-- ─── Views ────────────────────────────────────────────────────────────────────

-- Calibration dashboard view
CREATE OR REPLACE VIEW wells.calibration_dashboard AS
SELECT
    cs.calibration_id,
    cs.well_id,
    w.well_name,
    w.api_number,
    sr.sensor_tag,
    sr.sensor_name,
    sr.sensor_type,
    sr.unit,
    cs.calibration_type,
    cs.last_calibration_date,
    cs.next_due_date,
    cs.status,
    cs.current_drift_pct,
    cs.drift_threshold_pct,
    cs.interval_days,
    cs.assigned_technician,
    CASE
        WHEN cs.next_due_date < CURRENT_DATE THEN 'OVERDUE'
        WHEN cs.next_due_date < CURRENT_DATE + INTERVAL '30 days' THEN 'DUE_SOON'
        ELSE 'CURRENT'
    END AS computed_status,
    (cs.next_due_date - CURRENT_DATE) AS days_until_due
FROM wells.calibration_schedule cs
JOIN wells.sensor_registry sr ON cs.sensor_id = sr.sensor_id
JOIN wells.wells w ON cs.well_id = w.well_id
ORDER BY cs.next_due_date ASC;

-- Site connectivity fleet view
CREATE OR REPLACE VIEW wells.connectivity_fleet AS
SELECT
    sc.well_id,
    w.well_name,
    w.api_number,
    w.latitude,
    w.longitude,
    sc.status,
    sc.link_quality_pct,
    sc.buffer_depth,
    sc.last_upload_ok,
    sc.last_seen_at,
    sc.protocols_active,
    sc.solar_voltage_v,
    sc.battery_soc_pct,
    sc.compressor_running,
    sc.site_power_mode,
    EXTRACT(EPOCH FROM (NOW() - sc.last_seen_at)) AS seconds_since_last_seen
FROM wells.site_connectivity sc
JOIN wells.wells w ON sc.well_id = w.well_id
ORDER BY sc.link_quality_pct ASC;

-- FPSO fleet view
CREATE OR REPLACE VIEW wells.fpso_fleet AS
SELECT
    fv.vessel_id,
    fv.vessel_name,
    fv.imo_number,
    fv.vessel_type,
    fv.latitude,
    fv.longitude,
    fv.water_depth_m,
    fv.processing_capacity_bpd,
    fv.status,
    COUNT(DISTINCT st.tree_id) AS subsea_tree_count,
    COUNT(DISTINCT hu.hpu_id) AS hpu_count,
    COUNT(DISTINCT sm.manifold_id) AS manifold_count
FROM wells.fpso_vessels fv
LEFT JOIN wells.subsea_trees st ON st.vessel_id = fv.vessel_id
LEFT JOIN wells.hpu_units hu ON hu.vessel_id = fv.vessel_id
LEFT JOIN wells.subsea_manifolds sm ON sm.vessel_id = fv.vessel_id
GROUP BY fv.vessel_id;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE wells.actuator_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE wells.calibration_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE wells.site_connectivity ENABLE ROW LEVEL SECURITY;

-- Operators can read all; only supervisors can issue actuator commands
CREATE POLICY actuator_commands_read ON wells.actuator_commands
    FOR SELECT USING (TRUE);

CREATE POLICY actuator_commands_insert ON wells.actuator_commands
    FOR INSERT WITH CHECK (
        current_setting('app.user_role', TRUE) IN ('SUPERVISOR', 'ADMINISTRATOR')
    );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_fpso_vessels_field ON wells.fpso_vessels(field_id);
CREATE INDEX idx_fpso_vessels_location ON wells.fpso_vessels USING GIST(location);
CREATE INDEX idx_hpu_units_vessel ON wells.hpu_units(vessel_id);
CREATE INDEX idx_hpu_units_well ON wells.hpu_units(well_id);
CREATE INDEX idx_subsea_trees_well ON wells.subsea_trees(well_id);
CREATE INDEX idx_subsea_trees_vessel ON wells.subsea_trees(vessel_id);
CREATE INDEX idx_subsea_trees_location ON wells.subsea_trees USING GIST(location);
CREATE INDEX idx_valves_well ON wells.valves(well_id);
CREATE INDEX idx_valves_tree ON wells.valves(tree_id);
CREATE INDEX idx_sensor_registry_well ON wells.sensor_registry(well_id);
CREATE INDEX idx_connectivity_well ON wells.site_connectivity(well_id);
CREATE INDEX idx_protocol_configs_well ON wells.protocol_configs(well_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA: cybersecurity  (IEC 62443 / NERC CIP)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS cybersecurity;

CREATE TABLE IF NOT EXISTS cybersecurity.security_zones (
    zone_id          TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    purdue_level     INTEGER NOT NULL CHECK (purdue_level BETWEEN 0 AND 5),
    target_sl        INTEGER NOT NULL CHECK (target_sl BETWEEN 1 AND 4),
    current_sl       INTEGER NOT NULL CHECK (current_sl BETWEEN 1 AND 4),
    asset_count      INTEGER DEFAULT 0,
    last_scan_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cybersecurity.vulnerabilities (
    vuln_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cve_id           TEXT NOT NULL,
    asset_name       TEXT NOT NULL,
    zone_id          TEXT REFERENCES cybersecurity.security_zones(zone_id),
    severity         TEXT NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFO')),
    cvss_score       NUMERIC(3,1),
    description      TEXT,
    patch_available  BOOLEAN DEFAULT FALSE,
    remediated_at    TIMESTAMPTZ,
    discovered_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cybersecurity.security_incidents (
    incident_id      TEXT PRIMARY KEY,
    occurred_at      TIMESTAMPTZ NOT NULL,
    incident_type    TEXT NOT NULL,
    source_ip        INET,
    target_asset     TEXT NOT NULL,
    severity         TEXT NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFO')),
    status           TEXT NOT NULL CHECK (status IN ('OPEN','INVESTIGATING','CONTAINED','RESOLVED')),
    description      TEXT,
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cybersecurity.certificates (
    cert_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT NOT NULL,
    asset_fqdn       TEXT NOT NULL,
    issuer           TEXT,
    not_before       DATE,
    not_after        DATE NOT NULL,
    auto_renew       BOOLEAN DEFAULT TRUE,
    last_checked_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vuln_severity ON cybersecurity.vulnerabilities(severity, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_status ON cybersecurity.security_incidents(status, occurred_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA: digital_twin  (Nodal Analysis / Physics Simulation)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS digital_twin;

CREATE TABLE IF NOT EXISTS digital_twin.well_models (
    model_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id          UUID NOT NULL REFERENCES wells.wells(well_id) ON DELETE CASCADE,
    reservoir_pressure_psi NUMERIC(10,2),
    q_max_bpd        NUMERIC(10,2),
    depth_ft         NUMERIC(10,2),
    fluid_gradient   NUMERIC(6,4),
    bubble_point_psi NUMERIC(10,2),
    ooip_mmstb       NUMERIC(10,3),
    decline_rate_di  NUMERIC(6,4),
    skin_factor      NUMERIC(6,2),
    model_version    INTEGER DEFAULT 1,
    last_calibrated  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS digital_twin.nodal_scenarios (
    scenario_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id          UUID NOT NULL REFERENCES wells.wells(well_id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    esp_frequency_hz NUMERIC(5,2),
    wellhead_pressure_psi NUMERIC(10,2),
    gor_override     NUMERIC(10,2),
    operating_q_bpd  NUMERIC(10,2),
    operating_pwf_psi NUMERIC(10,2),
    delta_q_bpd      NUMERIC(10,2),
    created_by       TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS digital_twin.optimization_recommendations (
    rec_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id          UUID NOT NULL REFERENCES wells.wells(well_id) ON DELETE CASCADE,
    priority         TEXT NOT NULL CHECK (priority IN ('HIGH','MEDIUM','LOW')),
    action_text      TEXT NOT NULL,
    estimated_gain_bpd NUMERIC(10,2),
    confidence_pct   NUMERIC(5,2),
    basis            TEXT,
    accepted_at      TIMESTAMPTZ,
    accepted_by      TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA: production_allocation
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS production_allocation;

CREATE TABLE IF NOT EXISTS production_allocation.separators (
    separator_id     TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    separator_type   TEXT NOT NULL CHECK (separator_type IN ('PRODUCTION','TEST','BULK')),
    facility_id      TEXT,
    allocation_method TEXT NOT NULL CHECK (allocation_method IN ('TEST_BASED','PROPORTIONAL','SIMULATION')),
    active           BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_allocation.well_allocations (
    allocation_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id          UUID NOT NULL REFERENCES wells.wells(well_id) ON DELETE CASCADE,
    separator_id     TEXT NOT NULL REFERENCES production_allocation.separators(separator_id),
    allocation_date  DATE NOT NULL,
    allocation_factor NUMERIC(6,5) NOT NULL CHECK (allocation_factor BETWEEN 0 AND 1),
    allocated_oil_bpd NUMERIC(10,2),
    allocated_gas_mmscfd NUMERIC(10,4),
    allocated_water_bpd NUMERIC(10,2),
    imbalance_bbl    NUMERIC(10,2) DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (well_id, separator_id, allocation_date)
);

CREATE TABLE IF NOT EXISTS production_allocation.well_tests (
    test_id          TEXT PRIMARY KEY,
    well_id          UUID NOT NULL REFERENCES wells.wells(well_id) ON DELETE CASCADE,
    test_date        DATE NOT NULL,
    duration_hrs     NUMERIC(5,2),
    oil_rate_bpd     NUMERIC(10,2),
    gas_rate_mmscfd  NUMERIC(10,4),
    water_rate_bpd   NUMERIC(10,2),
    gor_scf_bbl      NUMERIC(10,2),
    wor              NUMERIC(6,4),
    status           TEXT NOT NULL CHECK (status IN ('SCHEDULED','IN_PROGRESS','COMPLETE','OVERDUE')),
    technician       TEXT,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alloc_well_date ON production_allocation.well_allocations(well_id, allocation_date DESC);
CREATE INDEX IF NOT EXISTS idx_well_test_date ON production_allocation.well_tests(test_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA: sis  (Safety Instrumented Systems — IEC 61511)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS sis;

CREATE TABLE IF NOT EXISTS sis.safety_instrumented_functions (
    sif_id           TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    facility_id      TEXT,
    sil_required     INTEGER NOT NULL CHECK (sil_required BETWEEN 1 AND 4),
    sil_achieved     INTEGER NOT NULL CHECK (sil_achieved BETWEEN 1 AND 4),
    pfd_avg          NUMERIC(10,6),
    status           TEXT NOT NULL CHECK (status IN ('NORMAL','BYPASSED','TRIPPED','MAINTENANCE','DEGRADED')),
    bypass_moc_ref   TEXT,
    last_proof_test  DATE,
    next_proof_test  DATE,
    trip_count_ytd   INTEGER DEFAULT 0,
    description      TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sis.esd_trips (
    trip_id          TEXT PRIMARY KEY,
    occurred_at      TIMESTAMPTZ NOT NULL,
    facility_id      TEXT,
    sif_id           TEXT REFERENCES sis.safety_instrumented_functions(sif_id),
    cause            TEXT NOT NULL,
    duration_min     INTEGER,
    production_loss_bbl NUMERIC(10,2),
    root_cause       TEXT,
    corrective_action TEXT,
    closed_at        TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sis.proof_tests (
    pt_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sif_id           TEXT NOT NULL REFERENCES sis.safety_instrumented_functions(sif_id),
    scheduled_date   DATE NOT NULL,
    completed_date   DATE,
    technician       TEXT,
    pfd_measured     NUMERIC(10,6),
    result           TEXT CHECK (result IN ('PASS','FAIL','PARTIAL')),
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sif_status ON sis.safety_instrumented_functions(status);
CREATE INDEX IF NOT EXISTS idx_esd_trip_date ON sis.esd_trips(occurred_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA: multi_tenant  (Tenant isolation metadata — RLS enforced)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS multi_tenant;

CREATE TABLE IF NOT EXISTS multi_tenant.tenants (
    tenant_id        TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    tier             TEXT NOT NULL CHECK (tier IN ('ENTERPRISE','PROFESSIONAL','STARTER')),
    data_isolation   TEXT NOT NULL CHECK (data_isolation IN ('CLUSTER','DATABASE','SCHEMA')),
    region           TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','PENDING')),
    max_wells        INTEGER,
    max_users        INTEGER,
    storage_quota_gb INTEGER,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA: regulatory  (API 14C / BSEE OGOR / EPA Subpart W)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS regulatory;

CREATE TABLE IF NOT EXISTS regulatory.report_templates (
    template_id      TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    agency           TEXT NOT NULL,
    regulation_ref   TEXT,
    frequency        TEXT NOT NULL CHECK (frequency IN ('MONTHLY','QUARTERLY','ANNUALLY','ON_DEMAND')),
    active           BOOLEAN DEFAULT TRUE
);

INSERT INTO regulatory.report_templates VALUES
    ('API14C',    'API 14C Surface Safety System Documentation', 'API',  'API RP 14C',     'ANNUALLY',  TRUE),
    ('BSEE_OGOR', 'BSEE Oil and Gas Operations Report',          'BSEE', '30 CFR Part 250', 'MONTHLY',  TRUE),
    ('EPA_W',     'EPA Subpart W GHG Emissions Report',          'EPA',  '40 CFR Part 98',  'ANNUALLY', TRUE),
    ('DOGGR',     'DOGGR Monthly Production Report',             'DOGGR','14 CCR 1724',     'MONTHLY',  TRUE)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS regulatory.report_submissions (
    submission_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id      TEXT NOT NULL REFERENCES regulatory.report_templates(template_id),
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('DRAFT','REVIEW','SUBMITTED','ACCEPTED','REJECTED')),
    submitted_by     TEXT,
    submitted_at     TIMESTAMPTZ,
    file_path        TEXT,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_submission_status ON regulatory.report_submissions(status, period_end DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA: shift_handover
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS shift_handover;

CREATE TABLE IF NOT EXISTS shift_handover.reports (
    report_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_type       TEXT NOT NULL CHECK (shift_type IN ('DAY','NIGHT')),
    shift_date       DATE NOT NULL,
    outgoing_operator TEXT NOT NULL,
    incoming_operator TEXT,
    total_oil_bpd    NUMERIC(10,2),
    total_gas_mmscfd NUMERIC(10,4),
    active_alarms    INTEGER DEFAULT 0,
    critical_alarms  INTEGER DEFAULT 0,
    workovers_active INTEGER DEFAULT 0,
    calibrations_due INTEGER DEFAULT 0,
    notes            TEXT,
    status           TEXT NOT NULL CHECK (status IN ('DRAFT','SIGNED_OFF','DELIVERED')),
    signed_off_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_report_date ON shift_handover.reports(shift_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCHEMA: pi_historian  (PI Web API v2 compatibility layer)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS pi_historian;

CREATE TABLE IF NOT EXISTS pi_historian.pi_points (
    pi_point_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name         TEXT NOT NULL UNIQUE,
    well_id          UUID REFERENCES wells.wells(well_id),
    sensor_type      TEXT NOT NULL,
    engineering_unit TEXT,
    descriptor       TEXT,
    point_type       TEXT DEFAULT 'Float32',
    scan_class       INTEGER DEFAULT 1,
    active           BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pi_historian.pi_archive (
    tag_name         TEXT NOT NULL,
    timestamp        TIMESTAMPTZ NOT NULL,
    value            DOUBLE PRECISION,
    quality          INTEGER DEFAULT 192,  -- 192 = Good (OPC quality code)
    PRIMARY KEY (tag_name, timestamp)
);

-- TimescaleDB hypertable for PI archive (high-frequency historian data)
SELECT create_hypertable('pi_historian.pi_archive', 'timestamp',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_pi_archive_tag ON pi_historian.pi_archive(tag_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pi_points_well ON pi_historian.pi_points(well_id);

-- ============================================================
-- ME-02: Kuwait NCSC Data Classification (Decision No. 1/2025)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS compliance;

CREATE TYPE IF NOT EXISTS ncsc_classification AS ENUM ('public', 'internal', 'confidential', 'restricted');

CREATE TABLE IF NOT EXISTS compliance.data_classification_policy (
    id              SERIAL PRIMARY KEY,
    table_name      VARCHAR(128) NOT NULL,
    column_name     VARCHAR(128),
    classification  ncsc_classification NOT NULL DEFAULT 'internal',
    justification   TEXT,
    owner           VARCHAR(128),
    review_date     DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wells.wells ADD COLUMN IF NOT EXISTS data_classification ncsc_classification DEFAULT 'confidential';
ALTER TABLE alarms.alarms ADD COLUMN IF NOT EXISTS data_classification ncsc_classification DEFAULT 'confidential';
ALTER TABLE financials.transactions ADD COLUMN IF NOT EXISTS data_classification ncsc_classification DEFAULT 'restricted';

CREATE TABLE IF NOT EXISTS compliance.classification_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    table_name      VARCHAR(128) NOT NULL,
    record_id       BIGINT,
    old_class       ncsc_classification,
    new_class       ncsc_classification NOT NULL,
    changed_by      VARCHAR(128) NOT NULL,
    changed_at      TIMESTAMPTZ DEFAULT NOW(),
    reason          TEXT
);

INSERT INTO compliance.data_classification_policy (table_name, column_name, classification, justification, owner)
VALUES
    ('wells.wells', 'ALL', 'confidential', 'Well location and production data — NCSC Decision 1/2025 Art. 4.3', 'Operations Manager'),
    ('telemetry.readings', 'ALL', 'confidential', 'Real-time sensor data — operational security', 'SCADA Engineer'),
    ('alarms.alarms', 'ALL', 'confidential', 'Safety system alarm records', 'HSE Manager'),
    ('financials.transactions', 'ALL', 'restricted', 'Financial ledger — highest sensitivity, in-country storage required', 'CFO'),
    ('wells.workovers', 'ALL', 'confidential', 'Workover job records', 'Operations Manager')
ON CONFLICT DO NOTHING;
