CREATE TABLE "recurring_contribution_history" (
	"id" text PRIMARY KEY NOT NULL,
	"recurring_contribution_id" text NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"frequency" text NOT NULL,
	"day_of_month" integer,
	"day_of_week" integer,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_processed_at" timestamp,
	"next_process_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
