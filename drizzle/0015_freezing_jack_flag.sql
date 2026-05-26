CREATE TYPE "public"."damage_asset_type" AS ENUM('WELLHEAD', 'CHRISTMAS_TREE', 'PIPELINE', 'FLOWLINE', 'SEPARATOR', 'PUMP_STATION', 'COMPRESSOR_STATION', 'STORAGE_TANK', 'CONTROL_ROOM', 'POWER_SUPPLY', 'ROAD_ACCESS', 'MANIFOLD', 'FLARE_STACK', 'WATER_INJECTION', 'FPSO', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."damage_cause" AS ENUM('DIRECT_STRIKE', 'BLAST_OVERPRESSURE', 'SHRAPNEL', 'FIRE', 'SABOTAGE', 'LOOTING', 'NEGLECT_DURING_CONFLICT', 'SECONDARY_DAMAGE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."damage_classification" AS ENUM('DESTROYED', 'SEVERELY_DAMAGED', 'MODERATELY_DAMAGED', 'MINOR_DAMAGE', 'INTACT', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."repair_priority" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'DEFERRED');--> statement-breakpoint
CREATE TYPE "public"."repair_status" AS ENUM('PENDING_ASSESSMENT', 'ASSESSED', 'APPROVED', 'MOBILIZING', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "damage_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" varchar(32) NOT NULL,
	"well_id" varchar(32),
	"asset_type" "damage_asset_type" NOT NULL,
	"asset_name" varchar(256) NOT NULL,
	"asset_tag" varchar(64),
	"field_name" varchar(128),
	"country" varchar(64) DEFAULT 'Iraq' NOT NULL,
	"coordinates" json,
	"classification" "damage_classification" DEFAULT 'UNKNOWN' NOT NULL,
	"cause" "damage_cause" DEFAULT 'UNKNOWN',
	"incident_date" timestamp,
	"assessment_date" timestamp DEFAULT now(),
	"assessed_by" varchar(128),
	"production_loss_bpd" real DEFAULT 0,
	"production_loss_gas_mmscfd" real DEFAULT 0,
	"estimated_downtime_days" integer,
	"estimated_repair_cost_usd" real,
	"estimated_replacement_cost_usd" real,
	"triage_score" real,
	"repair_priority" "repair_priority" DEFAULT 'DEFERRED',
	"description" text,
	"ai_summary" text,
	"ai_recommendations" json,
	"repair_status" "repair_status" DEFAULT 'PENDING_ASSESSMENT',
	"hse_risk" boolean DEFAULT false,
	"environmental_risk" boolean DEFAULT false,
	"access_safe" boolean DEFAULT false,
	"created_by" varchar(128),
	"updated_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "damage_assessments_assessment_id_unique" UNIQUE("assessment_id")
);
--> statement-breakpoint
CREATE TABLE "damage_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"evidence_type" varchar(32) NOT NULL,
	"file_name" varchar(256),
	"file_url" text,
	"file_key" varchar(512),
	"caption" text,
	"taken_at" timestamp,
	"uploaded_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" varchar(32) NOT NULL,
	"assessment_id" integer NOT NULL,
	"title" varchar(256) NOT NULL,
	"scope" text,
	"contractor" varchar(128),
	"estimated_cost_usd" real,
	"actual_cost_usd" real,
	"planned_start_date" timestamp,
	"planned_end_date" timestamp,
	"actual_start_date" timestamp,
	"actual_end_date" timestamp,
	"status" "repair_status" DEFAULT 'PENDING_ASSESSMENT',
	"priority" "repair_priority" DEFAULT 'MEDIUM',
	"assigned_to" varchar(128),
	"notes" text,
	"created_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repair_tickets_ticket_id_unique" UNIQUE("ticket_id")
);
