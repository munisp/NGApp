CREATE TABLE "alert_thresholds" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"sensor_type" varchar(64) NOT NULL,
	"min_value" real,
	"max_value" real,
	"unit" varchar(16),
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repair_tickets" ADD COLUMN "assigned_contractor_id" integer;