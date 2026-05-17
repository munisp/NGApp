ALTER TABLE "devices" ADD COLUMN "enrollmentToken" varchar(64);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "enrollmentExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "slaDeadlineAt" timestamp;