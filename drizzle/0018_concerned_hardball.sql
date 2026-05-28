CREATE TYPE "public"."completion_type" AS ENUM('OPEN_HOLE', 'CASED_PERFORATED', 'GRAVEL_PACK', 'FRAC_PACK', 'EXPANDABLE_SAND_SCREEN', 'STANDALONE_SCREEN');--> statement-breakpoint
CREATE TYPE "public"."eor_method" AS ENUM('PRIMARY_DEPLETION', 'WATER_FLOOD', 'POLYMER_FLOOD', 'STEAM_FLOOD', 'CYCLIC_STEAM_STIMULATION', 'SAGD', 'IN_SITU_COMBUSTION', 'SOLVENT_INJECTION');--> statement-breakpoint
CREATE TYPE "public"."liquid_loading_status" AS ENUM('UNLOADED', 'AT_RISK', 'LOADING', 'SEVERE_LOADING');--> statement-breakpoint
CREATE TYPE "public"."mud_transaction_type" AS ENUM('RECEIVED', 'CONSUMED', 'TRANSFERRED', 'DISPOSED', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."mud_type" AS ENUM('OBM', 'SBM', 'WBM', 'BRINE');--> statement-breakpoint
CREATE TYPE "public"."mud_weight_status" AS ENUM('OPTIMAL', 'NEAR_COLLAPSE_LIMIT', 'NEAR_FRACTURE_LIMIT', 'BELOW_COLLAPSE', 'ABOVE_FRACTURE');--> statement-breakpoint
CREATE TYPE "public"."remediation_method" AS ENUM('PLUNGER_LIFT', 'VELOCITY_STRING', 'FOAM_INJECTION', 'GAS_LIFT', 'COMPRESSION', 'WELLBORE_CLEANOUT');--> statement-breakpoint
CREATE TYPE "public"."sand_control_method" AS ENUM('NONE', 'CHOKEBACK', 'GRAVEL_PACK', 'FRAC_PACK', 'EXPANDABLE_SAND_SCREEN', 'STANDALONE_SCREEN', 'CHEMICAL_CONSOLIDATION');--> statement-breakpoint
CREATE TYPE "public"."sand_risk_level_v2" AS ENUM('LOW', 'MODERATE', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."stability_risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."stress_regime" AS ENUM('NORMAL_FAULTING', 'STRIKE_SLIP', 'THRUST_FAULTING');--> statement-breakpoint
CREATE TYPE "public"."water_quality_status" AS ENUM('COMPLIANT', 'MARGINAL', 'NON_COMPLIANT');--> statement-breakpoint
CREATE TABLE "geomechanical_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"tvd_ft" real NOT NULL,
	"avg_bulk_density_gcc" real DEFAULT 2.3,
	"pore_pressure_gradient_ppg" real,
	"normal_pp_gradient_ppg" real DEFAULT 8.6,
	"eaton_exponent" real DEFAULT 3,
	"lot_pressure_ppg" real,
	"ucs_psi" real DEFAULT 3000,
	"friction_angle_deg" real DEFAULT 30,
	"biot_coefficient" real DEFAULT 0.8,
	"poisson_ratio" real DEFAULT 0.25,
	"inclination_deg" real DEFAULT 0,
	"azimuth_deg" real DEFAULT 0,
	"current_mud_weight_ppg" real NOT NULL,
	"stress_regime" "stress_regime" DEFAULT 'NORMAL_FAULTING',
	"overburden_gradient_ppg" real,
	"shmin_gradient_ppg" real,
	"fracture_gradient_ppg" real,
	"collapse_gradient_ppg" real,
	"mw_lower_ppg" real,
	"mw_upper_ppg" real,
	"mw_window_width_ppg" real,
	"mud_weight_status" "mud_weight_status",
	"stability_risk" "stability_risk_level",
	"recommended_mw_ppg" real,
	"analysis_notes" text,
	"computed_at" timestamp,
	"created_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heavy_oil_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"api_gravity" real NOT NULL,
	"reservoir_temp_f" real NOT NULL,
	"current_rate_bpd" real,
	"water_cut" real DEFAULT 0,
	"steam_injection_cwe_bpd" real DEFAULT 0,
	"steam_quality" real DEFAULT 0.8,
	"gor_scf_per_bbl" real DEFAULT 50,
	"net_pay_ft" real,
	"porosity_fraction" real,
	"eor_method" "eor_method" DEFAULT 'PRIMARY_DEPLETION',
	"steam_cost_usd_per_bbl_cwe" real DEFAULT 8,
	"current_viscosity_cp" real,
	"recommended_eor_method" "eor_method",
	"projected_rate_uplift_pct" real,
	"steam_to_oil_ratio" real,
	"thermal_efficiency_pct" real,
	"net_benefit_usd_per_year" real,
	"computed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquid_loading_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"detected_at" timestamp NOT NULL,
	"wellhead_pressure_psia" real,
	"wellhead_temp_f" real,
	"gas_rate_mscfd" real,
	"tubing_id_in" real,
	"critical_velocity_fps" real,
	"actual_velocity_fps" real,
	"critical_rate_mscfd" real,
	"velocity_ratio" real,
	"loading_status" "liquid_loading_status",
	"days_to_loading" real,
	"decline_rate_mscfd_per_day" real,
	"remediation_method" "remediation_method",
	"remediation_applied_at" timestamp,
	"remediation_notes" text,
	"urgency" varchar(32),
	"resolved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mud_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"location_name" varchar(128) NOT NULL,
	"mud_type" "mud_type" NOT NULL,
	"mud_grade" varchar(64),
	"current_volume_bbl" real DEFAULT 0 NOT NULL,
	"max_capacity_bbl" real NOT NULL,
	"reorder_point_bbl" real,
	"cost_per_bbl_usd" real,
	"supplier_name" varchar(128),
	"last_received_at" timestamp,
	"expiry_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mud_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_id" integer NOT NULL,
	"transaction_type" "mud_transaction_type" NOT NULL,
	"volume_bbl" real NOT NULL,
	"cost_usd" real,
	"well_id" varchar(32),
	"from_location_id" varchar(64),
	"to_location_id" varchar(64),
	"reference_number" varchar(64),
	"performed_by" varchar(128),
	"notes" text,
	"transaction_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produced_water_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" varchar(64) NOT NULL,
	"record_date" timestamp NOT NULL,
	"produced_water_bbl" real DEFAULT 0 NOT NULL,
	"injected_water_bbl" real DEFAULT 0,
	"disposed_water_bbl" real DEFAULT 0,
	"recycled_water_bbl" real DEFAULT 0,
	"evaporated_water_bbl" real DEFAULT 0,
	"oil_in_water_mg_l" real,
	"tss_mg_l" real,
	"bacteria_count_cfu_ml" real,
	"ph_value" real,
	"chloride_mg_l" real,
	"water_balance_bbl" real,
	"balance_status" varchar(32),
	"water_quality_status" "water_quality_status",
	"injection_efficiency_pct" real,
	"recycling_rate_pct" real,
	"treatment_cost_usd" real,
	"environmental_risk" varchar(16),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sand_production_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"sand_rate_mg_l" real,
	"cumulative_sand_kg" real,
	"drawdown_psi" real,
	"flow_rate_bpd" real,
	"water_cut" real,
	"sand_risk" "sand_risk_level_v2",
	"critical_drawdown_psi" real,
	"safety_margin_psi" real,
	"sand_control_method" "sand_control_method",
	"completion_type" "completion_type",
	"ucs_psi" real,
	"action_taken" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stress_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"depth_ft" real NOT NULL,
	"overburden_ppg" real,
	"pore_pressure_ppg" real,
	"shmin_ppg" real,
	"fracture_gradient_ppg" real,
	"collapse_gradient_ppg" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
