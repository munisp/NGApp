CREATE TYPE "public"."sil_level" AS ENUM('SIL_0', 'SIL_1', 'SIL_2', 'SIL_3', 'SIL_4');--> statement-breakpoint
CREATE TYPE "public"."sil_phase" AS ENUM('CONCEPT', 'DESIGN', 'IMPLEMENTATION', 'OPERATION', 'MODIFICATION', 'DECOMMISSION');--> statement-breakpoint
CREATE TYPE "public"."sil_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLIANT', 'NON_COMPLIANT', 'WAIVED');--> statement-breakpoint
CREATE TABLE "sil_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"scope" text,
	"target_sil_level" "sil_level" DEFAULT 'SIL_1' NOT NULL,
	"achieved_sil_level" "sil_level",
	"phase" "sil_phase" DEFAULT 'CONCEPT' NOT NULL,
	"assessor_name" varchar(128),
	"assessor_org" varchar(128),
	"assessment_date" timestamp,
	"next_review_date" timestamp,
	"pfd_avg" real,
	"pfh_avg" real,
	"rrf" real,
	"status" "sil_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sil_controls" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"clause_ref" varchar(32) NOT NULL,
	"control_title" varchar(256) NOT NULL,
	"control_description" text,
	"category" varchar(64) NOT NULL,
	"sil_applicability" varchar(32),
	"status" "sil_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"evidence" text,
	"evidence_url" text,
	"gap_description" text,
	"remediation_action" text,
	"remediation_owner" varchar(128),
	"remediation_due_date" timestamp,
	"verified_by" varchar(128),
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sil_gaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"control_id" integer,
	"gap_title" varchar(256) NOT NULL,
	"severity" varchar(16) DEFAULT 'MEDIUM' NOT NULL,
	"description" text,
	"impacted_sil_level" "sil_level",
	"remediation_plan" text,
	"owner" varchar(128),
	"target_date" timestamp,
	"closed_at" timestamp,
	"status" varchar(32) DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
