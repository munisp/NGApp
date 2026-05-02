ALTER TABLE `participant_applications` ADD `currentStep` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `participant_applications` ADD `lastActivityAt` timestamp DEFAULT (now()) NOT NULL;