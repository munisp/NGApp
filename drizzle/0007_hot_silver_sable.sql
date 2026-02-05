CREATE TABLE "alert_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"duplicate_charge_enabled" boolean DEFAULT true NOT NULL,
	"large_transaction_enabled" boolean DEFAULT true NOT NULL,
	"large_transaction_threshold" numeric(10, 2) DEFAULT '500' NOT NULL,
	"merchant_change_enabled" boolean DEFAULT true NOT NULL,
	"unusual_category_enabled" boolean DEFAULT true NOT NULL,
	"spending_spike_enabled" boolean DEFAULT true NOT NULL,
	"push_notifications_enabled" boolean DEFAULT true NOT NULL,
	"email_notifications_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alert_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "spending_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"alert_type" text NOT NULL,
	"transaction_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"merchant" text,
	"category" text,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	"dismissed_at" timestamp
);
