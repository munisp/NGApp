-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 0022: Platform Improvements — Indexes, Soft Delete, Idempotency
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
-- Foreign key columns (most critical for JOIN performance)
CREATE INDEX IF NOT EXISTS idx_telemetry_well_id ON telemetry_readings(well_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON telemetry_readings(recorded_at);
CREATE INDEX IF NOT EXISTS idx_alarms_well_id ON alarms(well_id);
CREATE INDEX IF NOT EXISTS idx_alarms_state ON alarms(state);
CREATE INDEX IF NOT EXISTS idx_alarms_severity ON alarms(severity);
CREATE INDEX IF NOT EXISTS idx_alarms_created_at ON alarms(created_at);
CREATE INDEX IF NOT EXISTS idx_alarm_rules_well_id ON alarm_rules(well_id);
CREATE INDEX IF NOT EXISTS idx_production_records_well_id ON production_records(well_id);
CREATE INDEX IF NOT EXISTS idx_production_records_date ON production_records(date);
CREATE INDEX IF NOT EXISTS idx_workovers_well_id ON workovers(well_id);
CREATE INDEX IF NOT EXISTS idx_workovers_status ON workovers(status);
CREATE INDEX IF NOT EXISTS idx_workover_costs_workover_id ON workover_costs(workover_id);
CREATE INDEX IF NOT EXISTS idx_calibration_well_id ON calibration_records(well_id);
CREATE INDEX IF NOT EXISTS idx_calibration_status ON calibration_records(status);
CREATE INDEX IF NOT EXISTS idx_permits_well_id ON permits(well_id);
CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);
CREATE INDEX IF NOT EXISTS idx_hpu_fpso_id ON hpu_units(fpso_id);
CREATE INDEX IF NOT EXISTS idx_hpu_well_id ON hpu_units(well_id);
CREATE INDEX IF NOT EXISTS idx_subsea_well_id ON subsea_trees(well_id);
CREATE INDEX IF NOT EXISTS idx_subsea_fpso_id ON subsea_trees(fpso_id);
CREATE INDEX IF NOT EXISTS idx_site_well_id ON site_connectivity(well_id);
CREATE INDEX IF NOT EXISTS idx_actuator_well_id ON actuator_commands(well_id);
CREATE INDEX IF NOT EXISTS idx_actuator_status ON actuator_commands(status);
CREATE INDEX IF NOT EXISTS idx_financial_well_id ON financial_entries(well_id);
CREATE INDEX IF NOT EXISTS idx_financial_status ON financial_entries(status);
CREATE INDEX IF NOT EXISTS idx_financial_entry_type ON financial_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_allocation_well_id ON allocation_records(well_id);
CREATE INDEX IF NOT EXISTS idx_allocation_date ON allocation_records(date);
CREATE INDEX IF NOT EXISTS idx_shift_date ON shift_handovers(date);
CREATE INDEX IF NOT EXISTS idx_regulatory_status ON regulatory_reports(status);
CREATE INDEX IF NOT EXISTS idx_regulatory_type ON regulatory_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_hse_well_id ON hse_incidents(well_id);
CREATE INDEX IF NOT EXISTS idx_hse_severity ON hse_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_hse_occurred_at ON hse_incidents(occurred_at);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_occurred ON security_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_well_id ON ml_predictions(well_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_model_type ON ml_predictions(model_type);
CREATE INDEX IF NOT EXISTS idx_dt_scenarios_well_id ON digital_twin_scenarios(well_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sil_controls_assessment ON sil_controls(assessment_id);
CREATE INDEX IF NOT EXISTS idx_sil_gaps_assessment ON sil_gaps(assessment_id);
CREATE INDEX IF NOT EXISTS idx_sil_gaps_control ON sil_gaps(control_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_devices_well_id ON devices(well_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_firmware_device_type ON firmware_versions(device_type);
CREATE INDEX IF NOT EXISTS idx_ota_campaigns_status ON ota_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ota_device_updates_campaign ON ota_device_updates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ota_device_updates_device ON ota_device_updates(device_id);
CREATE INDEX IF NOT EXISTS idx_decline_curves_well_id ON decline_curve_params(well_id);
CREATE INDEX IF NOT EXISTS idx_well_physics_well_id ON well_physics_params(well_id);
CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_dr_events_program ON dr_events(program_id);
CREATE INDEX IF NOT EXISTS idx_dr_events_status ON dr_events(status);
CREATE INDEX IF NOT EXISTS idx_dr_vens_program ON dr_vens(program_id);
CREATE INDEX IF NOT EXISTS idx_dr_audit_event ON dr_audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_model_metrics_tag ON model_metrics(tag);
CREATE INDEX IF NOT EXISTS idx_incident_triage_status ON incident_triage(status);
CREATE INDEX IF NOT EXISTS idx_mojaloop_status ON mojaloop_settlements(status);
CREATE INDEX IF NOT EXISTS idx_mojaloop_well_id ON mojaloop_settlements(well_id);
CREATE INDEX IF NOT EXISTS idx_damage_well_id ON damage_assessments(well_id);
CREATE INDEX IF NOT EXISTS idx_damage_classification ON damage_assessments(classification);
CREATE INDEX IF NOT EXISTS idx_damage_repair_status ON damage_assessments(repair_status);
CREATE INDEX IF NOT EXISTS idx_damage_evidence_assessment ON damage_evidence(assessment_id);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_assessment ON repair_tickets(assessment_id);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_status ON repair_tickets(status);
CREATE INDEX IF NOT EXISTS idx_damage_images_assessment ON damage_images(assessment_id);
CREATE INDEX IF NOT EXISTS idx_repair_cost_ticket ON repair_cost_estimates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_well_id ON alert_thresholds(well_id);
CREATE INDEX IF NOT EXISTS idx_geomech_well_id ON geomechanical_models(well_id);
CREATE INDEX IF NOT EXISTS idx_stress_model_id ON stress_profiles(model_id);
CREATE INDEX IF NOT EXISTS idx_stress_well_id ON stress_profiles(well_id);
CREATE INDEX IF NOT EXISTS idx_mud_inventory_location ON mud_inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_mud_tx_inventory ON mud_transactions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_mud_tx_well ON mud_transactions(well_id);
CREATE INDEX IF NOT EXISTS idx_sand_well_id ON sand_production_records(well_id);
CREATE INDEX IF NOT EXISTS idx_produced_water_field ON produced_water_records(field_id);
CREATE INDEX IF NOT EXISTS idx_heavy_oil_well_id ON heavy_oil_parameters(well_id);
CREATE INDEX IF NOT EXISTS idx_liquid_loading_well ON liquid_loading_events(well_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_well_id ON production_forecasts(well_id);
CREATE INDEX IF NOT EXISTS idx_casing_well_id ON casing_inspections(well_id);
CREATE INDEX IF NOT EXISTS idx_pressure_tests_well_id ON pressure_tests(well_id);
CREATE INDEX IF NOT EXISTS idx_reservoir_pressure_well ON reservoir_pressure_records(well_id);
CREATE INDEX IF NOT EXISTS idx_reservoir_pressure_field ON reservoir_pressure_records(field_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user_id ON ai_copilot_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_copilot_chats(session_id);
CREATE INDEX IF NOT EXISTS idx_iec62443_controls_status ON iec62443_controls(status);
CREATE INDEX IF NOT EXISTS idx_sil_functions_status ON sil_functions(status);
CREATE INDEX IF NOT EXISTS idx_sil_test_function ON sil_test_records(sil_function_id);
CREATE INDEX IF NOT EXISTS idx_soc2_events_user ON soc2_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_soc2_events_action ON soc2_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_soc2_events_time ON soc2_audit_events(event_time);
CREATE INDEX IF NOT EXISTS idx_historian_well_id ON historian_streams(well_id);
CREATE INDEX IF NOT EXISTS idx_dt_models_well_id ON digital_twin_models(well_id);
CREATE INDEX IF NOT EXISTS idx_fpso_twin_fpso ON fpso_twin_sessions(fpso_id);
CREATE INDEX IF NOT EXISTS idx_pinn_well_id ON pinn_models(well_id);
CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_wf ON agent_workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_federated_participants_model ON federated_participants(model_id);
CREATE INDEX IF NOT EXISTS idx_federated_participants_tenant ON federated_participants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_osdu_status ON osdu_datasets(status);
CREATE INDEX IF NOT EXISTS idx_prodml_well ON prodml_production_sets(uid_well);
CREATE INDEX IF NOT EXISTS idx_cmms_wo_well ON cmms_work_orders(well_id);
CREATE INDEX IF NOT EXISTS idx_cmms_wo_status ON cmms_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_cmms_integrations_tenant ON cmms_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_allocation_rules_field ON production_allocation_rules(field_id);
CREATE INDEX IF NOT EXISTS idx_well_allocation_rule ON well_allocation_factors(rule_id);
CREATE INDEX IF NOT EXISTS idx_well_allocation_well ON well_allocation_factors(well_id);
CREATE INDEX IF NOT EXISTS idx_allocated_prod_well ON allocated_production(well_id);
CREATE INDEX IF NOT EXISTS idx_allocated_prod_date ON allocated_production(allocation_date);
CREATE INDEX IF NOT EXISTS idx_reservoir_sim_status ON reservoir_simulations(status);
CREATE INDEX IF NOT EXISTS idx_emission_source_well ON emission_sources(well_id);
CREATE INDEX IF NOT EXISTS idx_emission_records_source ON emission_records(source_id);
CREATE INDEX IF NOT EXISTS idx_emission_records_period ON emission_records(reporting_period_start, reporting_period_end);
CREATE INDEX IF NOT EXISTS idx_drone_inspections_well ON drone_inspections(well_id);
CREATE INDEX IF NOT EXISTS idx_drone_inspections_status ON drone_inspections(status);
CREATE INDEX IF NOT EXISTS idx_drone_findings_inspection ON drone_findings(inspection_id);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_tenant ON saas_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_plan ON saas_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_saas_usage_tenant ON saas_usage_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_usage_date ON saas_usage_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_marketplace_installs_app ON marketplace_installs(app_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_installs_tenant ON marketplace_installs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_runs_app ON marketplace_runs(app_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_runs_tenant ON marketplace_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_runs_status ON marketplace_runs(status);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_telemetry_well_time ON telemetry_readings(well_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_production_well_date ON production_records(well_id, date);
CREATE INDEX IF NOT EXISTS idx_alarms_well_state ON alarms(well_id, state);
CREATE INDEX IF NOT EXISTS idx_financial_well_type ON financial_entries(well_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_id ON audit_log(resource, resource_id);

-- Wells: index on status + field for filtered queries
CREATE INDEX IF NOT EXISTS idx_wells_status ON wells(status);
CREATE INDEX IF NOT EXISTS idx_wells_field ON wells(field);

-- ─── SOFT DELETE ─────────────────────────────────────────────────────────────
-- Add deletedAt columns to business-critical tables
ALTER TABLE wells ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE alarms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE workovers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE financial_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE hse_incidents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE damage_assessments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE regulatory_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE calibration_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE sil_assessments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE cmms_work_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE production_forecasts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE drone_inspections ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Partial indexes for soft delete (only index non-deleted rows for common queries)
CREATE INDEX IF NOT EXISTS idx_wells_active ON wells(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alarms_active ON alarms(state) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_devices_active ON devices(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workovers_active ON workovers(status) WHERE deleted_at IS NULL;

-- ─── IDEMPOTENCY KEYS TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(128) NOT NULL UNIQUE,
  user_id VARCHAR(128) NOT NULL,
  route VARCHAR(256) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'processing',
  response_status INTEGER,
  response_body TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ─── FEATURE FLAGS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  flag_key VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  tenant_ids TEXT,
  percentage INTEGER DEFAULT 100,
  created_by VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── DATA QUALITY RULES TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_quality_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(128) NOT NULL,
  sensor_type VARCHAR(64) NOT NULL,
  min_value REAL,
  max_value REAL,
  max_rate_of_change REAL,
  unit VARCHAR(16),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_quality_violations (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL,
  well_id VARCHAR(32) NOT NULL,
  sensor_type VARCHAR(64) NOT NULL,
  value REAL NOT NULL,
  expected_range VARCHAR(64),
  violation_type VARCHAR(32) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'warning',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by VARCHAR(128),
  acknowledged_at TIMESTAMP,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dq_violations_well ON data_quality_violations(well_id);
CREATE INDEX IF NOT EXISTS idx_dq_violations_rule ON data_quality_violations(rule_id);
CREATE INDEX IF NOT EXISTS idx_dq_violations_detected ON data_quality_violations(detected_at);
