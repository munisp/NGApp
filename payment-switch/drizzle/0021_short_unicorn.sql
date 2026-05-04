CREATE TABLE `saved_comparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`notes` text,
	`executionId1` int NOT NULL,
	`executionId2` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_comparisons_id` PRIMARY KEY(`id`)
);
