CREATE TABLE `rate_alerts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `from_currency` varchar(10) NOT NULL,
  `to_currency` varchar(10) NOT NULL,
  `target_rate` decimal(20,8) NOT NULL,
  `condition` enum('above','below','exact') NOT NULL,
  `status` enum('active','triggered','expired','cancelled') DEFAULT 'active' NOT NULL,
  `is_active` boolean DEFAULT true NOT NULL,
  `notify_email` boolean DEFAULT true NOT NULL,
  `notify_sms` boolean DEFAULT false NOT NULL,
  `notify_push` boolean DEFAULT true NOT NULL,
  `expires_at` timestamp,
  `triggered_at` timestamp,
  `triggered_rate` decimal(20,8),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);--> statement-breakpoint

CREATE TABLE `rate_alert_history` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `alert_id` int NOT NULL,
  `user_id` int NOT NULL,
  `from_currency` varchar(10) NOT NULL,
  `to_currency` varchar(10) NOT NULL,
  `target_rate` decimal(20,8) NOT NULL,
  `triggered_rate` decimal(20,8) NOT NULL,
  `condition` varchar(20) NOT NULL,
  `notifications_sent` text,
  `notification_status` enum('sent','failed','pending') NOT NULL,
  `triggered_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`alert_id`) REFERENCES `rate_alerts`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
