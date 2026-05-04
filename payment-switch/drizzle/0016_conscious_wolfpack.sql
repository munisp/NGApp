CREATE TABLE `retry_attempt_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`delivery_log_id` int NOT NULL,
	`attempt_number` int NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`status_code` int,
	`error_message` text,
	`response_body` text,
	`duration_ms` int,
	`success` boolean NOT NULL,
	CONSTRAINT `retry_attempt_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `api_key_webhooks` ADD `final_failure_template` text;--> statement-breakpoint
ALTER TABLE `api_key_webhooks` ADD `consecutive_failure_threshold` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `api_key_webhooks` ADD `consecutive_failures` int DEFAULT 0 NOT NULL;