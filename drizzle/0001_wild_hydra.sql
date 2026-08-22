CREATE TABLE `aiProviderCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(32) NOT NULL,
	`encryptedKey` text NOT NULL,
	`keySuffix` varchar(8) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiProviderCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_provider_credentials_user_provider_unique` UNIQUE(`userId`,`provider`)
);
--> statement-breakpoint
ALTER TABLE `aiProviderCredentials` ADD CONSTRAINT `aiProviderCredentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;