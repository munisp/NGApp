ALTER TABLE `users` ADD `twoFactorSecret` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` enum('true','false') DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorBackupCodes` text;