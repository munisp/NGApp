ALTER TABLE `webhook_delivery_logs` ADD `event_data` text;--> statement-breakpoint
ALTER TABLE `webhook_delivery_logs` ADD `error_message` text;--> statement-breakpoint
ALTER TABLE `webhook_delivery_logs` ADD `delivery_duration_ms` int;