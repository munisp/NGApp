CREATE TABLE `batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255),
	`totalFiles` int NOT NULL DEFAULT 0,
	`completedFiles` int NOT NULL DEFAULT 0,
	`failedFiles` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` DROP FOREIGN KEY `documents_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `ocrResults` DROP FOREIGN KEY `ocrResults_documentId_documents_id_fk`;
--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `fileSize` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `batchId` int;