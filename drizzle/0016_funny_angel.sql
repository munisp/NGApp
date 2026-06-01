CREATE TYPE "public"."contractor_specialization" AS ENUM('WELL_INTERVENTION', 'PIPELINE_REPAIR', 'MECHANICAL_INTEGRITY', 'ELECTRICAL_INSTRUMENTATION', 'CIVIL_STRUCTURAL', 'ENVIRONMENTAL_REMEDIATION', 'GENERAL_OILFIELD');--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"company" varchar(256) NOT NULL,
	"specialization" "contractor_specialization" NOT NULL,
	"country" varchar(64) NOT NULL,
	"city" varchar(64),
	"location_lat" real,
	"location_lng" real,
	"phone" varchar(32),
	"email" varchar(128),
	"mobilization_cost_usd" real,
	"day_rate_usd" real,
	"available" boolean DEFAULT true,
	"certifications" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "damage_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"s3_key" varchar(512) NOT NULL,
	"s3_url" text NOT NULL,
	"filename" varchar(256) NOT NULL,
	"mime_type" varchar(64) NOT NULL,
	"file_size_bytes" integer,
	"lat" real,
	"lng" real,
	"captured_at" timestamp,
	"ai_severity" varchar(32),
	"ai_confidence" real,
	"ai_summary" text,
	"ai_asset_type" varchar(64),
	"uploaded_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_cost_estimates" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"labor_days" real,
	"labor_cost_usd" real,
	"material_cost_usd" real,
	"mobilization_cost_usd" real,
	"contingency_pct" real DEFAULT 15,
	"total_cost_usd" real,
	"currency" varchar(8) DEFAULT 'USD',
	"estimated_by" varchar(128),
	"basis_of_estimate" text,
	"contractor_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
