CREATE TABLE `account_recovery_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`userId` int NOT NULL,
	`action` enum('request_initiated','code_sent','code_verified','code_failed','admin_review_requested','admin_approved','admin_rejected','recovery_completed','request_expired') NOT NULL,
	`performedBy` int,
	`performedAt` timestamp NOT NULL DEFAULT (now()),
	`ipAddress` varchar(45),
	`userAgent` text,
	`details` text,
	CONSTRAINT `account_recovery_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `account_recovery_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recoveryMethod` enum('email','sms','admin') NOT NULL,
	`recoveryCode` varchar(64),
	`status` enum('pending','approved','rejected','completed','expired') NOT NULL DEFAULT 'pending',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`ipAddress` varchar(45),
	`userAgent` text,
	CONSTRAINT `account_recovery_requests_id` PRIMARY KEY(`id`)
);
