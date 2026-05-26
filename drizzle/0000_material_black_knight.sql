CREATE TYPE "public"."alarm_condition" AS ENUM('GT', 'LT', 'GTE', 'LTE');--> statement-breakpoint
CREATE TYPE "public"."alarm_state" AS ENUM('UNACKNOWLEDGED', 'ACKNOWLEDGED', 'CLEARED', 'SUPPRESSED');--> statement-breakpoint
CREATE TYPE "public"."allocation_method" AS ENUM('WELL_TEST', 'METERED', 'CALCULATED', 'ESTIMATED');--> statement-breakpoint
CREATE TYPE "public"."calibration_status" AS ENUM('CURRENT', 'DUE_SOON', 'OVERDUE', 'IN_PROGRESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."command_status" AS ENUM('PENDING', 'SENT', 'ACKNOWLEDGED', 'EXECUTED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."command_type" AS ENUM('VALVE_OPEN', 'VALVE_CLOSE', 'CHOKE_SETPOINT', 'PRESSURE_SETPOINT', 'PUMP_START', 'PUMP_STOP', 'ESD_ACTIVATE', 'ESD_RESET');--> statement-breakpoint
CREATE TYPE "public"."compressor_status" AS ENUM('RUNNING', 'STANDBY', 'FAULT', 'OFF');--> statement-breakpoint
CREATE TYPE "public"."data_classification" AS ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('PENDING', 'POSTED', 'SETTLED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('REVENUE', 'ROYALTY', 'OPEX', 'CAPEX', 'TAX', 'SETTLEMENT', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."fpso_status" AS ENUM('OPERATIONAL', 'MAINTENANCE', 'STANDBY', 'OFFHIRE');--> statement-breakpoint
CREATE TYPE "public"."hpu_status" AS ENUM('RUNNING', 'STANDBY', 'FAULT', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('NEAR_MISS', 'FIRST_AID', 'RECORDABLE', 'LTI', 'FATALITY', 'SPILL', 'FIRE', 'EXPLOSION', 'RELEASE');--> statement-breakpoint
CREATE TYPE "public"."ml_model_type" AS ENUM('ESP_FAILURE', 'ANOMALY_DETECTION', 'PRODUCTION_FORECAST', 'DECLINE_CURVE');--> statement-breakpoint
CREATE TYPE "public"."permit_status" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."permit_type" AS ENUM('HOT_WORK', 'CONFINED_SPACE', 'ELECTRICAL', 'EXCAVATION', 'RADIATION', 'COLD_WORK', 'WORKING_AT_HEIGHT');--> statement-breakpoint
CREATE TYPE "public"."pump_status" AS ENUM('RUNNING', 'STANDBY', 'FAULT');--> statement-breakpoint
CREATE TYPE "public"."report_language" AS ENUM('EN', 'AR', 'BILINGUAL');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('DRAFT', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('API_14C', 'BSEE_OGOR', 'EPA_SUBPART_W', 'MOCCAE', 'ADNOC_HSE', 'KOC_ENV', 'NCSC_INCIDENT');--> statement-breakpoint
CREATE TYPE "public"."security_event_type" AS ENUM('INTRUSION_ATTEMPT', 'MALWARE', 'UNAUTHORIZED_ACCESS', 'POLICY_VIOLATION', 'ANOMALY', 'PHISHING', 'RANSOMWARE', 'SCADA_ATTACK');--> statement-breakpoint
CREATE TYPE "public"."sensor_type" AS ENUM('PRESSURE', 'TEMPERATURE', 'FLOW', 'LEVEL', 'VIBRATION', 'CURRENT', 'VOLTAGE', 'GAS_DETECTOR', 'SAFETY_VALVE');--> statement-breakpoint
CREATE TYPE "public"."shift_type" AS ENUM('MORNING', 'EVENING', 'NIGHT');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('ONLINE', 'DEGRADED', 'OFFLINE', 'BUFFERING', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."telemetry_protocol" AS ENUM('MQTT', 'MODBUS_TCP', 'MODBUS_RTU', 'OPC_UA', 'DNP3', 'HART');--> statement-breakpoint
CREATE TYPE "public"."tree_status" AS ENUM('ACTIVE', 'SHUT_IN', 'MAINTENANCE', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'operator', 'supervisor', 'engineer');--> statement-breakpoint
CREATE TYPE "public"."well_status" AS ENUM('ACTIVE', 'SHUT_IN', 'DRILLING', 'WORKOVER', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."well_type" AS ENUM('OIL', 'GAS', 'WATER_INJECTION', 'DISPOSAL', 'OBSERVATION');--> statement-breakpoint
CREATE TYPE "public"."workover_cost_category" AS ENUM('LABOR', 'EQUIPMENT', 'MATERIALS', 'TRANSPORT', 'THIRD_PARTY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."workover_job_type" AS ENUM('PUMP_REPLACEMENT', 'TUBING_REPAIR', 'STIMULATION', 'PERFORATION', 'SAND_CONTROL', 'SCALE_REMOVAL', 'CALIBRATION', 'INSPECTION', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."workover_priority" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."workover_status" AS ENUM('PLANNED', 'MOBILIZING', 'IN_PROGRESS', 'SUSPENDED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "actuator_commands" (
	"id" serial PRIMARY KEY NOT NULL,
	"command_id" varchar(32) NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"asset_id" varchar(64) NOT NULL,
	"asset_name" varchar(128),
	"command_type" "command_type" NOT NULL,
	"target_value" real,
	"status" "command_status" DEFAULT 'PENDING' NOT NULL,
	"issued_by" varchar(128) NOT NULL,
	"approved_by" varchar(128),
	"confirmation_code" varchar(32),
	"executed_at" timestamp,
	"failure_reason" text,
	"audit_trail" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "actuator_commands_command_id_unique" UNIQUE("command_id")
);
--> statement-breakpoint
CREATE TABLE "alarm_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" varchar(32) NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"tag" varchar(64) NOT NULL,
	"sensor_field" varchar(64) NOT NULL,
	"condition" "alarm_condition" NOT NULL,
	"threshold" real NOT NULL,
	"dead_band" real DEFAULT 0,
	"severity" integer NOT NULL,
	"description" text NOT NULL,
	"unit" varchar(16),
	"isa182_category" varchar(32) DEFAULT 'PROCESS',
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alarm_rules_rule_id_unique" UNIQUE("rule_id")
);
--> statement-breakpoint
CREATE TABLE "alarms" (
	"id" serial PRIMARY KEY NOT NULL,
	"alarm_id" varchar(32) NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"tag" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"severity" integer NOT NULL,
	"state" "alarm_state" DEFAULT 'UNACKNOWLEDGED' NOT NULL,
	"value" real,
	"setpoint" real,
	"unit" varchar(16),
	"acknowledged_by" varchar(128),
	"acknowledged_at" timestamp,
	"suppressed_until" timestamp,
	"cleared_at" timestamp,
	"isa182_category" varchar(32),
	"is_standing" boolean DEFAULT false,
	"is_chattering" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alarms_alarm_id_unique" UNIQUE("alarm_id")
);
--> statement-breakpoint
CREATE TABLE "allocation_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"separator_id" varchar(32),
	"date" timestamp NOT NULL,
	"allocated_oil_bbls" real,
	"allocated_gas_mmscf" real,
	"allocated_water_bbls" real,
	"allocation_factor" real,
	"method" "allocation_method" DEFAULT 'WELL_TEST',
	"imbalance_bbls" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_email" varchar(320),
	"action" varchar(128) NOT NULL,
	"resource" varchar(64) NOT NULL,
	"resource_id" varchar(64),
	"details" json,
	"ip_address" varchar(45),
	"user_agent" varchar(512),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calibration_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"sensor_id" varchar(64) NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"sensor_type" "sensor_type" NOT NULL,
	"tag" varchar(64) NOT NULL,
	"status" "calibration_status" DEFAULT 'CURRENT' NOT NULL,
	"quality_score" integer DEFAULT 100,
	"drift_pct" real DEFAULT 0,
	"last_calibrated_at" timestamp,
	"next_due_at" timestamp,
	"interval_days" integer DEFAULT 90,
	"certificate_ref" varchar(64),
	"nist_traceable" boolean DEFAULT true,
	"technician" varchar(128),
	"notes" text,
	"workover_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_twin_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario_id" varchar(32) NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"reservoir_pressure_psi" real,
	"skin_factor" real,
	"perforation_interval" real,
	"esp_frequency_hz" real,
	"choke_opening_pct" real,
	"predicted_rate_bpd" real,
	"ipr_aof_bpd" real,
	"optimum_rate_bpd" real,
	"created_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "digital_twin_scenarios_scenario_id_unique" UNIQUE("scenario_id")
);
--> statement-breakpoint
CREATE TABLE "financial_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" varchar(32) NOT NULL,
	"well_id" varchar(32),
	"entry_type" "entry_type" NOT NULL,
	"description" text NOT NULL,
	"amount_usd" numeric(15, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'USD',
	"counterparty" varchar(128),
	"tiger_beetle_ref" varchar(64),
	"mojalooop_ref" varchar(64),
	"status" "entry_status" DEFAULT 'PENDING' NOT NULL,
	"value_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "financial_entries_entry_id_unique" UNIQUE("entry_id")
);
--> statement-breakpoint
CREATE TABLE "fpso_vessels" (
	"id" serial PRIMARY KEY NOT NULL,
	"vessel_id" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"imo_number" varchar(16),
	"field" varchar(64),
	"status" "fpso_status" DEFAULT 'OPERATIONAL' NOT NULL,
	"latitude" numeric(10, 6),
	"longitude" numeric(10, 6),
	"storage_bbls" integer,
	"current_inventory_bbls" integer,
	"processing_capacity_bpd" integer,
	"current_production_bpd" integer,
	"data_classification" "data_classification" DEFAULT 'CONFIDENTIAL' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fpso_vessels_vessel_id_unique" UNIQUE("vessel_id")
);
--> statement-breakpoint
CREATE TABLE "hpu_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"hpu_id" varchar(32) NOT NULL,
	"fpso_id" varchar(32),
	"well_id" varchar(32),
	"name" varchar(128) NOT NULL,
	"status" "hpu_status" DEFAULT 'RUNNING' NOT NULL,
	"system_pressure_bar" real,
	"reservoir_level_pct" real,
	"pump_a_status" "pump_status" DEFAULT 'RUNNING',
	"pump_b_status" "pump_status" DEFAULT 'STANDBY',
	"filter_dp_bar" real,
	"oil_temp_c" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hpu_units_hpu_id_unique" UNIQUE("hpu_id")
);
--> statement-breakpoint
CREATE TABLE "hse_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" varchar(32) NOT NULL,
	"well_id" varchar(32),
	"incident_type" "incident_type" NOT NULL,
	"severity" "incident_severity" DEFAULT 'LOW' NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"location" varchar(256),
	"reported_by" varchar(128),
	"investigated_by" varchar(128),
	"root_cause" text,
	"corrective_actions" json,
	"iogp_code" varchar(16),
	"lost_time_days" integer DEFAULT 0,
	"occurred_at" timestamp NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hse_incidents_incident_id_unique" UNIQUE("incident_id")
);
--> statement-breakpoint
CREATE TABLE "ml_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"model_type" "ml_model_type" NOT NULL,
	"health_score" real,
	"failure_probability" real,
	"days_to_failure" integer,
	"confidence" real,
	"anomaly_score" real,
	"features" json,
	"recommendation" text,
	"model_version" varchar(32),
	"predicted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permits" (
	"id" serial PRIMARY KEY NOT NULL,
	"permit_id" varchar(32) NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"permit_type" "permit_type" NOT NULL,
	"status" "permit_status" DEFAULT 'DRAFT' NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"location" varchar(256),
	"requested_by" varchar(128) NOT NULL,
	"approved_by" varchar(128),
	"approved_at" timestamp,
	"closed_by" varchar(128),
	"closed_at" timestamp,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"sif_bypass_required" boolean DEFAULT false,
	"sif_bypassed" varchar(256),
	"hazards" json,
	"controls" json,
	"isolations" json,
	"temporal_workflow_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permits_permit_id_unique" UNIQUE("permit_id")
);
--> statement-breakpoint
CREATE TABLE "production_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"date" timestamp NOT NULL,
	"oil_bbls" real DEFAULT 0,
	"gas_mmscf" real DEFAULT 0,
	"water_bbls" real DEFAULT 0,
	"injection_bbls" real DEFAULT 0,
	"uptime_hours" real DEFAULT 24,
	"downtime" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" varchar(32) NOT NULL,
	"report_type" "report_type" NOT NULL,
	"period" varchar(16) NOT NULL,
	"status" "report_status" DEFAULT 'DRAFT' NOT NULL,
	"language" "report_language" DEFAULT 'EN',
	"generated_at" timestamp,
	"submitted_at" timestamp,
	"submitted_by" varchar(128),
	"file_url" varchar(512),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "regulatory_reports_report_id_unique" UNIQUE("report_id")
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar(32) NOT NULL,
	"event_type" "security_event_type" NOT NULL,
	"severity" "incident_severity" DEFAULT 'LOW' NOT NULL,
	"source" varchar(256),
	"target" varchar(256),
	"description" text,
	"cve_id" varchar(32),
	"mitigated" boolean DEFAULT false,
	"mitigated_at" timestamp,
	"mitigated_by" varchar(128),
	"iec62443_zone" varchar(32),
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "security_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "shift_handovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" varchar(32) NOT NULL,
	"shift_type" "shift_type" NOT NULL,
	"date" timestamp NOT NULL,
	"outgoing_operator" varchar(128) NOT NULL,
	"incoming_operator" varchar(128),
	"signed_off_at" timestamp,
	"email_sent_at" timestamp,
	"email_recipient" varchar(320),
	"summary" text,
	"critical_alarms" integer DEFAULT 0,
	"active_workovers" integer DEFAULT 0,
	"production_bpd" real,
	"notes" text,
	"hijri_date" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_handovers_shift_id_unique" UNIQUE("shift_id")
);
--> statement-breakpoint
CREATE TABLE "site_connectivity" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" varchar(32) NOT NULL,
	"well_id" varchar(32),
	"site_name" varchar(128) NOT NULL,
	"status" "site_status" DEFAULT 'ONLINE' NOT NULL,
	"protocol" "telemetry_protocol" DEFAULT 'MQTT',
	"link_quality_pct" integer DEFAULT 100,
	"latency_ms" integer,
	"buffer_depth" integer DEFAULT 0,
	"last_seen_at" timestamp,
	"is_solar_powered" boolean DEFAULT false,
	"solar_volts" real,
	"battery_pct" real,
	"compressor_status" "compressor_status",
	"edge_agent_version" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_connectivity_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "subsea_trees" (
	"id" serial PRIMARY KEY NOT NULL,
	"tree_id" varchar(32) NOT NULL,
	"well_id" varchar(32),
	"fpso_id" varchar(32),
	"name" varchar(128) NOT NULL,
	"status" "tree_status" DEFAULT 'ACTIVE' NOT NULL,
	"water_depth_m" integer,
	"latitude" numeric(10, 6),
	"longitude" numeric(10, 6),
	"flowline_id" varchar(32),
	"umbilical_id" varchar(32),
	"master_valve_open" boolean DEFAULT true,
	"wing_valve_open" boolean DEFAULT true,
	"swab_valve_open" boolean DEFAULT false,
	"annulus_master_open" boolean DEFAULT true,
	"wellhead_pressure_bar" real,
	"flow_temp_c" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subsea_trees_tree_id_unique" UNIQUE("tree_id")
);
--> statement-breakpoint
CREATE TABLE "telemetry_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"tubing_pressure" real,
	"casing_pressure" real,
	"flow_rate" real,
	"water_cut" real,
	"gas_oil_ratio" real,
	"esp_current" real,
	"esp_frequency" real,
	"esp_vibration" real,
	"esp_motor_temp" real,
	"esp_inlet_pressure" real,
	"esp_discharge_pressure" real,
	"wellhead_temp" real,
	"choke_position" real,
	"oil_rate" real,
	"gas_rate" real,
	"water_rate" real,
	"gor" real,
	"bhp" real,
	"bht" real,
	"protocol" "telemetry_protocol" DEFAULT 'MQTT',
	"quality" integer DEFAULT 100,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_id" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"login_method" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "wells" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"field" varchar(64) NOT NULL,
	"basin" varchar(64),
	"country" varchar(64) DEFAULT 'Kuwait',
	"latitude" numeric(10, 6),
	"longitude" numeric(10, 6),
	"status" "well_status" DEFAULT 'ACTIVE' NOT NULL,
	"well_type" "well_type" DEFAULT 'OIL' NOT NULL,
	"depth" integer,
	"completion_date" timestamp,
	"operator" varchar(128),
	"api_number" varchar(32),
	"data_classification" "data_classification" DEFAULT 'INTERNAL' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wells_well_id_unique" UNIQUE("well_id")
);
--> statement-breakpoint
CREATE TABLE "workover_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workover_id" integer NOT NULL,
	"category" "workover_cost_category" NOT NULL,
	"description" text,
	"amount_usd" numeric(12, 2) NOT NULL,
	"vendor" varchar(128),
	"invoice_ref" varchar(64),
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" varchar(32) NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"job_type" "workover_job_type" NOT NULL,
	"status" "workover_status" DEFAULT 'PLANNED' NOT NULL,
	"priority" "workover_priority" DEFAULT 'MEDIUM' NOT NULL,
	"description" text,
	"trigger" text,
	"assigned_to" varchar(128),
	"estimated_days" integer,
	"actual_days" integer,
	"budget_usd" numeric(12, 2),
	"actual_cost_usd" numeric(12, 2),
	"temporal_workflow_id" varchar(128),
	"tiger_beetle_ref" varchar(64),
	"from_calibration" boolean DEFAULT false,
	"calibration_sensor_id" varchar(64),
	"start_date" timestamp,
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workovers_job_id_unique" UNIQUE("job_id")
);
