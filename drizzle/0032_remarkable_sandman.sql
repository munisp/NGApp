CREATE TABLE `rate_alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alert_id` int NOT NULL,
	`user_id` int NOT NULL,
	`from_currency` varchar(10) NOT NULL,
	`to_currency` varchar(10) NOT NULL,
	`target_rate` decimal(20,8) NOT NULL,
	`triggered_rate` decimal(20,8) NOT NULL,
	`condition` varchar(20) NOT NULL,
	`notifications_sent` text,
	`notification_status` enum('sent','failed','pending') NOT NULL,
	`triggered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rate_alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`from_currency` varchar(10) NOT NULL,
	`to_currency` varchar(10) NOT NULL,
	`target_rate` decimal(20,8) NOT NULL,
	`condition` enum('above','below','exact') NOT NULL,
	`status` enum('active','triggered','expired','cancelled') NOT NULL DEFAULT 'active',
	`is_active` boolean NOT NULL DEFAULT true,
	`notify_email` boolean NOT NULL DEFAULT true,
	`notify_sms` boolean NOT NULL DEFAULT false,
	`notify_push` boolean NOT NULL DEFAULT true,
	`expires_at` timestamp,
	`triggered_at` timestamp,
	`triggered_rate` decimal(20,8),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rate_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rate_alert_history` ADD CONSTRAINT `rate_alert_history_alert_id_rate_alerts_id_fk` FOREIGN KEY (`alert_id`) REFERENCES `rate_alerts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rate_alert_history` ADD CONSTRAINT `rate_alert_history_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rate_alerts` ADD CONSTRAINT `rate_alerts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;