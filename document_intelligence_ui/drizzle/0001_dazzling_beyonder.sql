CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` enum('citizenship_identity','immigration_status','income_employment','tribal_aian','employer_health_coverage','household_relationship','other_supporting') NOT NULL,
	`filename` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ocrResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`extractedText` text,
	`confidence` int NOT NULL,
	`selectedEngine` varchar(50),
	`strategy` varchar(50),
	`processingTimeMs` int,
	`extractedData` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ocrResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ocrResults` ADD CONSTRAINT `ocrResults_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE no action ON UPDATE no action;