CREATE TABLE `trusted_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceFingerprint` varchar(128) NOT NULL,
	`deviceName` varchar(255),
	`userAgent` text,
	`ipAddress` varchar(45),
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	`trustedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`isActive` enum('true','false') NOT NULL DEFAULT 'true',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trusted_devices_id` PRIMARY KEY(`id`)
);
