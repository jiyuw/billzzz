CREATE TABLE IF NOT EXISTS `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `categories_name_unique` ON `categories` (`name`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `asset_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`color` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nickname` text NOT NULL,
	`last_four` text NOT NULL,
	`type` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`due_date` integer NOT NULL,
	`payment_link` text,
	`category_id` integer,
	`asset_tag_id` integer,
	`payment_method_id` integer,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurrence_type` text,
	`recurrence_interval` integer,
	`recurrence_unit` text,
	`recurrence_day` integer,
	`is_paid` integer DEFAULT false NOT NULL,
	`is_autopay` integer DEFAULT false NOT NULL,
	`is_variable` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`asset_tag_id`) REFERENCES `asset_tags`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bill_cycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bill_id` integer NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`expected_amount` real NOT NULL,
	`total_paid` real DEFAULT 0 NOT NULL,
	`is_paid` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bill_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bill_id` integer NOT NULL,
	`cycle_id` integer NOT NULL,
	`amount` real NOT NULL,
	`payment_date` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `bill_cycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`theme_preference` text DEFAULT 'system' NOT NULL,
	`expected_income_amount` real,
	`current_balance` real,
	`last_balance_update` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
