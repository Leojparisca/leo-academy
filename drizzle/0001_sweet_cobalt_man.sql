CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`date` text NOT NULL,
	`mode` text DEFAULT 'normal' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_student_date_unique` ON `attendance` (`student_id`,`date`);--> statement-breakpoint
CREATE INDEX `attendance_date_idx` ON `attendance` (`date`);--> statement-breakpoint
ALTER TABLE `students` ADD `age` integer;--> statement-breakpoint
ALTER TABLE `students` ADD `teacher_notes` text;--> statement-breakpoint
ALTER TABLE `teacher_evaluations` ADD `posture` integer DEFAULT 0 NOT NULL;