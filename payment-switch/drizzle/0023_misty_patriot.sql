ALTER TABLE `saved_comparisons` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `saved_comparisons` ADD `shareToken` varchar(64);--> statement-breakpoint
ALTER TABLE `saved_comparisons` ADD `isPublic` enum('0','1') DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `saved_comparisons` ADD `sharedAt` timestamp;--> statement-breakpoint
ALTER TABLE `saved_comparisons` ADD CONSTRAINT `saved_comparisons_shareToken_unique` UNIQUE(`shareToken`);