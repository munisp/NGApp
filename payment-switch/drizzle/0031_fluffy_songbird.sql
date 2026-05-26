CREATE TABLE `bank_accounts_remittance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` varchar(64) NOT NULL,
	`remittance_id` varchar(64) NOT NULL,
	`account_number` varchar(20) NOT NULL,
	`bank_name` varchar(100) NOT NULL,
	`bank_code` varchar(10) NOT NULL,
	`account_name` varchar(200) NOT NULL,
	`account_type` varchar(50) NOT NULL,
	`status` enum('pending','opening','active','verified','failed','closed') NOT NULL DEFAULT 'pending',
	`is_new_account` boolean DEFAULT false,
	`opening_provider` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`verified_at` timestamp,
	`error_message` text,
	CONSTRAINT `bank_accounts_remittance_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_accounts_remittance_account_id_unique` UNIQUE(`account_id`),
	CONSTRAINT `account_number_idx` UNIQUE(`account_number`,`bank_code`)
);
--> statement-breakpoint
CREATE TABLE `bank_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transfer_id` varchar(64) NOT NULL,
	`remittance_id` varchar(64) NOT NULL,
	`account_number` varchar(20) NOT NULL,
	`bank_code` varchar(10) NOT NULL,
	`account_name` varchar(200) NOT NULL,
	`amount` decimal(20,2) NOT NULL,
	`currency` varchar(10) NOT NULL,
	`narration` varchar(255),
	`nibss_reference` varchar(100),
	`session_id` varchar(100),
	`status` enum('pending','processing','completed','failed','reversed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completed_at` timestamp,
	`error_message` text,
	`error_code` varchar(50),
	CONSTRAINT `bank_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_transfers_transfer_id_unique` UNIQUE(`transfer_id`)
);
--> statement-breakpoint
CREATE TABLE `crypto_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversion_id` varchar(64) NOT NULL,
	`remittance_id` varchar(64) NOT NULL,
	`crypto_currency` varchar(10) NOT NULL,
	`crypto_amount` decimal(20,8) NOT NULL,
	`crypto_wallet_address` varchar(255),
	`crypto_transaction_hash` varchar(255),
	`crypto_confirmations` int DEFAULT 0,
	`fiat_currency` varchar(10) NOT NULL,
	`fiat_amount` decimal(20,2) NOT NULL,
	`exchange_rate` decimal(20,8) NOT NULL,
	`exchange_fee` decimal(20,8) NOT NULL,
	`provider` varchar(50) NOT NULL,
	`provider_transaction_id` varchar(255),
	`status` enum('pending','confirming','converting','completed','failed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completed_at` timestamp,
	`error_message` text,
	CONSTRAINT `crypto_conversions_id` PRIMARY KEY(`id`),
	CONSTRAINT `crypto_conversions_conversion_id_unique` UNIQUE(`conversion_id`)
);
--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_currency` varchar(10) NOT NULL,
	`to_currency` varchar(10) NOT NULL,
	`rate` decimal(20,8) NOT NULL,
	`bid_rate` decimal(20,8),
	`ask_rate` decimal(20,8),
	`provider` varchar(50) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`valid_until` timestamp NOT NULL,
	CONSTRAINT `exchange_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kyc_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`verification_id` varchar(64) NOT NULL,
	`remittance_id` varchar(64) NOT NULL,
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`date_of_birth` varchar(10) NOT NULL,
	`address` text NOT NULL,
	`bvn` varchar(11),
	`id_type` varchar(50) NOT NULL,
	`id_number` varchar(100) NOT NULL,
	`photo_url` varchar(500),
	`id_document_url` varchar(500),
	`provider` varchar(50) NOT NULL,
	`provider_verification_id` varchar(255),
	`status` enum('pending','in_progress','approved','rejected','failed') NOT NULL DEFAULT 'pending',
	`confidence_score` decimal(5,2),
	`liveness_check` boolean DEFAULT false,
	`document_match` boolean DEFAULT false,
	`aml_screening` boolean DEFAULT false,
	`sanctions_check` boolean DEFAULT false,
	`risk_score` decimal(5,2),
	`risk_level` enum('low','medium','high'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completed_at` timestamp,
	`rejection_reason` text,
	`error_message` text,
	CONSTRAINT `kyc_verifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `kyc_verifications_verification_id_unique` UNIQUE(`verification_id`)
);
--> statement-breakpoint
CREATE TABLE `remittance_timeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`remittance_id` varchar(64) NOT NULL,
	`status` varchar(50) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`message` text,
	`metadata` json,
	`actor_type` varchar(50),
	`actor_id` varchar(64),
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `remittance_timeline_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `remittance_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`remittance_id` varchar(64) NOT NULL,
	`event` varchar(100) NOT NULL,
	`url` varchar(500) NOT NULL,
	`payload` json NOT NULL,
	`signature` varchar(255) NOT NULL,
	`status` enum('pending','delivered','failed','retrying') NOT NULL DEFAULT 'pending',
	`attempts` int DEFAULT 0,
	`max_attempts` int DEFAULT 5,
	`next_retry_at` timestamp,
	`response_status_code` int,
	`response_body` text,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`delivered_at` timestamp,
	CONSTRAINT `remittance_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `remittances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`remittance_id` varchar(64) NOT NULL,
	`sender_user_id` int,
	`sender_currency` varchar(10) NOT NULL,
	`sender_amount` decimal(20,8) NOT NULL,
	`recipient_phone` varchar(20) NOT NULL,
	`recipient_country` varchar(3) NOT NULL,
	`recipient_currency` varchar(10) NOT NULL,
	`estimated_recipient_amount` decimal(20,2) NOT NULL,
	`actual_recipient_amount` decimal(20,2),
	`exchange_rate` decimal(20,8) NOT NULL,
	`crypto_exchange_fee` decimal(20,8) NOT NULL,
	`platform_fee` decimal(20,8) NOT NULL,
	`total_fees` decimal(20,8) NOT NULL,
	`delivery_option` enum('NEW_ACCOUNT','EXISTING_ACCOUNT','AGENT_CASH','PAY_BILLS') NOT NULL,
	`status` enum('pending_recipient_info','pending_kyc','kyc_approved','kyc_failed','crypto_converting','crypto_converted','processing','account_opened','funds_deposited','collection_code_generated','cash_collected','bill_paid','completed','failed','expired') NOT NULL DEFAULT 'pending_recipient_info',
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expires_at` timestamp NOT NULL,
	`completed_at` timestamp,
	`failure_reason` text,
	`failure_code` varchar(50),
	CONSTRAINT `remittances_id` PRIMARY KEY(`id`),
	CONSTRAINT `remittances_remittance_id_unique` UNIQUE(`remittance_id`)
);
--> statement-breakpoint
CREATE INDEX `remittance_idx` ON `bank_accounts_remittance` (`remittance_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `bank_accounts_remittance` (`status`);--> statement-breakpoint
CREATE INDEX `remittance_idx` ON `bank_transfers` (`remittance_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `bank_transfers` (`status`);--> statement-breakpoint
CREATE INDEX `nibss_ref_idx` ON `bank_transfers` (`nibss_reference`);--> statement-breakpoint
CREATE INDEX `remittance_idx` ON `crypto_conversions` (`remittance_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `crypto_conversions` (`status`);--> statement-breakpoint
CREATE INDEX `tx_hash_idx` ON `crypto_conversions` (`crypto_transaction_hash`);--> statement-breakpoint
CREATE INDEX `currency_pair_idx` ON `exchange_rates` (`from_currency`,`to_currency`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `exchange_rates` (`created_at`);--> statement-breakpoint
CREATE INDEX `remittance_idx` ON `kyc_verifications` (`remittance_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `kyc_verifications` (`status`);--> statement-breakpoint
CREATE INDEX `bvn_idx` ON `kyc_verifications` (`bvn`);--> statement-breakpoint
CREATE INDEX `remittance_idx` ON `remittance_timeline` (`remittance_id`);--> statement-breakpoint
CREATE INDEX `timestamp_idx` ON `remittance_timeline` (`timestamp`);--> statement-breakpoint
CREATE INDEX `remittance_idx` ON `remittance_webhooks` (`remittance_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `remittance_webhooks` (`status`);--> statement-breakpoint
CREATE INDEX `next_retry_idx` ON `remittance_webhooks` (`next_retry_at`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `remittances` (`status`);--> statement-breakpoint
CREATE INDEX `sender_user_idx` ON `remittances` (`sender_user_id`);--> statement-breakpoint
CREATE INDEX `recipient_phone_idx` ON `remittances` (`recipient_phone`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `remittances` (`created_at`);