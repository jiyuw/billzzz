CREATE TABLE IF NOT EXISTS `rental_payment_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_id` integer NOT NULL,
	`is_notified` integer DEFAULT false NOT NULL,
	`notified_on` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `bill_payments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `__new_bill_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bill_id` integer NOT NULL,
	`cycle_id` integer NOT NULL,
	`amount` real NOT NULL,
	`payment_date` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `bill_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bill_payments` (
	`id`, `bill_id`, `cycle_id`, `amount`, `payment_date`, `notes`, `created_at`, `updated_at`
)
SELECT
	`id`, `bill_id`, `cycle_id`, `amount`, `payment_date`, `notes`, `created_at`, `updated_at`
FROM `bill_payments`;
--> statement-breakpoint
CREATE TABLE `__new_rental_payment_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payment_id` integer NOT NULL,
	`is_notified` integer DEFAULT false NOT NULL,
	`notified_on` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `__new_bill_payments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_rental_payment_notifications` (
	`id`, `payment_id`, `is_notified`, `notified_on`, `created_at`, `updated_at`
)
SELECT
	`id`, `payment_id`, `is_notified`, `notified_on`, `created_at`, `updated_at`
FROM `rental_payment_notifications`;
--> statement-breakpoint
DROP TABLE `rental_payment_notifications`;
--> statement-breakpoint
DROP TABLE `bill_payments`;
--> statement-breakpoint
ALTER TABLE `__new_bill_payments` RENAME TO `bill_payments`;
--> statement-breakpoint
ALTER TABLE `__new_rental_payment_notifications` RENAME TO `rental_payment_notifications`;
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_payment_notifications_payment_id_unique`
	ON `rental_payment_notifications` (`payment_id`);
