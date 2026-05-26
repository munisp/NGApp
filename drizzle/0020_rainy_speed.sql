CREATE TABLE `scheduled_test_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`executionId` int,
	`runAt` timestamp NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_test_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` int NOT NULL,
	`scenarioId` int NOT NULL,
	`frequency` enum('daily','weekly','monthly','custom') NOT NULL,
	`customIntervalHours` int,
	`scheduledTime` varchar(5),
	`scheduledDay` int,
	`nextRunAt` timestamp NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`notifyOnSuccess` int NOT NULL DEFAULT 1,
	`notifyOnFailure` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_schedules_id` PRIMARY KEY(`id`)
);
