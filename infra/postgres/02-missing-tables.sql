-- ============================================================================
-- OG-RMM Platform — Missing Tables Migration
-- Creates tables referenced by tRPC routers but absent from init.sql.
-- All tables use IF NOT EXISTS for idempotent execution.
-- ============================================================================

-- ─── Tenants & Multi-Tenancy ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
    id              SERIAL PRIMARY KEY,
    tenant_id       VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(200) NOT NULL,
    fields          TEXT[] NOT NULL DEFAULT '{}',
    contact_email   VARCHAR(255),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_users (
    id              SERIAL PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_open_id    VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'OPERATOR',
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_open_id)
);

-- ─── Production Targets ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS production_targets (
    id                      SERIAL PRIMARY KEY,
    well_id                 VARCHAR(100) NOT NULL,
    target_date             DATE NOT NULL,
    oil_target_bpd          NUMERIC(12,2) NOT NULL DEFAULT 0,
    gas_target_mmscfd       NUMERIC(12,4) NOT NULL DEFAULT 0,
    water_injection_bwpd    NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(well_id, target_date)
);

-- ─── Well Tests ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS well_tests (
    id                  SERIAL PRIMARY KEY,
    test_id             VARCHAR(100) UNIQUE NOT NULL,
    well_id             VARCHAR(100) NOT NULL,
    test_type           VARCHAR(50) NOT NULL,
    scheduled_at        TIMESTAMPTZ NOT NULL,
    duration_hours      NUMERIC(6,1) DEFAULT 24,
    assigned_to         VARCHAR(255),
    notes               TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    oil_rate_bpd        NUMERIC(12,2),
    gas_rate_mmscfd     NUMERIC(12,4),
    water_rate_bwpd     NUMERIC(12,2),
    bhp_psi             NUMERIC(10,2),
    bht_deg_f           NUMERIC(8,2),
    skin_factor         NUMERIC(8,4),
    permeability_md     NUMERIC(10,4),
    created_by          VARCHAR(255),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Shift Handovers ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shift_handovers (
    id                  SERIAL PRIMARY KEY,
    handover_id         VARCHAR(100) UNIQUE NOT NULL,
    field               VARCHAR(200),
    shift_date          DATE NOT NULL,
    shift_type          VARCHAR(20) NOT NULL, -- DAY, NIGHT
    outgoing_operator   VARCHAR(255) NOT NULL,
    incoming_operator   VARCHAR(255),
    status              VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    summary             TEXT,
    safety_issues       TEXT,
    production_summary  TEXT,
    equipment_status    TEXT,
    pending_actions     JSONB DEFAULT '[]'::jsonb,
    acknowledged_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Sand Management ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sand_monitoring (
    id                      SERIAL PRIMARY KEY,
    well_id                 VARCHAR(100) NOT NULL UNIQUE,
    sand_concentration_ppm  NUMERIC(10,2) DEFAULT 0,
    last_sand_event         TIMESTAMPTZ,
    choke_size_64ths        INTEGER DEFAULT 32,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sand_events (
    id                      SERIAL PRIMARY KEY,
    well_id                 VARCHAR(100) NOT NULL,
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sand_concentration_ppm  NUMERIC(10,2) NOT NULL,
    production_rate_bpd     NUMERIC(12,2),
    choke_setting           INTEGER,
    action_taken            VARCHAR(50) NOT NULL,
    notes                   TEXT,
    logged_by               VARCHAR(255),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Water Injection ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS water_injection_data (
    id                      SERIAL PRIMARY KEY,
    well_id                 VARCHAR(100) NOT NULL,
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    injection_rate_bwpd     NUMERIC(12,2) NOT NULL,
    injection_pressure_psi  NUMERIC(10,2),
    water_quality_ppm       NUMERIC(10,2),
    cumulative_injection_bbl NUMERIC(15,2) DEFAULT 0,
    status                  VARCHAR(30) DEFAULT 'ACTIVE',
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Well Logs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS well_logs (
    id              SERIAL PRIMARY KEY,
    well_id         VARCHAR(100) NOT NULL,
    log_type        VARCHAR(100) NOT NULL,
    log_date        DATE NOT NULL,
    top_depth_ft    NUMERIC(10,2),
    bottom_depth_ft NUMERIC(10,2),
    file_path       TEXT,
    interpreter     VARCHAR(255),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workover Jobs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workover_jobs (
    id              SERIAL PRIMARY KEY,
    job_id          VARCHAR(100) UNIQUE NOT NULL,
    well_id         VARCHAR(100) NOT NULL,
    job_type        VARCHAR(100) NOT NULL,
    description     TEXT,
    contractor_id   VARCHAR(100),
    status          VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    planned_start   DATE,
    planned_end     DATE,
    actual_start    DATE,
    actual_end      DATE,
    cost_estimate   NUMERIC(15,2),
    actual_cost     NUMERIC(15,2),
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Damage Assessment ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS damage_assessments (
    id                  SERIAL PRIMARY KEY,
    assessment_id       VARCHAR(100) UNIQUE NOT NULL,
    well_id             VARCHAR(100),
    field               VARCHAR(200),
    assessment_type     VARCHAR(50) NOT NULL,
    severity            VARCHAR(20) NOT NULL,
    description         TEXT NOT NULL,
    location_description TEXT,
    latitude            NUMERIC(10,7),
    longitude           NUMERIC(10,7),
    status              VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    assigned_to         VARCHAR(255),
    estimated_cost      NUMERIC(15,2),
    created_by          VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS damage_evidence (
    id                  SERIAL PRIMARY KEY,
    assessment_id       VARCHAR(100) NOT NULL,
    evidence_type       VARCHAR(50) NOT NULL,
    file_path           TEXT NOT NULL,
    description         TEXT,
    uploaded_by         VARCHAR(255),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS damage_images (
    id                  SERIAL PRIMARY KEY,
    assessment_id       VARCHAR(100) NOT NULL,
    image_url           TEXT NOT NULL,
    caption             TEXT,
    analysis_result     JSONB,
    uploaded_by         VARCHAR(255),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Materials Management ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
    id              SERIAL PRIMARY KEY,
    supplier_id     VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(300) NOT NULL,
    contact_name    VARCHAR(200),
    contact_email   VARCHAR(255),
    contact_phone   VARCHAR(50),
    country         VARCHAR(100),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contractors (
    id              SERIAL PRIMARY KEY,
    contractor_id   VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(300) NOT NULL,
    specialty       VARCHAR(200),
    contact_email   VARCHAR(255),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_master (
    id              SERIAL PRIMARY KEY,
    material_id     VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(300) NOT NULL,
    category        VARCHAR(100),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'EA',
    min_stock_level NUMERIC(12,2) DEFAULT 0,
    reorder_point   NUMERIC(12,2) DEFAULT 0,
    unit_cost       NUMERIC(12,2) DEFAULT 0,
    supplier_id     VARCHAR(100),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_locations (
    id              SERIAL PRIMARY KEY,
    location_id     VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(200) NOT NULL,
    field           VARCHAR(200),
    location_type   VARCHAR(50) DEFAULT 'WAREHOUSE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_batches (
    id              SERIAL PRIMARY KEY,
    batch_id        VARCHAR(100) UNIQUE NOT NULL,
    material_id     VARCHAR(100) NOT NULL,
    location_id     VARCHAR(100) NOT NULL,
    quantity        NUMERIC(12,2) NOT NULL DEFAULT 0,
    lot_number      VARCHAR(100),
    expiry_date     DATE,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_requests (
    id              SERIAL PRIMARY KEY,
    request_id      VARCHAR(100) UNIQUE NOT NULL,
    requester_id    VARCHAR(255) NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    priority        VARCHAR(20) DEFAULT 'NORMAL',
    notes           TEXT,
    approved_by     VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_request_items (
    id              SERIAL PRIMARY KEY,
    request_id      VARCHAR(100) NOT NULL,
    material_id     VARCHAR(100) NOT NULL,
    quantity        NUMERIC(12,2) NOT NULL,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id              SERIAL PRIMARY KEY,
    po_number       VARCHAR(100) UNIQUE NOT NULL,
    supplier_id     VARCHAR(100) NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    total_amount    NUMERIC(15,2) DEFAULT 0,
    currency        VARCHAR(10) DEFAULT 'USD',
    ordered_by      VARCHAR(255),
    ordered_at      TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id              SERIAL PRIMARY KEY,
    po_number       VARCHAR(100) NOT NULL,
    material_id     VARCHAR(100) NOT NULL,
    quantity        NUMERIC(12,2) NOT NULL,
    unit_price      NUMERIC(12,2) NOT NULL,
    total_price     NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS transfer_orders (
    id              SERIAL PRIMARY KEY,
    transfer_id     VARCHAR(100) UNIQUE NOT NULL,
    from_location   VARCHAR(100) NOT NULL,
    to_location     VARCHAR(100) NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    requested_by    VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_order_items (
    id              SERIAL PRIMARY KEY,
    transfer_id     VARCHAR(100) NOT NULL,
    material_id     VARCHAR(100) NOT NULL,
    quantity        NUMERIC(12,2) NOT NULL
);

-- ─── Repair Tickets ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS repair_tickets (
    id              SERIAL PRIMARY KEY,
    ticket_id       VARCHAR(100) UNIQUE NOT NULL,
    well_id         VARCHAR(100),
    equipment_id    VARCHAR(100),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status          VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    assigned_to     VARCHAR(255),
    contractor_id   VARCHAR(100),
    estimated_hours NUMERIC(6,1),
    actual_hours    NUMERIC(6,1),
    cost            NUMERIC(15,2),
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

-- ─── Field Issues ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS field_issue_tickets (
    id              SERIAL PRIMARY KEY,
    ticket_id       VARCHAR(100) UNIQUE NOT NULL,
    field           VARCHAR(200) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status          VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    reported_by     VARCHAR(255),
    assigned_to     VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS field_issue_items (
    id              SERIAL PRIMARY KEY,
    ticket_id       VARCHAR(100) NOT NULL,
    item_type       VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,
    status          VARCHAR(30) DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Mud Tank Monitoring ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mud_tank_snapshots (
    id              SERIAL PRIMARY KEY,
    well_id         VARCHAR(100) NOT NULL,
    tank_id         VARCHAR(100) NOT NULL,
    volume_bbl      NUMERIC(10,2) NOT NULL,
    density_ppg     NUMERIC(8,2),
    temperature_f   NUMERIC(8,2),
    mud_type        VARCHAR(50),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Push Notifications ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_log (
    id              SERIAL PRIMARY KEY,
    user_open_id    VARCHAR(255) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    body            TEXT,
    data            JSONB,
    status          VARCHAR(30) NOT NULL DEFAULT 'SENT',
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Alert Thresholds ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_thresholds (
    id              SERIAL PRIMARY KEY,
    well_id         VARCHAR(100) NOT NULL,
    sensor_type     VARCHAR(100) NOT NULL,
    low_threshold   NUMERIC(12,4),
    high_threshold  NUMERIC(12,4),
    critical_low    NUMERIC(12,4),
    critical_high   NUMERIC(12,4),
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(well_id, sensor_type)
);

-- ─── Calibration Records ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calibration_records (
    id                  SERIAL PRIMARY KEY,
    sensor_id           VARCHAR(100) NOT NULL,
    well_id             VARCHAR(100),
    calibration_date    TIMESTAMPTZ NOT NULL,
    calibrated_by       VARCHAR(255),
    result              VARCHAR(30) NOT NULL,
    deviation_pct       NUMERIC(8,4),
    adjustment_applied  BOOLEAN DEFAULT false,
    certificate_path    TEXT,
    next_due            TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_production_targets_well_date ON production_targets(well_id, target_date);
CREATE INDEX IF NOT EXISTS idx_well_tests_well_status ON well_tests(well_id, status);
CREATE INDEX IF NOT EXISTS idx_well_tests_scheduled ON well_tests(scheduled_at) WHERE status = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS idx_shift_handovers_field_date ON shift_handovers(field, shift_date);
CREATE INDEX IF NOT EXISTS idx_sand_events_well ON sand_events(well_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_water_injection_well ON water_injection_data(well_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_damage_assessments_status ON damage_assessments(status);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_status ON repair_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_material_batches_material ON material_batches(material_id, location_id);
CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_log(user_open_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_calibration_records_sensor ON calibration_records(sensor_id, calibration_date);
CREATE INDEX IF NOT EXISTS idx_workover_jobs_well ON workover_jobs(well_id, status);
CREATE INDEX IF NOT EXISTS idx_mud_tank_snapshots_well ON mud_tank_snapshots(well_id, recorded_at);
