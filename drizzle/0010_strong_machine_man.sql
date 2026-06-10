CREATE TABLE `api_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`environment_id` int NOT NULL,
	`api_key` varchar(128) NOT NULL,
	`api_secret` varchar(128) NOT NULL,
	`key_version` int NOT NULL DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`expires_at` timestamp,
	`last_used_at` timestamp,
	`created_by` int NOT NULL,
	`revoked_by` int,
	`revoked_at` timestamp,
	`revocation_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_credentials_api_key_unique` UNIQUE(`api_key`)
);
--> statement-breakpoint
CREATE TABLE `api_key_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credential_id` int NOT NULL,
	`action` enum('created','rotated','revoked','expired') NOT NULL,
	`performed_by` int NOT NULL,
	`old_key_version` int,
	`new_key_version` int,
	`reason` text,
	`performed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_key_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_environments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`application_id` int NOT NULL,
	`environment_type` enum('sandbox','staging','production') NOT NULL,
	`api_endpoint` varchar(512) NOT NULL,
	`status` enum('provisioning','active','suspended','decommissioned') NOT NULL DEFAULT 'provisioning',
	`provisioned_at` timestamp,
	`last_accessed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_environments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`application_id` int NOT NULL,
	`environment_id` int NOT NULL,
	`test_type` varchar(64) NOT NULL,
	`test_name` varchar(255) NOT NULL,
	`status` enum('pending','running','passed','failed') NOT NULL DEFAULT 'pending',
	`execution_time` int,
	`error_message` text,
	`logs` text,
	`executed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sdk_downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`application_id` int NOT NULL,
	`sdk_type` enum('javascript','python','java','php','dotnet') NOT NULL,
	`sdk_version` varchar(32) NOT NULL,
	`downloaded_by` int NOT NULL,
	`downloaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sdk_downloads_id` PRIMARY KEY(`id`)
);
