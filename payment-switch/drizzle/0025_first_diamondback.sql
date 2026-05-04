CREATE TABLE `go_live_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`application_id` int NOT NULL,
	`certification_passed` boolean NOT NULL DEFAULT false,
	`security_audit_completed` boolean NOT NULL DEFAULT false,
	`compliance_verified` boolean NOT NULL DEFAULT false,
	`integration_tested` boolean NOT NULL DEFAULT false,
	`documentation_reviewed` boolean NOT NULL DEFAULT false,
	`support_contacts_provided` boolean NOT NULL DEFAULT false,
	`disaster_recovery_plan_submitted` boolean NOT NULL DEFAULT false,
	`production_endpoints_configured` boolean NOT NULL DEFAULT false,
	`all_items_completed` boolean NOT NULL DEFAULT false,
	`approved_by` int,
	`approved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `go_live_checklist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incident_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credential_id` int NOT NULL,
	`reported_by` int NOT NULL,
	`incident_type` enum('outage','performance_degradation','security_breach','data_issue','integration_failure','other') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`affected_transactions` int,
	`estimated_downtime` int,
	`financial_impact` int,
	`status` enum('open','investigating','resolved','closed') NOT NULL DEFAULT 'open',
	`resolution` text,
	`resolved_by` int,
	`resolved_at` timestamp,
	`occurred_at` timestamp NOT NULL,
	`reported_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incident_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`application_id` int NOT NULL,
	`user_id` int NOT NULL,
	`production_api_key` varchar(255) NOT NULL,
	`production_api_secret` varchar(255) NOT NULL,
	`production_webhook_secret` varchar(255),
	`production_endpoint` varchar(500) NOT NULL,
	`production_webhook_url` varchar(500),
	`status` enum('pending','active','suspended','revoked') NOT NULL DEFAULT 'pending',
	`activated_at` timestamp,
	`activated_by` int,
	`daily_transaction_limit` int NOT NULL,
	`monthly_transaction_limit` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_credentials_production_api_key_unique` UNIQUE(`production_api_key`)
);
--> statement-breakpoint
CREATE TABLE `production_monitoring` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credential_id` int NOT NULL,
	`date` timestamp NOT NULL,
	`total_transactions` int NOT NULL DEFAULT 0,
	`successful_transactions` int NOT NULL DEFAULT 0,
	`failed_transactions` int NOT NULL DEFAULT 0,
	`average_response_time` int,
	`peak_tps` int,
	`uptime_percentage` int,
	`error_rate` int,
	`alerts_triggered` int DEFAULT 0,
	`incidents_reported` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_monitoring_id` PRIMARY KEY(`id`)
);
