CREATE TABLE `customTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`icon` varchar(10) DEFAULT '📄',
	`category` varchar(100) NOT NULL,
	`fields` text NOT NULL,
	`ocrSettings` text NOT NULL,
	`isPublic` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`useCount` int NOT NULL DEFAULT 0,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customTemplates_id` PRIMARY KEY(`id`)
);
