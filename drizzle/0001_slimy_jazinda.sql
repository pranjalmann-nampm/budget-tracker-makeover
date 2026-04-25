CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(64) NOT NULL,
	`icon` varchar(64) NOT NULL,
	`color` varchar(32) NOT NULL,
	`type` enum('income','expense','both') NOT NULL DEFAULT 'expense',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`category` varchar(64) NOT NULL,
	`description` text,
	`merchant` varchar(255),
	`date` bigint NOT NULL,
	`receiptUrl` text,
	`receiptKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`theme` enum('dark','light') NOT NULL DEFAULT 'dark',
	`palette` varchar(32) NOT NULL DEFAULT 'midnight-blue',
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`notificationsEnabled` boolean NOT NULL DEFAULT true,
	`notifyOnLargeExpense` boolean NOT NULL DEFAULT true,
	`largeExpenseThreshold` decimal(12,2) NOT NULL DEFAULT '100.00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
