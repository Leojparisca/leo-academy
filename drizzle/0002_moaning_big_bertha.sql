CREATE TABLE `curriculum_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`node_id` text NOT NULL,
	`branch` text NOT NULL,
	`level` integer NOT NULL,
	`stars` integer DEFAULT 1 NOT NULL,
	`accuracy` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `curriculum_student_node_unique` ON `curriculum_progress` (`student_id`,`node_id`);--> statement-breakpoint
CREATE INDEX `curriculum_student_idx` ON `curriculum_progress` (`student_id`);--> statement-breakpoint
CREATE TABLE `xp_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text DEFAULT 'lesson' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`synced_from` text DEFAULT 'device' NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `xp_student_idx` ON `xp_ledger` (`student_id`);--> statement-breakpoint
CREATE INDEX `xp_created_idx` ON `xp_ledger` (`created_at`);