CREATE TYPE "public"."decline_curve_type" AS ENUM('EXPONENTIAL', 'HYPERBOLIC', 'HARMONIC');--> statement-breakpoint
CREATE TABLE "decline_curve_params" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"curve_type" "decline_curve_type" DEFAULT 'EXPONENTIAL' NOT NULL,
	"qi" real NOT NULL,
	"di" real NOT NULL,
	"b" real DEFAULT 0,
	"economic_limit" real DEFAULT 5,
	"eur_bbls" real,
	"remaining_life_years" real,
	"fitted_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(128),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
