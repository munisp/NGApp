CREATE TABLE "bill_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"bill_reminder_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"status" varchar(50) NOT NULL,
	"payment_method" varchar(100),
	"transaction_id" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"bill_reminder_id" integer NOT NULL,
	"predicted_amount" integer NOT NULL,
	"confidence" integer NOT NULL,
	"based_on_payments" integer NOT NULL,
	"for_month" integer NOT NULL,
	"for_year" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"merchant_name" varchar(200) NOT NULL,
	"merchant_logo" text,
	"category_id" integer,
	"amount" integer NOT NULL,
	"is_amount_variable" boolean DEFAULT false NOT NULL,
	"frequency" varchar(50) NOT NULL,
	"due_day" integer NOT NULL,
	"next_due_date" timestamp NOT NULL,
	"auto_pay_enabled" boolean DEFAULT false NOT NULL,
	"linked_account_id" integer,
	"reminder_days_before" integer DEFAULT 3 NOT NULL,
	"reminder_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
