CREATE TABLE `certification_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` int NOT NULL,
	`status` enum('pending','in_progress','passed','failed') NOT NULL DEFAULT 'pending',
	`submittedAt` timestamp,
	`completedAt` timestamp,
	`certificateId` varchar(64),
	`score` int,
	`requiredTestsPassed` int NOT NULL DEFAULT 0,
	`totalRequiredTests` int NOT NULL DEFAULT 0,
	`optionalTestsPassed` int NOT NULL DEFAULT 0,
	`complianceChecksPassed` int NOT NULL DEFAULT 0,
	`securityAuditPassed` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certification_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`certificationId` int NOT NULL,
	`checkType` varchar(100) NOT NULL,
	`checkName` varchar(255) NOT NULL,
	`status` enum('pending','passed','failed','warning') NOT NULL DEFAULT 'pending',
	`details` text,
	`recommendation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` int NOT NULL,
	`scenarioId` int NOT NULL,
	`status` enum('pending','running','passed','failed') NOT NULL DEFAULT 'pending',
	`startedAt` timestamp,
	`completedAt` timestamp,
	`result` text,
	`errorMessage` text,
	`logs` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` enum('connectivity','authentication','transaction','webhook','security','performance') NOT NULL,
	`isRequired` int NOT NULL DEFAULT 1,
	`testScript` text NOT NULL,
	`passingCriteria` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_scenarios_id` PRIMARY KEY(`id`)
);
