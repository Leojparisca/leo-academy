CREATE TABLE `lesson_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`level_id` text NOT NULL,
	`status` text DEFAULT 'current' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`best_score` integer DEFAULT 0 NOT NULL,
	`minutes_practiced` integer DEFAULT 0 NOT NULL,
	`last_practiced_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_student_level_unique` ON `lesson_progress` (`student_id`,`level_id`);--> statement-breakpoint
CREATE INDEX `progress_student_idx` ON `lesson_progress` (`student_id`);--> statement-breakpoint
CREATE TABLE `levels` (
	`id` text PRIMARY KEY NOT NULL,
	`ordinal` integer NOT NULL,
	`title` text NOT NULL,
	`subtitle` text NOT NULL,
	`focus` text NOT NULL,
	`minutes` integer NOT NULL,
	`xp` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `levels_ordinal_unique` ON `levels` (`ordinal`);--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`level_id` text,
	`skill` text,
	`minutes` integer DEFAULT 1 NOT NULL,
	`score` integer,
	`source` text DEFAULT 'live' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sessions_student_created_idx` ON `practice_sessions` (`student_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `skill_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`skill` text NOT NULL,
	`score` integer NOT NULL,
	`source` text DEFAULT 'lesson' NOT NULL,
	`created_at` text NOT NULL,
	`synced_from` text DEFAULT 'server' NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scores_student_skill_idx` ON `skill_scores` (`student_id`,`skill`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`first_name` text NOT NULL,
	`initials` text NOT NULL,
	`avatar_tone` text DEFAULT 'sapphire' NOT NULL,
	`current_level` integer DEFAULT 1 NOT NULL,
	`streak_days` integer DEFAULT 0 NOT NULL,
	`total_minutes` integer DEFAULT 0 NOT NULL,
	`accuracy` integer DEFAULT 0 NOT NULL,
	`weekly_minutes` integer DEFAULT 0 NOT NULL,
	`weekly_goal_minutes` integer DEFAULT 90 NOT NULL,
	`joined_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `students_updated_idx` ON `students` (`updated_at`);--> statement-breakpoint
CREATE TABLE `teacher_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`level_id` text NOT NULL,
	`teacher_name` text DEFAULT 'Prof. Leo' NOT NULL,
	`melody` integer NOT NULL,
	`harmony` integer NOT NULL,
	`rhythm` integer NOT NULL,
	`feedback` text NOT NULL,
	`homework` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `evaluations_student_idx` ON `teacher_evaluations` (`student_id`);--> statement-breakpoint
CREATE INDEX `evaluations_created_idx` ON `teacher_evaluations` (`created_at`);--> statement-breakpoint
CREATE TABLE `unlocked_levels` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`level_id` text NOT NULL,
	`unlocked_at` text NOT NULL,
	`unlocked_by` text DEFAULT 'teacher' NOT NULL,
	`note` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unlocked_student_level_unique` ON `unlocked_levels` (`student_id`,`level_id`);--> statement-breakpoint
CREATE INDEX `unlocked_student_idx` ON `unlocked_levels` (`student_id`);