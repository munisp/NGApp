CREATE TABLE "incident_triage" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar(32) NOT NULL,
	"workflow_id" varchar(128),
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"opencti_score" integer DEFAULT 0,
	"tlp_classification" varchar(16) DEFAULT 'TLP:WHITE',
	"final_severity" varchar(16),
	"node_isolated" boolean DEFAULT false,
	"network_policy_id" varchar(128),
	"alert_group_id" varchar(128),
	"recommended_action" text,
	"node_readmitted_at" timestamp,
	"node_readmitted_by" varchar(128),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "incident_triage_event_id_unique" UNIQUE("event_id")
);
