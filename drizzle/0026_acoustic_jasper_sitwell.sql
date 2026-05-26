CREATE TABLE `alert_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alert_id` int NOT NULL,
	`notification_type` enum('email','in_app','webhook') NOT NULL,
	`recipient` varchar(255) NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`sent_at` timestamp,
	`failure_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credential_id` int NOT NULL,
	`rule_name` varchar(255) NOT NULL,
	`metric_type` enum('error_rate','response_time','transaction_volume','uptime','failure_rate','peak_tps') NOT NULL,
	`operator` enum('greater_than','less_than','equals','not_equals') NOT NULL,
	`threshold_value` int NOT NULL,
	`duration` int,
	`severity` enum('info','warning','critical') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`notify_email` boolean NOT NULL DEFAULT true,
	`notify_in_app` boolean NOT NULL DEFAULT true,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitoring_alert_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` int NOT NULL,
	`credential_id` int NOT NULL,
	`metric_type` varchar(100) NOT NULL,
	`current_value` int NOT NULL,
	`threshold_value` int NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`status` enum('active','acknowledged','resolved') NOT NULL DEFAULT 'active',
	`acknowledged_by` int,
	`acknowledged_at` timestamp,
	`resolved_by` int,
	`resolved_at` timestamp,
	`triggered_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitoring_alerts_id` PRIMARY KEY(`id`)
);
