ALTER TABLE `saved_comparisons` ADD `scanCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_comparisons` ADD `lastScannedAt` timestamp;