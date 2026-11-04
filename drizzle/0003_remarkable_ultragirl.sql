CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `live_presence` (
	`student_id` text PRIMARY KEY NOT NULL,
	`tab` text DEFAULT 'mapa' NOT NULL,
	`level_id` text,
	`exercise` text DEFAULT '' NOT NULL,
	`key_label` text,
	`skill` text,
	`melody` integer DEFAULT 0 NOT NULL,
	`harmony` integer DEFAULT 0 NOT NULL,
	`rhythm` integer DEFAULT 0 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`practicing` integer DEFAULT false NOT NULL,
	`last_activity` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `live_presence_seen_idx` ON `live_presence` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `student_access_codes` (
	`student_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_login_at` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_code_unique` ON `student_access_codes` (`code`);