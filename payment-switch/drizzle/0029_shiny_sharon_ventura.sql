CREATE TABLE `reminder_email_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stage` enum('registration','technical','integration','testing','production') NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`thresholdDays` int NOT NULL,
	`reminderIntervalDays` int NOT NULL,
	`maxReminders` int NOT NULL DEFAULT 3,
	`emailSubject` varchar(255) NOT NULL,
	`emailTemplate` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminder_email_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_email_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`stage` enum('registration','technical','integration','testing','production') NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('sent','failed','bounced') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`reminderCount` int NOT NULL DEFAULT 1,
	CONSTRAINT `reminder_email_log_id` PRIMARY KEY(`id`)
);
