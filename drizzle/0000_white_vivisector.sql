CREATE TYPE "public"."document_type" AS ENUM('national_id', 'passport', 'drivers_license', 'voters_card');--> statement-breakpoint
CREATE TYPE "public"."kyc_action" AS ENUM('submitted', 'approved', 'rejected', 'updated', 'viewed');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'approved', 'rejected', 'requires_review');--> statement-breakpoint
CREATE TYPE "public"."mfa_event" AS ENUM('mfa_enabled', 'mfa_disabled', 'mfa_verified', 'mfa_failed', 'backup_code_used', 'backup_codes_regenerated', 'recovery_email_updated');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."bnpl_installment_status" AS ENUM('pending', 'paid', 'overdue', 'waived');--> statement-breakpoint
CREATE TYPE "public"."bnpl_status" AS ENUM('pending', 'approved', 'rejected', 'active', 'completed', 'defaulted');--> statement-breakpoint
CREATE TYPE "public"."credit_grade" AS ENUM('poor', 'fair', 'good', 'very_good', 'excellent');--> statement-breakpoint
CREATE TYPE "public"."factor_impact" AS ENUM('positive', 'negative', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."bank_connection_status" AS ENUM('connected', 'disconnected', 'error', 'pending', 'active');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."api_key_environment" AS ENUM('development', 'production');--> statement-breakpoint
CREATE TYPE "public"."api_key_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('active', 'inactive', 'failed');--> statement-breakpoint
CREATE TABLE "kyc_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"kyc_submission_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action" "kyc_action" NOT NULL,
	"performed_by" integer NOT NULL,
	"details" json,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"document_type" "document_type" NOT NULL,
	"document_number" text,
	"full_name" text,
	"date_of_birth" text,
	"address" text,
	"nationality" varchar(100),
	"document_image_url" text NOT NULL,
	"selfie_image_url" text NOT NULL,
	"ocr_data" json,
	"facial_recognition_data" json,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event" "mfa_event" NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"details" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_mfa" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"totp_secret" varchar(255) NOT NULL,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_verified" boolean DEFAULT false NOT NULL,
	"backup_codes" text,
	"backup_codes_used" integer DEFAULT 0 NOT NULL,
	"recovery_email" varchar(320),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "user_mfa_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "bnpl_applications" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"student_name" varchar(255) NOT NULL,
	"school_name" varchar(255) NOT NULL,
	"grade" varchar(50) NOT NULL,
	"school_fees_amount" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"installment_plan" integer NOT NULL,
	"monthly_payment" numeric(12, 2) NOT NULL,
	"employment_status" varchar(100) NOT NULL,
	"monthly_income" numeric(12, 2) NOT NULL,
	"documents" json NOT NULL,
	"status" "bnpl_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" varchar(500),
	"approved_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bnpl_installments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"application_id" varchar(36) NOT NULL,
	"installment_number" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "bnpl_installment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"payment_method" varchar(50),
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_score_factors" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"factor_type" varchar(100) NOT NULL,
	"impact" "factor_impact" NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_score_history" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"score" integer NOT NULL,
	"grade" "credit_grade" NOT NULL,
	"calculated_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_scores" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"score" integer NOT NULL,
	"grade" "credit_grade" NOT NULL,
	"last_calculated" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "credit_scores_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"bank_name" varchar(255) NOT NULL,
	"bank_code" varchar(50) NOT NULL,
	"status" "bank_connection_status" DEFAULT 'pending' NOT NULL,
	"session_id" varchar(255),
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp,
	"last_synced_at" timestamp,
	"error_message" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"account_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"transaction_id" varchar(255) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100),
	"balance" numeric(15, 2) NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linked_bank_accounts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"bank_code" varchar(10) NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"balance" numeric(15, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_value" text NOT NULL,
	"secret_value" text NOT NULL,
	"environment" "api_key_environment" DEFAULT 'development' NOT NULL,
	"permissions" varchar(500) NOT NULL,
	"status" "api_key_status" DEFAULT 'active' NOT NULL,
	"request_count" varchar(20) DEFAULT '0' NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_logs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"api_key_id" varchar(36) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer NOT NULL,
	"response_time" varchar(20) NOT NULL,
	"cost" varchar(20) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"webhook_id" varchar(36) NOT NULL,
	"event" varchar(100) NOT NULL,
	"payload" json NOT NULL,
	"status_code" integer,
	"response_body" text,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"url" text NOT NULL,
	"events" json NOT NULL,
	"secret" text NOT NULL,
	"status" "webhook_status" DEFAULT 'active' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_triggered_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_audit_log" ADD CONSTRAINT "kyc_audit_log_kyc_submission_id_kyc_submissions_id_fk" FOREIGN KEY ("kyc_submission_id") REFERENCES "public"."kyc_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_audit_log" ADD CONSTRAINT "mfa_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mfa" ADD CONSTRAINT "user_mfa_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyc_audit_submission_id_idx" ON "kyc_audit_log" USING btree ("kyc_submission_id");--> statement-breakpoint
CREATE INDEX "kyc_audit_user_id_idx" ON "kyc_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kyc_audit_action_idx" ON "kyc_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "kyc_audit_created_at_idx" ON "kyc_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "kyc_user_id_idx" ON "kyc_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kyc_status_idx" ON "kyc_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_created_at_idx" ON "kyc_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mfa_audit_user_id_idx" ON "mfa_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_audit_created_at_idx" ON "mfa_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mfa_user_id_idx" ON "user_mfa" USING btree ("user_id");