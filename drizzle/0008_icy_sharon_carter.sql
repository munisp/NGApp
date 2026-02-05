CREATE TABLE "financial_health_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"score_id" integer NOT NULL,
	"category" text NOT NULL,
	"priority" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"action_items" json,
	"potential_score_increase" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_health_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"overall_score" integer NOT NULL,
	"credit_score_component" integer NOT NULL,
	"savings_rate_component" integer NOT NULL,
	"debt_to_income_component" integer NOT NULL,
	"budget_adherence_component" integer NOT NULL,
	"credit_score" integer,
	"savings_rate" numeric(5, 2),
	"debt_to_income_ratio" numeric(5, 2),
	"budget_adherence" numeric(5, 2),
	"monthly_income" numeric(12, 2),
	"monthly_expenses" numeric(12, 2),
	"monthly_debt_payments" numeric(12, 2),
	"monthly_savings" numeric(12, 2),
	"score_month" integer NOT NULL,
	"score_year" integer NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_health_recommendations" ADD CONSTRAINT "financial_health_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_health_recommendations" ADD CONSTRAINT "financial_health_recommendations_score_id_financial_health_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."financial_health_scores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_health_scores" ADD CONSTRAINT "financial_health_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_health_rec_user_id_idx" ON "financial_health_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "financial_health_rec_score_id_idx" ON "financial_health_recommendations" USING btree ("score_id");--> statement-breakpoint
CREATE INDEX "financial_health_rec_category_idx" ON "financial_health_recommendations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "financial_health_user_id_idx" ON "financial_health_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "financial_health_score_month_idx" ON "financial_health_scores" USING btree ("score_month","score_year");--> statement-breakpoint
CREATE INDEX "financial_health_user_month_idx" ON "financial_health_scores" USING btree ("user_id","score_month","score_year");