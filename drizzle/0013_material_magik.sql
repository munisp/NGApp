CREATE TABLE "well_physics_params" (
	"id" serial PRIMARY KEY NOT NULL,
	"well_id" varchar(32) NOT NULL,
	"reservoir_pressure_psi" real DEFAULT 3200 NOT NULL,
	"q_max_bpd" real DEFAULT 1200 NOT NULL,
	"skin_factor" real DEFAULT 0,
	"perforation_interval_ft" real DEFAULT 120,
	"tvd_ft" integer DEFAULT 8500,
	"fluid_gradient_psi_per_ft" real DEFAULT 0.433,
	"water_cut_fraction" real DEFAULT 0.25,
	"gor_scf_per_bbl" real DEFAULT 450,
	"esp_frequency_hz" real DEFAULT 50,
	"esp_min_freq_hz" real DEFAULT 35,
	"esp_max_freq_hz" real DEFAULT 65,
	"qi" real DEFAULT 1200,
	"di" real DEFAULT 0.08,
	"b" real DEFAULT 0,
	"curve_type" "decline_curve_type" DEFAULT 'EXPONENTIAL',
	"calibrated_at" timestamp DEFAULT now() NOT NULL,
	"calibrated_by" varchar(128),
	"confidence_score" real DEFAULT 0.75,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "well_physics_params_well_id_unique" UNIQUE("well_id")
);
--> statement-breakpoint
ALTER TABLE "wells" ADD COLUMN "reservoir_pressure_psi" real;--> statement-breakpoint
ALTER TABLE "wells" ADD COLUMN "q_max_bpd" real;--> statement-breakpoint
ALTER TABLE "wells" ADD COLUMN "fluid_gradient_psi_per_ft" real;--> statement-breakpoint
ALTER TABLE "wells" ADD COLUMN "skin_factor" real;--> statement-breakpoint
ALTER TABLE "wells" ADD COLUMN "perforation_interval_ft" real;--> statement-breakpoint
ALTER TABLE "wells" ADD COLUMN "water_cut_fraction" real;--> statement-breakpoint
ALTER TABLE "wells" ADD COLUMN "gor_scf_per_bbl" real;--> statement-breakpoint
ALTER TABLE "wells" ADD COLUMN "esp_frequency_hz" real;