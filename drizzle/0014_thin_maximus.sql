ALTER TABLE `api_key_webhooks` ADD `max_retries` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `api_key_webhooks` ADD `retry_backoff_ms` int DEFAULT 60000 NOT NULL;--> statement-breakpoint
ALTER TABLE `api_key_webhooks` ADD `retries_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `webhook_delivery_logs` ADD `next_retry_at` timestamp;