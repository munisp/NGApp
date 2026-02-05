CREATE TABLE "goal_template_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"template_id" integer NOT NULL,
	"goal_id" integer NOT NULL,
	"used_recommended_amount" boolean NOT NULL,
	"used_recommended_timeline" boolean NOT NULL,
	"custom_amount" integer,
	"custom_months" integer,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"days_to_complete" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"icon" varchar(50) NOT NULL,
	"category" varchar(100) NOT NULL,
	"min_amount" integer NOT NULL,
	"max_amount" integer NOT NULL,
	"recommended_amount" integer NOT NULL,
	"min_months" integer NOT NULL,
	"max_months" integer NOT NULL,
	"recommended_months" integer NOT NULL,
	"difficulty" varchar(50) NOT NULL,
	"success_rate" integer NOT NULL,
	"popularity_rank" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"tips" text,
	"milestones" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
