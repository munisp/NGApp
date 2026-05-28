CREATE TABLE "dr_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar(64) NOT NULL,
	"program_id" varchar(64),
	"ven_id" varchar(64),
	"tag" varchar(128),
	"setpoint_kw" real,
	"baseline_kw" real,
	"actual_kw" real,
	"deviation_kw" real,
	"curtailment_kw" real,
	"opcua_status" varchar(32) DEFAULT 'PENDING',
	"dispatched_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"regulatory_ref" varchar(128),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag" varchar(128) NOT NULL,
	"model_type" varchar(64) DEFAULT 'xgb_quantile' NOT NULL,
	"mae" real,
	"rmse" real,
	"mape" real,
	"bias" real,
	"r2" real,
	"training_samples" integer,
	"horizon" integer DEFAULT 48,
	"trained_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
