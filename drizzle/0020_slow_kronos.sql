CREATE TABLE "agent_workflow_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"workflow_id" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"context" text,
	"step_results" text,
	"error_message" text,
	"triggered_by" varchar(64),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	CONSTRAINT "agent_workflow_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "agent_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"trigger_type" varchar(64) NOT NULL,
	"trigger_config" text,
	"steps" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"run_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_workflows_workflow_id_unique" UNIQUE("workflow_id")
);
--> statement-breakpoint
CREATE TABLE "allocated_production" (
	"id" serial PRIMARY KEY NOT NULL,
	"allocation_date" timestamp NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"rule_id" varchar(64) NOT NULL,
	"allocated_oil_bbl" real,
	"allocated_gas_mcf" real,
	"allocated_water_bbl" real,
	"allocation_method" varchar(32),
	"is_finalized" boolean DEFAULT false NOT NULL,
	"finalized_at" timestamp,
	"finalized_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carbon_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_year" integer NOT NULL,
	"scope" varchar(16) NOT NULL,
	"baseline_year" integer DEFAULT 2019 NOT NULL,
	"baseline_co2e_tonnes" real,
	"target_co2e_tonnes" real,
	"reduction_percent" real,
	"actual_co2e_tonnes" real,
	"status" varchar(32) DEFAULT 'on_track' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cmms_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"cmms_system" varchar(32) NOT NULL,
	"base_url" varchar(512),
	"auth_type" varchar(32) DEFAULT 'basic' NOT NULL,
	"username" varchar(128),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_test_at" timestamp,
	"last_test_status" varchar(32),
	"sync_interval" integer DEFAULT 300 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cmms_work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(64),
	"cmms_system" varchar(32) DEFAULT 'sap_pm' NOT NULL,
	"work_order_number" varchar(64),
	"title" varchar(256) NOT NULL,
	"description" text,
	"well_id" varchar(32),
	"asset_id" varchar(64),
	"priority" varchar(32) DEFAULT 'medium' NOT NULL,
	"work_order_type" varchar(32) DEFAULT 'corrective' NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"assigned_to" varchar(64),
	"planned_start" timestamp,
	"planned_end" timestamp,
	"actual_start" timestamp,
	"actual_end" timestamp,
	"estimated_hours" real,
	"actual_hours" real,
	"estimated_cost" real,
	"actual_cost" real,
	"sync_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"last_synced_at" timestamp,
	"sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_twin_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"asset_type" varchar(64) NOT NULL,
	"well_id" varchar(32),
	"facility_id" varchar(64),
	"gltf_url" text,
	"thumbnail_url" text,
	"position_lat" real,
	"position_lon" real,
	"scene_config" text,
	"sensor_bindings" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "digital_twin_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "drone_findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"inspection_id" varchar(64) NOT NULL,
	"finding_type" varchar(64) NOT NULL,
	"severity" varchar(32) DEFAULT 'low' NOT NULL,
	"location" varchar(256),
	"description" text,
	"image_url" text,
	"thermal_image_url" text,
	"ai_detection_confidence" real,
	"ai_model_version" varchar(32),
	"work_order_id" integer,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drone_inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"inspection_id" varchar(64) NOT NULL,
	"well_id" varchar(32),
	"facility_id" varchar(64),
	"drone_model" varchar(64),
	"pilot_name" varchar(128),
	"inspection_type" varchar(64) DEFAULT 'visual' NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"flight_duration_min" integer,
	"flight_log_url" text,
	"image_count" integer DEFAULT 0 NOT NULL,
	"thermal_image_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'scheduled' NOT NULL,
	"weather_conditions" varchar(128),
	"wind_speed_knots" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drone_inspections_inspection_id_unique" UNIQUE("inspection_id")
);
--> statement-breakpoint
CREATE TABLE "emission_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(64) NOT NULL,
	"reporting_period_start" timestamp NOT NULL,
	"reporting_period_end" timestamp NOT NULL,
	"activity_data" real NOT NULL,
	"activity_unit" varchar(32) NOT NULL,
	"co2_tonnes" real,
	"ch4_tonnes" real,
	"n2o_tonnes" real,
	"co2e_tonnes" real,
	"calculation_method" varchar(64) DEFAULT 'emission_factor' NOT NULL,
	"verification_status" varchar(32) DEFAULT 'unverified' NOT NULL,
	"verified_by" varchar(64),
	"verified_at" timestamp,
	"reporting_standard" varchar(64) DEFAULT 'GHG_Protocol',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emission_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"well_id" varchar(32),
	"facility_id" varchar(64),
	"emission_scope" varchar(16) DEFAULT 'scope1' NOT NULL,
	"ghg_component" varchar(32) DEFAULT 'co2' NOT NULL,
	"emission_factor" real,
	"emission_factor_unit" varchar(64),
	"emission_factor_source" varchar(128) DEFAULT 'EPA_AP42',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emission_sources_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "federated_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"model_type" varchar(64) NOT NULL,
	"aggregation_strategy" varchar(32) DEFAULT 'fedavg' NOT NULL,
	"global_round" integer DEFAULT 0 NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"min_participants" integer DEFAULT 3 NOT NULL,
	"global_accuracy" real,
	"global_loss" real,
	"model_weights_url" text,
	"differential_privacy_epsilon" real DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'recruiting' NOT NULL,
	"last_aggregated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "federated_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "federated_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"participant_name" varchar(128),
	"local_data_points" integer,
	"local_accuracy" real,
	"last_contributed_at" timestamp,
	"contribution_round" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fpso_twin_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"fpso_id" varchar(32) NOT NULL,
	"user_id" varchar(64),
	"stream_url" text,
	"status" varchar(32) DEFAULT 'initializing' NOT NULL,
	"gpu_node_id" varchar(64),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_sec" integer,
	CONSTRAINT "fpso_twin_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "historian_streams" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_name" varchar(128) NOT NULL,
	"well_id" varchar(32),
	"device_id" varchar(64),
	"description" varchar(256),
	"engineering_unit" varchar(32),
	"data_type" varchar(32) DEFAULT 'float' NOT NULL,
	"sample_rate_hz" real DEFAULT 1 NOT NULL,
	"compression_enabled" boolean DEFAULT true NOT NULL,
	"compression_deviation" real DEFAULT 0.1 NOT NULL,
	"retention_days" integer DEFAULT 730 NOT NULL,
	"questdb_table" varchar(128),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "historian_streams_tag_name_unique" UNIQUE("tag_name")
);
--> statement-breakpoint
CREATE TABLE "iec62443_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_date" timestamp NOT NULL,
	"assessor_name" varchar(128),
	"assessor_org" varchar(128),
	"target_sl" integer DEFAULT 2 NOT NULL,
	"achieved_sl" integer,
	"overall_score" real,
	"findings" text,
	"recommendations" text,
	"report_url" text,
	"status" varchar(32) DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iec62443_controls" (
	"id" serial PRIMARY KEY NOT NULL,
	"control_id" varchar(32) NOT NULL,
	"zone" varchar(32) DEFAULT 'SL2' NOT NULL,
	"category" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"requirement" text,
	"status" varchar(32) DEFAULT 'not_started' NOT NULL,
	"evidence_url" text,
	"assigned_to" varchar(64),
	"target_date" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "iec62443_controls_control_id_unique" UNIQUE("control_id")
);
--> statement-breakpoint
CREATE TABLE "marketplace_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"long_description" text,
	"category" varchar(64) NOT NULL,
	"author" varchar(128) NOT NULL,
	"author_org" varchar(128),
	"version" varchar(32) DEFAULT '1.0.0' NOT NULL,
	"icon_url" text,
	"entrypoint" text,
	"runtime" varchar(32) DEFAULT 'python' NOT NULL,
	"input_schema" text,
	"output_schema" text,
	"required_permissions" text,
	"pricing_model" varchar(32) DEFAULT 'free' NOT NULL,
	"price_per_run" real,
	"price_monthly" real,
	"install_count" integer DEFAULT 0 NOT NULL,
	"rating" real,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"tags" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_apps_app_id_unique" UNIQUE("app_id")
);
--> statement-breakpoint
CREATE TABLE "marketplace_installs" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"installed_by" varchar(64),
	"config_json" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"last_run_at" timestamp,
	"run_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" varchar(64) NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"triggered_by" varchar(64),
	"input_data" text,
	"output_data" text,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_ms" integer,
	"error_message" text,
	"cost" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "opcua_server_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" varchar(128) NOT NULL,
	"display_name" varchar(256) NOT NULL,
	"node_class" varchar(32) DEFAULT 'Variable' NOT NULL,
	"data_type" varchar(32) DEFAULT 'Double' NOT NULL,
	"tag_name" varchar(128),
	"well_id" varchar(32),
	"access_level" varchar(32) DEFAULT 'read' NOT NULL,
	"description" text,
	"engineering_unit" varchar(32),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "opcua_server_nodes_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "osdu_datasets" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_id" varchar(128) NOT NULL,
	"kind" varchar(256) NOT NULL,
	"namespace" varchar(64) DEFAULT 'opendes' NOT NULL,
	"version" varchar(32) DEFAULT '1.0.0' NOT NULL,
	"acl" text,
	"legal" text,
	"tags" text,
	"data" text,
	"ancestry" text,
	"source" varchar(128),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "osdu_datasets_dataset_id_unique" UNIQUE("dataset_id")
);
--> statement-breakpoint
CREATE TABLE "pinn_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"model_type" varchar(64) NOT NULL,
	"well_id" varchar(32),
	"field_id" varchar(32),
	"onnx_url" text,
	"training_data_points" integer,
	"validation_rmse" real,
	"physics_loss_weight" real DEFAULT 0.1 NOT NULL,
	"data_loss_weight" real DEFAULT 0.9 NOT NULL,
	"epochs" integer,
	"status" varchar(32) DEFAULT 'training' NOT NULL,
	"trained_at" timestamp,
	"inference_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pinn_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "prodml_production_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" varchar(64) NOT NULL,
	"uid_well" varchar(64) NOT NULL,
	"d_tim_start" timestamp NOT NULL,
	"d_tim_end" timestamp NOT NULL,
	"oil_volume" real,
	"gas_volume" real,
	"water_volume" real,
	"condensate_volume" real,
	"injected_water_volume" real,
	"volume_uom" varchar(16) DEFAULT 'bbl',
	"pressure_avg" real,
	"temp_avg" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prodml_production_sets_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "production_allocation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"field_id" varchar(32) NOT NULL,
	"separator_id" varchar(64),
	"method" varchar(32) DEFAULT 'well_test_ratio' NOT NULL,
	"oil_allocation_bbl" real,
	"gas_allocation_mcf" real,
	"water_allocation_bbl" real,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_allocation_rules_rule_id_unique" UNIQUE("rule_id")
);
--> statement-breakpoint
CREATE TABLE "reservoir_simulations" (
	"id" serial PRIMARY KEY NOT NULL,
	"sim_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"simulator" varchar(32) DEFAULT 'opm_flow' NOT NULL,
	"field_id" varchar(32),
	"model_file" text,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"submitted_by" varchar(64),
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_sec" integer,
	"output_url" text,
	"summary_stats" text,
	"error_message" text,
	"cpu_cores" integer DEFAULT 4 NOT NULL,
	"memory_gb" integer DEFAULT 8 NOT NULL,
	CONSTRAINT "reservoir_simulations_sim_id_unique" UNIQUE("sim_id")
);
--> statement-breakpoint
CREATE TABLE "saas_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"price_per_well_monthly" real NOT NULL,
	"price_per_well_annual" real,
	"max_wells" integer,
	"max_users" integer,
	"max_data_retention_days" integer DEFAULT 365 NOT NULL,
	"features_included" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_price_id_monthly" varchar(128),
	"stripe_price_id_annual" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saas_plans_plan_id_unique" UNIQUE("plan_id")
);
--> statement-breakpoint
CREATE TABLE "saas_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"plan_id" varchar(64) NOT NULL,
	"billing_cycle" varchar(16) DEFAULT 'monthly' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"stripe_subscription_id" varchar(128),
	"stripe_customer_id" varchar(128),
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"well_count" integer DEFAULT 0 NOT NULL,
	"monthly_revenue" real,
	"trial_ends_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saas_subscriptions_subscription_id_unique" UNIQUE("subscription_id")
);
--> statement-breakpoint
CREATE TABLE "saas_usage_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"metric_date" timestamp NOT NULL,
	"active_wells" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"api_calls_total" integer DEFAULT 0 NOT NULL,
	"data_ingest_gb" real DEFAULT 0 NOT NULL,
	"storage_used_gb" real DEFAULT 0 NOT NULL,
	"ai_copilot_queries" integer DEFAULT 0 NOT NULL,
	"optimization_runs" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sil_functions" (
	"id" serial PRIMARY KEY NOT NULL,
	"function_id" varchar(32) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"process_hazard" text,
	"initiating_event" varchar(256),
	"safeguard" varchar(256),
	"consequence_category" varchar(32),
	"target_sil" integer DEFAULT 2 NOT NULL,
	"achieved_sil" integer,
	"pfd_avg" real,
	"rrf" real,
	"lopa_ref" varchar(64),
	"status" varchar(32) DEFAULT 'design' NOT NULL,
	"last_verified_at" timestamp,
	"next_test_due" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sil_functions_function_id_unique" UNIQUE("function_id")
);
--> statement-breakpoint
CREATE TABLE "sil_test_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"sil_function_id" integer NOT NULL,
	"test_date" timestamp NOT NULL,
	"test_type" varchar(64) NOT NULL,
	"test_result" varchar(32) NOT NULL,
	"response_time_sec" real,
	"tested_by" varchar(64),
	"witnessed_by" varchar(64),
	"deviations" text,
	"corrective_actions" text,
	"next_test_due" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soc2_audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_time" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar(64),
	"user_email" varchar(128),
	"ip_address" varchar(64),
	"action" varchar(128) NOT NULL,
	"resource" varchar(128),
	"resource_id" varchar(64),
	"outcome" varchar(32) DEFAULT 'success' NOT NULL,
	"details" text,
	"session_id" varchar(128),
	"user_agent" varchar(512),
	"trace_id" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "soc2_controls" (
	"id" serial PRIMARY KEY NOT NULL,
	"control_ref" varchar(32) NOT NULL,
	"trust_service_criteria" varchar(32) NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"control_type" varchar(32) DEFAULT 'preventive' NOT NULL,
	"frequency" varchar(32) DEFAULT 'continuous' NOT NULL,
	"owner" varchar(64),
	"status" varchar(32) DEFAULT 'in_place' NOT NULL,
	"last_tested_at" timestamp,
	"test_result" varchar(32),
	"evidence" text,
	"deficiencies" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "soc2_controls_control_ref_unique" UNIQUE("control_ref")
);
--> statement-breakpoint
CREATE TABLE "well_allocation_factors" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" varchar(64) NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"oil_factor" real DEFAULT 0 NOT NULL,
	"gas_factor" real DEFAULT 0 NOT NULL,
	"water_factor" real DEFAULT 0 NOT NULL,
	"basis_type" varchar(32) DEFAULT 'well_test' NOT NULL,
	"basis_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "witsml_wells" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"name_legal" varchar(256),
	"country" varchar(64),
	"field" varchar(128),
	"operator" varchar(128),
	"num_license" varchar(64),
	"status_well" varchar(32),
	"purpose_well" varchar(32),
	"fluid_well" varchar(32),
	"ground_elevation" real,
	"water_depth" real,
	"d_tim_spud" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "witsml_wells_uid_unique" UNIQUE("uid")
);
