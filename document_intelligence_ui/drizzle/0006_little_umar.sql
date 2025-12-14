ALTER TABLE `ocrResults` ADD `templateId` int;--> statement-breakpoint
ALTER TABLE `ocrResults` ADD `validationStatus` enum('valid','invalid','partial','not_validated') DEFAULT 'not_validated';--> statement-breakpoint
ALTER TABLE `ocrResults` ADD `validationErrors` text;--> statement-breakpoint
ALTER TABLE `ocrResults` ADD `validatedAt` timestamp;