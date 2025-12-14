CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`type` enum('info','success','warning','error','critical') NOT NULL,
	`category` enum('system','ocr_processing','batch_processing','lakehouse','ingestion','security','admin') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`isRead` int NOT NULL DEFAULT 0,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`actionUrl` varchar(512),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
