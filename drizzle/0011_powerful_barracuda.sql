CREATE TABLE `api_key_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credential_id` int NOT NULL,
	`resource` varchar(64) NOT NULL,
	`can_read` boolean NOT NULL DEFAULT false,
	`can_write` boolean NOT NULL DEFAULT false,
	`can_delete` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_key_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_key_usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credential_id` int NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`endpoint` varchar(255) NOT NULL,
	`method` varchar(10) NOT NULL,
	`status_code` int NOT NULL,
	`response_time` int NOT NULL,
	`ip_address` varchar(45),
	`user_agent` varchar(512),
	`error_message` text,
	CONSTRAINT `api_key_usage_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_key_usage_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credential_id` int NOT NULL,
	`date` timestamp NOT NULL,
	`request_count` int NOT NULL DEFAULT 0,
	`error_count` int NOT NULL DEFAULT 0,
	`avg_response_time` int NOT NULL DEFAULT 0,
	`peak_requests_per_hour` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_key_usage_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_key_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credential_id` int NOT NULL,
	`webhook_url` varchar(512) NOT NULL,
	`secret` varchar(128) NOT NULL,
	`events` text NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_key_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_permission_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text,
	`permissions` text NOT NULL,
	`is_system` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_permission_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_permission_templates_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `webhook_delivery_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhook_id` int NOT NULL,
	`event` varchar(64) NOT NULL,
	`payload` text NOT NULL,
	`status` enum('pending','delivered','failed') NOT NULL DEFAULT 'pending',
	`status_code` int,
	`response_body` text,
	`attempts` int NOT NULL DEFAULT 0,
	`last_attempt_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_delivery_logs_id` PRIMARY KEY(`id`)
);
