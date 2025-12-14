CREATE TABLE `exportExecutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduledExportId` int NOT NULL,
	`status` enum('running','success','failed') NOT NULL,
	`recordsExported` int DEFAULT 0,
	`fileUrl` text,
	`fileSize` bigint,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int,
	CONSTRAINT `exportExecutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`exportFormat` enum('csv','json') NOT NULL DEFAULT 'csv',
	`category` varchar(100),
	`status` enum('pending','processing','completed','failed'),
	`includeOcrResults` int NOT NULL DEFAULT 1,
	`selectedFields` text,
	`scheduleType` enum('once','daily','weekly','monthly','custom') NOT NULL,
	`cronExpression` varchar(100),
	`nextRunAt` timestamp,
	`lastRunAt` timestamp,
	`emailRecipients` text,
	`emailSubject` varchar(255),
	`emailBody` text,
	`isActive` int NOT NULL DEFAULT 1,
	`runCount` int NOT NULL DEFAULT 0,
	`lastStatus` enum('success','failed','skipped'),
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduledExports_id` PRIMARY KEY(`id`)
);
