CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`commission_id` text NOT NULL,
	`milestone_id` text NOT NULL,
	`submission_id` text,
	`uploader_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`commission_id`) REFERENCES `commissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `commissions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`commissioner_id` text NOT NULL,
	`commissioner_email` text NOT NULL,
	`artist_email` text NOT NULL,
	`artist_id` text,
	`status` text DEFAULT 'invited' NOT NULL,
	`hold_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`commission_id` text NOT NULL,
	`milestone_id` text,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`commission_id`) REFERENCES `commissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`commission_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`deliverable` text NOT NULL,
	`due_date` text NOT NULL,
	`payout_percent` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` text,
	`approved_at` text,
	`paid_at` text,
	`payment_method` text,
	`payment_reference` text,
	FOREIGN KEY (`commission_id`) REFERENCES `commissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`commission_id` text NOT NULL,
	`recipient_id` text,
	`recipient_email` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`commission_id`) REFERENCES `commissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_key_unique` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `showcase_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`commission_id` text NOT NULL,
	`title` text NOT NULL,
	`artist_name` text NOT NULL,
	`location` text NOT NULL,
	`description` text NOT NULL,
	`image_attachment_id` text,
	`published_at` text NOT NULL,
	FOREIGN KEY (`commission_id`) REFERENCES `commissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showcase_entries_commission_id_unique` ON `showcase_entries` (`commission_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`commission_id` text NOT NULL,
	`milestone_id` text NOT NULL,
	`author_id` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`commission_id`) REFERENCES `commissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE no action
);
