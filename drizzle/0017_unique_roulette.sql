CREATE TABLE `notification_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` int NOT NULL,
	`channelType` enum('slack','email') NOT NULL,
	`channelName` varchar(255) NOT NULL,
	`config` text NOT NULL,
	`template` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`event` varchar(100) NOT NULL,
	`payload` text NOT NULL,
	`status` enum('sent','failed') NOT NULL,
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_deliveries_id` PRIMARY KEY(`id`)
);
