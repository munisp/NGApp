ALTER TABLE `notification_channels` ADD `dndEnabled` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_channels` ADD `dndUntil` timestamp;--> statement-breakpoint
ALTER TABLE `notification_channels` ADD `dndSchedules` text;