-- Drop the debt_rate_buckets table if it exists
DROP TABLE IF EXISTS `debt_rate_buckets`;
--> statement-breakpoint
-- SQLite doesn't support DROP COLUMN, so we need to recreate the table
-- Step 1: Create new debts table without payment_allocation_strategy
CREATE TABLE `debts_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`original_balance` real NOT NULL,
	`current_balance` real NOT NULL,
	`interest_rate` real NOT NULL,
	`minimum_payment` real NOT NULL,
	`linked_bill_id` integer,
	`priority` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`linked_bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- Step 2: Copy existing data
INSERT INTO `debts_new`
SELECT `id`, `name`, `original_balance`, `current_balance`, `interest_rate`,
       `minimum_payment`, `linked_bill_id`, `priority`, `notes`, `created_at`, `updated_at`
FROM `debts`;
--> statement-breakpoint
-- Step 3: Drop old table
DROP TABLE `debts`;
--> statement-breakpoint
-- Step 4: Rename new table
ALTER TABLE `debts_new` RENAME TO `debts`;
