CREATE TABLE "ai_copilot_chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"tool_calls" text,
	"context_well_id" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casing_inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"inspection_date" timestamp NOT NULL,
	"inspection_type" varchar(32) NOT NULL,
	"casing_string" varchar(32) NOT NULL,
	"top_depth_ft" real NOT NULL,
	"bottom_depth_ft" real NOT NULL,
	"wall_thickness_in" real,
	"corrosion_pct" real,
	"ovality_pct" real,
	"integrity_score" real,
	"anomalies_found" integer DEFAULT 0,
	"passed_test" boolean DEFAULT true,
	"next_inspection_due" timestamp,
	"notes" text,
	"inspected_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pressure_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"test_date" timestamp NOT NULL,
	"test_type" varchar(32) NOT NULL,
	"test_pressure_psi" real NOT NULL,
	"hold_time_mins" integer NOT NULL,
	"pressure_drop_psi" real,
	"acceptance_criteria_psi" real,
	"passed" boolean DEFAULT true NOT NULL,
	"test_fluid" varchar(32) DEFAULT 'water',
	"notes" text,
	"tested_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"forecast_name" varchar(128) NOT NULL,
	"decline_type" varchar(16) DEFAULT 'exponential' NOT NULL,
	"initial_rate_bopd" real NOT NULL,
	"decline_rate_monthly" real NOT NULL,
	"b_factor" real DEFAULT 0,
	"forecast_years" integer DEFAULT 10 NOT NULL,
	"eur_bbl" real,
	"p10_eur_bbl" real,
	"p50_eur_bbl" real,
	"p90_eur_bbl" real,
	"oil_price_usd_per_bbl" real DEFAULT 70,
	"npv10_m" real,
	"created_by" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservoir_pressure_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" varchar(32) DEFAULT 'DEFAULT' NOT NULL,
	"well_id" varchar(32),
	"record_date" timestamp NOT NULL,
	"measured_pressure_psia" real NOT NULL,
	"measurement_method" varchar(32) DEFAULT 'BHP',
	"depth_ft" real,
	"water_cut_frac" real,
	"gas_cap" boolean DEFAULT false,
	"aquifer_strength" varchar(16) DEFAULT 'NONE',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
