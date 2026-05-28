CREATE TYPE "public"."dr_event_status" AS ENUM('SCHEDULED', 'ACTIVE', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."dr_program_status" AS ENUM('ACTIVE', 'INACTIVE', 'DRAFT');--> statement-breakpoint
CREATE TYPE "public"."dr_signal_type" AS ENUM('SIMPLE', 'PRICE', 'LOAD', 'EMERGENCY');--> statement-breakpoint
CREATE TABLE "dr_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar(64) NOT NULL,
	"program_id" varchar(64) NOT NULL,
	"event_name" varchar(128) NOT NULL,
	"status" "dr_event_status" DEFAULT 'SCHEDULED' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"signal_type" "dr_signal_type" DEFAULT 'SIMPLE' NOT NULL,
	"payload_value" real DEFAULT 0 NOT NULL,
	"payload_unit" varchar(32) DEFAULT 'kW',
	"targets" text,
	"interval_period" varchar(32) DEFAULT 'PT1H',
	"report_required" boolean DEFAULT false NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dr_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "dr_programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"program_type" varchar(64) DEFAULT 'DEMAND_RESPONSE' NOT NULL,
	"country" varchar(8) DEFAULT 'US' NOT NULL,
	"principal_program" boolean DEFAULT false NOT NULL,
	"binding_events" boolean DEFAULT true NOT NULL,
	"local_price" boolean DEFAULT false NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"status" "dr_program_status" DEFAULT 'ACTIVE' NOT NULL,
	"description" text,
	"interval_period" varchar(32) DEFAULT 'PT1H',
	"payload_descriptors" text,
	"targets" text,
	"created_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dr_programs_program_id_unique" UNIQUE("program_id")
);
--> statement-breakpoint
CREATE TABLE "dr_vens" (
	"id" serial PRIMARY KEY NOT NULL,
	"ven_id" varchar(64) NOT NULL,
	"ven_name" varchar(128) NOT NULL,
	"program_id" varchar(64) NOT NULL,
	"facility_id" varchar(64),
	"resource_type" varchar(64) DEFAULT 'COMPRESSOR',
	"max_load_kw" real,
	"current_load_kw" real,
	"available_kw" real,
	"status" varchar(32) DEFAULT 'REGISTERED' NOT NULL,
	"capabilities" text,
	"last_heartbeat" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dr_vens_ven_id_unique" UNIQUE("ven_id")
);
